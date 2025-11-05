// routes/adminRoutes.js - UPDATED FOR EXPRESS 5
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');

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

// ==================== ENHANCED BOOKING ROUTES ====================

// Get all bookings for admin workflow
router.get('/bookings/workflow', (req, res) => adminController.getAllBookingsForAdmin(req, res));

// Quick action - Mark as contacted - FIXED FOR EXPRESS 5
router.patch('/bookings/:id/contacted', [
  body('call_notes').optional().isString(),
  body('next_steps').optional().isString()
], validate, (req, res) => adminController.markAsContacted(req, res));

// Quick action - Move to in progress - FIXED FOR EXPRESS 5
router.patch('/bookings/:id/in-progress', [
  body('consultation_date').optional().isISO8601(),
  body('consultation_notes').optional().isString()
], validate, (req, res) => adminController.moveToInProgress(req, res));

// Provide quotation - FIXED FOR EXPRESS 5
router.patch('/bookings/:id/provide-quote', [
  body('quoted_amount').isDecimal({ min: 0 }),
  body('quote_breakdown').optional().isString(),
  body('quote_notes').optional().isString()
], validate, (req, res) => adminController.provideQuotation(req, res));

// Update booking status - FIXED FOR EXPRESS 5
router.patch('/bookings/:id/status', [
  body('Status').isIn(['requested', 'contacted', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled']),
  body('contact_date').optional().isISO8601(),
  body('consultation_date').optional().isISO8601(),
  body('admin_notes').optional().isString()
], validate, (req, res) => adminController.updateBookingStatus(req, res));

router.get('/bookings', (req, res) => adminController.getAllBookingsForAdmin(req, res));
// Get booking statistics
router.get('/bookings/stats', (req, res) => adminController.getBookingStats(req, res));

// Get booking details
router.get('/bookings/:id', (req, res) => adminController.getBookingDetails(req, res));

// Update booking
router.put('/bookings/:id', (req, res) => adminController.updateBooking(req, res));

// Delete booking
router.delete('/bookings/:id', (req, res) => adminController.deleteBooking(req, res));

// ==================== EXISTING ROUTES ====================

// Password management
router.get('/password-status', (req, res) => adminController.checkPasswordStatus(req, res));
router.post('/reset-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], validate, (req, res) => adminController.resetPassword(req, res));

// Admin management (main admin only)
router.post('/admins', [
  body('Name').isLength({ min: 2, max: 100 }),
  body('Email').isEmail().normalizeEmail(),
  body('Phone').optional().isLength({ min: 10, max: 15 }),
  body('Role').optional().isIn(['main_admin', 'sub_admin'])
], validate, (req, res) => adminController.createAdmin(req, res));

router.get('/admins', (req, res) => adminController.getAllAdmins(req, res));
router.get('/admins/:id', (req, res) => adminController.getAdminDetails(req, res));
router.put('/admins/:id', (req, res) => adminController.updateAdmin(req, res));
router.delete('/admins/:id', (req, res) => adminController.deleteAdmin(req, res));

// Dashboard
router.get('/dashboard/stats', (req, res) => adminController.getDashboardStats(req, res));
router.get('/dashboard/analytics', (req, res) => adminController.getBookingAnalytics(req, res));

// Customer management
router.get('/customers', (req, res) => adminController.getAllCustomers(req, res));
router.get('/customers/:id', (req, res) => adminController.getCustomerDetails(req, res));
router.put('/customers/:id', (req, res) => adminController.updateCustomer(req, res));

// Service management
router.post('/services',
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Service name is required'),
    body('Duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
  ],
  validate,
  (req, res) => adminController.createService(req, res)
);

router.get('/services', (req, res) => adminController.getAllServices(req, res));
router.get('/services/:id', (req, res) => adminController.getServiceDetails(req, res));
router.put('/services/:id', upload.single('image'), (req, res) => adminController.updateService(req, res));
router.delete('/services/:id', (req, res) => adminController.deleteService(req, res));
router.patch('/services/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, (req, res) => adminController.toggleServiceAvailability(req, res));

// Product management
router.post('/products', 
  upload.single('image'),
  [
    body('Name').notEmpty().withMessage('Product name is required'),
    body('Price').isDecimal({ min: 0 }).withMessage('Price must be a positive number'),
    body('Stock_Quantity').isInt({ min: 0 }).withMessage('Stock quantity must be a positive number')
  ],
  validate,
  (req, res) => adminController.createProduct(req, res)
);

router.get('/products', (req, res) => adminController.getAllProducts(req, res));
router.get('/products/:id', (req, res) => adminController.getProductById(req, res));
router.put('/products/:id', upload.single('image'), (req, res) => adminController.updateProduct(req, res));
router.delete('/products/:id', (req, res) => adminController.deleteProduct(req, res));
router.patch('/products/:id/availability', [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
], validate, (req, res) => adminController.toggleProductAvailability(req, res));

// Order management
router.get('/orders', (req, res) => adminController.getAllOrders(req, res));

// System health
router.get('/system/health', (req, res) => adminController.getSystemHealth(req, res));

// Profile management
router.get('/profile', (req, res) => adminController.getAdminProfile(req, res));
router.put('/profile', (req, res) => adminController.updateAdminProfile(req, res));

module.exports = router;