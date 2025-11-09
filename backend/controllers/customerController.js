// backend/controllers/customerController.js - Fixed version
const { Customer } = require('../models');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
  try {
    console.log('GET /api/customer/profile called for user:', req.user.id);
    
    const customer = await Customer.findByPk(req.user.id, {
      attributes: { exclude: ['Password'] }
    });
    
    if (!customer) {
      console.log('Customer not found for ID:', req.user.id);
      return res.status(404).json({ message: 'Customer not found.' });
    }
    
    console.log('Customer found:', customer.Full_Name);
    res.json(customer);
  } catch (err) {
    console.error('Error in getProfile:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { Full_Name, Email, Phone, Address, City, State, ZipCode } = req.body;
  
  try {
    console.log('PUT /api/customer/profile called for user:', req.user.id);
    console.log('Update data:', req.body);
    
    const customer = await Customer.findByPk(req.user.id);
    if (!customer) {
      console.log('Customer not found for update');
      return res.status(404).json({ message: 'Customer not found.' });
    }
    
    // Update all allowed fields
    if (Full_Name !== undefined) customer.Full_Name = Full_Name;
    if (Email !== undefined) customer.Email = Email;
    if (Phone !== undefined) customer.Phone = Phone;
    if (Address !== undefined) customer.Address = Address;
    if (City !== undefined) customer.City = City;
    if (State !== undefined) customer.State = State;
    if (ZipCode !== undefined) customer.ZipCode = ZipCode;
    
    await customer.save();
    console.log('Customer updated successfully');
    
    // Return updated customer without password
    const updatedCustomer = await Customer.findByPk(req.user.id, {
      attributes: { exclude: ['Password'] }
    });
    
    res.json({ message: 'Profile updated successfully.', customer: updatedCustomer });
  } catch (err) {
    console.error('Error in updateProfile:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    console.log('PUT /api/customer/change-password called for user:', req.user.id);
    console.log('Request body:', req.body);

    // Input validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required.' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 6 characters long.' 
      });
    }

    // Find user with password included
    const customer = await Customer.findByPk(req.user.id);
    if (!customer) {
      return res.status(404).json({ 
        success: false,
        message: 'Customer not found.' 
      });
    }

    // Debug: Check if customer has a password
    console.log('Customer password exists:', !!customer.Password);
    console.log('Customer password length:', customer.Password?.length);

    // Check if customer has a password set (for users who might not have one)
    if (!customer.Password) {
      return res.status(400).json({ 
        success: false,
        message: 'No password set for this account. Please use password reset instead.' 
      });
    }

    // Verify current password with proper error handling
    let isPasswordValid;
    try {
      isPasswordValid = await bcrypt.compare(currentPassword, customer.Password);
    } catch (bcryptError) {
      console.error('Bcrypt compare error:', bcryptError);
      return res.status(400).json({ 
        success: false,
        message: 'Error verifying current password. The password format may be invalid.' 
      });
    }

    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect.' 
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    customer.Password = hashedPassword;
    await customer.save();

    console.log('Password changed successfully for user:', req.user.id);

    res.json({ 
      success: true,
      message: 'Password changed successfully.' 
    });

  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to change password. Please try again.' 
    });
  }
};