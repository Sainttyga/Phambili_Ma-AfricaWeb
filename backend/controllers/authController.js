require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Customer, Admin } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;

exports.register = async (req, res) => {
  const { Full_Name, Email, Password } = req.body;
  if (!Full_Name || !Email || !Password) {
    return res.status(400).json({ message: 'All fields required.' });
  }
  try {
    const existing = await Customer.findOne({ where: { Email } });
    if (existing) return res.status(409).json({ message: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(Password, 10);
    const customer = await Customer.create({ Full_Name, Email, Password: hashedPassword });
    const token = jwt.sign({ id: customer.ID, Email: customer.Email, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ message: 'Registered successfully.', token, role: 'customer' });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  const { Email, Password } = req.body;
  if (!Email || !Password) return res.status(400).json({ message: 'Email and password required.' });

  try {
    let user = await Customer.findOne({ where: { Email } });
    let role = 'customer';

    // If not a customer, check admin table
    if (!user) {
      user = await Admin.findOne({ where: { Email } });
      role = 'admin';
    }

    if (!user || !user.Password) return res.status(401).json({ message: 'Invalid credentials.' });

    const valid = await bcrypt.compare(Password, user.Password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.ID, Email: user.Email, role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({ token, role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};