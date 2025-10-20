// middleware/auth.js - Fixed version
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Admin, Customer } = require('../models'); // Import both models
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is admin or customer based on the role in the token
    if (decoded.role === 'admin') {
      // Verify admin still exists and is active
      const admin = await Admin.findByPk(decoded.id);
      if (!admin) {
        return res.status(401).json({ message: 'Admin account no longer exists' });
      }
    } else if (decoded.role === 'customer') {
      // Verify customer still exists
      const customer = await Customer.findByPk(decoded.id);
      if (!customer) {
        return res.status(401).json({ message: 'Customer account no longer exists' });
      }
    } else {
      return res.status(401).json({ message: 'Invalid user role' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Authentication error' });
  }
};