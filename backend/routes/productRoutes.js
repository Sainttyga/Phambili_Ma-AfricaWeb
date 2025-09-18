const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const productController = require('../controllers/productController');
const validate = require('../middleware/validate'); // optional validation middleware

// Create a product
router.post(
  '/',
  [
    body('Name').notEmpty().withMessage('Name is required'),
    body('Price').isDecimal().withMessage('Price must be a number'),
    body('Stock_Quantity').isInt().withMessage('Stock_Quantity must be an integer')
  ],
  validate,
  productController.createProduct
);

// Get all products
router.get('/', productController.getAllProducts);

// Get product by ID
router.get('/:id', productController.getProductById);

// Update product
router.put(
  '/:id',
  [
    body('Price').optional().isDecimal(),
    body('Stock_Quantity').optional().isInt()
  ],
  validate,
  productController.updateProduct
);

// Delete product
router.delete('/:id', productController.deleteProduct);

module.exports = router;
