const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');          
const Fee = require('../models/Fee');
const PaymentOrder = require('../models/PaymentOrder');
const Student = require('../models/Student');
const Semester = require('../models/Semester');
const { protect, authorize } = require('../middleware/auth.middleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const SEMESTER_FEE = 100; // ₹1

// GET fee status (student)
router.get('/status', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findById(req.user._id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Determine current semester number safely
    let currentSemNumber = 1;
    if (student.semesterID) {
      try {
        const semDoc = await Semester.findById(student.semesterID);
        if (semDoc && semDoc.semesterName) {
          const match = semDoc.semesterName.match(/\d+/);
          if (match) currentSemNumber = parseInt(match[0]);
        }
      } catch (err) {
        console.warn('Could not fetch semester, defaulting to 1');
      }
    }
    const totalSemesters = Math.min(currentSemNumber, 6);

    const fees = await Fee.find({ student: req.user._id });
    const feeMap = new Map();
    fees.forEach(f => feeMap.set(f.semester, f));

    const semestersData = [];
    for (let i = 1; i <= totalSemesters; i++) {
      const fee = feeMap.get(i);
      semestersData.push({
        semester: i,
        amount: fee ? fee.amount : SEMESTER_FEE,
        paid: fee ? fee.paid : false,
        receipt: fee ? fee.receipt : null,
        paidAt: fee ? fee.paidAt : null,
        _id: fee ? fee._id : null,      // ← added for receipt
      });
    }

    res.json({ success: true, data: semestersData });
  } catch (error) {
    console.error('❌ Fee status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE ORDER
router.post('/create-order', protect, authorize('student'), async (req, res) => {
  try {
    const { semesters } = req.body;
    console.log('📦 [create-order] Received semesters:', JSON.stringify(semesters));
    if (!semesters || !Array.isArray(semesters) || semesters.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one semester' });
    }

    // Validate each semester
    for (const sem of semesters) {
      if (sem < 1 || sem > 6) {
        return res.status(400).json({ success: false, message: `Invalid semester: ${sem}` });
      }
    }

    // Check if any selected semester is already paid
    const paidSemesters = await Fee.find({ student: req.user._id, semester: { $in: semesters }, paid: true });
    if (paidSemesters.length > 0) {
      const alreadyPaid = paidSemesters.map(f => f.semester).join(', ');
      return res.status(400).json({ success: false, message: `Semesters ${alreadyPaid} already paid.` });
    }

    const totalAmount = semesters.length * SEMESTER_FEE;

    const options = {
      amount: totalAmount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    };
    const order = await razorpay.orders.create(options);

    // Delete any existing incomplete payment orders for this student
    await PaymentOrder.deleteMany({ student: req.user._id, paid: false });

    const paymentOrder = new PaymentOrder({
      student: req.user._id,
      orderId: order.id,
      amount: totalAmount,
      semesters: semesters.slice(), // copy to ensure it's an array
      paid: false,
    });
    await paymentOrder.save();

    console.log('✅ [create-order] Payment order saved with semesters:', paymentOrder.semesters);
    res.json({
      success: true,
      orderId: order.id,
      amount: totalAmount,
      key: process.env.RAZORPAY_KEY_ID,
      semesters: paymentOrder.semesters,
    });
  } catch (error) {
    console.error('❌ [create-order] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// VERIFY PAYMENT – marks ALL semesters in the payment order as paid
router.post('/verify-payment', protect, authorize('student'), async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;
    const paymentOrder = await PaymentOrder.findOne({ orderId, student: req.user._id });
    if (!paymentOrder) {
      return res.status(404).json({ success: false, message: 'Payment order not found' });
    }

    console.log('🔍 [verify-payment] Verifying for semesters:', paymentOrder.semesters);

    // Verify signature
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    // Update each semester's fee record
    const updateResults = [];
    for (const sem of paymentOrder.semesters) {
      try {
        let fee = await Fee.findOne({ student: req.user._id, semester: sem });
        if (!fee) {
          fee = new Fee({
            student: req.user._id,
            semester: sem,
            amount: SEMESTER_FEE,
            paid: false,
          });
          console.log(`🆕 Creating new fee record for semester ${sem}`);
        }
        fee.paid = true;
        fee.paymentId = paymentId;
        fee.paidAt = new Date();
        fee.receipt = `receipt_${paymentOrder._id}_${paymentId}_sem${sem}`;
        await fee.save();
        console.log(`✅ Marked semester ${sem} as paid`);
        updateResults.push({ semester: sem, success: true });
      } catch (err) {
        console.error(`❌ Failed to update semester ${sem}:`, err);
        updateResults.push({ semester: sem, success: false, error: err.message });
      }
    }

    const failed = updateResults.filter(r => !r.success);
    if (failed.length > 0) {
      return res.status(207).json({
        success: true,
        message: `Payment verified, but some semesters could not be updated: ${failed.map(f => f.semester).join(', ')}`,
        receipt: paymentOrder.receipt,
      });
    }

    // Update payment order
    paymentOrder.paid = true;
    paymentOrder.paymentId = paymentId;
    paymentOrder.paidAt = new Date();
    paymentOrder.receipt = `receipt_${paymentOrder._id}_${paymentId}`;
    await paymentOrder.save();

    res.json({
      success: true,
      message: `Payment successful for semesters ${paymentOrder.semesters.join(', ')}`,
      receipt: paymentOrder.receipt,
    });
  } catch (error) {
    console.error('❌ [verify-payment] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// ADMIN – GET ALL STUDENTS WITH PER-SEMESTER PAYMENT STATUS (paginated)
router.get('/admin/semester-wise', protect, authorize('admin'), async (req, res) => {
  try {
    const { department, semester, search, page = 1, limit = 10 } = req.query;

    let studentQuery = {};
    if (department && department !== 'all') studentQuery.department = department;
    if (semester && semester !== 'all') studentQuery.semesterID = semester;
    if (search) studentQuery.enrollmentNum = { $regex: search, $options: 'i' };

    const students = await Student.find(studentQuery)
      .populate('department', 'name code')
      .populate('semesterID', 'semesterName')
      .select('_id name enrollmentNum email department semesterID');

    if (students.length === 0) {
      return res.json({ success: true, data: [], total: 0, page: parseInt(page), pages: 0 });
    }

    const studentIds = students.map(s => s._id);
    const fees = await Fee.find({ student: { $in: studentIds } }).lean();

    const feesByStudent = new Map();
    fees.forEach(fee => {
      const sid = fee.student.toString();
      if (!feesByStudent.has(sid)) feesByStudent.set(sid, []);
      feesByStudent.get(sid).push(fee);
    });

    const results = [];
    for (const student of students) {
      let currentSemNumber = 1;
      if (student.semesterID && student.semesterID.semesterName) {
        const match = student.semesterID.semesterName.match(/\d+/);
        if (match) currentSemNumber = parseInt(match[0]);
      }
      const totalSemesters = Math.min(currentSemNumber, 6);

      const studentFees = feesByStudent.get(student._id.toString()) || [];
      const feeMap = new Map();
      studentFees.forEach(fee => {
        feeMap.set(fee.semester, {
          semester: fee.semester,
          paid: fee.paid,
          amount: fee.amount,
          receipt: fee.receipt,
          paidAt: fee.paidAt,
          _id: fee._id,
        });
      });

      const semestersData = [];
      for (let i = 1; i <= totalSemesters; i++) {
        const fee = feeMap.get(i);
        semestersData.push({
          semester: i,
          paid: fee ? fee.paid : false,
          amount: fee ? fee.amount : 100,
          receipt: fee ? fee.receipt : null,
          paidAt: fee ? fee.paidAt : null,
          _id: fee ? fee._id : null,
        });
      }

      results.push({
        _id: student._id,
        enrollmentNum: student.enrollmentNum,
        name: student.name,
        department: student.department,
        currentSemesterName: student.semesterID?.semesterName || 'N/A',
        semesters: semestersData,
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const total = results.length;
    const pages = Math.ceil(total / limitNum);
    const paginatedResults = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ success: true, data: paginatedResults, total, page: pageNum, pages });
  } catch (error) {
    console.error('Admin semester-wise error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ADMIN – GET AGGREGATE FEE SUMMARY FOR ALL MATCHING STUDENTS
// Used by the summary cards and semester progress bars in the frontend
router.get('/admin/summary', protect, authorize('admin'), async (req, res) => {
  try {
    const { department, semester, search } = req.query;

    let studentQuery = {};
    if (department && department !== 'all') studentQuery.department = department;
    if (semester && semester !== 'all') studentQuery.semesterID = semester;
    if (search) studentQuery.enrollmentNum = { $regex: search, $options: 'i' };

    const students = await Student.find(studentQuery)
      .populate('semesterID', 'semesterName')
      .select('_id semesterID');

    if (students.length === 0) {
      return res.json({
        success: true,
        totalStudents: 0,
        totalCollected: 0,
        totalPending: 0,
        semesterWise: Array.from({ length: 6 }, (_, i) => ({
          semester: i + 1, collected: 0, pending: 0,
        })),
      });
    }

    const studentIds = students.map(s => s._id);

    // Build semNumber map
    const semNumberMap = new Map();
    students.forEach(s => {
      let n = 1;
      if (s.semesterID?.semesterName) {
        const m = s.semesterID.semesterName.match(/\d+/);
        if (m) n = Math.min(parseInt(m[0]), 6);
      }
      semNumberMap.set(s._id.toString(), n);
    });

    const fees = await Fee.find({ student: { $in: studentIds } }).lean();

    const feesByStudent = new Map();
    fees.forEach(fee => {
      const sid = fee.student.toString();
      if (!feesByStudent.has(sid)) feesByStudent.set(sid, []);
      feesByStudent.get(sid).push(fee);
    });

    const MAX_SEM = 6;
    let totalCollected = 0;
    let totalPending = 0;
    const semCollected = Array(MAX_SEM).fill(0);
    const semPending = Array(MAX_SEM).fill(0);

    for (const student of students) {
      const sid = student._id.toString();
      const currentSem = semNumberMap.get(sid) || 1;
      const studentFees = feesByStudent.get(sid) || [];

      const feeMap = new Map();
      studentFees.forEach(f => feeMap.set(f.semester, f));

      for (let i = 1; i <= currentSem; i++) {
        const fee = feeMap.get(i);
        const amount = fee ? fee.amount : 100;
        const paid = fee ? fee.paid : false;

        if (paid) {
          totalCollected += amount;
          semCollected[i - 1] += amount;
        } else {
          totalPending += amount;
          semPending[i - 1] += amount;
        }
      }
    }

    const semesterWise = Array.from({ length: MAX_SEM }, (_, i) => ({
      semester: i + 1,
      collected: semCollected[i],
      pending: semPending[i],
    }));

    res.json({
      success: true,
      totalStudents: students.length,
      totalCollected,
      totalPending,
      semesterWise,
    });
  } catch (error) {
    console.error('Admin summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET receipt for a paid fee record
router.get('/receipt/:feeId', async (req, res) => {
  try {
    const { feeId } = req.params;
    const token = req.query.token;
    if (!token) return res.status(401).send('Unauthorized');

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).send('Invalid or expired token');
    }

    const fee = await Fee.findById(feeId)
      .populate('student', 'name enrollmentNum email department semesterID')
      .populate({
        path: 'student',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'semesterID', select: 'semesterName' }
        ]
      });
    if (!fee) return res.status(404).send('Fee record not found');
    if (fee.student._id.toString() !== decoded.id) return res.status(403).send('Not authorized');
    if (!fee.paid) return res.status(400).send('Fee not paid');

    const student = fee.student;
    const amountRupees = (fee.amount / 100).toFixed(2);
    const paidDate = new Date(fee.paidAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const receiptId = fee.receipt || fee._id.toString();

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Fee Receipt</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .receipt { max-width: 700px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0; }
        .receipt-header { background: linear-gradient(135deg, #1e3a8a, #1e40af); color: white; padding: 24px; text-align: center; }
        .receipt-header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .receipt-header p { margin: 8px 0 0; opacity: 0.9; }
        .receipt-body { padding: 24px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px dashed #e2e8f0; }
        .info-label { font-weight: 600; color: #4b5563; }
        .info-value { color: #111827; }
        .payment-details { background: #f9fafb; border-radius: 12px; padding: 16px; margin: 20px 0; }
        .payment-details table { width: 100%; border-collapse: collapse; }
        .payment-details td { padding: 8px 0; }
        .payment-details td:last-child { text-align: right; font-weight: 600; }
        .total { font-size: 18px; font-weight: 700; border-top: 2px solid #e2e8f0; margin-top: 12px; padding-top: 12px; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #6b7280; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        button { background: #1e40af; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 16px; }
        button:hover { background: #1e3a8a; }
        @media print { body { background: white; padding: 0; } .receipt { box-shadow: none; border: none; } button { display: none; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-header">
          <h1>CAMPUS FLOW</h1>
          <p>Official Fee Receipt</p>
        </div>
        <div class="receipt-body">
          <div class="info-row"><span class="info-label">Receipt No.</span><span class="info-value">${receiptId}</span></div>
          <div class="info-row"><span class="info-label">Date</span><span class="info-value">${paidDate}</span></div>
          <div class="info-row"><span class="info-label">Student Name</span><span class="info-value">${student.name}</span></div>
          <div class="info-row"><span class="info-label">Enrollment No.</span><span class="info-value">${student.enrollmentNum}</span></div>
          <div class="info-row"><span class="info-label">Department</span><span class="info-value">${student.department?.name || 'N/A'}</span></div>
          <div class="info-row"><span class="info-label">Current Semester</span><span class="info-value">${student.semesterID?.semesterName || 'N/A'}</span></div>
          <div class="payment-details">
            <table>
              <tr><td>Semester ${fee.semester} Fee</td><td>₹${amountRupees}</td> </tr>
             </table>
            <div class="total"><div style="display: flex; justify-content: space-between;"><span>Total Paid</span><span>₹${amountRupees}</span></div></div>
          </div>
          <div class="footer">
            <p>This is a computer-generated receipt. No signature required.</p>
            <p>Thank you for using Campus Flow.</p>
          </div>
        </div>
        <div style="text-align: center; padding: 0 24px 24px;"><button onclick="window.print()">Print / Save as PDF</button></div>
      </div>
    </body>
    </html>`;
    res.send(html);
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(500).send('Server error');
  }
});

module.exports = router;