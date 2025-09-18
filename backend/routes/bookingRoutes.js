const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

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

// Update booking status
router.put(
  '/:id',
  auth,
  [
    body('Status').notEmpty().isString()
  ],
  validate,
  bookingController.updateBookingStatus
);

// Get all bookings
router.get('/', auth, bookingController.getAllBookings);

// Get booking by ID
router.get('/:id', auth, bookingController.getBookingById);

// Delete booking
router.delete('/:id', auth, bookingController.deleteBooking);


module.exports = router;
