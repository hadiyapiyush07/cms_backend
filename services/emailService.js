const nodemailer = require('nodemailer');// Library to send emails in Node.js

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,// SMTP server (e.g., smtp.gmail.com)
  port: process.env.EMAIL_PORT,// Port (587 or 465)
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// Function to send OTP email
const sendOtpEmail = async (to, otp) => {

  // Email content configuration
  const mailOptions = {
    from: `"Campus Flow" <${process.env.EMAIL_FROM}>`,
    to,
    subject: 'Password Reset OTP',
     // Plain text version (for basic email clients)
    text: `Your OTP for password reset is: ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Expires in 5 minutes.</p><p> Do not share this OTP with anyone.</p>`,
  };
  await transporter.sendMail(mailOptions);// Send email using transporter
};

module.exports = { sendOtpEmail };// Export function to use in other files (like forgot password)