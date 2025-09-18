const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const validate = require('../middleware/validate'); // optional validation middleware

// Create a quotation
router.post(
  '/',
  [
    body('Customer_ID').isInt(),
    body('Service_ID').isInt(),
    body('Date').isDate(),
    body('Amount').isDecimal()
  ],
  validate,
  quotationController.createQuotation
);

// Get all quotations
router.get('/', quotationController.getQuotations);

// Get quotation by ID
router.get('/:id', quotationController.getQuotationById);

// Update a quotation
router.put(
  '/:id',
  [
    body('Customer_ID').optional().isInt(),
    body('Service_ID').optional().isInt(),
    body('Date').optional().isDate(),
    body('Amount').optional().isDecimal()
  ],
  validate,
  quotationController.updateQuotation
);

// Delete a quotation
router.delete('/:id', quotationController.deleteQuotation);

module.exports = router;
