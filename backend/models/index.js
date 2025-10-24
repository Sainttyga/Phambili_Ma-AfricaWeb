// models/index.js
const Customer = require('./customer');
const Admin = require('./admin');
const Booking = require('./booking');
const Service = require('./service');
const Product = require('./product');
const Order = require('./order');
const Payment = require('./payment');
const sequelize = require('../config'); // Import sequelize instance

// Customer associations
Customer.hasMany(Booking, { foreignKey: 'Customer_ID' });
Customer.hasMany(Order, { foreignKey: 'Customer_ID' });

// Booking associations
Booking.belongsTo(Customer, { foreignKey: 'Customer_ID' });
Booking.belongsTo(Service, { foreignKey: 'Service_ID' });
Booking.hasOne(Payment, { foreignKey: 'Booking_ID' });

// Service associations
Service.hasMany(Booking, { foreignKey: 'Service_ID' });

// Product associations
Product.hasMany(Order, { foreignKey: 'Product_ID' });

// Order associations
Order.belongsTo(Customer, { foreignKey: 'Customer_ID' });
Order.belongsTo(Product, { foreignKey: 'Product_ID' });
Order.belongsTo(Payment, { 
  foreignKey: 'Payment_ID',
  allowNull: true // Payment is optional for orders
});

// Payment associations
Payment.belongsTo(Booking, { foreignKey: 'Booking_ID' });
Payment.hasOne(Order, { foreignKey: 'Payment_ID' });

// Admin associations (self-referential for sub-admins)
Admin.belongsTo(Admin, { 
  as: 'Creator', 
  foreignKey: 'Created_By' 
});

module.exports = {
  Customer,
  Admin,
  Booking,
  Service,
  Product,
  Order,
  Payment,
  sequelize
};