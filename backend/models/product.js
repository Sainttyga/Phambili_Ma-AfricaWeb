const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Product = sequelize.define('Product', {
  ID: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true,
    field: 'id'
  },
  Name: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    field: 'name'
  },
  Description: { 
    type: DataTypes.TEXT, 
    allowNull: true,
    field: 'description'
  },
  Price: { 
    type: DataTypes.DECIMAL(10,2), 
    allowNull: false,
    field: 'price'
  },
  Stock_Quantity: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    defaultValue: 0,
    field: 'stock_quantity'
  },
  Image_URL: { 
    type: DataTypes.STRING(500), 
    allowNull: true,
    field: 'image_url'
  },
  Category: { 
    type: DataTypes.STRING(100), 
    allowNull: true,
    field: 'category'
  },
  Is_Available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Product;