const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

// Protect create/update/delete routes with simple authentication
router.post('/', auth, [
  body('Name').notEmpty(),
  body('Price').isDecimal(),
  body('Duration').isInt()
], validate, serviceController.createService);

router.get('/', serviceController.getServices);
router.get('/:id', serviceController.getServiceById);

router.put('/:id', auth, [
  body('Name').optional().notEmpty(),
  body('Price').optional().isDecimal(),
  body('Duration').optional().isInt()
], validate, serviceController.updateService);

router.delete('/:id', auth, serviceController.deleteService);

module.exports = router;