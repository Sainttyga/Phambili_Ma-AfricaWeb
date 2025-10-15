// controllers/quotationController.js
const { Quotation, Customer, Service } = require('../models');
const { Op } = require('sequelize');

// Create a new quotation
exports.createQuotation = async (req, res) => {
  const { Customer_ID, Service_ID, Date, Amount, Status = 'pending', Notes } = req.body;
  try {
    const quotation = await Quotation.create({ 
      Customer_ID, 
      Service_ID, 
      Date, 
      Amount, 
      Status,
      Notes 
    });
    res.status(201).json({ 
      success: true,
      message: 'Quotation created successfully', 
      quotation 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get all quotations with filtering
exports.getQuotations = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.Status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { '$Customer.Full_Name$': { [Op.like]: `%${search}%` } },
        { '$Service.Name$': { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: quotations } = await Quotation.findAndCountAll({
      where: whereClause,
      include: [
        { 
          model: Customer, 
          attributes: ['ID', 'Full_Name', 'Email', 'Phone'] 
        },
        { 
          model: Service, 
          attributes: ['ID', 'Name', 'Price', 'Duration'] 
        }
      ],
      order: [['Date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      success: true,
      quotations,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalQuotations: count
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get quotation by ID
exports.getQuotationById = async (req, res) => {
  const { id } = req.params;
  try {
    const quotation = await Quotation.findByPk(id, {
      include: [
        { 
          model: Customer, 
          attributes: ['ID', 'Full_Name', 'Email', 'Phone'] 
        },
        { 
          model: Service, 
          attributes: ['ID', 'Name', 'Price', 'Duration'] 
        }
      ]
    });
    if (!quotation) return res.status(404).json({ 
      success: false,
      message: 'Quotation not found' 
    });
    
    res.json({
      success: true,
      quotation
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Update a quotation
exports.updateQuotation = async (req, res) => {
  const { id } = req.params;
  const { Customer_ID, Service_ID, Date, Amount, Status, Notes } = req.body;
  try {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) return res.status(404).json({ 
      success: false,
      message: 'Quotation not found' 
    });

    // Update only provided fields
    if (Customer_ID !== undefined) quotation.Customer_ID = Customer_ID;
    if (Service_ID !== undefined) quotation.Service_ID = Service_ID;
    if (Date !== undefined) quotation.Date = Date;
    if (Amount !== undefined) quotation.Amount = Amount;
    if (Status !== undefined) quotation.Status = Status;
    if (Notes !== undefined) quotation.Notes = Notes;

    await quotation.save();
    
    res.json({ 
      success: true,
      message: 'Quotation updated successfully', 
      quotation 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Update quotation status only
exports.updateQuotationStatus = async (req, res) => {
  const { id } = req.params;
  const { Status } = req.body;
  try {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) return res.status(404).json({ 
      success: false,
      message: 'Quotation not found' 
    });

    quotation.Status = Status;
    await quotation.save();
    
    res.json({ 
      success: true,
      message: 'Quotation status updated successfully', 
      quotation 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Delete a quotation
exports.deleteQuotation = async (req, res) => {
  const { id } = req.params;
  try {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) return res.status(404).json({ 
      success: false,
      message: 'Quotation not found' 
    });

    await quotation.destroy();
    res.json({ 
      success: true,
      message: 'Quotation deleted successfully' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};

// Get quotation statistics for dashboard
exports.getQuotationStats = async (req, res) => {
  try {
    const pendingQuotations = await Quotation.count({
      where: { Status: 'pending' }
    });

    const totalQuotations = await Quotation.count();

    res.json({
      success: true,
      pendingQuotations: pendingQuotations || 0,
      totalQuotations: totalQuotations || 0
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
};