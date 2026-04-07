const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMeasurements,
  getMeasurementById,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
} = require('../controllers/measurementController');

router.get('/', auth, getMeasurements);
router.get('/:id', auth, getMeasurementById);
router.post('/', auth, createMeasurement);
router.put('/:id', auth, updateMeasurement);
router.delete('/:id', auth, deleteMeasurement);

module.exports = router;
