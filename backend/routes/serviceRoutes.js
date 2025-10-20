const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { Service } = require('../models'); // Add this import

// ==================== PUBLIC ROUTES ====================

// Public route to get all available services (NO AUTH REQUIRED)
router.get('/public/services', async (req, res) => {
  try {
    const services = await Service.findAll({
      where: { Is_Available: true },
      order: [['created_at', 'DESC']],
      attributes: ['ID', 'Name', 'Description', 'Price', 'Duration', 'Category', 'Is_Available', 'Image_URL']
    });
    
    res.json({ 
      success: true,
      services 
    });
  } catch (err) {
    console.error('Public services error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching services' 
    });
  }
});

// ==================== PROTECTED ROUTES (REQUIRE AUTH) ====================

// Protect all routes below this line with auth middleware
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

// Get all services (PROTECTED - requires auth)
router.get('/', serviceController.getServices);

// Get service by ID (PROTECTED - requires auth)
router.get('/:id', serviceController.getServiceById);

// Update service with image upload (PROTECTED - requires auth)
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

// Delete service (PROTECTED - requires auth)
router.delete('/:id', serviceController.deleteService);

// Toggle service availability (PROTECTED - requires auth)
router.patch('/:id/availability', [
  body('isAvailable').isBoolean()
], validate, serviceController.toggleServiceAvailability);

module.exports = router;