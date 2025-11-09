const { Booking, Customer, Service } = require('../models');
const bcrypt = require('bcryptjs');

exports.createBooking = async (req, res) => {
  try {
    const {
      customer_id,
      service_id,
      date,
      time,
      address,
      special_instructions,
      duration,
      property_type,
      property_size,
      cleaning_frequency
    } = req.body;

    console.log('📥 CREATE BOOKING REQUEST:', req.body);

    // Basic validation
    if (!customer_id || !service_id || !date || !address) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, Service ID, Date, and Address are required.'
      });
    }

    // Validate customer exists
    const customer = await Customer.findById(customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    // Validate service exists
    const service = await Service.findById(service_id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    // Create booking
    const booking = await Booking.create({
      customer_id,
      service_id,
      date,
      time: time || '09:00',
      address,
      special_instructions,
      duration: duration || service.duration,
      property_type,
      property_size,
      cleaning_frequency,
      status: 'requested'
    });

    console.log('✅ Booking created successfully:', booking.id);

    res.status(201).json({
      success: true,
      message: 'Quotation request submitted successfully!',
      booking
    });

  } catch (error) {
    console.error('💥 CREATE BOOKING ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to process your quotation request.'
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

    console.log('📝 UPDATE BOOKING REQUEST:', {
      id,
      updates,
      timestamp: new Date().toISOString()
    });

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    // Add last_updated timestamp
    updates.last_updated = new Date().toISOString();

    console.log('🔄 UPDATING BOOKING WITH:', updates);

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
      message: 'Booking updated successfully',
      booking: updatedBooking
    });
  } catch (err) {
    console.error('💥 UPDATE BOOKING ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Get all bookings with pagination and filtering
exports.getAllBookings = async (req, res) => {
  try {
    console.log('📖 Getting all bookings...', req.query);
    
    const { 
      limit = 10, 
      status, 
      customer_id, 
      page = 1
    } = req.query;
    
    // Get all bookings from Firestore
    let bookings = await Booking.findAll();
    
    // Apply filters
    if (status && status !== 'all') {
      bookings = bookings.filter(booking => 
        booking.Status === status || booking.status === status
      );
    }
    
    if (customer_id) {
      bookings = bookings.filter(booking => 
        booking.Customer_ID === customer_id || booking.customer_id === customer_id
      );
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
    
    // Enrich with customer and service details
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
          ...booking,
          Customer: customer ? {
            ID: customer.id,
            Full_Name: customer.Full_Name || customer.name,
            Email: customer.Email || customer.email,
            Phone: customer.Phone || customer.phone
          } : null,
          Service: service ? {
            ID: service.id,
            Name: service.Name || service.name,
            Description: service.Description || service.description,
            Duration: service.Duration || service.duration
          } : null
        };
      })
    );
    
    console.log(`✅ Found ${bookings.length} bookings`);
    
    res.json({
      success: true,
      data: enrichedBookings,
      count: enrichedBookings.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: bookings.length
      }
    });
    
  } catch (error) {
    console.error('❌ Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
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
    const { Status, contact_date, consultation_date, admin_notes } = req.body;

    console.log('📝 ADMIN WORKFLOW - Update booking status:', {
      id,
      Status,
      contact_date,
      admin_notes: admin_notes ? 'provided' : 'not provided'
    });

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

    // Prepare update data
    const updateData = {
      Status,
      last_updated: new Date().toISOString()
    };

    // Add timestamps based on status changes
    if (Status === 'contacted') {
      updateData.contact_date = contact_date || new Date().toISOString();
      console.log('📞 Marking as contacted - customer call completed');
    }

    if (Status === 'in_progress' && consultation_date) {
      updateData.consultation_date = consultation_date;
      console.log('🔄 Moving to in progress - consultation scheduled');
    }

    if (Status === 'completed') {
      updateData.completed_date = new Date().toISOString();
      console.log('✅ Marking as completed - service done');
    }

    if (Status === 'cancelled') {
      updateData.cancelled_date = new Date().toISOString();
      console.log('❌ Marking as cancelled');
    }

    // Save admin notes if provided
    if (admin_notes) {
      updateData.admin_notes = admin_notes;
      console.log('📝 Admin notes saved');
    }

    console.log('🔄 Updating booking with:', updateData);

    await booking.update(updateData);

    // Fetch updated booking with relationships
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

    console.log('✅ Booking status updated successfully:', {
      bookingId: id,
      oldStatus: booking.Status,
      newStatus: Status
    });

    res.json({
      success: true,
      message: `Booking ${this.getStatusActionMessage(Status)}`,
      booking: updatedBooking
    });

  } catch (err) {
    console.error('💥 UPDATE BOOKING STATUS ERROR:', {
      message: err.message,
      stack: err.stack,
      params: req.params,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: 'Error updating booking status: ' + err.message
    });
  }
};

exports.markAsContacted = async (req, res) => {
  try {
    const { id } = req.params;
    const { call_notes, next_steps } = req.body;

    console.log('📞 QUICK ACTION - Mark as contacted:', { id, call_notes: call_notes ? 'provided' : 'not provided' });

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    const updateData = {
      Status: 'contacted',
      contact_date: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };

    // Save call notes if provided
    if (call_notes) {
      updateData.call_notes = call_notes;
    }

    if (next_steps) {
      updateData.next_steps = next_steps;
    }

    await booking.update(updateData);

    const updatedBooking = await Booking.findByPk(id, {
      include: [
        {
          model: Customer,
          attributes: ['ID', 'Full_Name', 'Email', 'Phone']
        }
      ]
    });

    console.log('✅ Marked as contacted successfully:', id);

    res.json({
      success: true,
      message: 'Booking marked as contacted. Customer call completed.',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('❌ Mark as contacted error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking as contacted: ' + error.message
    });
  }
};
// Quick action - Move to in progress
exports.moveToInProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { consultation_date, consultation_notes } = req.body;

    console.log('🔄 QUICK ACTION - Move to in progress:', { id });

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    const updateData = {
      Status: 'in_progress',
      last_updated: new Date().toISOString()
    };

    if (consultation_date) {
      updateData.consultation_date = consultation_date;
    }

    if (consultation_notes) {
      updateData.consultation_notes = consultation_notes;
    }

    await booking.update(updateData);

    console.log('✅ Moved to in progress successfully:', id);

    res.json({
      success: true,
      message: 'Booking moved to in progress.',
      booking: await Booking.findByPk(id, {
        include: [{ model: Customer }, { model: Service }]
      })
    });

  } catch (error) {
    console.error('❌ Move to in progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error moving to in progress: ' + error.message
    });
  }
};

// Provide quotation
exports.provideQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { quoted_amount, quote_breakdown, quote_notes } = req.body;

    console.log(`🔄 Providing quote for booking ${id}`);

    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    if (!quoted_amount) {
      return res.status(400).json({
        success: false,
        message: 'Quoted amount is required'
      });
    }

    const bookingRef = db.collection('bookings').doc(id);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const updateData = {
      Status: 'quoted',
      quoted_amount: parseFloat(quoted_amount),
      quote_date: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };

    if (quote_breakdown) updateData.quote_breakdown = quote_breakdown;
    if (quote_notes) updateData.quote_notes = quote_notes;

    await bookingRef.update(updateData);
    const updatedBooking = await bookingRef.get();

    res.json({
      success: true,
      message: 'Quote provided successfully',
      booking: {
        id: updatedBooking.id,
        ...updatedBooking.data()
      }
    });
  } catch (error) {
    console.error('Error providing quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to provide quote',
      error: error.message
    });
  }
};
// Helper method for status messages
exports.getStatusActionMessage = (status) => {
  const messages = {
    'requested': 'quotation request received',
    'contacted': 'marked as contacted - call completed',
    'in_progress': 'moved to in progress',
    'quoted': 'quotation provided',
    'confirmed': 'confirmed by customer',
    'completed': 'marked as completed',
    'cancelled': 'cancelled'
  };
  return messages[status] || 'updated';
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

// Get booking statistics for dashboard
exports.getBookingStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayRequests,
      pendingContact,
      pendingQuotation,
      upcomingBookings,
      totalCompleted
    ] = await Promise.all([
      // Today's quotation requests
      Booking.count({
        where: {
          created_at: { [Op.gte]: today }
        }
      }),

      // Need contact (requested status)
      Booking.count({
        where: { Status: 'requested' }
      }),

      // Need quotation (contacted but not quoted)
      Booking.count({
        where: {
          Status: 'contacted',
          Quoted_Amount: null
        }
      }),

      // Upcoming confirmed bookings
      Booking.count({
        where: {
          Status: 'confirmed',
          Date: { [Op.gte]: today }
        }
      }),

      // Total completed this week
      Booking.count({
        where: {
          Status: 'completed',
          Date: { [Op.gte]: oneWeekAgo }
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        todayRequests,
        pendingContact,
        pendingQuotation,
        upcomingBookings,
        totalCompleted
      }
    });

  } catch (error) {
    console.error('❌ Get booking stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking statistics'
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
    console.log(`📖 Getting booking details for: ${id}`);
    
    const booking = await Booking.findById(id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // Fetch related data
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
    
    const bookingWithDetails = {
      ...booking,
      Customer: customer ? {
        ID: customer.id,
        Full_Name: customer.Full_Name || customer.name,
        Email: customer.Email || customer.email,
        Phone: customer.Phone || customer.phone,
        Address: customer.Address || customer.address
      } : null,
      Service: service ? {
        ID: service.id,
        Name: service.Name || service.name,
        Description: service.Description || service.description,
        Duration: service.Duration || service.duration,
        Category: service.Category || service.category,
        Image_URL: service.Image_URL || service.image_url
      } : null
    };
    
    console.log(`✅ Found booking: ${id}`);
    
    res.json({
      success: true,
      data: bookingWithDetails
    });
    
  } catch (error) {
    console.error('❌ Get booking details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking details',
      error: error.message
    });
  }
};

exports.updateBookingQuote = async (req, res) => {
  try {
    const { id } = req.params;
    const { quotedAmount, status, quote_breakdown, quote_validity_days, quote_notes } = req.body;

    console.log('💰 UPDATE BOOKING QUOTE REQUEST:', {
      id,
      quotedAmount,
      status,
      body: req.body
    });

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const updateData = {
      last_updated: new Date().toISOString()
    };

    if (quotedAmount !== undefined) {
      updateData.Quoted_Amount = parseFloat(quotedAmount);
    }

    if (status) {
      updateData.Status = status;
    }

    if (quote_breakdown !== undefined) {
      updateData.quote_breakdown = quote_breakdown;
    }

    if (quote_validity_days !== undefined) {
      updateData.quote_validity_days = quote_validity_days;
    }

    if (quote_notes !== undefined) {
      updateData.quote_notes = quote_notes;
    }

    if (status === 'quoted') {
      updateData.quoted_date = new Date().toISOString();
    }

    console.log('🔄 UPDATING BOOKING QUOTE WITH:', updateData);

    await booking.update(updateData);

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
      message: 'Booking quote updated successfully',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('❌ UPDATE BOOKING QUOTE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking quote: ' + error.message
    });
  }
};

// Add this method to bookingController.js for updating booking with consultation details
exports.updateBookingWithConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Status,
      contact_date,
      consultation_date,
      consultation_type,
      consultation_notes,
      last_updated
    } = req.body;

    console.log('📞 UPDATE BOOKING CONSULTATION REQUEST:', {
      id,
      Status,
      consultation_type,
      body: req.body
    });

    const booking = await Booking.findByPk(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.'
      });
    }

    // Prepare update data
    const updateData = {
      last_updated: last_updated || new Date().toISOString()
    };

    if (Status) {
      updateData.Status = Status;
    }

    // Add timestamps based on status changes
    if (Status === 'contacted' && contact_date) {
      updateData.contact_date = contact_date;
    }

    if (Status === 'in_progress' && consultation_date) {
      updateData.consultation_date = consultation_date;
      updateData.consultation_type = consultation_type;
      updateData.consultation_notes = consultation_notes;
    }

    if (Status === 'completed') {
      updateData.completed_date = new Date().toISOString();
    }

    if (Status === 'cancelled') {
      updateData.cancelled_date = new Date().toISOString();
    }

    console.log('🔄 UPDATING BOOKING CONSULTATION WITH:', updateData);

    await booking.update(updateData);

    // Fetch updated booking with relationships
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

    console.log('✅ BOOKING CONSULTATION UPDATED SUCCESSFULLY:', {
      bookingId: id,
      newStatus: Status
    });

    res.json({
      success: true,
      message: `Booking updated to ${Status}`,
      booking: updatedBooking
    });

  } catch (err) {
    console.error('💥 UPDATE BOOKING CONSULTATION ERROR:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating booking: ' + err.message
    });
  }
};