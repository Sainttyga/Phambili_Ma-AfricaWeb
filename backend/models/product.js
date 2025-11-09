// models/Product.js
const BaseModel = require('./BaseModel');

class Product extends BaseModel {
  constructor() {
    super('products');
  }

  async create(productData) {
    const productWithDefaults = {
      ...productData,
      is_available: productData.is_available !== undefined ? productData.is_available : true,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
      stock_quantity: productData.stock_quantity || 0,
      popularity: productData.popularity || 0
    };

    return await super.create(productWithDefaults);
  }

  async findAvailable() {
    return await this.findAll({ 
      is_available: true, 
      is_active: true 
    });
  }

  async findByCategory(category) {
    return await this.findAll({ 
      category, 
      is_available: true,
      is_active: true 
    });
  }

  async updateStock(id, newQuantity) {
    const updates = { 
      stock_quantity: newQuantity,
      is_available: newQuantity > 0
    };

    return await this.update(id, updates);
  }

  async decrementStock(id, quantity = 1) {
    const product = await this.findById(id);
    if (!product) throw new Error('Product not found');

    const newQuantity = (product.stock_quantity || 0) - quantity;
    if (newQuantity < 0) throw new Error('Insufficient stock');

    return await this.updateStock(id, newQuantity);
  }

  async incrementPopularity(id) {
    const product = await this.findById(id);
    if (product) {
      const newPopularity = (product.popularity || 0) + 1;
      await this.update(id, { popularity: newPopularity });
    }
  }
}

module.exports = new Product();