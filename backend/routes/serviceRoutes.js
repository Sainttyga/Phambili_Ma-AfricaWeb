// serviceRoutes.js - FIXED VERSION
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { Service } = require('../models');

// ==================== PUBLIC ROUTES ====================
router.get('/public/services', async (req, res) => {
  try {
    const services = await Service.findAll({
      where: { Is_Available: true },
      order: [['created_at', 'DESC']],
      attributes: ['ID', 'Name', 'Description', 'Duration', 'Category', 'Is_Available', 'Image_URL'] // Removed Price
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