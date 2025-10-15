const { Booking, Customer, Service } = require('../models');
const { Op } = require('sequelize');

// Enhanced booking controller with admin dashboard support
exports.createBooking = async (req, res) => {
  try {
    const { 
      Customer_ID, 
      Service_ID, 
      Date, 
      Time, 
      Address, 
      Special_Instructions, 
      Total_Amount,
      Duration,
      Status = 'pending'
    } = req.body;

    if (!Customer_ID || !Service_ID || !Date) {
      return res.status(400).json({ message: 'Customer_ID, Service_ID, and Date are required.' });
    }

    const booking = await Booking.create({
      Customer_ID,
      Service_ID,
      Date,
      Time,
      Address,
      Special_Instructions,
      Total_Amount: Total_Amount || 0,
      Duration,
      Status
    });

    // Return the full booking with associations
    const newBooking = await Booking.findByPk(booking.ID, {
      include: [
        { 
          model: Customer, 
          attributes: ['ID', 'Full_Name', 'Email', 'Phone'] 
        },
        { 
          model: Service, 
          attributes: ['ID', 'Name', 'Price', 'Duration'] 
        }
      ]
    });

    res.status(201).json({ 
      success: true,
      message: 'Booking created successfully', 
      booking: newBooking 
    });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
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

    // Return updated booking with associations
    const updatedBooking = await Booking.findByPk(id, {
      include: [
        { 
          model: Customer, 
          attributes: ['ID', 'Full_Name', 'Email', 'Phone'] 
        },
        { 
          model: Service, 
          attributes: ['ID', 'Name', 'Price', 'Duration'] 
        }
      ]
    });

    res.json({ 
      success: true,
      message: 'Booking updated successfully', 
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
          attributes: ['ID', 'Name', 'Price', 'Duration'] 
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
          attributes: ['ID', 'Name', 'Description', 'Price', 'Duration'] 
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
      message: 'Booking deleted successfully' 
    });
  } catch (err) {
    console.error('Delete booking error:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Add these methods to your existing bookingController.js

exports.getBookingStats = async (req, res) => {
  try {
    console.log('📊 Getting booking stats for admin dashboard...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayBookings,
      weeklyRevenue,
      pendingBookings,
      newCustomers,
      totalRevenue
    ] = await Promise.all([
      // Today's bookings
      Booking.count({
        where: {
          Date: today.toISOString().split('T')[0]
        }
      }),

      // Weekly revenue
      Booking.sum('Total_Amount', {
        where: {
          Date: { [Op.gte]: oneWeekAgo },
          Status: { [Op.notIn]: ['cancelled', 'rejected'] }
        }
      }),

      // Pending bookings
      Booking.count({
        where: { Status: 'pending' }
      }),

      // New customers this week
      Customer.count({
        where: {
          createdAt: { [Op.gte]: oneWeekAgo }
        }
      }),

      // Total revenue
      Booking.sum('Total_Amount', {
        where: {
          Status: { [Op.notIn]: ['cancelled', 'rejected'] }
        }
      })
    ]);

    res.json({
      success: true,
      todayBookings: todayBookings || 0,
      weeklyRevenue: weeklyRevenue || 0,
      pendingBookings: pendingBookings || 0,
      newCustomers: newCustomers || 0,
      totalRevenue: totalRevenue || 0,
      totalProducts: 0, // Add if you have products
      totalOrders: 0    // Add if you have orders
    });

  } catch (error) {
    console.error('❌ getBookingStats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
};

exports.getBookingAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    let groupBy, dateFormat;
    
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
        [Booking.sequelize.fn('SUM', Booking.sequelize.col('Total_Amount')), 'revenue']
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
      message: 'Booking status updated successfully', 
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