const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Product = sequelize.define('Product', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Description: { type: DataTypes.TEXT, allowNull: true },
  Price: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  Stock_Quantity: { type: DataTypes.INTEGER, allowNull: false }
});

module.exports = Product;