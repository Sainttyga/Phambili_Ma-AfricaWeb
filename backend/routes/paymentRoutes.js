const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const validate = require('../middleware/validate');

// Create payment
router.post(
  '/',
  [
    body('Booking_ID').optional().isInt(),
    body('Date').isDate(),
    body('Amount').isDecimal(),
    body('Method').isString(),
    body('Status').isString()
  ],
  validate,
  paymentController.createPayment
);

// Get all payments
router.get('/', paymentController.getPayments);

// Get payment by ID
router.get('/:id', paymentController.getPaymentById);

// Update payment
router.put(
  '/:id',
  [
    body('Booking_ID').optional().isInt(),
    body('Date').optional().isDate(),
    body('Amount').optional().isDecimal(),
    body('Method').optional().isString(),
    body('Status').optional().isString()
  ],
  validate,
  paymentController.updatePayment
);

// Delete payment
router.delete('/:id', paymentController.deletePayment);

module.exports = router; 
