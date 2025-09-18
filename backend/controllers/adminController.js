require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET;

// In-memory OTP store for development
let otpStore = {};

// Step 1: Send OTP
exports.sendOTP = async (req, res) => {
  const { Email } = req.body;
  if (!Email) return res.status(400).json({ message: 'Email is required.' });

  if (Email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ message: 'Unauthorized email.' });
  }

  try {
    let admin = await Admin.findOne({ where: { Email } });
    if (!admin) admin = await Admin.create({ Name: 'Admin', Email, Password: null });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[admin.ID] = otp;

    // Email transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: Email,
      subject: 'Your Admin OTP',
      text: `Your OTP is: ${otp}`
    });

    console.log(`OTP sent to ${Email}: ${otp}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

    res.json({ message: 'OTP sent successfully.', adminId: admin.ID });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Step 2: Verify OTP and set password
exports.verifyOTPAndSetPassword = async (req, res) => {
  const { Admin_ID, OTP, Password } = req.body;
  if (!Admin_ID || !OTP || !Password) return res.status(400).json({ message: 'All fields are required.' });

  const savedOtp = otpStore[Admin_ID];
  if (!savedOtp || savedOtp !== OTP) return res.status(400).json({ message: 'Invalid or expired OTP.' });

  try {
    const admin = await Admin.findByPk(Admin_ID);
    const hashedPassword = await bcrypt.hash(Password, 10);
    admin.Password = hashedPassword;
    await admin.save();
    delete otpStore[Admin_ID];
    res.json({ message: 'Password set successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Step 3: Normal login
exports.login = async (req, res) => {
  const { Email, Password } = req.body;
  if (!Email || !Password) return res.status(400).json({ message: 'Email and password required.' });

  try {
    const admin = await Admin.findOne({ where: { Email } });
    if (!admin || !admin.Password) return res.status(401).json({ message: 'Invalid credentials or password not set yet.' });

    const valid = await bcrypt.compare(Password, admin.Password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ id: admin.ID, Email: admin.Email, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role: 'admin' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
