const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { getLastSession, getSessionHistory, getExerciseMaxes, createSession, getAllSessions, updateSession, deleteSession } = require('../controllers/trainingSessionController');

const createSessionValidation = [
  body('trainingId').optional({ nullable: true }),
  body('exercises').isArray().withMessage('Los ejercicios deben ser un array'),
  body('duration').optional().isNumeric().withMessage('La duración debe ser un número'),
  body('date').optional().isISO8601().withMessage('La fecha debe ser una fecha válida'),
];

const updateSessionValidation = [
  body('duration').optional().isNumeric().withMessage('La duración debe ser un número'),
  body('date').optional().isISO8601().withMessage('La fecha debe ser una fecha válida'),
  body('notes').optional().isString().withMessage('Las notas deben ser texto'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.get('/all', auth, getAllSessions);
router.get('/last/:trainingId', auth, getLastSession);
router.get('/history/:trainingId', auth, getSessionHistory);
router.get('/exercise-maxes/:trainingId', auth, getExerciseMaxes);
router.post('/', auth, createSessionValidation, handleValidation, createSession);
router.put('/:id', auth, updateSessionValidation, handleValidation, updateSession);
router.delete('/:id', auth, deleteSession);

module.exports = router;
