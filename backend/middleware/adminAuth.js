// middleware/adminAuth.js - Fixed version
const { Admin } = require('../models');

const adminAuth = async (req, res, next) => {
  try {
    console.log('🔐 AdminAuth middleware checking...');
    
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

    // Import JWT and verify
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('📋 Decoded token:', decoded);

    // Check if user is admin
    if (decoded.role !== 'admin') {
      console.error('❌ User is not admin. Role:', decoded.role);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Verify admin exists - use only existing columns
    const admin = await Admin.findByPk(decoded.id, {
      attributes: ['ID', 'Email', 'Name', 'Role'] // Only columns that exist
    });

    if (!admin) {
      console.error('❌ Admin not found in database:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Admin account not found.'
      });
    }

    req.user = {
      id: admin.ID,
      email: admin.Email,
      role: 'admin',
      name: admin.Name
    };

    console.log(`✅ Admin access granted: ${admin.Name} (${admin.Email})`);
    
    next();
  } catch (error) {
    console.error('❌ Admin auth error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please log in again.' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    // Handle database errors
    if (error.name === 'SequelizeDatabaseError') {
      console.error('❌ Database error in adminAuth:', error.message);
      return res.status(500).json({ 
        success: false,
        message: 'Database configuration error. Please contact administrator.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Admin authentication failed' 
    });
  }
};

module.exports = adminAuth;