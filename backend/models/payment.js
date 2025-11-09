// models/Payment.js
const BaseModel = require('./BaseModel');

class Payment extends BaseModel {
  constructor() {
    super('payments');
  }

  async create(paymentData) {
    return await super.create(paymentData);
  }

  async findByBookingId(bookingId) {
    return await this.findAll({ booking_id: bookingId });
  }

  async updateStatus(id, status) {
    return await this.update(id, { status });
  }
}

module.exports = new Payment();