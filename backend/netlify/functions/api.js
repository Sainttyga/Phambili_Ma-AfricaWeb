// netlify/functions/api.js
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const path = require('path');

// Import your existing app setup
const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://72.61.104.51:3000',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://your-netlify-app.netlify.app' // Your Netlify domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Import all your routes (they remain EXACTLY the same)
const authRoutes = require('../../routes/authRoutes');
const publicRoutes = require('../../routes/publicRoutes');
const customerRoutes = require('../../routes/customerRoutes');
const serviceRoutes = require('../../routes/serviceRoutes');
const bookingRoutes = require('../../routes/bookingRoutes');
const productRoutes = require('../../routes/productRoutes');
const adminRoutes = require('../../routes/adminRoutes');
const orderRoutes = require('../../routes/orderRoutes');
const paymentRoutes = require('../../routes/paymentRoutes');
const galleryRoutes = require('../../routes/galleryRoutes');

// Mount all your routes (they work exactly the same)
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/gallery', galleryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: 'Netlify Function',
    message: 'Server is running on Netlify Functions'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Export the serverless function
module.exports.handler = serverless(app);