const Student = require('../models/Student');
const Department = require('../models/Department');

async function generateEnrollmentNumber(yearStr, departmentId) {
  if (!yearStr || !departmentId) {
    throw new Error('Year and department are required');
  }

  // 1. Get department and its 2‑digit code
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw new Error(`Department not found for id: ${departmentId}`);
  }

  const deptCodeMap = {
    'BCA': '01', 'BBA': '02', 'BCOM': '03',
    'MCA': '04', 'MBA': '05', 'MCOM': '06'
  };
  const deptName = dept.name.toUpperCase().replace(/[\s.]/g, '');
  let deptCode = deptCodeMap[deptName];
  if (!deptCode) {
    deptCode = (deptName.substring(0, 2) + '0').toUpperCase();
  }

  // 2. Determine the middle part
  const middlePart = String(yearStr).slice(-2);

  // 3. Build the prefix: YYYY + deptCode + middlePart (total 8 digits)
  const prefix = `${yearStr}${deptCode}${middlePart}`;

  // 4. Find the highest existing enrollment number with this prefix
  const lastStudent = await Student.findOne({
    enrollmentNum: { $regex: `^${prefix}` }
  }).sort({ enrollmentNum: -1 });

  let nextSeq = 1;
  if (lastStudent) {
    const lastNum = lastStudent.enrollmentNum;
    const seqPart = lastNum.slice(-4);
    nextSeq = parseInt(seqPart, 10) + 1;
  }

  // 5. Build the full 12‑digit enrollment number
  let enrollmentNum = `${prefix}${String(nextSeq).padStart(4, '0')}`;

  // 6. Safety check
  const exists = await Student.findOne({ enrollmentNum });
  if (exists) {
    const fallback = await Student.findOne({ enrollmentNum: { $regex: `^${prefix}` } }).sort({ enrollmentNum: -1 });
    const newSeq = fallback ? parseInt(fallback.enrollmentNum.slice(-4), 10) + 1 : nextSeq + 1;
    enrollmentNum = `${prefix}${String(newSeq).padStart(4, '0')}`;
  }

  return enrollmentNum;
}

module.exports = {
  generateEnrollmentNumber
};
