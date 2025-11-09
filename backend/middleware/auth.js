// middleware/auth.js - UPDATED WITH BETTER FIELD HANDLING
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { Admin, Customer } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res, next) => {
  try {
    console.log('🔐 Auth middleware checking...');
    
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No Bearer token provided');
      return res.status(401).json({ 
        success: false,
        message: 'Access token required' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.error('❌ Invalid token format');
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token format' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔐 Auth middleware - Decoded token:', decoded);
    
    // Check if user is admin or customer based on the role in the token
    if (decoded.role === 'admin') {
      // Get admin without field filtering first to see actual structure
      const admin = await Admin.findById(decoded.id);
      
      if (!admin) {
        console.error('❌ Admin not found in database:', decoded.id);
        return res.status(401).json({ 
          success: false,
          message: 'Admin account no longer exists' 
        });
      }

      console.log('🔍 Admin document structure:', admin);

      // Handle different field name cases
      req.user = {
        id: admin.id || admin.ID,
        email: admin.Email || admin.email || decoded.email,
        role: 'admin',
        name: admin.Name || admin.name || 'Admin User'
      };

      console.log(`✅ Admin authenticated: ${req.user.name} (${req.user.email})`);

    } else if (decoded.role === 'customer') {
      // Get customer without field filtering first
      const customer = await Customer.findById(decoded.id);
      
      if (!customer) {
        console.error('❌ Customer not found in database:', decoded.id);
        return res.status(401).json({ 
          success: false,
          message: 'Customer account no longer exists' 
        });
      }

      console.log('🔍 Customer document structure:', customer);

      // Handle different field name cases
      req.user = {
        id: customer.id || customer.ID,
        email: customer.Email || customer.email || decoded.email,
        role: 'customer',
        name: customer.Full_Name || customer.full_name || customer.Name || customer.name || 'Customer'
      };

      console.log(`✅ Customer authenticated: ${req.user.name} (${req.user.email})`);

    } else {
      console.error('❌ Invalid user role in token:', decoded.role);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid user role' 
      });
    }

    next();
  } catch (err) {
    console.error('❌ Auth middleware error:', err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please log in again.' 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Authentication error' 
    });
  }
};