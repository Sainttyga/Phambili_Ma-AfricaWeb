// models/admin.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Admin = sequelize.define('Admin', {
  ID: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true,
    field: 'id'
  },
  Name: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    field: 'name',
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  Email: { 
    type: DataTypes.STRING(100), 
    allowNull: false, 
    unique: true,
    field: 'email',
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  Phone: { 
    type: DataTypes.STRING(15), 
    allowNull: true,
    field: 'phone',
    validate: {
      is: /^[\+]?[1-9][\d]{0,15}$/
    }
  },
  Password: { 
    type: DataTypes.STRING(255), 
    allowNull: false,
    field: 'password',
    validate: {
      notEmpty: true
    }
  },
  Role: { 
    type: DataTypes.ENUM('main_admin', 'sub_admin'),
    defaultValue: 'sub_admin',
    field: 'role'
  },
  First_Login: { 
    type: DataTypes.BOOLEAN, 
    defaultValue: true,
    field: 'first_login'
  },
  Is_Active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  Last_Login: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  },
  Login_Attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'login_attempts'
  },
  Locked_Until: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'locked_until'
  },
  Created_By: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by'
    // REMOVE the references from here - define in index.js only
  }
}, {
  tableName: 'admins',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  defaultScope: {
    attributes: { exclude: ['password', 'login_attempts', 'locked_until'] }
  },
  scopes: {
    withPassword: {
      attributes: { include: ['password', 'login_attempts', 'locked_until', 'first_login'] }
    },
    withSecurity: {
      attributes: { include: ['first_login', 'login_attempts', 'locked_until', 'is_active'] }
    },
    withAll: {
      attributes: { include: [] }
    },
    inactive: {
      where: { is_active: false }
    }
  },
  hooks: {
    beforeCreate: (admin) => {
      if (admin.Email) {
        admin.Email = admin.Email.toLowerCase().trim();
      }
    },
    beforeUpdate: (admin) => {
      if (admin.Email && admin.changed('Email')) {
        admin.Email = admin.Email.toLowerCase().trim();
      }
    }
  }
});


module.exports = Admin;