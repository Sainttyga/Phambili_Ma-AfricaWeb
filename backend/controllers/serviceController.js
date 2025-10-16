const { Service } = require('../models');
const path = require('path');
const fs = require('fs');

// Create a new service// In your serviceController.js - update the createService method
exports.createService = async (req, res) => {
  try {
    const { Name, Description, Price, Duration, Category, Is_Available } = req.body;

    if (!Name || !Price || !Duration) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, Price, and Duration are required.' 
      });
    }

    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      // Return the full URL path for the image
      imageUrl = `/upload/services/${req.file.filename}`;
      console.log(`📸 Image saved: ${imageUrl}`);
    }

    const service = await Service.create({ 
      Name, 
      Description, 
      Price, 
      Duration,
      Category,
      Is_Available: Is_Available !== undefined ? Is_Available : true,
      Image_URL: imageUrl
    });

    res.status(201).json({ 
      success: true,
      message: 'Service created successfully', 
      service 
    });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error creating service: ' + err.message 
    });
  }
};

// Get all services
exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll({
      order: [['created_at', 'DESC']]
    });
    
    res.json({ 
      success: true,
      services 
    });
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching services: ' + err.message 
    });
  }
};

// Get service by ID
exports.getServiceById = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found.' 
      });
    }
    
    res.json({ 
      success: true,
      service 
    });
  } catch (err) {
    console.error('Get service error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching service: ' + err.message 
    });
  }
};

// Update a service
exports.updateService = async (req, res) => {
  const { id } = req.params;
  const { Name, Description, Price, Duration, Category, Is_Available } = req.body;

  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found.' 
      });
    }

    // Handle image upload
    let imageUrl = service.Image_URL;
    if (req.file) {
      // Delete old image if exists
      if (service.Image_URL) {
        const oldImagePath = path.join(__dirname, '..', 'public', service.Image_URL);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/upload/services/${req.file.filename}`;
    }

    await service.update({
      Name: Name || service.Name,
      Description: Description !== undefined ? Description : service.Description,
      Price: Price != null ? Price : service.Price,
      Duration: Duration != null ? Duration : service.Duration,
      Category: Category !== undefined ? Category : service.Category,
      Is_Available: Is_Available !== undefined ? Is_Available : service.Is_Available,
      Image_URL: imageUrl
    });

    const updatedService = await Service.findByPk(id);
    
    res.json({ 
      success: true,
      message: 'Service updated successfully', 
      service: updatedService 
    });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating service: ' + err.message 
    });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  const { id } = req.params;
  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found.' 
      });
    }

    // Delete associated image if exists
    if (service.Image_URL) {
      const imagePath = path.join(__dirname, '..', 'public', service.Image_URL);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await service.destroy();
    
    res.json({ 
      success: true,
      message: 'Service deleted successfully' 
    });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting service: ' + err.message 
    });
  }
};

// Toggle service availability
exports.toggleServiceAvailability = async (req, res) => {
  const { id } = req.params;
  const { isAvailable } = req.body;

  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found.' 
      });
    }

    await service.update({ Is_Available: isAvailable });
    
    res.json({ 
      success: true,
      message: `Service ${isAvailable ? 'activated' : 'deactivated'} successfully`,
      service 
    });
  } catch (err) {
    console.error('Toggle service availability error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error updating service availability: ' + err.message 
    });
  }
};