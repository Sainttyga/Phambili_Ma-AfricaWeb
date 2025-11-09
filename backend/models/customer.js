// models/Customer.js
const BaseModel = require('./BaseModel');
const bcrypt = require('bcryptjs'); // Fixed: changed from bcrypt to bcryptjs

class Customer extends BaseModel {
  constructor() {
    super('customers');
  }

  async create(customerData) {
    // Hash password before saving
    if (customerData.password) {
      customerData.password = await bcrypt.hash(customerData.password, 12);
    }
    
    // Normalize email
    if (customerData.email) {
      customerData.email = customerData.email.toLowerCase().trim();
    }

    // Set default values
    const customerWithDefaults = {
      ...customerData,
      is_active: customerData.is_active !== undefined ? customerData.is_active : true,
      email_verified: false,
      login_attempts: 0,
      locked_until: null,
      last_login: null
    };

    const customer = await super.create(customerWithDefaults);
    return this.excludeSensitiveFields(customer);
  }

  async findByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return await this.findOne({ email: normalizedEmail });
  }

  async update(id, updates) {
    // Don't auto-hash password here - let controller handle specific password updates
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }

    const updatedCustomer = await super.update(id, updates);
    return this.excludeSensitiveFields(updatedCustomer);
  }

  async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await super.update(id, { password: hashedPassword });
  }

  excludeSensitiveFields(customer) {
    const { password, login_attempts, locked_until, ...safeCustomer } = customer;
    return safeCustomer;
  }

  async validatePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Include password for authentication (used in login)
  async findByEmailWithPassword(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return await this.findOne({ email: normalizedEmail });
  }

  async findByIdWithPassword(id) {
    return await this.findById(id);
  }

  async incrementLoginAttempts(id) {
    const customer = await this.findById(id);
    if (!customer) return;

    const newAttempts = (customer.login_attempts || 0) + 1;
    const updates = {
      login_attempts: newAttempts
    };

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

  async isAccountLocked(customer) {
    if (!customer.locked_until) return false;
    return new Date(customer.locked_until) > new Date();
  }
}

module.exports = new Customer();