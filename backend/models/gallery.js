const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Gallery = sequelize.define('Gallery', {
  ID: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true,
    field: 'id'
  },
  filename: { 
    type: DataTypes.STRING(255), 
    allowNull: false 
  },
  category: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    defaultValue: 'general'
  },
  media_type: { 
    type: DataTypes.ENUM('image', 'video'), 
    allowNull: false 
  },
  is_active: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true 
  }
}, {
  tableName: 'gallery',
  timestamps: true,
  createdAt: 'uploaded_at',
  updatedAt: false
});

module.exports = Gallery;