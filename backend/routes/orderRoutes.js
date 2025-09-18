const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const orderController = require('../controllers/orderController');
const validate = require('../middleware/validate');

// Create order
router.post(
  '/',
  [
    body('Customer_ID').isInt(),
    body('Product_ID').isInt(),
    body('Payment_ID').optional().isInt(),
    body('Date').isDate()
  ],
  validate,
  orderController.createOrder
);

// Get all orders
router.get('/', orderController.getOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Update order
router.put(
  '/:id',
  [
    body('Customer_ID').optional().isInt(),
    body('Product_ID').optional().isInt(),
    body('Payment_ID').optional().isInt(),
    body('Date').optional().isDate()
  ],
  validate,
  orderController.updateOrder
);

// Delete order
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
