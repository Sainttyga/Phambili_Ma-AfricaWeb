// serviceController.js - FINAL VERSION (keep only one copy)
const { Service } = require('../models');
const path = require('path');
const fs = require('fs');

exports.createService = async (req, res) => {
  try {
    const { Name, Description, Duration, Category, Is_Available } = req.body;

    if (!Name || !Duration) {
      return res.status(400).json({ 
        success: false,
        message: 'Name and Duration are required.' 
      });
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/upload/services/${req.file.filename}`;
    }

    const service = await Service.create({ 
      Name, 
      Description, 
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

exports.updateService = async (req, res) => {
  const { id } = req.params;
  const { Name, Description, Duration, Category, Is_Available } = req.body;

  try {
    const service = await Service.findByPk(id);
    if (!service) {
      return res.status(404).json({ 
        success: false,
        message: 'Service not found.' 
      });
    }

    let imageUrl = service.Image_URL;
    if (req.file) {
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