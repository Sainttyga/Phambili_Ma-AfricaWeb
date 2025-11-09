// models/Admin.js - UPDATED FOR FIRESTORE
const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs');

class Admin extends BaseModel {
  constructor() {
    super('admins');
  }

  // Add findByPk method for compatibility with auth middleware
  async findByPk(id, options = {}) {
    const admin = await this.findById(id);
    if (!admin) return null;
    
    // Handle attributes filtering (like Sequelize does)
    if (options.attributes && Array.isArray(options.attributes)) {
      const filteredAdmin = {};
      options.attributes.forEach(attr => {
        if (admin[attr] !== undefined) {
          filteredAdmin[attr] = admin[attr];
        }
      });
      return filteredAdmin;
    }
    
    return admin;
  }

  async create(adminData) {
    // Hash password before saving using bcryptjs
    if (adminData.password) {
      adminData.password = await bcrypt.hash(adminData.password, 12);
    }
    
    // Set default values
    const adminWithDefaults = {
      ...adminData,
      first_login: adminData.first_login !== undefined ? adminData.first_login : true,
      is_active: adminData.is_active !== undefined ? adminData.is_active : true,
      role: adminData.role || 'sub_admin',
      login_attempts: 0,
      locked_until: null,
      last_login: null,
      Email: adminData.Email ? adminData.Email.toLowerCase().trim() : adminData.email
    };

    return await super.create(adminWithDefaults);
  }

  async findByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return await this.findOne({ Email: normalizedEmail });
  }

  async update(id, updates) {
    // If password is being updated, hash it with bcryptjs
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 12);
    }
    
    // Handle email normalization
    if (updates.Email) {
      updates.Email = updates.Email.toLowerCase().trim();
    } else if (updates.email) {
      updates.Email = updates.email.toLowerCase().trim();
      delete updates.email;
    }
    
    return await super.update(id, updates);
  }

  async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await super.update(id, {
      password: hashedPassword,
      first_login: false // Mark first login as completed
    });
  }

  excludeSensitiveFields(admin) {
    const { password, login_attempts, locked_until, ...safeAdmin } = admin;
    return safeAdmin;
  }

  async validatePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async incrementLoginAttempts(id) {
    const admin = await this.findById(id);
    if (!admin) return;

    const newAttempts = (admin.login_attempts || 0) + 1;
    const updates = {
      login_attempts: newAttempts
    };

    // Lock account after 5 failed attempts for 15 minutes
    if (newAttempts >= 5) {
      updates.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }

    await this.update(id, updates);
  }

  async resetLoginAttempts(id) {
    await this.update(id, {
      login_attempts: 0,
      locked_until: null,
      last_login: new Date()
    });
  }

  async isAccountLocked(admin) {
    if (!admin.locked_until) return false;
    return new Date(admin.locked_until) > new Date();
  }

  // Get all active admins
  async findActiveAdmins() {
    return await this.findAll({ is_active: true });
  }
}

module.exports = new Admin();