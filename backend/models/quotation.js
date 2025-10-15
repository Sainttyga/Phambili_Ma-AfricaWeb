// models/quotation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config');
const Customer = require('./customer');
const Service = require('./service');

const Quotation = sequelize.define('Quotation', {
  ID: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  Customer_ID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Service_ID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  Date: { 
    type: DataTypes.DATEONLY, 
    allowNull: false 
  },
  Amount: { 
    type: DataTypes.DECIMAL(10,2), 
    allowNull: false 
  },
  Status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending',
    allowNull: false
  },
  Notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'quotations',
  timestamps: true
});

Customer.hasMany(Quotation, { foreignKey: 'Customer_ID' });
Quotation.belongsTo(Customer, { foreignKey: 'Customer_ID' });

Service.hasMany(Quotation, { foreignKey: 'Service_ID' });
Quotation.belongsTo(Service, { foreignKey: 'Service_ID' });

module.exports = Quotation;