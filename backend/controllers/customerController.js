const { Customer } = require('../models');

exports.getProfile = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.user.id, {
      attributes: { exclude: ['Password'] }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { Phone, Address } = req.body;
  try {
    const customer = await Customer.findByPk(req.user.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    customer.Phone = Phone || customer.Phone;
    customer.Address = Address || customer.Address;
    await customer.save();
    res.json({ message: 'Profile updated.', customer });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};