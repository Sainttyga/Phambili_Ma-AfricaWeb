// models/Gallery.js
const BaseModel = require('./BaseModel');

class Gallery extends BaseModel {
  constructor() {
    super('gallery');
  }

  async create(galleryData) {
    return await super.create({
      ...galleryData,
      media_type: galleryData.media_type || 'image',
      category: galleryData.category || 'general',
      is_active: galleryData.is_active !== undefined ? galleryData.is_active : true
    });
  }

  async findActive() {
    return await this.findAll({ is_active: true });
  }

  async findByCategory(category) {
    return await this.findAll({ category, is_active: true });
  }

  async findByMediaType(mediaType) {
    return await this.findAll({ media_type: mediaType, is_active: true });
  }
}

module.exports = new Gallery();