const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Customer = sequelize.define('Customer', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Full_Name: { type: DataTypes.STRING(100), allowNull: false },
  Email: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  Password: { type: DataTypes.STRING(100), allowNull: false },
  Phone: { type: DataTypes.STRING(20), allowNull: true },
  Address: { type: DataTypes.TEXT, allowNull: true }
},
{
    defaultScope: {
      attributes: { exclude: ['Password'] } 
    }
  }
);

module.exports = Customer;