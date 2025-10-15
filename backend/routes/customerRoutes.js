const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');

router.get('/profile', auth, customerController.getProfile);
router.put('/profile', auth, customerController.updateProfile);
router.put('/change-password', auth, customerController.changePassword);

module.exports = router;