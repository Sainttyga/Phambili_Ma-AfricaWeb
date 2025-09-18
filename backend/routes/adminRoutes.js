const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');

// Send OTP
router.post('/send-otp', [body('Email').isEmail()], validate, adminController.sendOTP);

// Verify OTP & set password
router.post('/verify-otp', [
  body('Admin_ID').isInt(),
  body('OTP').isLength({ min: 6, max: 6 }),
  body('Password').isLength({ min: 6 })
], validate, adminController.verifyOTPAndSetPassword);

// Login
router.post('/login', [
  body('Email').isEmail(),
  body('Password').notEmpty()
], validate, adminController.login);

module.exports = router;
