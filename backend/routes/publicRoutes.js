// routes/publicRoutes.js - Updated to match your actual database schema
const express = require('express');
const router = express.Router();
const { Service, Product } = require('../models');

// ==================== PUBLIC SERVICES ====================

// Get all available services (public - no auth required)
router.get('/services', async (req, res) => {
  try {
    console.log('📋 Fetching public services...');
    
    const services = await Service.findAll({
      where: { 
        Is_Available: true 
      },
      order: [['Name', 'ASC']],
      attributes: [
        'ID', 
        'Name', 
        'Description', 
        'Duration', 
        'Category', 
        'Is_Available', 
        'Image_URL',
        'created_at'
      ] // Removed Features and Requirements columns
    });

    console.log(`✅ Found ${services.length} public services`);

    res.json({
      success: true,
      services: services.map(service => ({
        ID: service.ID,
        Name: service.Name,
        Description: service.Description,
        Duration: service.Duration,
        Category: service.Category,
        Is_Available: service.Is_Available,
        Image_URL: service.Image_URL,
        Created_At: service.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching public services:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching services'
    });
  }
});

// Get single service details (public)
router.get('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const service = await Service.findByPk(id, {
      attributes: [
        'ID', 
        'Name', 
        'Description', 
        'Duration', 
        'Category', 
        'Is_Available', 
        'Image_URL',
        'created_at'
      ] // Removed Features and Requirements columns
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service: {
        ID: service.ID,
        Name: service.Name,
        Description: service.Description,
        Duration: service.Duration,
        Category: service.Category,
        Is_Available: service.Is_Available,
        Image_URL: service.Image_URL,
        Created_At: service.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching service details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service details'
    });
  }
});

// ==================== PUBLIC PRODUCTS ====================

// Get all available products (public - no auth required)
router.get('/products', async (req, res) => {
  try {
    console.log('📦 Fetching public products...');
    
    const products = await Product.findAll({
      where: { 
        Is_Available: true 
      },
      order: [['Name', 'ASC']],
      attributes: [
        'ID', 
        'Name', 
        'Description', 
        'Price',
        'Stock_Quantity',
        'Category', 
        'Is_Available', 
        'Image_URL',
        'created_at'
      ]
    });

    console.log(`✅ Found ${products.length} public products`);

    res.json({
      success: false,
      products: products.map(product => ({
        ID: product.ID,
        Name: product.Name,
        Description: product.Description,
        Price: product.Price,
        Stock_Quantity: product.Stock_Quantity,
        Category: product.Category,
        Is_Available: product.Is_Available,
        Image_URL: product.Image_URL,
        Created_At: product.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching public products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products'
    });
  }
});

// Get single product details (public)
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByPk(id, {
      attributes: [
        'ID', 
        'Name', 
        'Description', 
        'Price',
        'Stock_Quantity',
        'Category', 
        'Is_Available', 
        'Image_URL',
        'created_at'
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: {
        ID: product.ID,
        Name: product.Name,
        Description: product.Description,
        Price: product.Price,
        Stock_Quantity: product.Stock_Quantity,
        Category: product.Category,
        Is_Available: product.Is_Available,
        Image_URL: product.Image_URL,
        Created_At: product.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product details'
    });
  }
});

module.exports = router;