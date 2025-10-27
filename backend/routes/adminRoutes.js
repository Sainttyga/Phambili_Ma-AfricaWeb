// adminRoutes.js - FIXED VERSION
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload'); // FIXED: Destructure upload

// ==================== PUBLIC ROUTES ====================
router.post('/first-login', [
  body('Email').isEmail().normalizeEmail(),
  body('TemporaryPassword').isLength({ min: 1 }),
  body('NewPassword').isLength({ min: 8 })
], validate, adminController.firstLoginSetup);

router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Admin routes are working!',
    timestamp: new Date().toISOString()
  });
});

// ==================== PROTECTED ADMIN ROUTES ====================
router.use(adminAuth);
router.use(adminController.checkAdminPermissions);
// Password management
router.get('/password-status', adminController.checkPasswordStatus);
router.post('/reset-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], validate, adminController.resetPassword);

// Admin management (main admin only)
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

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/analytics', adminController.getBookingAnalytics);

// Booking management
router.get('/bookings', adminController.getAllBookings);
router.post('/bookings', adminController.createBooking);
router.put('/bookings/:id', adminController.updateBooking);
router.delete('/bookings/:id', adminController.deleteBooking);

// Customer management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerDetails);
router.put('/customers/:id', adminController.updateCustomer);

// ==================== SERVICE MANAGEMENT ====================
router.post('/services',
  upload.single('image'), // This will now work with destructured upload
  [
    body('Name').notEmpty().withMessage('Service name is required'),
    body('Duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
  ],
  validate,
  adminController.createService
);

router.get('/services', adminController.getAllServices);
router.get('/services/:id', adminController.getServiceDetails);

router.put('/services/:id',
  upload.single('image'),
  adminController.updateService
);

router.delete('/services/:id', adminController.deleteService);

router.patch('/services/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, adminController.toggleServiceAvailability);

// ==================== PRODUCT MANAGEMENT ====================
router.post('/products', 
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Product name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Stock_Quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive number')
  ],
  validate,
  adminController.createProduct
);

router.get('/products', adminController.getAllProducts);
router.get('/products/:id', adminController.getProductById);

router.put('/products/:id',
  upload.single('image'),
  adminController.updateProduct
);

router.delete('/products/:id', adminController.deleteProduct);

router.patch('/products/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, adminController.toggleProductAvailability);

// ==================== ORDER MANAGEMENT ====================
router.get('/orders', adminController.getAllOrders);

// ==================== SYSTEM HEALTH ====================
router.get('/system/health', adminController.getSystemHealth);

// ==================== PROFILE MANAGEMENT ====================
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', adminController.updateAdminProfile);

module.exports = router;