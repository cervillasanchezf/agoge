const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getTrainings, getTrainingById, createTraining, updateTraining, deleteTraining } = require('../controllers/trainingController');

router.get('/', auth, getTrainings);
router.get('/:id', auth, getTrainingById);
router.post('/', auth, createTraining);
router.put('/:id', auth, updateTraining);
router.delete('/:id', auth, deleteTraining);

module.exports = router;
