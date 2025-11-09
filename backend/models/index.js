// models/index.js
const Customer = require('./Customer');
const Admin = require('./Admin');
const Booking = require('./Booking');
const Service = require('./Service');
const Product = require('./Product');
const Order = require('./Order');
const Payment = require('./Payment');
const Gallery = require('./Gallery');

// Note: Firebase doesn't need explicit associations like Sequelize
// Relationships are handled through document references

module.exports = {
  Customer,
  Admin,
  Booking,
  Service,
  Product,
  Order,
  Payment,
  Gallery
};