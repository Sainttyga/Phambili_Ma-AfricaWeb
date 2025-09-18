const { Product } = require('../models');

// Create a new product
exports.createProduct = async (req, res) => {
  const { Name, Description, Price, Stock_Quantity } = req.body;

  if (!Name || !Price || Stock_Quantity == null) {
    return res.status(400).json({ message: 'Name, Price, and Stock_Quantity are required.' });
  }

  try {
    const product = await Product.create({ Name, Description, Price, Stock_Quantity });
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { Name, Description, Price, Stock_Quantity } = req.body;

  try {
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    product.Name = Name || product.Name;
    product.Description = Description || product.Description;
    product.Price = Price != null ? Price : product.Price;
    product.Stock_Quantity = Stock_Quantity != null ? Stock_Quantity : product.Stock_Quantity;

    await product.save();
    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Product.destroy({ where: { ID: id } });
    if (!deleted) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
