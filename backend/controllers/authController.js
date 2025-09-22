require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Customer, Admin } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

// --- Helper validation functions ---
const validateFullName = (name) => /^[A-Za-z\s]{2,100}$/.test(name.trim());
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const validatePassword = (password) => password.length >= 6; // Minimum 6 chars

exports.register = async (req, res) => {
  const { Full_Name, Email, Password } = req.body;

  // --- Basic presence check ---
  if (!Full_Name || !Email || !Password) {
    return res.status(400).json({ message: 'Full name, email, and password are required.' });
  }

  // --- Input validation ---
  if (!validateFullName(Full_Name)) {
    return res.status(400).json({ message: 'Please provide a valid full name (letters and spaces only).' });
  }

  if (!validateEmail(Email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (!validatePassword(Password)) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    // --- Check if email already exists ---
    const existing = await Customer.findOne({ where: { Email } });
    if (existing) return res.status(409).json({ message: 'Email already registered.' });

    // --- Hash password ---
    const hashedPassword = await bcrypt.hash(Password, 10);

    // --- Create user ---
    const customer = await Customer.create({
      Full_Name: Full_Name.trim(),
      Email: Email.toLowerCase().trim(),
      Password: hashedPassword
    });

    // --- Generate token ---
    const token = jwt.sign(
      { id: customer.ID, Email: customer.Email, role: 'customer' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ message: 'Registered successfully.', token, role: 'customer' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.login = async (req, res) => {
  const Email = req.body.Email?.toLowerCase().trim();
  const Password = req.body.Password;

  if (!Email || !Password) {
    return res.status(400).json({ message: 'Email and password required.' });
  }

  try {
    let user = await Customer.scope('withPassword').findOne({ where: { Email } });
    let role = 'customer';

    if (!user) {
      user = await Admin.scope('withPassword').findOne({ where: { Email } });
      role = 'admin';
    }

    if (!user || !user.Password) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(Password, user.Password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    const token = jwt.sign({ id: user.ID, Email: user.Email, role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
