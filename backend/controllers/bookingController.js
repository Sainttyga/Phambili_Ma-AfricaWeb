const { Booking, Customer, Service } = require('../models');
const { Op } = require('sequelize');

// Enhanced booking controller for quotation requests
exports.createBooking = async (req, res) => {
  try {
    const {
      Customer_ID,
      Service_ID,
      Date,
      Time,
      Special_Instructions,
      Duration,
      Status = 'requested',
      // address components (required)
      Address_Street,
      Address_City,
      Address_State,
      Address_Postal_Code,
      // Additional fields for quotation
      Property_Type,
      Property_Size,
      Cleaning_Frequency
    } = req.body;

    // Require authenticated customer
    if (!Customer_ID) {
      return res.status(401).json({ message: 'Please log in to request a quotation.' });
    }

    if (!Service_ID || !Date) {
      return res.status(400).json({ message: 'Service and Date are required.' });
    }

    // Require full address components
    if (!Address_Street || !Address_City || !Address_State || !Address_Postal_Code) {
      return res.status(400).json({
        message: 'Address must include Street, City, State and Postal Code.'
      });
    }

    // Normalize and validate date
    const requestedDateObj = new Date(Date);
    if (isNaN(requestedDateObj)) {
      return res.status(400).json({ message: 'Invalid Date.' });
    }
    const requestedDate = requestedDateObj.toISOString().split('T')[0];

    // Server current date/time
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

    // Same-day quotation rule: if requested is today and server time >= 12 -> reject
    if (requestedDate === today && currentHour >= 12) {
      return res.status(400).json({
        message: 'Same-day quotation requests must be made before 12:00. Please select the next day.'
      });
    }

    // Validate customer exists
    const customer = await Customer.findByPk(Customer_ID);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    // Validate service exists
    const service = await Service.findByPk(Service_ID);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    // Prevent duplicate requests: same customer + service + date
    const duplicate = await Booking.findOne({
      where: {
        Customer_ID,
        Service_ID,
        Date: requestedDate
      }
    });

    if (duplicate) {
      return res.status(409).json({
        message: 'You have already requested a quotation for this service on the selected date.'
      });
    }

    // Build address string from components
    const Address = `${Address_Street.trim()}, ${Address_City.trim()}, ${Address_State.trim()}, ${Address_Postal_Code.trim()}`;

    // Create booking (quotation request) - No Total_Amount
    const booking = await Booking.create({
      Customer_ID,
      Service_ID,
      Date: requestedDate,
      Time: Time || null,
      Address,
      Special_Instructions: Special_Instructions || null,
      Total_Amount: null, // No payment amount
      Duration: Duration || service.Duration || null,
      Status,
      Property_Type: Property_Type || null,
      Property_Size: Property_Size || null,
      Cleaning_Frequency: Cleaning_Frequency || null
    });

    const newBooking = await Booking.findByPk(booking.ID, {
      include: [
        { model: Customer, attributes: ['ID', 'Full_Name', 'Email', 'Phone'] },
        { model: Service, attributes: ['ID', 'Name', 'Description', 'Duration'] }
      ]
    });

    return res.status(201).json({
      message: 'Quotation request submitted successfully. We will contact you shortly.',
      booking: newBooking
    });
  } catch (err) {
    console.error('Create booking error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
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