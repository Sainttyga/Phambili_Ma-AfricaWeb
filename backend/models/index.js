const sequelize = require('../config');
const Customer = require('./customer');
const Admin = require('./admin');
const Service = require('./service');
const Booking = require('./booking');
const Quotation = require('./quotation');
const Payment = require('./payment');
const Product = require('./product');
const Order = require('./order');

// Sync all models
sequelize.sync({ alter: true })
  .then(() => console.log('Database synced'))
  .catch(err => console.error('DB sync error:', err));

module.exports = {
  Customer,
  Admin,
  Service,
  Booking,
  Quotation,
  Payment,
  Product,
  Order
};