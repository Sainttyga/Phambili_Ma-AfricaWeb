const { DataTypes } = require('sequelize');
const sequelize = require('../config');
const Customer = require('./customer');
const Product = require('./product');
const Payment = require('./payment');

const Order = sequelize.define('Order', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Date: { type: DataTypes.DATEONLY, allowNull: false }
});

// Associations
Customer.hasMany(Order, { foreignKey: 'Customer_ID' });
Order.belongsTo(Customer, { foreignKey: 'Customer_ID' });

Product.hasMany(Order, { foreignKey: 'Product_ID' });
Order.belongsTo(Product, { foreignKey: 'Product_ID' });

// Payment can be optional
Payment.hasMany(Order, { foreignKey: 'Payment_ID' });
Order.belongsTo(Payment, { 
  foreignKey: { name: 'Payment_ID', allowNull: true }, // optional
  onDelete: 'SET NULL',  // if payment is deleted, set Payment_ID to null
  onUpdate: 'CASCADE'   // if payment ID changes, update here
});

module.exports = Order;
