const { Order, Customer, Product, Payment } = require('../models');

// Create a new order
exports.createOrder = async (req, res) => {
  const { Customer_ID, Product_ID, Payment_ID, Date } = req.body;
  try {
    const order = await Order.create({
      Customer_ID,
      Product_ID,
      Payment_ID: Payment_ID || null, // optional
      Date
    });
    res.status(201).json({ message: 'Order created successfully', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: Customer, attributes: ['Full_Name', 'Email', 'Phone'] },
        { model: Product, attributes: ['Name', 'Price', 'Stock_Quantity'] },
        { model: Payment, attributes: ['Amount', 'Method', 'Status'], required: false }
      ]
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findByPk(id, {
      include: [
        { model: Customer, attributes: ['Full_Name', 'Email', 'Phone'] },
        { model: Product, attributes: ['Name', 'Price', 'Stock_Quantity'] },
        { model: Payment, attributes: ['Amount', 'Method', 'Status'], required: false }
      ]
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  const { id } = req.params;
  const { Customer_ID, Product_ID, Payment_ID, Date } = req.body;
  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.Customer_ID = Customer_ID || order.Customer_ID;
    order.Product_ID = Product_ID || order.Product_ID;
    order.Payment_ID = Payment_ID !== undefined ? Payment_ID : order.Payment_ID;
    order.Date = Date || order.Date;

    await order.save();
    res.json({ message: 'Order updated successfully', order });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await order.destroy();
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
