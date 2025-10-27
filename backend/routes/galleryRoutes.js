const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const adminAuth = require('../middleware/adminAuth');
const { galleryUpload } = require('../middleware/upload');

// Public routes
router.get('/media', galleryController.getAllMedia);

// Admin routes
router.post('/upload', adminAuth, galleryUpload.single('media'), galleryController.uploadMedia);
router.delete('/media/:id', adminAuth, galleryController.deleteMedia);

module.exports = router;