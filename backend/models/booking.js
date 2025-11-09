// models/Booking.js
const BaseModel = require('./BaseModel');

class Booking extends BaseModel {
  constructor() {
    super('bookings');
  }

  async create(bookingData) {
    const bookingWithDefaults = {
      ...bookingData,
      status: bookingData.status || 'requested',
      created_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    };

    return await super.create(bookingWithDefaults);
  }

  async findByCustomerId(customerId) {
    return await this.findAll({ customer_id: customerId });
  }

  async findByServiceId(serviceId) {
    return await this.findAll({ service_id: serviceId });
  }

  async findByDate(date) {
    return await this.findAll({ date });
  }

  async findByStatus(status) {
    return await this.findAll({ status });
  }

  async updateStatus(id, status) {
    const validStatuses = ['requested', 'contacted', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    return await this.update(id, { 
      status,
      status_updated_at: new Date()
    });
  }

  // Check for duplicate bookings (same customer, service, and date)
  async findDuplicateBooking(customerId, serviceId, date) {
    return await this.findOne({
      customer_id: customerId,
      service_id: serviceId,
      date: date,
      status: ['requested', 'confirmed', 'in_progress'] // Only check active statuses
    });
  }

  // Get today's bookings
  async findTodaysBookings() {
    const today = new Date().toISOString().split('T')[0];
    return await this.findAll({ date: today });
  }
}

module.exports = new Booking();