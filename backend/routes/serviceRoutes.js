const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Protect all routes with auth middleware
router.use(auth);

// Create a service with image upload
router.post(
  '/',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
  ],
  validate,
  serviceController.createService
);

// Get all services
router.get('/', serviceController.getServices);

// Get service by ID
router.get('/:id', serviceController.getServiceById);

// Update service with image upload
router.put(
  '/:id',
  upload.single('image'),
  [
    body('Price').optional().isDecimal({ min: 0 }),
    body('Duration').optional().isInt({ min: 1 })
  ],
  validate,
  serviceController.updateService
);

// Delete service
router.delete('/:id', serviceController.deleteService);

// Toggle service availability
router.patch('/:id/availability', [
  body('isAvailable').isBoolean()
], validate, serviceController.toggleServiceAvailability);

module.exports = router;