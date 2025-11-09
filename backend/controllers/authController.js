// controllers/authController.js - FIXED VERSION
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Validation helper functions
const validateFullName = (name) => /^[A-Za-z\s]{2,100}$/.test(name?.trim());
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
const validatePassword = (password) => password && password.length >= 6;

// Customer Registration
const register = async (req, res) => {
  try {
    const { Full_Name, Email, Password } = req.body;

    // Basic validation
    if (!Full_Name || !Email || !Password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required.'
      });
    }

    if (!validateFullName(Full_Name)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid full name (letters and spaces only, 2-100 characters).'
      });
    }

    if (!validateEmail(Email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!validatePassword(Password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if email already exists
    const existingCustomer = await Customer.findByEmail(Email.toLowerCase().trim());
    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.'
      });
    }

    // Create customer using Firebase model
    const customer = await Customer.create({
      full_name: Full_Name.trim(),
      email: Email.toLowerCase().trim(),
      password: Password
    });

    // Generate token
    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        role: 'customer'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return customer data (without password)
    const customerData = {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone || null,
      address: customer.address || null,
      created_at: customer.created_at
    };

    res.status(201).json({
      success: true,
      message: 'Registered successfully.',
      token,
      role: 'customer',
      user: customerData
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration.'
    });
  }
};

// Login for both Customers and Admins
const login = async (req, res) => {
  try {
    const Email = req.body.Email?.toLowerCase().trim();
    const Password = req.body.Password;

    console.log('🔐 Login attempt for:', Email);

    // Basic validation
    if (!Email || !Password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    if (!validateEmail(Email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    let user = await Customer.findByEmail(Email);
    let role = 'customer';
    let requiresPasswordReset = false;

    // If not a customer, check if it's an admin
    if (!user) {
      user = await Admin.findByEmail(Email);
      role = 'admin';

      // Check if admin requires password reset (first login)
      if (user && user.first_login) {
        requiresPasswordReset = true;
      }
    }

    // Enhanced user not found handling
    if (!user) {
      console.log('❌ User not found:', Email);
      return res.status(404).json({
        success: false,
        message: 'User not found. Please check your email or register for a new account.'
      });
    }

    // Verify password using the model method
    const validPassword = await Customer.validatePassword(Password, user.password);
    if (!validPassword) {
      console.log('❌ Invalid password for:', Email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // If admin requires password reset, return special response
    if (requiresPasswordReset) {
      console.log('🔄 Password reset required for admin:', Email);
      return res.json({
        success: true,
        message: 'Password reset required for first login',
        requiresPasswordReset: true,
        role: 'admin',
        user: {
          email: user.email,
          name: user.name
        }
      });
    }

    // Generate token for successful login
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: role
      },
      JWT_SECRET,
      { expiresIn: role === 'admin' ? '8h' : '7d' }
    );

    // Prepare user data based on role
    const userData = role === 'admin' ? {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      first_login: user.first_login || false
    } : {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || null,
      address: user.address || null,
      created_at: user.created_at
    };

    console.log('✅ Login successful for:', Email, 'Role:', role);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      role,
      user: userData
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
};

// Change Password (for authenticated users)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    let user;

    // Find user based on role
    if (userRole === 'admin') {
      user = await Admin.findById(userId);
    } else {
      user = await Customer.findById(userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify current password using bcryptjs
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Update password - this will be hashed by the model
    if (userRole === 'admin') {
      await Admin.updatePassword(userId, newPassword);
    } else {
      await Customer.updatePassword(userId, newPassword);
    }

    console.log(`✅ Password changed successfully for ${userRole}: ${user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });

  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password. Please try again.'
    });
  }
};

// Verify Token (for checking if token is still valid)
const verifyToken = async (req, res) => {
  try {
    const user = req.user; // From auth middleware

    let userData;
    if (user.role === 'admin') {
      const admin = await Admin.findById(user.id);
      if (admin) {
        userData = {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone || null,
          role: admin.role,
          first_login: admin.first_login || false
        };
      }
    } else {
      const customer = await Customer.findById(user.id);
      if (customer) {
        userData = {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone || null,
          address: customer.address || null,
          created_at: customer.created_at
        };
      }
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({
      success: true,
      user: userData,
      role: user.role
    });

  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying token.'
    });
  }
};

// Forgot Password - Initiate reset
const forgotPassword = async (req, res) => {
  try {
    const { Email } = req.body;

    if (!Email || !validateEmail(Email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Check if user exists (customer or admin)
    let user = await Customer.findByEmail(Email);
    let userType = 'customer';

    if (!user) {
      user = await Admin.findByEmail(Email);
      userType = 'admin';
    }

    // Always return success to prevent email enumeration
    if (!user) {
      console.log('📧 Forgot password request for non-existent email:', Email);
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token (simple implementation)
    const resetToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: userType,
        purpose: 'password_reset',
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`📧 Password reset token generated for ${user.email}`);

    // TODO: Implement email sending in production
    // await sendPasswordResetEmail(user.email, resetToken, userType);

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Remove this in production - only for development
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request. Please try again later.'
    });
  }
};

// Reset Password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required.'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.'
      });
    }

    // Check if token is for password reset
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    let user;

    if (decoded.type === 'admin') {
      user = await Admin.findById(decoded.id);
      if (user) {
        await Admin.updatePassword(user.id, newPassword);
      }
    } else {
      user = await Customer.findById(decoded.id);
      if (user) {
        await Customer.updatePassword(user.id, newPassword);
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    console.log(`✅ Password reset successfully for ${user.email}`);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password.'
    });
  }
};

// Logout (client-side token removal)
const logout = async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // by removing the token from storage
    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout.'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let userData;

    if (userRole === 'admin') {
      const admin = await Admin.findById(userId);
      if (admin) {
        userData = {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone || null,
          role: admin.role,
          first_login: admin.first_login || false,
          created_at: admin.created_at,
          updated_at: admin.updated_at
        };
      }
    } else {
      const customer = await Customer.findById(userId);
      if (customer) {
        userData = {
          id: customer.id,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone || null,
          address: customer.address || null,
          created_at: customer.created_at,
          updated_at: customer.updated_at
        };
      }
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({
      success: true,
      user: userData,
      role: userRole
    });

  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile.'
    });
  }
};

// SINGLE EXPORT AT THE BOTTOM - NO DUPLICATES
module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyToken,
  getProfile,
  logout
};