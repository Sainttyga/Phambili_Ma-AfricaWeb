const { Payment, Booking } = require('../models');

// Create a new payment
exports.createPayment = async (req, res) => {
  const { Booking_ID, Date, Amount, Method, Status } = req.body;
  try {
    const payment = await Payment.create({
      Booking_ID: Booking_ID || null,
      Date,
      Amount,
      Method,
      Status
    });
    res.status(201).json({ message: 'Payment created successfully', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [
        { model: Booking, attributes: ['ID', 'Date', 'Status'] }
      ]
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  const { id } = req.params;
  try {
    const payment = await Payment.findByPk(id, {
      include: [
        { model: Booking, attributes: ['ID', 'Date', 'Status'] }
      ]
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a payment
exports.updatePayment = async (req, res) => {
  const { id } = req.params;
  const { Booking_ID, Date, Amount, Method, Status } = req.body;
  try {
    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    payment.Booking_ID = Booking_ID !== undefined ? Booking_ID : payment.Booking_ID;
    payment.Date = Date || payment.Date;
    payment.Amount = Amount || payment.Amount;
    payment.Method = Method || payment.Method;
    payment.Status = Status || payment.Status;

    await payment.save();
    res.json({ message: 'Payment updated successfully', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a payment
exports.deletePayment = async (req, res) => {
  const { id } = req.params;
  try {
    const payment = await Payment.findByPk(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await payment.destroy();
    res.json({ message: 'Payment deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
