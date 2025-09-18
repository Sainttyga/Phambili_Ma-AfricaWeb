const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Service = sequelize.define('Service', {
  ID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  Name: { type: DataTypes.STRING(100), allowNull: false },
  Description: { type: DataTypes.TEXT, allowNull: true },
  Price: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  Duration: { type: DataTypes.INTEGER, allowNull: false }
});

module.exports = Service;