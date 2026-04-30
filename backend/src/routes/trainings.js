const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { getTrainings, getTrainingById, createTraining, updateTraining, deleteTraining } = require('../controllers/trainingController');

const trainingValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido').isLength({ max: 100 }).withMessage('El nombre no puede superar los 100 caracteres'),
  body('exercises').isArray({ min: 1 }).withMessage('Debes añadir al menos un ejercicio'),
  body('exercises.*.exerciseId').notEmpty().withMessage('Cada ejercicio debe tener un ID válido'),
];

const updateTrainingValidation = [
  body('name').optional().trim().isLength({ max: 100 }).withMessage('El nombre no puede superar los 100 caracteres'),
  body('exercises').optional().isArray({ min: 1 }).withMessage('Debes añadir al menos un ejercicio'),
  body('exercises.*.exerciseId').optional().notEmpty().withMessage('Cada ejercicio debe tener un ID válido'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.get('/', auth, getTrainings);
router.get('/:id', auth, getTrainingById);
router.post('/', auth, trainingValidation, handleValidation, createTraining);
router.put('/:id', auth, updateTrainingValidation, handleValidation, updateTraining);
router.delete('/:id', auth, deleteTraining);

module.exports = router;
