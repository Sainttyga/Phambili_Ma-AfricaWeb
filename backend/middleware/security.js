const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Basic rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = [helmet(), limiter];