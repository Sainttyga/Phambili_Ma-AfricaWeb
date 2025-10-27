require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sequelize = require('./config');
require('./models');
const security = require('./middleware/security');
const swagger = require('./swagger');
const helmet = require('helmet');

// Import routes
const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const customerRoutes = require('./routes/customerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const galleryRoutes = require('./routes/galleryRoutes');

const app = express();

// Configure Helmet with proper CORS settings for images
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - MORE PERMISSIVE
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://localhost:8000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(...security);

// Ensure upload directories exist
const uploadDirs = [
  path.join(__dirname, 'public/upload/products'),
  path.join(__dirname, 'public/upload/services'),
  path.join(__dirname, 'public/upload/general')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// FIXED: Serve static files with proper CORS headers
app.use('/upload', (req, res, next) => {
  // Set CORS headers for all static files
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(path.join(__dirname, 'public/upload'), {
  // Additional static file options
  dotfiles: 'ignore',
  etag: true,
  extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  index: false,
  maxAge: '1d',
  redirect: false
}));

// Serve static files from uploads directory
app.use('/upload', express.static(path.join(__dirname, 'public/upload')));

// Add CORS headers for development
app.use('/upload', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// DEBUG MIDDLEWARE - Add this to see incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl}`);
  if (req.method === 'POST' && req.body) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// API Routes - ADD CONSOLE LOGS TO VERIFY ROUTES ARE LOADED
console.log('🔄 Loading API routes...');

// Test route to verify auth routes are working
app.get('/api/test-auth', (req, res) => {
  res.json({ message: 'Auth test route is working!' });
});

// Load all API routes
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes loaded: /api/auth');

app.use('/api/public', publicRoutes);
console.log('✅ Public routes loaded: /api/public');

app.use('/api/customer', customerRoutes);
console.log('✅ Customer routes loaded: /api/customer');

app.use('/api/services', serviceRoutes);
console.log('✅ Service routes loaded: /api/services');

app.use('/api/bookings', bookingRoutes);
console.log('✅ Booking routes loaded: /api/bookings');

app.use('/api/products', productRoutes);
console.log('✅ Product routes loaded: /api/products');

app.use('/api/admin', adminRoutes);
console.log('✅ Admin routes loaded: /api/admin');

app.use('/api/orders', orderRoutes);
console.log('✅ Order routes loaded: /api/orders');

app.use('/api/payments', paymentRoutes);
console.log('✅ Payment routes loaded: /api/payments');

app.use('/api/gallery', galleryRoutes);
console.log('✅ Gallery routes loaded: /api/gallery');

// FIXED: Health check route with /api prefix
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uploadPath: path.join(__dirname, 'public/upload'),
    message: 'Server is running correctly'
  });
});

// Special route to serve images with proper headers
app.get('/upload/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const validTypes = ['products', 'services', 'general'];
  
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid upload type' });
  }

  const filePath = path.join(__dirname, 'public/upload', type, filename);
  
  // Set proper headers for images
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', getContentType(filename));
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// Helper function to determine content type
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// FIXED: Remove the problematic wildcard route and use a generic 404 handler
// This should be the LAST middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/')) {
    // For API routes, return JSON
    res.status(404).json({ 
      success: false, 
      message: 'API endpoint not found',
      path: req.originalUrl,
      availableEndpoints: [
        '/api/health',
        '/api/test-auth',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password'
      ]
    });
  } else {
    // For non-API routes
    res.status(404).json({ 
      success: false, 
      message: 'Route not found',
      path: req.originalUrl
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

swagger(app);

// Sync database and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync all models with database
    await sequelize.sync({ force: false });
    console.log('✅ Database synchronized successfully.');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server started on port ${PORT}`);
      console.log(`📁 Upload directory: ${path.join(__dirname, 'public/upload')}`);
      console.log(`🌐 CORS enabled for: localhost:3000, 127.0.0.1:5500, localhost:5000`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Auth test: http://localhost:${PORT}/api/test-auth`);
      console.log(`🔗 Login endpoint: http://localhost:${PORT}/api/auth/login`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
  }
}

// ACTUALLY CALL THE START SERVER FUNCTION
startServer();