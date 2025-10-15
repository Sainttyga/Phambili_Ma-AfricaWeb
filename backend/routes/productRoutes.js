const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const productController = require('../controllers/productController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); 

// Protect all routes with auth middleware
router.use(auth);

// Create a product with image upload
router.post(
  '/',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Product name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Stock_Quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive number'),
    body('Category').optional().isLength({ max: 100 }),
    body('Description').optional().isLength({ max: 500 })
  ],
  validate,
  productController.createProduct
);

// Get all products (admin view)
router.get('/', productController.getProducts);

// Get product by ID
router.get('/:id', productController.getProductById);

// Update product with image upload
router.put(
  '/:id',
  upload.single('image'),
  [
    body('Price').optional().isDecimal({ min: 0 }),
    body('Stock_Quantity').optional().isInt({ min: 0 }),
    body('Category').optional().isLength({ max: 100 }),
    body('Description').optional().isLength({ max: 500 })
  ],
  validate,
  productController.updateProduct
);

// Delete product
router.delete('/:id', productController.deleteProduct);

// Toggle product availability
router.patch('/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, productController.toggleProductAvailability);

module.exports = router;