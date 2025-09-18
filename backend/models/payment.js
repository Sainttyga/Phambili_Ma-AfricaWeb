const { DataTypes } = require('sequelize');
const sequelize = require('../config');
const Booking = require('./booking');

const Payment = sequelize.define('Payment', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Date: { type: DataTypes.DATEONLY, allowNull: false },
  Amount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  Method: { type: DataTypes.STRING(50), allowNull: false },
  Status: { type: DataTypes.STRING(50), allowNull: false }
});

Booking.hasMany(Payment, { foreignKey: 'Booking_ID' });
Payment.belongsTo(Booking, { foreignKey: 'Booking_ID' });

module.exports = Payment;