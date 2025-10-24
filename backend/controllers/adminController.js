// adminController.js - Complete version with first login
const { Booking, Customer, Service, Feedback, Admin, Product, Order, Payment, sequelize } = require('../models');
const crypto = require('crypto');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// ==================== FIRST LOGIN & PASSWORD MANAGEMENT ====================

exports.firstLoginSetup = async (req, res) => {
  try {
    const { Email, TemporaryPassword, NewPassword } = req.body;

    console.log('First login setup for:', Email);

    // Find admin with temporary password
    const admin = await Admin.scope('withPassword').findOne({
      where: {
        Email,
        First_Login: true
      }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found or password already set'
      });
    }

    // Verify temporary password
    const validTempPassword = await bcrypt.compare(TemporaryPassword, admin.Password);
    if (!validTempPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid temporary password'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(NewPassword, 12);

    // Update admin
    await admin.update({
      Password: hashedPassword,
      First_Login: false,
      Last_Login: new Date()
    });

    // Generate token
    const token = jwt.sign(
      {
        id: admin.ID,
        Email: admin.Email,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const adminData = {
      ID: admin.ID,
      Name: admin.Name,
      Email: admin.Email,
      Phone: admin.Phone,
      Role: admin.Role
    };

    res.json({
      success: true,
      message: 'Password set successfully!',
      token,
      role: 'admin',
      user: adminData
    });

  } catch (error) {
    console.error('First login setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up account'
    });
  }
};

exports.checkPasswordStatus = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.user.id, {
      attributes: ['ID', 'First_Login', 'Email', 'Name']
    });

    if (!admin) {
      return res.status(404).json({
        requiresPasswordReset: false,
        message: 'Admin not found'
      });
    }

    res.json({
      requiresPasswordReset: admin.First_Login || false,
      admin: {
        Name: admin.Name,
        Email: admin.Email
      }
    });

  } catch (error) {
    console.error('Password status check error:', error);
    res.status(500).json({
      requiresPasswordReset: false,
      message: 'Error checking password status'
    });
  }
};


// RSA key validator — ensures provided key is a valid RSA public/private key
function validateRsaKey(key) {
  try {
    const keyObject = crypto.createPublicKey(key);
    return keyObject.asymmetricKeyType === 'rsa';
  } catch {
    return false;
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, rsaKey } = req.body;
    const admin = await Admin.scope('withPassword').findByPk(req.user.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Optional: If you require RSA validation, check it here
    if (rsaKey && !validateRsaKey(rsaKey)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid RSA key provided'
      });
    }

    // Verify current password
    const validCurrent = await bcrypt.compare(currentPassword, admin.Password);
    if (!validCurrent) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Example optional: encrypt the new password using the RSA public key
    // (Only if your system uses RSA encryption for password transmission)
    let passwordToStore = newPassword;
    if (rsaKey) {
      const buffer = Buffer.from(newPassword, 'utf8');
      passwordToStore = crypto.publicEncrypt(rsaKey, buffer).toString('base64');
    }

    // Hash the (possibly RSA-encrypted) password before storing
    const hashedPassword = await bcrypt.hash(passwordToStore, 12);

    // Update admin password
    await admin.update({ Password: hashedPassword });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password'
    });
  }
};

// ==================== ADMIN MANAGEMENT (MAIN_ADMIN ONLY) ====================

// In adminController.js - Fix createAdmin method
exports.createAdmin = async (req, res) => {
  try {
    console.log('🔄 Creating admin...', req.body);

    // Check if current user is main_admin
    const currentAdmin = await Admin.findByPk(req.user.id);
    if (currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can create other admins'
      });
    }

    const { Name, Email, Phone, Role = 'sub_admin' } = req.body;

    // Validate required fields
    if (!Name || !Email) {
      return res.status(400).json({
        success: false,
        message: 'Name and Email are required'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ where: { Email } });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedTempPassword = await bcrypt.hash(temporaryPassword, 12);

    console.log('📝 Creating admin with data:', {
      Name, Email, Phone, Role, hasTempPassword: true
    });

    let newAdmin;
    try {
      newAdmin = await Admin.create({
        Name: Name.trim(),
        Email: Email.toLowerCase().trim(),
        Phone: Phone ? Phone.toString().replace(/[^\d+]/g, '') : null,
        Password: hashedTempPassword,
        First_Login: true,
        Role: Role,
        Created_By: req.user.id
      });
    } catch (createError) {
      console.error('❌ Admin creation validation error:', createError);

      if (createError.name === 'SequelizeValidationError') {
        const messages = createError.errors.map(err => `${err.path}: ${err.message}`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Validation error: ${messages}`
        });
      }
      throw createError;
    }

    console.log(`✅ Admin created successfully. Temporary password for ${Email}: ${temporaryPassword}`);

    // Return the temporary password in the response
    res.status(201).json({
      success: true,
      message: `${Role === 'main_admin' ? 'Main admin' : 'Sub-admin'} created successfully`,
      admin: {
        ID: newAdmin.ID,
        Name: newAdmin.Name,
        Email: newAdmin.Email,
        Role: newAdmin.Role,
        First_Login: newAdmin.First_Login
      },
      temporaryPassword: temporaryPassword, // Send this to the frontend
      instructions: 'Send the temporary password to the admin securely. They will need to set a new password on first login.'
    });

  } catch (error) {
    console.error('❌ Create admin error:', error);

    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => `${err.path}: ${err.message}`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating admin: ' + error.message
    });
  }
};

// Add this helper method to generate secure temporary passwords
exports.generateTemporaryPassword = () => {
  const length = 10;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one of each required character type
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // uppercase
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // lowercase
  password += "0123456789"[Math.floor(Math.random() * 10)]; // number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // special character

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};
// In adminController.js - Fix the getAllAdmins method
exports.getAllAdmins = async (req, res) => {
  try {
    console.log('Getting all admins for user:', req.user.id);

    // Check if current user is main_admin
    const currentAdmin = await Admin.findByPk(req.user.id);
    console.log('Current admin role:', currentAdmin?.Role);

    if (currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can view all admins'
      });
    }

    const admins = await Admin.findAll({
      attributes: {
        exclude: ['Password', 'login_attempts', 'locked_until']
      },
      // FIX: Use the correct database column names
      order: [['Role', 'DESC'], ['created_at', 'DESC']] // main_admins first
    });

    console.log(`Found ${admins.length} admins`);

    res.json({
      success: true,
      admins
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admins: ' + error.message
    });
  }
};

exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if current user is main_admin
    const currentAdmin = await Admin.findByPk(req.user.id);
    if (currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can update other admins'
      });
    }

    // Prevent main admin from modifying their own role
    if (parseInt(id) === currentAdmin.ID && updateData.Role) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }

    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Validate role if being updated
    if (updateData.Role && !['main_admin', 'sub_admin'].includes(updateData.Role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    await admin.update(updateData);

    const updatedAdmin = await Admin.findByPk(id, {
      attributes: { exclude: ['Password'] }
    });

    res.json({
      success: true,
      message: 'Admin updated successfully',
      admin: updatedAdmin
    });

  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating admin'
    });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if current user is main_admin
    const currentAdmin = await Admin.findByPk(req.user.id);
    if (currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can delete admins'
      });
    }

    // Prevent self-deletion
    if (parseInt(id) === currentAdmin.ID) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const admin = await Admin.findByPk(id);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    await admin.destroy();

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting admin'
    });
  }
};

exports.getAdminDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if current user is main_admin
    const currentAdmin = await Admin.findByPk(req.user.id);
    if (currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can view admin details'
      });
    }

    const admin = await Admin.findByPk(id, {
      attributes: { exclude: ['Password'] }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      admin
    });

  } catch (error) {
    console.error('Get admin details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin details'
    });
  }
};


// ==================== DASHBOARD & ANALYTICS ====================

// FIXED: Dashboard stats without Quotation model
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for user:', req.user.id);

    // Get current admin to check role
    const currentAdmin = await Admin.findByPk(req.user.id);
    const isMainAdmin = currentAdmin.Role === 'main_admin';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Base queries that all admins can see
    const baseQueries = [
      // Today's bookings (quotation requests)
      Booking.count({
        where: {
          Date: today.toISOString().split('T')[0]
        }
      }),

      // Pending bookings (pending quotations)
      Booking.count({
        where: { Status: 'requested' }
      }),

      // Completed bookings this week
      Booking.count({
        where: {
          Status: 'completed',
          Date: { [Op.gte]: oneWeekAgo }
        }
      })
    ];

    // Main admin only queries
    const mainAdminQueries = isMainAdmin ? [
      // Weekly revenue from completed bookings
      Booking.sum('Quoted_Amount', {
        where: {
          Status: 'completed',
          Date: { [Op.gte]: oneWeekAgo }
        }
      }),

      // New customers this month
      Customer.count({
        where: {
          createdAt: { [Op.gte]: oneMonthAgo }
        }
      }),

      // Total revenue (all completed bookings)
      Booking.sum('Quoted_Amount', {
        where: {
          Status: 'completed'
        }
      }),

      // Total products
      Product.count(),

      // Total services
      Service.count(),

      // Confirmed bookings (quotations that were accepted)
      Booking.count({
        where: {
          Status: 'confirmed'
        }
      })
    ] : [0, 0, 0, 0, 0, 0];

    const results = await Promise.all([...baseQueries, ...mainAdminQueries]);

    // In getDashboardStats - Update the response to match frontend expectations:
    const response = {
      success: true,
      todayBookings: results[0] || 0,           // Today's quotation requests
      pendingBookings: results[1] || 0,         // Pending quotations
      completedBookings: results[2] || 0        // Completed services this week
    };

    // Add main admin only stats - USE THE FIELD NAMES THE FRONTEND EXPECTS
    if (isMainAdmin) {
      response.totalRevenue = parseFloat(results[5] || 0).toFixed(2);  // Changed from weeklyRevenue
      response.newCustomers = results[4] || 0;
      // Add other expected fields
      response.todayBookings = results[0] || 0;
      response.pendingBookings = results[1] || 0;
    }

    console.log(`📊 Dashboard stats for ${isMainAdmin ? 'Main Admin' : 'Sub Admin'}:`, response);

    res.json(response);
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics: ' + error.message
    });
  }
};

// Also update the getBookingAnalytics function:
exports.getBookingAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let groupBy;
    if (period === 'daily') {
      groupBy = sequelize.fn('DATE', sequelize.col('Date'));
    } else if (period === 'weekly') {
      groupBy = sequelize.fn('YEARWEEK', sequelize.col('Date'));
    } else {
      groupBy = sequelize.fn('DATE_FORMAT', sequelize.col('Date'), '%Y-%m');
    }

    const analytics = await Booking.findAll({
      attributes: [
        [groupBy, 'period'],
        [sequelize.fn('COUNT', sequelize.col('ID')), 'bookings'],
        // FIXED: Use Quoted_Amount instead of Total_Amount
        [sequelize.fn('SUM', sequelize.col('Quoted_Amount')), 'revenue']
      ],
      where: {
        Status: { [Op.ne]: 'cancelled' }
      },
      group: ['period'],
      order: [[groupBy, 'ASC']]
    });

    res.json({
      success: true,
      analytics,
      period
    });
  } catch (error) {
    console.error('Booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking analytics'
    });
  }
};
// ==================== BOOKING MANAGEMENT ====================

exports.getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.Status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { '$Customer.Full_Name$': { [Op.like]: `%${search}%` } },
        { '$Service.Name$': { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone']
        },
        {
          model: Service,
          attributes: ['ID', 'Name']
        }
      ],
      order: [['Date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
};

// Update the createBooking function:
exports.createBooking = async (req, res) => {
  try {
    const {
      customerId,
      serviceId,
      date,
      time,
      duration,
      address,
      specialInstructions,
      amount, // This should be Quoted_Amount
      status = 'pending'
    } = req.body;

    // Validate customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Validate service exists
    const service = await Service.findByPk(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const booking = await Booking.create({
      Customer_ID: customerId,
      Service_ID: serviceId,
      Date: date,
      Time: time,
      Duration: duration,
      Address: address,
      Special_Instructions: specialInstructions,
      Quoted_Amount: amount, // FIXED: Use Quoted_Amount instead of Total_Amount
      Status: status
    });

    const newBooking = await Booking.findByPk(booking.ID, {
      include: [
        { model: Customer },
        { model: Service }
      ]
    });

    res.status(201).json({
      message: 'Booking created successfully',
      booking: newBooking
    });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ message: 'Error creating booking' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (updateData.customerId) {
      const customer = await Customer.findByPk(updateData.customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
    }

    if (updateData.serviceId) {
      const service = await Service.findByPk(updateData.serviceId);
      if (!service) {
        return res.status(404).json({ message: 'Service not found' });
      }
    }

    await booking.update(updateData);

    const updatedBooking = await Booking.findByPk(id, {
      include: [
        { model: Customer },
        { model: Service }
      ]
    });

    res.json({ message: 'Booking updated successfully', booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Error updating booking' });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    await booking.destroy();
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ message: 'Error deleting booking' });
  }
};


// ==================== SERVICE MANAGEMENT ====================

// Add these methods to adminController.js
// Update createService method
exports.createService = async (req, res) => {
  try {
    const { Name, Description, Duration, Category, Is_Available } = req.body;

    if (!Name || !Duration) {
      return res.status(400).json({
        success: false,
        message: 'Name and Duration are required.'
      });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/upload/services/${req.file.filename}`;
    }

    const service = await Service.create({
      Name,
      Description,
      Duration,
      Category,
      Is_Available: Is_Available !== undefined ? Is_Available : true,
      Image_URL: imageUrl
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service
    });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating service: ' + err.message
    });
  }
};

// Update updateService method
exports.updateService = async (req, res) => {
  const { id } = req.params;
  const { Name, Description, Duration, Category, Is_Available } = req.body;

  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    // Handle image upload
    let imageUrl = service.Image_URL;
    if (req.file) {
      // Delete old image if exists
      if (service.Image_URL) {
        const oldImagePath = path.join(__dirname, '..', 'public', service.Image_URL);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/upload/services/${req.file.filename}`;
    }

    await service.update({
      Name: Name || service.Name,
      Description: Description !== undefined ? Description : service.Description,
      Duration: Duration != null ? Duration : service.Duration,
      Category: Category !== undefined ? Category : service.Category,
      Is_Available: Is_Available !== undefined ? Is_Available : service.Is_Available,
      Image_URL: imageUrl
    });

    const updatedService = await Service.findByPk(id);

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating service: ' + err.message
    });
  }
};

exports.deleteService = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    // Delete associated image if exists
    if (service.Image_URL) {
      const imagePath = path.join(__dirname, '..', 'public', service.Image_URL);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await service.destroy();

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting service: ' + err.message
    });
  }
};

exports.toggleServiceAvailability = async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    await service.update({ Is_Available: isAvailable });

    res.json({
      success: true,
      message: `Service ${isAvailable ? 'activated' : 'deactivated'} successfully`,
      service
    });
  } catch (err) {
    console.error('Toggle service availability error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating service availability: ' + err.message
    });
  }
};

exports.getServiceDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    res.json({
      success: true,
      service
    });
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching service: ' + err.message
    });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll({
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      services
    });
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching services: ' + err.message
    });
  }
};

// ==================== CUSTOMER MANAGEMENT ====================

exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { Full_Name: { [Op.like]: `%${search}%` } },
        { Email: { [Op.like]: `%${search}%` } },
        { Phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: customers } = await Customer.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['Password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      customers,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalCustomers: count
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Error fetching customers' });
  }
};

// ==================== PRODUCT MANAGEMENT ====================

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['Name', 'ASC']]
    });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
};

// ==================== ORDER MANAGEMENT ====================

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: Customer, attributes: ['Full_Name', 'Email'] },
        { model: Product, attributes: ['Name', 'Price'] }
      ],
      order: [['Date', 'DESC']]
    });
    res.json({ orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};


// FIXED: Updated Total_Amount to Quoted_Amount
exports.getRevenueReport = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let groupBy;
    if (period === 'daily') {
      groupBy = sequelize.fn('DATE', sequelize.col('Date'));
    } else if (period === 'weekly') {
      groupBy = sequelize.fn('YEARWEEK', sequelize.col('Date'));
    } else {
      groupBy = sequelize.fn('DATE_FORMAT', sequelize.col('Date'), '%Y-%m');
    }

    const revenue = await Booking.findAll({
      where: {
        Status: { [Op.ne]: 'cancelled' }
      },
      attributes: [
        [groupBy, 'period'],
        // FIXED: Use Quoted_Amount instead of Total_Amount
        [sequelize.fn('SUM', sequelize.col('Quoted_Amount')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('ID')), 'bookings']
      ],
      group: ['period'],
      order: [[groupBy, 'DESC']]
    });

    res.json({
      success: true,
      revenue
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating revenue report'
    });
  }
};

// ==================== SYSTEM HEALTH ====================

exports.getSystemHealth = async (req, res) => {
  try {
    const dbStatus = await sequelize.authenticate().then(() => 'healthy').catch(() => 'unhealthy');

    res.json({
      database: dbStatus,
      server: 'healthy',
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ message: 'Error fetching system health' });
  }
};

// ==================== BULK OPERATIONS ====================

exports.sendBulkReminders = async (req, res) => {
  try {
    res.json({
      message: 'Bulk reminders feature would be implemented here',
      sent: 0,
      failed: 0
    });
  } catch (error) {
    console.error('Bulk reminders error:', error);
    res.status(500).json({ message: 'Error sending bulk reminders' });
  }
};

// ==================== PROFILE MANAGEMENT ====================

exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.user.id, {
      attributes: { exclude: ['Password', 'login_attempts', 'locked_until'] }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      admin: {
        ID: admin.ID,
        Name: admin.Name,
        Email: admin.Email,
        Phone: admin.Phone,
        Role: admin.Role,
        First_Login: admin.First_Login,
        Is_Active: admin.Is_Active,
        Last_Login: admin.Last_Login,
        Created_At: admin.created_at,
        Updated_At: admin.updated_at
      }
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin profile'
    });
  }
};

// In adminController.js - FIX the updateAdminProfile method
exports.updateAdminProfile = async (req, res) => {
  try {
    const { Name, Email, Phone } = req.body;
    const adminId = req.user.id;

    console.log('🔄 Updating admin profile:', { Name, Email, Phone, adminId });

    const admin = await Admin.findByPk(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if email is already taken by another admin
    if (Email && Email !== admin.Email) {
      const existingAdmin = await Admin.findOne({
        where: {
          Email,
          ID: { [Op.ne]: adminId }
        }
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another admin'
        });
      }
    }

    // Update admin profile - handle empty phone properly
    const updateData = {};
    if (Name) updateData.Name = Name;
    if (Email) updateData.Email = Email;

    // FIXED: Handle phone properly - set to null if empty string
    if (Phone !== undefined) {
      // Basic phone cleaning - remove any non-digit characters except +
      if (Phone === '' || Phone === null) {
        updateData.Phone = null;
      } else {
        const cleanedPhone = Phone.toString().replace(/[^\d+]/g, '');
        updateData.Phone = cleanedPhone;
      }
    }

    console.log('📝 Update data:', updateData);

    // Use try-catch for the update to catch validation errors
    try {
      await admin.update(updateData);
    } catch (updateError) {
      console.error('❌ Update validation error:', updateError);

      if (updateError.name === 'SequelizeValidationError') {
        const messages = updateError.errors.map(err => `${err.path}: ${err.message}`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Validation error: ${messages}`
        });
      }
      throw updateError;
    }

    // Get updated admin data
    const updatedAdmin = await Admin.findByPk(adminId, {
      attributes: { exclude: ['Password', 'login_attempts', 'locked_until'] }
    });

    console.log('✅ Profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      admin: updatedAdmin
    });

  } catch (error) {
    console.error('❌ Update admin profile error:', error);

    // Handle validation errors specifically
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => `${err.path}: ${err.message}`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${messages}`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating admin profile: ' + error.message
    });
  }
};

// ==================== CUSTOMER DETAILS ====================

exports.getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id, {
      attributes: { exclude: ['Password'] },
      include: [
        {
          model: Booking,
          include: [
            {
              model: Service,
              attributes: ['ID', 'Name', 'Price', 'Duration']
            }
          ],
          order: [['Date', 'DESC']],
          limit: 10
        },
        {
          model: Feedback,
          order: [['createdAt', 'DESC']],
          limit: 10
        }
      ]
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer details'
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if email is already taken by another customer
    if (updateData.Email && updateData.Email !== customer.Email) {
      const existingCustomer = await Customer.findOne({
        where: {
          Email: updateData.Email,
          ID: { [Op.ne]: id }
        }
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another customer'
        });
      }
    }

    await customer.update(updateData);

    const updatedCustomer = await Customer.findByPk(id, {
      attributes: { exclude: ['Password'] }
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updatedCustomer
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer'
    });
  }
};

// ==================== SERVICE DETAILS ====================

exports.getServiceDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id, {
      include: [
        {
          model: Booking,
          include: [
            {
              model: Customer,
              attributes: ['ID', 'Full_Name', 'Email']
            }
          ],
          order: [['Date', 'DESC']],
          limit: 10
        }
      ]
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Get service details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service details'
    });
  }
};

// ==================== PRODUCT DETAILS ====================

exports.getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: Order,
          include: [
            {
              model: Customer,
              attributes: ['ID', 'Full_Name', 'Email']
            }
          ],
          order: [['Date', 'DESC']],
          limit: 10
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details'
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { Name, Description, Price, Stock_Quantity, Category, Is_Available } = req.body;

    if (!Name || !Price) {
      return res.status(400).json({
        success: false,
        message: 'Name and Price are required.'
      });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/upload/products/${req.file.filename}`;
    }

    const product = await Product.create({
      Name,
      Description,
      Price,
      Stock_Quantity: Stock_Quantity || 0,
      Category,
      Is_Available: Is_Available !== undefined ? Is_Available : true,
      Image_URL: imageUrl
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product: ' + error.message
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Handle image update
    if (req.file) {
      updateData.Image_URL = `/upload/products/${req.file.filename}`;
    }

    await product.update(updateData);

    const updatedProduct = await Product.findByPk(id);

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product'
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.destroy();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product'
    });
  }
};
exports.toggleProductAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.update({ Is_Available: isAvailable });

    res.json({
      success: true,
      message: `Product ${isAvailable ? 'activated' : 'deactivated'} successfully`,
      product
    });
  } catch (error) {
    console.error('Toggle product availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product availability'
    });
  }
};

exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching product: ' + err.message
    });
  }
};

// Add to adminController.js - Role checking middleware
exports.checkAdminPermissions = async (req, res, next) => {
  try {
    console.log('🔐 Checking admin permissions for user:', req.user.id);

    const currentAdmin = await Admin.findByPk(req.user.id);

    if (!currentAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Store admin info for use in controllers
    req.admin = currentAdmin;

    // Check if sub-admin is trying to access main-admin only features
    const mainAdminOnlyRoutes = [
      '/api/admin/admins',
      '/api/admin/system',
      '/api/admin/customers', // Add customers to restricted routes
      '/api/admin/dashboard/stats' // Restrict full dashboard stats
    ];

    const isMainAdminRoute = mainAdminOnlyRoutes.some(route =>
      req.path.startsWith(route)
    );

    if (isMainAdminRoute && currentAdmin.Role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Main admin privileges required.'
      });
    }

    console.log(`✅ Admin permissions granted: ${currentAdmin.Name} (${currentAdmin.Role})`);
    next();
  } catch (error) {
    console.error('❌ Admin permission check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking admin permissions'
    });
  }
};

