const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    path.join(__dirname, '../public/upload/products'),
    path.join(__dirname, '../public/upload/services'),
    path.join(__dirname, '../public/upload/general')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created upload directory: ${dir}`);
    }
  });
};

createUploadDirs();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = path.join(__dirname, '../public/upload/');
    
    // Determine upload path based on route
    if (req.originalUrl.includes('/products')) {
      uploadPath = path.join(uploadPath, 'products');
    } else if (req.originalUrl.includes('/services')) {
      uploadPath = path.join(uploadPath, 'services');
    } else {
      uploadPath = path.join(uploadPath, 'general');
    }
    
    console.log(`📁 Saving file to: ${uploadPath}`);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const filename = 'image-' + uniqueSuffix + fileExtension;
    console.log(`📸 Generated filename: ${filename}`);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    console.log(`✅ Accepting image: ${file.originalname}, type: ${file.mimetype}`);
    cb(null, true);
  } else {
    console.log(`❌ Rejecting non-image: ${file.originalname}, type: ${file.mimetype}`);
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

module.exports = upload;