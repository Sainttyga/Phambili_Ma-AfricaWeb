// authRoutes.js - Complete routes
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public routes
router.post('/register', [
  body('Full_Name').isLength({ min: 2, max: 100 }),
  body('Email').isEmail().normalizeEmail(),
  body('Password').isLength({ min: 6 })
], validate, authController.register);

router.post('/login', [
  body('Email').isEmail().normalizeEmail(),
  body('Password').isLength({ min: 1 })
], validate, authController.login);

router.post('/forgot-password', [
  body('Email').isEmail().normalizeEmail()
], validate, authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validate, authController.resetPassword);

// Protected routes (require authentication)
router.use(auth);

router.post('/change-password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validate, authController.changePassword);

router.get('/verify', authController.verifyToken);
router.get('/profile', authController.getProfile);
router.post('/logout', authController.logout);

module.exports = router;