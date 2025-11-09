const { Product } = require('../models');
const path = require('path');
const fs = require('fs');

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { Name, Description, Price, Stock_Quantity, Category, Is_Available } = req.body;

    if (!Name || !Price) {
      return res.status(400).json({ 
        success: false,
        message: 'Name and Price are required.' 
      });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/upload/products/${req.file.filename}`;
    }

    const product = await Product.create({ 
      Name, 
      Description, 
      Price, 
      Stock_Quantity: Stock_Quantity || 0,
      Category,
      Is_Available: Is_Available !== undefined ? Is_Available : true,
      Image_URL: imageUrl
    });

    res.status(201).json({ 
      success: true,
      message: 'Product created successfully', 
      product 
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error creating product: ' + err.message 
    });
  }
};

// Get all products
// In controllers/productController.js - update getProducts method
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['created_at', 'DESC']]
    });
    
    // Convert image URLs to full URLs
    const productsWithFullUrls = products.map(product => {
      const productData = product.toJSON();
      if (productData.Image_URL) {
        // Convert relative path to full URL
        productData.Image_URL = `http://localhost:3000${productData.Image_URL}`;
      }
      return productData;
    });
    
    res.json({ 
      success: true,
      products: productsWithFullUrls
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching products: ' + err.message 
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found.' 
      });
    }
    
    res.json({ 
      success: true,
      product 
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching product: ' + err.message 
    });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { Name, Description, Price, Stock_Quantity, Category, Is_Available } = req.body;

  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found.' 
      });
    }

    // Handle image upload
    let imageUrl = product.Image_URL;
    if (req.file) {
      // Delete old image if exists
      if (product.Image_URL) {
        const oldImagePath = path.join(__dirname, '..', 'public', product.Image_URL);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/upload/products/${req.file.filename}`;
    }

    await product.update({
      Name: Name || product.Name,
      Description: Description !== undefined ? Description : product.Description,
      Price: Price != null ? Price : product.Price,
      Stock_Quantity: Stock_Quantity !== undefined ? Stock_Quantity : product.Stock_Quantity,
      Category: Category !== undefined ? Category : product.Category,
      Is_Available: Is_Available !== undefined ? Is_Available : product.Is_Available,
      Image_URL: imageUrl
    });

    const updatedProduct = await Product.findByPk(id);
    
    res.json({ 
      success: true,
      message: 'Product updated successfully', 
      product: updatedProduct 
    });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating product: ' + err.message 
    });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found.' 
      });
    }

    // Delete associated image if exists
    if (product.Image_URL) {
      const imagePath = path.join(__dirname, '..', 'public', product.Image_URL);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await product.destroy();
    
    res.json({ 
      success: true,
      message: 'Product deleted successfully' 
    });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting product: ' + err.message 
    });
  }
};

// Toggle product availability
exports.toggleProductAvailability = async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  try {
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found.' 
      });
    }

    await product.update({ Is_Available: isAvailable });
    
    res.json({ 
      success: true,
      message: `Product ${isAvailable ? 'activated' : 'deactivated'} successfully`,
      product 
    });
  } catch (err) {
    console.error('Toggle product availability error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating product availability: ' + err.message 
    });
  }
};