const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
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

// Helper: get current semester number
const getCurrentSemesterNumber = async (student) => {
  if (!student.semesterID) return 1;
  const semDoc = await Semester.findById(student.semesterID);
  if (!semDoc) return 1;
  const match = semDoc.semesterName.match(/\d+/);
  return match ? parseInt(match[0]) : 1;
};

// GET fee status
router.get('/status', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findById(req.user._id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const currentSem = await getCurrentSemesterNumber(student);
    const totalSemesters = Math.min(currentSem, 6);

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
      });
    }
    res.json({ success: true, data: semestersData });
  } catch (error) {
    console.error('Fee status error:', error);
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

// ADMIN – GET ALL STUDENTS WITH PER‑SEMESTER PAYMENT STATUS
router.get('/admin/semester-wise', protect, authorize('admin'), async (req, res) => {
  try {
    const { department, semester, search, page = 1, limit = 10 } = req.query;
    
    // Build student query
    let studentQuery = {};
    if (department && department !== 'all') studentQuery.department = department;
    if (semester && semester !== 'all') studentQuery.semesterID = semester;
    if (search) studentQuery.enrollmentNum = { $regex: search, $options: 'i' };

    // Get students
    const students = await Student.find(studentQuery)
      .populate('department', 'name code')
      .populate('semesterID', 'semesterName')
      .select('_id name enrollmentNum email department semesterID');

    if (students.length === 0) {
      return res.json({ success: true, data: [], total: 0, page, pages: 0 });
    }

    // Get fee records for these students
    const studentIds = students.map(s => s._id);
    const fees = await Fee.find({ student: { $in: studentIds } }).lean();

    // Group fees by student
    const feesByStudent = new Map();
    fees.forEach(fee => {
      const studentId = fee.student.toString();
      if (!feesByStudent.has(studentId)) feesByStudent.set(studentId, []);
      feesByStudent.get(studentId).push(fee);
    });

    // Build results with semester details
    const results = [];
    for (const student of students) {
      // Determine current semester number
      let currentSemNumber = 1;
      if (student.semesterID && student.semesterID.semesterName) {
        const match = student.semesterID.semesterName.match(/\d+/);
        if (match) currentSemNumber = parseInt(match[0]);
      }
      const totalSemesters = Math.min(currentSemNumber, 6);

      const studentFees = feesByStudent.get(student._id.toString()) || [];

      // Build a map of semester -> payment info
      const feeMap = new Map();
      studentFees.forEach(fee => {
        feeMap.set(fee.semester, {
          semester: fee.semester,
          paid: fee.paid,
          amount: fee.amount,
          receipt: fee.receipt,
          paidAt: fee.paidAt,
        });
      });

      // Create array for semesters 1..totalSemesters
      const semestersData = [];
      for (let i = 1; i <= totalSemesters; i++) {
        const fee = feeMap.get(i);
        semestersData.push({
          semester: i,
          paid: fee ? fee.paid : false,
          amount: fee ? fee.amount : 100, // default ₹1
          receipt: fee ? fee.receipt : null,
          paidAt: fee ? fee.paidAt : null,
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

    // Paginate results
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const total = results.length;
    const pages = Math.ceil(total / limitNum);
    const paginatedResults = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      data: paginatedResults,
      total,
      page: pageNum,
      pages,
    });
  } catch (error) {
    console.error('Admin semester-wise error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;