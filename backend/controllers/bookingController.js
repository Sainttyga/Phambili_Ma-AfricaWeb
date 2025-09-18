const { Booking, Customer, Service } = require('../models');

// Create a new booking
exports.createBooking = async (req, res) => {
  const { Customer_ID, Service_ID, Date } = req.body;

  if (!Customer_ID || !Service_ID || !Date) {
    return res.status(400).json({ message: 'Customer_ID, Service_ID, and Date are required.' });
  }

  try {
    const booking = await Booking.create({
      Customer_ID,
      Service_ID,
      Date,
      Status: 'Pending'
    });

    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { Status } = req.body;

  if (!Status) return res.status(400).json({ message: 'Status is required.' });

  try {
    const booking = await Booking.findByPk(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    booking.Status = Status;
    await booking.save();

    res.json({ message: 'Booking updated successfully', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all bookings with customer and service names
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      attributes: ['ID', 'Date', 'Status', 'Customer_ID', 'Service_ID'],
      include: [
        { model: Customer, attributes: [['Full_Name', 'Customer_Name']] },
        { model: Service, attributes: [['Name', 'Service_Name']] }
      ],
      raw: true,
      nest: true
    });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single booking by ID
exports.getBookingById = async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await Booking.findByPk(id, {
      attributes: ['ID', 'Date', 'Status', 'Customer_ID', 'Service_ID'],
      include: [
        { model: Customer, attributes: [['Full_Name', 'Customer_Name']] },
        { model: Service, attributes: [['Name', 'Service_Name']] }
      ],
      raw: true,
      nest: true
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// In bookingController.js
exports.deleteBooking = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Booking.destroy({ where: { ID: id } });
    if (!deleted) return res.status(404).json({ message: 'Booking not found.' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
