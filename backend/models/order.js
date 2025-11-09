// models/Order.js
const BaseModel = require('./BaseModel');

class Order extends BaseModel {
  constructor() {
    super('orders');
  }

  async create(orderData) {
    return await super.create(orderData);
  }

  async findByCustomerId(customerId) {
    return await this.findAll({ customer_id: customerId });
  }

  async findByProductId(productId) {
    return await this.findAll({ product_id: productId });
  }
}

module.exports = new Order();