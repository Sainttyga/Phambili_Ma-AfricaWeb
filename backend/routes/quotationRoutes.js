// routes/quotationRoutes.js
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// Create a quotation
router.post(
  '/',
  auth,
  [
    body('Customer_ID').isInt(),
    body('Service_ID').isInt(),
    body('Date').isDate(),
    body('Amount').isDecimal()
  ],
  validate,
  quotationController.createQuotation
);

// Get all quotations with filtering
router.get('/', auth, quotationController.getQuotations);

// Get quotation by ID
router.get('/:id', auth, quotationController.getQuotationById);

// Update a quotation
router.put(
  '/:id',
  auth,
  [
    body('Customer_ID').optional().isInt(),
    body('Service_ID').optional().isInt(),
    body('Date').optional().isDate(),
    body('Amount').optional().isDecimal(),
    body('Status').optional().isString()
  ],
  validate,
  quotationController.updateQuotation
);

// Update quotation status only
router.put(
  '/:id/status',
  auth,
  [
    body('Status').notEmpty().isString()
  ],
  validate,
  quotationController.updateQuotationStatus
);

// Delete a quotation
router.delete('/:id', auth, quotationController.deleteQuotation);

// Get quotation stats for dashboard
router.get('/admin/stats', auth, quotationController.getQuotationStats);

module.exports = router;