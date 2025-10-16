// adminRoutes.js - Updated and Fixed Version
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const serviceController = require('../controllers/serviceController'); // Add this import
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public route for first login setup
router.post('/first-login', [
  body('Email').isEmail().normalizeEmail(),
  body('TemporaryPassword').isLength({ min: 1 }),
  body('NewPassword').isLength({ min: 8 })
], validate, adminController.firstLoginSetup);

// Protected routes
router.use(auth);

// Password management
router.get('/password-status', adminController.checkPasswordStatus);
router.post('/reset-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], validate, adminController.resetPassword);

// Sub-admin management
router.post('/admins', [
  body('Name').isLength({ min: 2, max: 100 }),
  body('Email').isEmail().normalizeEmail(),
  body('Phone').optional().isLength({ min: 10, max: 15 }),
  body('Role').optional().isIn(['main_admin', 'sub_admin'])
], validate, adminController.createAdmin);

router.get('/admins', adminController.getAllAdmins);
router.get('/admins/:id', adminController.getAdminDetails);
router.put('/admins/:id', adminController.updateAdmin);
router.delete('/admins/:id', adminController.deleteAdmin);

// Dashboard routes
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/analytics', adminController.getBookingAnalytics);

// Management routes
router.get('/bookings', adminController.getAllBookings);
router.post('/bookings', adminController.createBooking);
router.put('/bookings/:id', adminController.updateBooking);
router.delete('/bookings/:id', adminController.deleteBooking);

router.get('/customers', adminController.getAllCustomers);

// ==================== SERVICE MANAGEMENT ROUTES ====================
// Use serviceController for all service routes
router.post('/services',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Service name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
  ],
  validate,
  serviceController.createService  // Fixed: Use serviceController
);

router.get('/services', serviceController.getServices);  // Fixed: Use serviceController

router.get('/services/:id', serviceController.getServiceById);  // Fixed: Use serviceController

router.put('/services/:id',
  upload.single('image'),
  serviceController.updateService  // Fixed: Use serviceController
);

router.delete('/services/:id', serviceController.deleteService);  // Fixed: Use serviceController

router.patch('/services/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, serviceController.toggleServiceAvailability);  // Fixed: Use serviceController
// ==================== END SERVICE ROUTES ====================

// ==================== PRODUCT MANAGEMENT ROUTES ====================
// Use productController for all product routes
router.post('/products', 
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Product name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Stock_Quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive number')
  ],
  validate,
  productController.createProduct
);

router.get('/products', productController.getProducts);

router.get('/products/:id', productController.getProductById);  // Add this route

router.put('/products/:id',
  upload.single('image'),
  productController.updateProduct
);

router.delete('/products/:id', productController.deleteProduct);

router.patch('/products/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, productController.toggleProductAvailability);
// ==================== END PRODUCT ROUTES ====================

// Quotation routes
router.get('/quotations', adminController.getAllQuotations);
router.post('/quotations/:id/respond', adminController.respondToQuotation);
router.get('/quotations/:id', adminController.getQuotationDetails);

// Order routes
router.get('/orders', adminController.getAllOrders);

// Reports
router.get('/reports/booking-summary', adminController.getBookingSummary);
router.get('/reports/revenue', adminController.getRevenueReport);

// System
router.get('/system/health', adminController.getSystemHealth);

// Profile routes
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', adminController.updateAdminProfile);

// Detailed view routes
router.get('/customers/:id', adminController.getCustomerDetails);
router.put('/customers/:id', adminController.updateCustomer);

// Remove duplicate service routes - use the ones above
// router.get('/services/:id', adminController.getServiceDetails); // Remove this duplicate
router.get('/products/:id', adminController.getProductDetails);

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin routes are working!',
    timestamp: new Date().toISOString(),
    user: req.user
  });
});

module.exports = router;