const { Quotation, Customer, Service } = require('../models');

// Create a new quotation
exports.createQuotation = async (req, res) => {
  const { Customer_ID, Service_ID, Date, Amount } = req.body;
  try {
    const quotation = await Quotation.create({ Customer_ID, Service_ID, Date, Amount });
    res.status(201).json({ message: 'Quotation created successfully', quotation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all quotations
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.findAll({
      include: [
        { model: Customer, attributes: ['Full_Name', 'Email', 'Phone'] },
        { model: Service, attributes: ['Name', 'Price', 'Duration'] }
      ]
    });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get quotation by ID
exports.getQuotationById = async (req, res) => {
  const { id } = req.params;
  try {
    const quotation = await Quotation.findByPk(id, {
      include: [
        { model: Customer, attributes: ['Full_Name', 'Email', 'Phone'] },
        { model: Service, attributes: ['Name', 'Price', 'Duration'] }
      ]
    });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    res.json(quotation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a quotation
exports.updateQuotation = async (req, res) => {
  const { id } = req.params;
  const { Customer_ID, Service_ID, Date, Amount } = req.body;
  try {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    quotation.Customer_ID = Customer_ID || quotation.Customer_ID;
    quotation.Service_ID = Service_ID || quotation.Service_ID;
    quotation.Date = Date || quotation.Date;
    quotation.Amount = Amount || quotation.Amount;

    await quotation.save();
    res.json({ message: 'Quotation updated successfully', quotation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a quotation
exports.deleteQuotation = async (req, res) => {
  const { id } = req.params;
  try {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    await quotation.destroy();
    res.json({ message: 'Quotation deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
