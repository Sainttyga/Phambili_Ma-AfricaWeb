// controllers/adminController.js - FIXED DUPLICATE DECLARATIONS
const { Admin, Customer, Booking, Service, Product } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== FIRST LOGIN & PASSWORD MANAGEMENT ====================

exports.firstLoginSetup = async (req, res) => {
  try {
    const { Email, TemporaryPassword, NewPassword } = req.body;

    console.log('🔄 First login setup for:', Email);

    // Find admin with temporary password
    const admin = await Admin.findByEmail(Email);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if admin requires first login
    if (!admin.first_login) {
      return res.status(400).json({
        success: false,
        message: 'Password already set. Please use regular login.'
      });
    }

    // Verify temporary password
    const validTempPassword = await bcrypt.compare(TemporaryPassword, admin.password);
    if (!validTempPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid temporary password'
      });
    }

    // Update admin with new password
    const hashedNewPassword = await bcrypt.hash(NewPassword, 12);
    await Admin.update(admin.id, {
      password: hashedNewPassword,
      first_login: false,
      last_login: new Date()
    });

    // Get updated admin
    const updatedAdmin = await Admin.findById(admin.id);

    // Generate new token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const adminData = Admin.excludeSensitiveFields(updatedAdmin);

    console.log('✅ First login setup successful for:', Email);

    res.json({
      success: true,
      message: 'Password set successfully!',
      token,
      role: 'admin',
      user: adminData
    });

  } catch (error) {
    console.error('❌ First login setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting up account: ' + error.message
    });
  }
};

// ==================== ADMIN MANAGEMENT ====================

exports.createAdmin = async (req, res) => {
  try {
    console.log('🔄 Creating admin...', req.body);

    // Check if current user is main_admin
    const currentAdmin = await Admin.findById(req.user.id);
    if (currentAdmin.role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can create other admins'
      });
    }

    const { name, email, phone, role = 'sub_admin' } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and Email are required'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findByEmail(email);
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();

    // Create admin
    const admin = await Admin.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.toString().replace(/[^\d+]/g, '') : null,
      password: temporaryPassword,
      first_login: true,
      role: role,
      created_by: req.user.id
    });

    console.log('✅ Main admin created successfully!');

    res.status(201).json({
      success: true,
      message: `${role === 'main_admin' ? 'Main admin' : 'Sub-admin'} created successfully`,
      admin: Admin.excludeSensitiveFields(admin),
      temporaryPassword: temporaryPassword,
      instructions: 'Send the temporary password to the admin securely. They will need to set a new password on first login.'
    });

  } catch (error) {
    console.error('❌ Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating admin: ' + error.message
    });
  }
};

exports.getAllAdmins = async (req, res) => {
  try {
    console.log('Getting all admins for user:', req.user.id);

    // Check if current user is main_admin
    const currentAdmin = await Admin.findById(req.user.id);
    if (currentAdmin.role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can view all admins'
      });
    }

    const admins = await Admin.findAll();
    const safeAdmins = admins.map(admin => Admin.excludeSensitiveFields(admin));

    console.log(`Found ${admins.length} admins`);

    res.json({
      success: true,
      admins: safeAdmins
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admins: ' + error.message
    });
  }
};

// ==================== DASHBOARD & ANALYTICS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for user:', req.user.id);

    // Get current admin to check role
    const currentAdmin = await Admin.findById(req.user.id);
    const isMainAdmin = currentAdmin.role === 'main_admin';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all bookings and filter in memory
    const allBookings = await Booking.findAll();
    const allCustomers = await Customer.findAll();

    // Filter bookings for today
    const todayBookings = allBookings.filter(booking => {
      const bookingDate = new Date(booking.Date || booking.date);
      return bookingDate.toDateString() === today.toDateString();
    });

    // Filter pending bookings
    const pendingBookings = allBookings.filter(booking => 
      booking.Status === 'requested' || booking.status === 'requested'
    );

    // Filter completed bookings this week
    const completedBookings = allBookings.filter(booking => {
      const bookingDate = new Date(booking.Date || booking.date);
      return (booking.Status === 'completed' || booking.status === 'completed') && 
             bookingDate >= oneWeekAgo;
    });

    const response = {
      success: true,
      todayBookings: todayBookings.length,
      pendingBookings: pendingBookings.length,
      completedBookings: completedBookings.length
    };

    // Add main admin only stats
    if (isMainAdmin) {
      // Calculate total revenue from completed bookings
      const totalRevenue = completedBookings.reduce((sum, booking) => {
        return sum + (parseFloat(booking.Quoted_Amount) || parseFloat(booking.quoted_amount) || 0);
      }, 0);
      
      response.totalRevenue = totalRevenue.toFixed(2);
      response.newCustomers = allCustomers.length;
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

// Helper method for generating temporary passwords
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

// ==================== PROFILE MANAGEMENT ====================

// In adminController.js - Fix getAdminProfile
exports.getAdminProfile = async (req, res) => {
  try {
    console.log('🔄 Getting admin profile for user:', req.user?.id);

    // FIXED: Add validation for user ID
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    const safeAdmin = Admin.excludeSensitiveFields(admin);

    console.log('✅ Admin profile fetched successfully');

    res.json({
      success: true,
      admin: {
        ID: admin.id,
        Name: admin.name,
        Email: admin.email,
        Phone: admin.phone,
        Role: admin.role,
        First_Login: admin.first_login,
        Is_Active: admin.is_active,
        Last_Login: admin.last_login,
        Created_At: admin.created_at,
        Updated_At: admin.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Get admin profile error:', error);
    
    // Handle invalid document path errors
    if (error.message.includes('documentPath') && error.message.includes('non-empty string')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error fetching admin profile: ' + error.message
    });
  }
};

exports.updateAdminProfile = async (req, res) => {
  try {
    const { Name, Email, Phone } = req.body;
    const adminId = req.user.id;

    console.log('🔄 Updating admin profile:', { Name, Email, Phone, adminId });

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if email is already taken by another admin
    if (Email && Email !== admin.email) {
      const existingAdmin = await Admin.findByEmail(Email);
      if (existingAdmin && existingAdmin.id !== adminId) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another admin'
        });
      }
    }

    // Update admin profile
    const updateData = {};
    if (Name) updateData.name = Name;
    if (Email) updateData.email = Email;

    // Handle phone properly
    if (Phone !== undefined) {
      if (Phone === '' || Phone === null) {
        updateData.phone = null;
      } else {
        const cleanedPhone = Phone.toString().replace(/[^\d+]/g, '');
        updateData.phone = cleanedPhone;
      }
    }

    console.log('📝 Update data:', updateData);

    await Admin.update(adminId, updateData);

    // Get updated admin data
    const updatedAdmin = await Admin.findById(adminId);

    console.log('✅ Profile updated successfully');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      admin: Admin.excludeSensitiveFields(updatedAdmin)
    });

  } catch (error) {
    console.error('❌ Update admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating admin profile: ' + error.message
    });
  }
};

// ==================== CUSTOMER MANAGEMENT ====================

exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    // Get all customers and filter in memory
    let customers = await Customer.findAll();

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(customer => 
        (customer.Full_Name && customer.Full_Name.toLowerCase().includes(searchLower)) ||
        (customer.Email && customer.Email.toLowerCase().includes(searchLower)) ||
        (customer.Phone && customer.Phone.includes(search))
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedCustomers = customers.slice(startIndex, endIndex);

    // Remove sensitive data
    const safeCustomers = paginatedCustomers.map(customer => {
      const { password, ...safeCustomer } = customer;
      return safeCustomer;
    });

    res.json({
      success: true,
      customers: safeCustomers,
      totalPages: Math.ceil(customers.length / limit),
      currentPage: parseInt(page),
      totalCustomers: customers.length
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers: ' + error.message
    });
  }
};

exports.getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's bookings
    const customerBookings = await Booking.findAll({ Customer_ID: id });

    const customerWithBookings = {
      ...customer,
      bookings: customerBookings
    };

    // Remove password
    delete customerWithBookings.password;

    res.json({
      success: true,
      customer: customerWithBookings
    });
  } catch (error) {
    console.error('Get customer details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer details: ' + error.message
    });
  }
};

// ==================== SERVICE MANAGEMENT ====================

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.findAll();

    // Map to frontend expected format while keeping model integrity
    const formattedServices = services.map(service => ({
      ID: service.id,
      id: service.id,
      Name: service.name,
      name: service.name,
      Description: service.description,
      description: service.description,
      Duration: service.duration,
      duration: service.duration,
      Category: service.category,
      category: service.category,
      Is_Available: service.is_available,
      is_available: service.is_available,
      Image_URL: service.image_url,
      image_url: service.image_url,
      Created_At: service.created_at,
      Updated_At: service.updated_at
    }));

    res.json({
      success: true,
      services: formattedServices
    });
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching services: ' + err.message
    });
  }
};

exports.getServiceDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findById(id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    // Format for frontend
    const formattedService = {
      ID: service.id,
      id: service.id,
      Name: service.name,
      name: service.name,
      Description: service.description,
      description: service.description,
      Duration: service.duration,
      duration: service.duration,
      Category: service.category,
      category: service.category,
      Is_Available: service.is_available,
      is_available: service.is_available,
      Image_URL: service.image_url,
      image_url: service.image_url,
      Created_At: service.created_at,
      Updated_At: service.updated_at
    };

    res.json({
      success: true,
      service: formattedService
    });
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching service: ' + err.message
    });
  }
};

// ==================== PRODUCT MANAGEMENT ====================

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll();

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

exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    
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

// ==================== BOOKING MANAGEMENT ====================

exports.getAllBookingsForAdmin = async (req, res) => {
  try {
    const { limit = 10, page = 1, status, search } = req.query;

    console.log('📋 Fetching bookings for admin workflow:', { status, search });

    // Get all bookings and filter in memory
    let bookings = await Booking.findAll();

    // Apply status filter
    if (status && status !== 'all') {
      bookings = bookings.filter(booking => 
        booking.Status === status || booking.status === status
      );
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      
      // Get all customers for search
      const allCustomers = await Customer.findAll();
      const customerMap = new Map();
      allCustomers.forEach(customer => {
        customerMap.set(customer.id, customer);
      });

      // Get all services for search
      const allServices = await Service.findAll();
      const serviceMap = new Map();
      allServices.forEach(service => {
        serviceMap.set(service.id, service);
      });

      bookings = bookings.filter(booking => {
        const customer = customerMap.get(booking.Customer_ID);
        const service = serviceMap.get(booking.Service_ID);
        
        return (
          (customer && customer.Full_Name && customer.Full_Name.toLowerCase().includes(searchLower)) ||
          (service && service.Name && service.Name.toLowerCase().includes(searchLower)) ||
          (booking.Address && booking.Address.toLowerCase().includes(searchLower)) ||
          (booking.address && booking.address.toLowerCase().includes(searchLower))
        );
      });
    }

    // Sort by date (newest first)
    bookings.sort((a, b) => {
      const dateA = new Date(a.Date || a.date || a.created_at);
      const dateB = new Date(b.Date || b.date || b.created_at);
      return dateB - dateA;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedBookings = bookings.slice(startIndex, endIndex);

    // Enrich bookings with customer and service details
    const enrichedBookings = await Promise.all(
      paginatedBookings.map(async (booking) => {
        let customer = null;
        let service = null;

        if (booking.Customer_ID) {
          try {
            customer = await Customer.findById(booking.Customer_ID);
          } catch (error) {
            console.error(`Error fetching customer ${booking.Customer_ID}:`, error);
          }
        }

        if (booking.Service_ID) {
          try {
            service = await Service.findById(booking.Service_ID);
          } catch (error) {
            console.error(`Error fetching service ${booking.Service_ID}:`, error);
          }
        }

        return {
          ID: booking.id,
          Customer_ID: booking.Customer_ID,
          Service_ID: booking.Service_ID,
          Date: booking.Date || booking.date,
          Time: booking.Time || booking.time,
          Duration: booking.Duration || booking.duration,
          Address: booking.Address || booking.address,
          Special_Instructions: booking.Special_Instructions || booking.special_instructions,
          Status: booking.Status || booking.status,
          Quoted_Amount: booking.Quoted_Amount || booking.quoted_amount,
          contact_date: booking.contact_date,
          consultation_date: booking.consultation_date,
          completed_date: booking.completed_date,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
          Customer: customer ? {
            ID: customer.id,
            Full_Name: customer.Full_Name || customer.name,
            Email: customer.Email || customer.email,
            Phone: customer.Phone || customer.phone
          } : null,
          Service: service ? {
            ID: service.id,
            Name: service.Name || service.name,
            Category: service.Category || service.category,
            Duration: service.Duration || service.duration
          } : null
        };
      })
    );

    res.json({
      success: true,
      bookings: enrichedBookings,
      totalPages: Math.ceil(bookings.length / limit),
      currentPage: parseInt(page),
      totalBookings: bookings.length
    });

  } catch (error) {
    console.error('❌ Get bookings for admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings: ' + error.message
    });
  }
};

// ==================== ADMIN PERMISSIONS ====================

// In adminController.js - Fix the checkAdminPermissions method
exports.checkAdminPermissions = async (req, res, next) => {
  try {
    console.log('🔐 Checking admin permissions for user:', req.user?.id);

    // FIXED: Add proper validation for req.user
    if (!req.user || !req.user.id) {
      console.error('❌ No user ID in request');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const currentAdmin = await Admin.findById(req.user.id);

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
      '/api/admin/customers',
      '/api/admin/dashboard/stats'
    ];

    const isMainAdminRoute = mainAdminOnlyRoutes.some(route =>
      req.path.startsWith(route)
    );

    if (isMainAdminRoute && currentAdmin.role !== 'main_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Main admin privileges required.'
      });
    }

    console.log(`✅ Admin permissions granted: ${currentAdmin.name} (${currentAdmin.role})`);
    next();
  } catch (error) {
    console.error('❌ Admin permission check error:', error);
    
    // Handle Firestore document path errors specifically
    if (error.message.includes('documentPath') && error.message.includes('non-empty string')) {
      console.error('❌ Invalid user ID format:', req.user?.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error checking admin permissions'
    });
  }
};
exports.checkPasswordStatus = async (req, res) => {
  try {
    const adminId = req.admin.ID || req.admin.id;
    
    console.log('🔐 Checking password status for admin:', adminId);

    // Get admin from database using your existing Admin model methods
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if password reset is required
    // Use the correct field names from your Admin model
    const requiresPasswordReset = admin.first_login || admin.Password_Reset_Required || false;
    
    // Optionally check if password is too old (e.g., > 90 days)
    const lastPasswordChange = admin.Last_Password_Change || admin.last_password_change || admin.updated_at;
    const isPasswordExpired = lastPasswordChange ? 
      (new Date() - new Date(lastPasswordChange)) > (90 * 24 * 60 * 60 * 1000) : false;

    console.log('✅ Password status check:', { 
      requiresPasswordReset, 
      lastPasswordChange, 
      isPasswordExpired 
    });

    return res.json({
      success: true,
      requiresPasswordReset: requiresPasswordReset || isPasswordExpired,
      lastPasswordChange: lastPasswordChange,
      isPasswordExpired: isPasswordExpired
    });

  } catch (error) {
    console.error('❌ Error checking password status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while checking password status'
    });
  }
};
// ==================== SERVICE MANAGEMENT ====================

exports.createService = async (req, res) => {
  try {
    console.log('🔄 Creating new service...');
    console.log('📝 Request body:', req.body);
    console.log('📸 File:', req.file);

    const { name, description, duration, category, is_available = true } = req.body;

    // Validate required fields
    if (!name || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Service name and duration are required'
      });
    }

    // Handle image upload
    let image_url = null;
    if (req.file) {
      image_url = `/uploads/services/${req.file.filename}`;
      console.log('📸 Image uploaded:', image_url);
    }

    // Create service data - using model field names
    const serviceData = {
      name: name.trim(),
      description: description?.trim() || '',
      duration: parseInt(duration),
      category: category?.trim() || 'General',
      is_available: is_available === 'true' || is_available === true,
      image_url: image_url,
      created_by: req.admin.id
    };

    console.log('📦 Service data to create:', serviceData);

    // Create service in database
    const service = await Service.create(serviceData);

    console.log('✅ Service created successfully:', service.id);

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service: service
    });

  } catch (error) {
    console.error('❌ Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating service: ' + error.message
    });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔄 Updating service:', id);
    console.log('📝 Update data:', req.body);

    // Check if service exists
    const existingService = await Service.findById(id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    const { name, description, duration, category, is_available } = req.body;

    // Prepare update data - using model field names
    const updateData = {};

    // Only update fields that are provided
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (category !== undefined) updateData.category = category.trim();
    
    // Handle boolean conversion properly
    if (is_available !== undefined) {
      updateData.is_available = is_available === 'true' || is_available === true || is_available === '1';
    }

    // Handle image upload
    if (req.file) {
      updateData.image_url = `/uploads/services/${req.file.filename}`;
      console.log('📸 New image uploaded:', updateData.image_url);
    }

    console.log('📦 Final update data:', updateData);

    // Use the proper update method
    await Service.update(id, updateData);

    // Get updated service
    const updatedService = await Service.findById(id);

    console.log('✅ Service updated successfully');

    res.json({
      success: true,
      message: 'Service updated successfully',
      service: updatedService
    });

  } catch (error) {
    console.error('❌ Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating service: ' + error.message
    });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting service:', id);

    // Check if service exists
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Delete service
    await Service.delete(id);

    console.log('✅ Service deleted successfully');

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting service: ' + error.message
    });
  }
};

// Toggle service availability
exports.toggleServiceAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_available } = req.body;

    console.log(`🔄 Toggling service ${id} availability to:`, is_available);

    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Service ID is required and cannot be undefined'
      });
    }

    // Validate is_available is boolean
    if (typeof is_available !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_available must be a boolean value'
      });
    }

    // Check if service exists
    const existingService = await Service.findById(id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Update availability using model method
    await Service.updateAvailability(id, is_available);

    // Get updated service
    const updatedService = await Service.findById(id);

    res.json({
      success: true,
      message: `Service ${is_available ? 'enabled' : 'disabled'} successfully`,
      service: updatedService
    });
  } catch (error) {
    console.error('Error toggling service availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service availability',
      error: error.message
    });
  }
};