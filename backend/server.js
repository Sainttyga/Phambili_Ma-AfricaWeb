require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config');
require('./models');
const security = require('./middleware/security');
const swagger = require('./swagger');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
app.use(bodyParser.json());
app.use(...security);

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

swagger(app);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));