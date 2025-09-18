const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Admin = sequelize.define('Admin', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Email: { type: DataTypes.STRING(100), unique: true, allowNull: false },
  Phone: { type: DataTypes.STRING(20), allowNull: true },
  Password: { type: DataTypes.STRING(100), allowNull: true }
});

module.exports = Admin;