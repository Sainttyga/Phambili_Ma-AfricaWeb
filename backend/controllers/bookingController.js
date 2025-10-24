const { Booking, Customer, Service } = require('../models');
const { Op } = require('sequelize');

exports.createBooking = async (req, res) => {
  try {
    console.log('📥 CREATE BOOKING REQUEST RECEIVED:', {
      body: req.body,
      user: req.user,
      timestamp: new Date().toISOString()
    });

    const {
      Customer_ID,
      Service_ID,
      Date: requestedDate,
      Time,
      Special_Instructions,
      Duration,
      Status = 'requested',
      Address_Street,
      Address_City,
      Address_State,
      Address_Postal_Code,
      Property_Type,
      Property_Size,
      Cleaning_Frequency
    } = req.body;

    // ==================== VALIDATION CHECKS ====================
    console.log('🔍 VALIDATING BOOKING DATA...');

    // 1. Authentication check
    if (!Customer_ID) {
      console.log('❌ UNAUTHENTICATED ACCESS ATTEMPT');
      return res.status(401).json({
        success: false,
        message: 'Please log in to request a quotation.'
      });
    }

    // 2. Required fields check
    if (!Service_ID || !requestedDate) {
      console.log('❌ MISSING REQUIRED FIELDS:', { Service_ID, Date: requestedDate });
      return res.status(400).json({
        success: false,
        message: 'Service and Date are required fields.'
      });
    }

    // 3. Address validation
    if (!Address_Street?.trim() || !Address_City?.trim() || !Address_State?.trim() || !Address_Postal_Code?.trim()) {
      console.log('❌ INCOMPLETE ADDRESS PROVIDED');
      return res.status(400).json({
        success: false,
        message: 'Complete address is required including Street, City, State and Postal Code.'
      });
    }

    // ==================== DATE VALIDATION ====================
    console.log('📅 VALIDATING DATE...');

    const requestedDateObj = new Date(requestedDate);
    if (isNaN(requestedDateObj.getTime())) {
      console.log('❌ INVALID DATE FORMAT:', requestedDate);
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format.'
      });
    }

    const normalizedRequestedDate = requestedDateObj.toISOString().split('T')[0];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    console.log('📅 DATE VALIDATION:', {
      requestedDate: normalizedRequestedDate,
      today: today,
      isPastDate: normalizedRequestedDate < today
    });

    // Prevent past dates
    if (normalizedRequestedDate < today) {
      console.log('❌ PAST DATE REJECTED:', normalizedRequestedDate);
      return res.status(400).json({
        success: false,
        message: 'Cannot request quotations for past dates. Please select today or a future date.'
      });
    }

    // ==================== DATABASE VALIDATION ====================
    console.log('🔍 VALIDATING CUSTOMER AND SERVICE...');

    // 4. Validate customer exists
    const customer = await Customer.findByPk(Customer_ID);
    if (!customer) {
      console.log('❌ CUSTOMER NOT FOUND:', Customer_ID);
      return res.status(404).json({
        success: false,
        message: 'Customer account not found. Please contact support.'
      });
    }
    console.log('✅ CUSTOMER VALIDATED:', customer.Full_Name);

    // 5. Validate service exists
    const service = await Service.findByPk(Service_ID);
    if (!service) {
      console.log('❌ SERVICE NOT FOUND:', Service_ID);
      return res.status(404).json({
        success: false,
        message: 'Service not found. Please refresh the page and try again.'
      });
    }

    if (service.Is_Available !== true) {
      console.log('❌ SERVICE UNAVAILABLE:', service.Name);
      return res.status(400).json({
        success: false,
        message: 'This service is currently unavailable. Please choose another service or check back later.'
      });
    }
    console.log('✅ SERVICE VALIDATED:', service.Name);

    // 6. Check for duplicate bookings
    const existingBooking = await Booking.findOne({
      where: {
        Customer_ID,
        Service_ID,
        Date: normalizedRequestedDate,
        Status: {
          [Op.notIn]: ['cancelled', 'rejected']
        }
      }
    });

    if (existingBooking) {
      console.log('❌ DUPLICATE BOOKING ATTEMPT');
      return res.status(409).json({
        success: false,
        message: 'You have already requested a quotation for this service on the selected date. Please choose a different date or service.'
      });
    }
    console.log('✅ NO DUPLICATE BOOKINGS FOUND');

    // ==================== CREATE BOOKING ====================
    console.log('💾 CREATING BOOKING IN DATABASE...');

    // Build formatted address
    const formattedAddress = `${Address_Street.trim()}, ${Address_City.trim()}, ${Address_State.trim()}, ${Address_Postal_Code.trim()}`;

    // Prepare booking data
    const bookingData = {
      Customer_ID: parseInt(Customer_ID),
      Service_ID: parseInt(Service_ID),
      Date: normalizedRequestedDate,
      Time: Time && Time.trim() ? Time.trim() : '09:00',
      Address: formattedAddress,
      Special_Instructions: Special_Instructions?.trim() || null,
      Total_Amount: null,
      Duration: Duration ? parseInt(Duration) : service.Duration,
      Status: Status,
      Property_Type: Property_Type?.trim() || null,
      Property_Size: Property_Size?.trim() || null,
      Cleaning_Frequency: Cleaning_Frequency?.trim() || null
    };

    console.log('📝 BOOKING DATA TO CREATE:', bookingData);

    // Create the booking
    const booking = await Booking.create(bookingData);
    console.log('✅ BOOKING CREATED SUCCESSFULLY - ID:', booking.ID);

    // Fetch the complete booking with relationships
    const newBooking = await Booking.findByPk(booking.ID, {
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone']
        },
        {
          model: Service,
          attributes: ['ID', 'Name', 'Description', 'Duration', 'Category']
        }
      ]
    });

    console.log('🎉 BOOKING COMPLETED SUCCESSFULLY:', {
      bookingId: newBooking.ID,
      customer: newBooking.Customer.Full_Name,
      service: newBooking.Service.Name,
      date: newBooking.Date,
      status: newBooking.Status
    });

    // Success response
    return res.status(201).json({
      success: true,
      message: 'Quotation request submitted successfully! We will contact you within 24 hours.',
      booking: newBooking,
      nextSteps: [
        'Our team will review your request',
        'You will receive a quotation via email',
        'We may contact you for additional details'
      ]
    });

  } catch (err) {
    console.error('💥 CREATE BOOKING ERROR:', {
      message: err.message,
      stack: err.stack,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Handle specific database errors
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        success: false,
        message: 'A booking with these details already exists.'
      });
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer or service reference.'
      });
    }

    if (err.name === 'SequelizeValidationError') {
      const validationErrors = err.errors.map(error => error.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      message: 'Unable to process your quotation request at this time. Please try again later.'
    });
  }
};

// ==================== SUPPORTING FUNCTIONS ====================

exports.checkBookingAvailability = async (req, res) => {
  try {
    console.log('🔍 CHECKING BOOKING AVAILABILITY - START');

    const { Customer_ID, Service_ID, Date: requestedDate } = req.query; // Rename Date to requestedDate

    console.log('📥 Query parameters:', { Customer_ID, Service_ID, requestedDate });

    // Validate required parameters
    if (!Customer_ID || !Service_ID || !requestedDate) {
      console.log('❌ MISSING PARAMETERS');
      return res.status(400).json({
        success: false,
        message: 'Customer ID, Service ID, and Date are required.'
      });
    }

    // Parse and validate date - Use the global Date constructor
    const requestedDateObj = new Date(requestedDate);
    if (isNaN(requestedDateObj.getTime())) {
      console.log('❌ INVALID DATE');
      return res.status(400).json({
        success: false,
        message: 'Invalid date format.'
      });
    }

    const normalizedDate = requestedDateObj.toISOString().split('T')[0];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    console.log('📅 DATE VALIDATION COMPLETE:', {
      normalizedDate,
      today,
      currentHour,
      currentMinutes
    });

    // Initialize response
    let available = true;
    let message = 'Booking available';
    let constraints = [];

    // Check 1: Past dates
    if (normalizedDate < today) {
      available = false;
      message = 'Cannot book for past dates';
      constraints.push('past_date');
      console.log('❌ PAST DATE REJECTED');
    }

    // Check 2: Same-day booking rules
    if (available && normalizedDate === today) {
      const currentTimeTotal = currentHour * 60 + currentMinutes;
      const cutoffTimeTotal = 12 * 60;

      if (currentTimeTotal >= cutoffTimeTotal) {
        available = false;
        message = 'Same-day bookings must be made before 12:00 PM';
        constraints.push('after_12pm_same_day');
        console.log('❌ SAME-DAY AFTER 12PM REJECTED');
      }
    }

    // Check 3: Duplicate bookings (only if not already rejected)
    if (available) {
      try {
        console.log('🔍 CHECKING FOR DUPLICATE BOOKINGS...');

        const existingBooking = await Booking.findOne({
          where: {
            Customer_ID: parseInt(Customer_ID),
            Service_ID: parseInt(Service_ID),
            Date: normalizedDate,
            Status: {
              [Op.notIn]: ['cancelled', 'rejected']
            }
          }
        });

        console.log('🔍 DUPLICATE CHECK RESULT:', existingBooking ? 'Found duplicate' : 'No duplicate');

        if (existingBooking) {
          available = false;
          message = 'You already have a booking for this service on the selected date';
          constraints.push('duplicate_booking');
          console.log('❌ DUPLICATE BOOKING FOUND');
        } else {
          console.log('✅ NO DUPLICATE BOOKINGS FOUND');
        }
      } catch (duplicateError) {
        console.error('💥 DUPLICATE CHECK ERROR:', duplicateError);
        // Don't fail the entire request if duplicate check fails
        console.log('⚠️ Continuing without duplicate check due to error');
      }
    }

    // Final response
    const response = {
      success: true,
      available,
      message,
      constraints,
      date: normalizedDate,
      customerId: Customer_ID,
      serviceId: Service_ID
    };

    console.log('✅ AVAILABILITY CHECK COMPLETE:', response);
    res.json(response);

  } catch (err) {
    console.error('💥 CHECK BOOKING AVAILABILITY ERROR:', {
      message: err.message,
      stack: err.stack,
      query: req.query
    });

    // Return a simple error response
    res.status(500).json({
      success: false,
      message: 'Unable to check availability at this time. Please try again.',
      error: err.message
    });
  }
};

// In bookingController.js
exports.getAdminBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findOne({
      where: { ID: id },
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone']
        },
        {
          model: Service, 
          attributes: ['ID', 'Name', 'Category', 'Duration']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Error fetching admin booking:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching booking details'
    });
  }
};

// Simple test endpoint to debug the availability check
exports.testAvailabilityCheck = async (req, res) => {
  try {
    console.log('🔧 TESTING AVAILABILITY CHECK ENDPOINT');

    const { Customer_ID, Service_ID, Date } = req.query;

    // Just return a simple response without database queries
    const response = {
      success: true,
      available: true,
      message: 'Test endpoint working',
      testData: {
        Customer_ID,
        Service_ID,
        Date,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ TEST ENDPOINT RESPONSE:', response);
    res.json(response);

  } catch (error) {
    console.error('💥 TEST ENDPOINT ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Test failed: ' + error.message
    });
  }
};
/**
 * Get customer's booking history
 */
exports.getCustomerBookings = async (req, res) => {
  try {
    const { Customer_ID } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = { Customer_ID };
    if (status && status !== 'all') {
      whereClause.Status = status;
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Service,
          attributes: ['ID', 'Name', 'Description', 'Duration', 'Category', 'Image_URL']
        }
      ],
      order: [['Date', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });

  } catch (err) {
    console.error('Get customer bookings error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking history'
    });
  }
};

// Update booking
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    await booking.update(updates);

    const updatedBooking = await Booking.findByPk(id, {
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone']
        },
        {
          model: Service,
          attributes: ['ID', 'Name', 'Description', 'Duration']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Quotation request updated successfully',
      booking: updatedBooking
    });
  } catch (err) {
    console.error('Update booking error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get all bookings with pagination and filtering
exports.getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      customerId,
      serviceId
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Status filter
    if (status && status !== 'all') {
      whereClause.Status = status;
    }

    // Customer filter
    if (customerId) {
      whereClause.Customer_ID = customerId;
    }

    // Service filter
    if (serviceId) {
      whereClause.Service_ID = serviceId;
    }

    // Search filter
    if (search) {
      whereClause[Op.or] = [
        { '$Customer.Full_Name$': { [Op.like]: `%${search}%` } },
        { '$Service.Name$': { [Op.like]: `%${search}%` } },
        { Address: { [Op.like]: `%${search}%` } }
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
          attributes: ['ID', 'Name', 'Description', 'Duration']
        }
      ],
      order: [['Date', 'DESC'], ['Time', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      success: true,
      bookings,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone', 'Address']
        },
        {
          model: Service,
          attributes: ['ID', 'Name', 'Description', 'Duration']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Delete booking
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    await booking.destroy();

    res.json({
      success: true,
      message: 'Quotation request deleted successfully'
    });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Update booking status only
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { Status } = req.body;

    if (!Status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    await booking.update({ Status });

    res.json({
      success: true,
      message: 'Quotation status updated successfully',
      booking
    });
  } catch (err) {
    console.error('Update booking status error:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
// Add this function to bookingController.js
exports.getBookingAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    let dateFormat;

    if (period === 'daily') {
      dateFormat = '%Y-%m-%d';
    } else if (period === 'weekly') {
      dateFormat = '%Y-%u';
    } else {
      dateFormat = '%Y-%m';
    }

    const analytics = await Booking.findAll({
      attributes: [
        [Booking.sequelize.fn('DATE_FORMAT', Booking.sequelize.col('Date'), dateFormat), 'period'],
        [Booking.sequelize.fn('COUNT', Booking.sequelize.col('ID')), 'bookings'],
      ],
      where: {
        Status: { [Op.notIn]: ['cancelled', 'rejected'] }
      },
      group: ['period'],
      order: [[Booking.sequelize.literal('period'), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      analytics: analytics || [],
      period
    });

  } catch (error) {
    console.error('❌ getBookingAnalytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics'
    });
  }
};

// Remove analytics and stats related to revenue since no payments
exports.getBookingStats = async (req, res) => {
  try {
    console.log('📊 Getting quotation stats for admin dashboard...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayRequests,
      pendingRequests,
      totalRequests
    ] = await Promise.all([
      // Today's quotation requests
      Booking.count({
        where: {
          Date: today.toISOString().split('T')[0]
        }
      }),

      // Pending quotation requests
      Booking.count({
        where: { Status: 'requested' }
      }),

      // Total quotation requests
      Booking.count()
    ]);

    res.json({
      success: true,
      todayRequests: todayRequests || 0,
      pendingRequests: pendingRequests || 0,
      totalRequests: totalRequests || 0
    });

  } catch (error) {
    console.error('❌ getBookingStats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
};

// Add to bookingController.js

exports.getBookingsAsCards = async (req, res) => {
  try {
    const { status, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.Status = status;
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
          attributes: ['ID', 'Name', 'Description', 'Duration', 'Category', 'Image_URL']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format as cards data
    const bookingCards = bookings.map(booking => ({
      id: booking.ID,
      customer: {
        id: booking.Customer.ID,
        name: booking.Customer.Full_Name,
        email: booking.Customer.Email,
        phone: booking.Customer.Phone
      },
      service: {
        id: booking.Service.ID,
        name: booking.Service.Name,
        description: booking.Service.Description,
        duration: booking.Service.Duration,
        category: booking.Service.Category,
        image: booking.Service.Image_URL
      },
      date: booking.Date,
      time: booking.Time,
      address: booking.Address,
      specialInstructions: booking.Special_Instructions,
      status: booking.Status,
      quotedAmount: booking.Quoted_Amount,
      propertyType: booking.Property_Type,
      propertySize: booking.Property_Size,
      cleaningFrequency: booking.Cleaning_Frequency,
      createdAt: booking.created_at
    }));

    res.json({
      success: true,
      bookings: bookingCards,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalBookings: count
    });
  } catch (error) {
    console.error('Get bookings as cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings'
    });
  }
};

exports.getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone', 'Address']
        },
        {
          model: Service,
          attributes: ['ID', 'Name', 'Description', 'Duration', 'Category', 'Image_URL']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const bookingDetails = {
      id: booking.ID,
      customer: {
        id: booking.Customer.ID,
        name: booking.Customer.Full_Name,
        email: booking.Customer.Email,
        phone: booking.Customer.Phone,
        address: booking.Customer.Address
      },
      service: {
        id: booking.Service.ID,
        name: booking.Service.Name,
        description: booking.Service.Description,
        duration: booking.Service.Duration,
        category: booking.Service.Category,
        image: booking.Service.Image_URL
      },
      date: booking.Date,
      time: booking.Time,
      address: booking.Address,
      specialInstructions: booking.Special_Instructions,
      status: booking.Status,
      quotedAmount: booking.Quoted_Amount,
      propertyType: booking.Property_Type,
      propertySize: booking.Property_Size,
      cleaningFrequency: booking.Cleaning_Frequency,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at
    };

    res.json({
      success: true,
      booking: bookingDetails
    });
  } catch (error) {
    console.error('Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking details'
    });
  }
};

exports.updateBookingQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotedAmount, status } = req.body;

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    await booking.update({
      Quoted_Amount: quotedAmount,
      Status: status || 'quoted'
    });

    res.json({
      success: true,
      message: 'Booking quote updated successfully'
    });
  } catch (error) {
    console.error('Update booking quote error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking quote'
    });
  }
};