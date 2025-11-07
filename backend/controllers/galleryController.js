const { Gallery } = require('../models');
const path = require('path');
const fs = require('fs');

exports.uploadMedia = async (req, res) => {
  try {
    console.log('🔄 Uploading gallery media...');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { category = 'general' } = req.body;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const mediaType = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension) ? 'image' : 'video';

    console.log('📝 Creating gallery record:', {
      filename: req.file.filename,
      category,
      mediaType
    });

    const galleryItem = await Gallery.create({
      filename: req.file.filename,
      category: category.toLowerCase(),
      media_type: mediaType
    });

    console.log('✅ Gallery media uploaded successfully');

    res.json({
      success: true,
      message: 'Media uploaded successfully',
      item: galleryItem
    });

  } catch (error) {
    console.error('❌ Upload media error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading media: ' + error.message
    });
  }
};

// In your gallery controller
exports.getAllMedia = async (req, res) => {
  try {
    const { category } = req.query;
    
    const whereClause = { is_active: true };
    if (category && category !== 'all') {
      whereClause.category = category;
    }

    const media = await Gallery.findAll({
      where: whereClause,
      order: [['uploaded_at', 'DESC']]
    });

    // Add full URL to files - FIXED
    const mediaWithUrls = media.map(item => ({
      ...item.toJSON(),
      url: `http://phambilimaafrica.site/upload/gallery/${item.filename}`
    }));

    res.json({
      success: true,
      media: mediaWithUrls
    });

  } catch (error) {
    console.error('❌ Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching media'
    });
  }
};

exports.deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const galleryItem = await Gallery.findByPk(id);
    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Delete file from server
    const filePath = path.join(__dirname, '../public/upload/gallery/', galleryItem.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Deleted file:', filePath);
    }

    await galleryItem.destroy();

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting media'
    });
  }
};