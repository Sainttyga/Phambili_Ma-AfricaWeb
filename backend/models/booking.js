const { DataTypes } = require('sequelize');
const sequelize = require('../config');
const Customer = require('./customer');
const Service = require('./service');

const Booking = sequelize.define('Booking', {
  ID: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true,
    field: 'ID'
  },
  Customer_ID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'Customer_ID'
  },
  Service_ID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'Service_ID'
  },
  Date: { 
    type: DataTypes.DATEONLY, 
    allowNull: false,
    field: 'Date'
  },
  Time: { 
    type: DataTypes.TIME,
    field: 'Time'
  },
  Status: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    field: 'Status'
  },
  Address: { 
    type: DataTypes.TEXT,
    field: 'Address'
  },
  Special_Instructions: { 
    type: DataTypes.TEXT,
    field: 'Special_Instructions'
  },
  Total_Amount: { 
    type: DataTypes.DECIMAL(10, 2),
    field: 'Total_Amount'
  },
  Duration: {
    type: DataTypes.STRING(50),
    field: 'Duration'
  }
}, {
  tableName: 'Bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
Customer.hasMany(Booking, { foreignKey: 'Customer_ID' });
Booking.belongsTo(Customer, { foreignKey: 'Customer_ID' });

Service.hasMany(Booking, { foreignKey: 'Service_ID' });
Booking.belongsTo(Service, { foreignKey: 'Service_ID' });

module.exports = Booking;