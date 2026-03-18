const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (to, otp) => {
  const mailOptions = {
    from: `"Campus Flow" <${process.env.EMAIL_FROM}>`,
    to,
    subject: 'Password Reset OTP',
    text: `Your OTP for password reset is: ${otp}. It will expire in 5 minutes.`,
    html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Expires in 5 minutes.</p><p> Do not share this OTP with anyone.</p>`,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail };