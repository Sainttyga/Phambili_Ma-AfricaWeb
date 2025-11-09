// models/Service.js
const BaseModel = require('./BaseModel');

class Service extends BaseModel {
  constructor() {
    super('services');
  }

  async create(serviceData) {
    const serviceWithDefaults = {
      ...serviceData,
      is_available: serviceData.is_available !== undefined ? serviceData.is_available : true,
      is_active: serviceData.is_active !== undefined ? serviceData.is_active : true,
      popularity: serviceData.popularity || 0,
      duration: serviceData.duration || 60 // Default 60 minutes
    };

    return await super.create(serviceWithDefaults);
  }

  async findAvailable() {
    return await this.findAll({ 
      is_available: true, 
      is_active: true 
    });
  }

  async findByCategory(category) {
    return await this.findAll({ 
      category, 
      is_available: true,
      is_active: true 
    });
  }

  async updateAvailability(id, isAvailable) {
    return await this.update(id, { is_available: isAvailable });
  }

  async incrementPopularity(id) {
    const service = await this.findById(id);
    if (service) {
      const newPopularity = (service.popularity || 0) + 1;
      await this.update(id, { popularity: newPopularity });
    }
  }

  // Search services by name or description
  async search(query) {
    // Note: Firebase doesn't support full-text search natively
    // This is a basic implementation - consider using Algolia or similar for production
    const allServices = await this.findAll({ is_active: true });
    const searchTerm = query.toLowerCase();
    
    return allServices.filter(service => 
      service.name.toLowerCase().includes(searchTerm) ||
      (service.description && service.description.toLowerCase().includes(searchTerm))
    );
  }
}

module.exports = new Service();