const { DataTypes } = require('sequelize');
const sequelize = require('../config');
const Customer = require('./customer');
const Service = require('./service');

const Booking = sequelize.define('Booking', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Date: { type: DataTypes.DATEONLY, allowNull: false },
  Status: { type: DataTypes.STRING(50), allowNull: false }
});

Customer.hasMany(Booking, { foreignKey: 'Customer_ID' });
Booking.belongsTo(Customer, { foreignKey: 'Customer_ID' });

Service.hasMany(Booking, { foreignKey: 'Service_ID' });
Booking.belongsTo(Service, { foreignKey: 'Service_ID' });

module.exports = Booking;