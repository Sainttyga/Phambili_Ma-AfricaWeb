const express = require('express');
const { body, query } = require('express-validator'); // Added query import
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// ==================== ADMIN ROUTES ====================

// Get booking details (admin)
router.get(
  '/admin/:id',
  auth,
  bookingController.getAdminBookingById
);

// Update booking status (admin)
router.put(
  '/admin/:id/status',
  auth,
  [
    body('Status').notEmpty().isString()
  ],
  validate,
  bookingController.updateBookingStatus
);

// Update booking quote (admin)
router.put(
  '/admin/:id/quote',
  auth,
  [
    body('quotedAmount').isDecimal({ min: 0 }),
    body('status').optional().isString()
  ],
  validate,
  bookingController.updateBookingQuote
);

// Get all bookings with advanced filtering (admin)
router.get(
  '/admin/all',
  auth,
  bookingController.getAllBookings
);

// Get booking statistics for admin dashboard
router.get(
  '/admin/stats',
  auth,
  bookingController.getBookingStats
);

// Get booking analytics for admin dashboard
router.get(
  '/admin/analytics',
  auth,
  bookingController.getBookingAnalytics
);
// Add this route to bookingRoutes.js
router.put(
  '/admin/:id/consultation',
  auth,
  [
    body('Status').optional().isString(),
    body('consultation_type').optional().isString(),
    body('consultation_notes').optional().isString()
  ],
  validate,
  bookingController.updateBookingWithConsultation
);

// ==================== REGULAR ROUTES ====================

// Create a booking
router.post(
  '/',
  auth,
  [
    body('Customer_ID').isInt(),
    body('Service_ID').isInt(),
    body('Date').isDate()
  ],
  validate,
  bookingController.createBooking
);

// Update booking
router.put(
  '/:id',
  auth,
  validate,
  bookingController.updateBooking
);

// Check booking availability before submitting
router.get(
  '/check-availability',
  auth,
  [
    query('Customer_ID').isInt(),
    query('Service_ID').isInt(), 
    query('Date').isDate()
  ],
  validate,
  bookingController.checkBookingAvailability
);

// Get customer's booking history
router.get(
  '/customer/:Customer_ID',
  auth,
  bookingController.getCustomerBookings
);

// Get all bookings (basic)
router.get('/', auth, bookingController.getAllBookings);

// Get booking by ID
router.get('/:id', auth, bookingController.getBookingById);

// Delete booking
router.delete('/:id', auth, bookingController.deleteBooking);

router.get('/test-availability', auth, bookingController.testAvailabilityCheck);
module.exports = router;