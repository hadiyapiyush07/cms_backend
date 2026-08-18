const cron = require('node-cron');
const Assignment = require('../models/Assignment');
const Student = require('../models/Student');
const { sendEmail } = require('./email');

// Run every day at 08:00 AM
const startCronJobs = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('⏳ Running daily assignment reminder cron job...');
    try {
      const today = new Date();
      // Calculate exactly tomorrow's date range
      const tomorrowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const tomorrowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

      // Find assignments due tomorrow
      const assignments = await Assignment.find({
        dueDate: {
          $gte: tomorrowStart,
          $lt: tomorrowEnd
        }
      }).populate('subject', 'name department semester');

      for (let assignment of assignments) {
        if (!assignment.subject) continue;

        const subject = assignment.subject;
        const students = await Student.find({
          department: subject.department,
          semesterID: subject.semester,
          isActive: true
        }).select('email');

        if (students.length > 0) {
          const emails = students.map(s => s.email);
          const emailSubject = `[Campus Flow] Reminder: Assignment Due Tomorrow`;
          const emailHtml = `<h2>Reminder: Assignment Due Tomorrow</h2>
                             <p><strong>Subject:</strong> ${subject.name}</p>
                             <p><strong>Assignment:</strong> ${assignment.title}</p>
                             <p>Your assignment is due tomorrow. Please ensure you submit it on time via the Campus Flow portal.</p>`;
          
          await sendEmail(emails, emailSubject, emailHtml);
          console.log(`✅ Sent reminder for assignment: ${assignment.title} to ${emails.length} students.`);
        }
      }
    } catch (err) {
      console.error('❌ Error in assignment reminder cron job:', err);
    }
  });
  console.log('🚀 Cron jobs initialized');
};

module.exports = { startCronJobs };
