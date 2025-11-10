// authController.js - Fixed with proper error handling
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Customer, Admin } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

// Validation helper functions
const validateFullName = (name) => /^[A-Za-z\s]{2,100}$/.test(name?.trim());
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
const validatePassword = (password) => password && password.length >= 6;

// Customer Registration
exports.register = async (req, res) => {
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
    const existingCustomer = await Customer.findOne({ where: { Email: Email.toLowerCase().trim() } });
    if (existingCustomer) {
      return res.status(409).json({ 
        success: false,
        message: 'Email already registered.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Create customer
    const customer = await Customer.create({
      Full_Name: Full_Name.trim(),
      Email: Email.toLowerCase().trim(),
      Password: hashedPassword
    });

    // Generate token
    const token = jwt.sign(
      { 
        id: customer.ID, 
        email: customer.Email, 
        role: 'customer' 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return customer data (without password)
    const customerData = {
      ID: customer.ID,
      Full_Name: customer.Full_Name,
      Email: customer.Email,
      Phone: customer.Phone || null,
      Address: customer.Address || null,
      Created_At: customer.Created_At || customer.createdAt
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
exports.login = async (req, res) => {
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

    let user = await Customer.scope('withPassword').findOne({ where: { Email } });
    let role = 'customer';
    let requiresPasswordReset = false;

    // If not a customer, check if it's an admin
    if (!user) {
      user = await Admin.scope('withPassword').findOne({ where: { Email } });
      role = 'admin';
      
      // Check if admin requires password reset (first login)
      if (user && user.First_Login) {
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

    // Check if user has a password set
    if (!user.Password) {
      return res.status(401).json({ 
        success: false,
        message: 'Account not properly set up. Please contact administrator.' 
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(Password, user.Password);
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
          Email: user.Email,
          Name: user.Name
        }
      });
    }

    // Generate token for successful login
    const token = jwt.sign(
      { 
        id: user.ID, 
        email: user.Email, 
        role: role 
      },
      JWT_SECRET,
      { expiresIn: role === 'admin' ? '8h' : '7d' }
    );

    // Prepare user data based on role
    const userData = role === 'admin' ? {
      ID: user.ID,
      Name: user.Name,
      Email: user.Email,
      Phone: user.Phone || null,
      Role: user.Role,
      First_Login: user.First_Login || false
    } : {
      ID: user.ID,
      Full_Name: user.Full_Name,
      Email: user.Email,
      Phone: user.Phone || null,
      Address: user.Address || null,
      Created_At: user.Created_At || user.createdAt
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
exports.changePassword = async (req, res) => {
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
      user = await Admin.scope('withPassword').findByPk(userId);
    } else {
      user = await Customer.scope('withPassword').findByPk(userId);
    }

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.Password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect.' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({
      Password: hashedNewPassword,
      ...(userRole === 'admin' && { First_Login: false }) // If admin, mark first login as completed
    });

    console.log(`✅ Password changed successfully for ${userRole}: ${user.Email}`);

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
exports.verifyToken = async (req, res) => {
  try {
    const user = req.user; // From auth middleware

    let userData;
    if (user.role === 'admin') {
      const admin = await Admin.findByPk(user.id, {
        attributes: { exclude: ['Password'] }
      });
      if (admin) {
        userData = {
          ID: admin.ID,
          Name: admin.Name,
          Email: admin.Email,
          Phone: admin.Phone,
          Role: admin.Role,
          First_Login: admin.First_Login
        };
      }
    } else {
      const customer = await Customer.findByPk(user.id, {
        attributes: { exclude: ['Password'] }
      });
      if (customer) {
        userData = {
          ID: customer.ID,
          Full_Name: customer.Full_Name,
          Email: customer.Email,
          Phone: customer.Phone,
          Address: customer.Address,
          Created_At: customer.Created_At
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
exports.forgotPassword = async (req, res) => {
  try {
    const { Email } = req.body;

    if (!Email || !validateEmail(Email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // Check if user exists (customer or admin)
    let user = await Customer.findOne({ where: { Email } });
    let userType = 'customer';

    if (!user) {
      user = await Admin.findOne({ where: { Email } });
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
        id: user.ID, 
        email: user.Email, 
        type: userType,
        purpose: 'password_reset',
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`📧 Password reset token generated for ${user.Email}`);

    // TODO: Implement email sending in production
    // await sendPasswordResetEmail(user.Email, resetToken, userType);

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
exports.resetPassword = async (req, res) => {
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    let user;

    if (decoded.type === 'admin') {
      user = await Admin.findByPk(decoded.id);
    } else {
      user = await Customer.findByPk(decoded.id);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Update password
    await user.update({
      Password: hashedPassword
    });

    console.log(`✅ Password reset successfully for ${user.Email}`);

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
exports.logout = async (req, res) => {
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
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let userData;

    if (userRole === 'admin') {
      const admin = await Admin.findByPk(userId, {
        attributes: { exclude: ['Password'] }
      });
      if (admin) {
        userData = {
          ID: admin.ID,
          Name: admin.Name,
          Email: admin.Email,
          Phone: admin.Phone,
          Role: admin.Role,
          First_Login: admin.First_Login,
          Created_At: admin.createdAt,
          Updated_At: admin.updatedAt
        };
      }
    } else {
      const customer = await Customer.findByPk(userId, {
        attributes: { exclude: ['Password'] }
      });
      if (customer) {
        userData = {
          ID: customer.ID,
          Full_Name: customer.Full_Name,
          Email: customer.Email,
          Phone: customer.Phone,
          Address: customer.Address,
          Created_At: customer.Created_At || customer.createdAt,
          Updated_At: customer.Updated_At || customer.updatedAt
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