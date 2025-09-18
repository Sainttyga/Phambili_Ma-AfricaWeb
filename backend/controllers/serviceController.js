const { Service } = require('../models');

// CRUD Operations
// CREATE
exports.createService = async (req, res) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ
exports.getServices = async (req, res) => {
  try {
    const services = await Service.findAll();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ
exports.getServiceById = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found.' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateService = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found.' });
    await service.update(req.body);
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findByPk(req.params.id);
    if (!service) return res.status(404).json({ message: 'Service not found.' });
    await service.destroy();
    res.json({ message: 'Service deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};