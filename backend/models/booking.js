const { DataTypes } = require('sequelize');
const sequelize = require('../config');

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
    type: DataTypes.ENUM('requested', 'contacted', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'),
    defaultValue: 'requested',
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
  Quoted_Amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'Quoted_Amount'
  },
  Duration: {
    type: DataTypes.STRING(50),
    field: 'Duration'
  },
  Property_Type: {
    type: DataTypes.STRING(100),
    field: 'Property_Type'
  },
  Property_Size: {
    type: DataTypes.STRING(100),
    field: 'Property_Size'
  },
  Cleaning_Frequency: {
    type: DataTypes.STRING(50),
    field: 'Cleaning_Frequency'
  }
}, {
  tableName: 'Bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Booking;