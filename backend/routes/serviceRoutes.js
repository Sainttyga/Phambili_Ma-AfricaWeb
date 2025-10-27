// serviceRoutes.js - FIXED VERSION
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const { upload } = require('../middleware/upload'); // Destructure the upload instance
const { Service } = require('../models');

// ==================== PUBLIC ROUTES ====================
// Get ALL services (public - no auth required) - including unavailable ones
router.get('/public/services', async (req, res) => {
  try {
    console.log('📋 Fetching ALL public services (including unavailable)...');

    const services = await Service.findAll({
      order: [['Name', 'ASC']],
      attributes: [
        'ID',
        'Name',
        'Description',
        'Duration',
        'Category',
        'Is_Available',
        'Image_URL',
        'created_at'
      ]
    });

    console.log(`✅ Found ${services.length} total services`);
    console.log(`📊 Available: ${services.filter(s => s.Is_Available).length}, Unavailable: ${services.filter(s => !s.Is_Available).length}`);

    res.json({
      success: true,
      services: services.map(service => ({
        ID: service.ID,
        Name: service.Name,
        Description: service.Description,
        Duration: service.Duration,
        Category: service.Category,
        Is_Available: service.Is_Available,
        Image_URL: service.Image_URL,
        Created_At: service.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching public services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services'
    });
  }
});

// Get single service details (public)
router.get('/public/services/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByPk(id, {
      attributes: [
        'ID',
        'Name',
        'Description',
        'Duration',
        'Category',
        'Is_Available',
        'Image_URL',
        'created_at'
      ]
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service: {
        ID: service.ID,
        Name: service.Name,
        Description: service.Description,
        Duration: service.Duration,
        Category: service.Category,
        Is_Available: service.Is_Available,
        Image_URL: service.Image_URL,
        Created_At: service.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching service details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service details'
    });
  }
});

// ==================== PROTECTED ROUTES ====================
router.use(auth);

router.post(
  '/',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Name is required'),
    body('Duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
  ],
  validate,
  serviceController.createService
);

router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById);
router.put('/:id', upload.single('image'), serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.patch('/:id/availability', [
  body('isAvailable').isBoolean()
], validate, serviceController.toggleServiceAvailability);

module.exports = router;