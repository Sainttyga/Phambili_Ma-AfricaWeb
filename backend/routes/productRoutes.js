// productRoutes.js - FIXED VERSION
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const productController = require('../controllers/productController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// ==================== PUBLIC ROUTES ====================
router.get('/public/products', async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { Is_Available: true },
      order: [['created_at', 'DESC']]
    });
    
    // Convert image URLs to full URLs
    const productsWithFullUrls = products.map(product => {
      const productData = product.toJSON();
      if (productData.Image_URL) {
        productData.Image_URL = `http://localhost:5000${productData.Image_URL}`;
      }
      return productData;
    });
    
    res.json({ 
      success: true,
      products: productsWithFullUrls
    });
  } catch (err) {
    console.error('Public products error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching products' 
    });
  }
});

// ==================== PROTECTED ROUTES ====================
router.use(auth);

router.post(
  '/',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Product name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Stock_Quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive number')
  ],
  validate,
  productController.createProduct
);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', upload.single('image'), productController.updateProduct);
router.delete('/:id', productController.deleteProduct);
router.patch('/:id/availability', [
  body('isAvailable').isBoolean()
], validate, productController.toggleProductAvailability);

module.exports = router;