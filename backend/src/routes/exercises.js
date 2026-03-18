const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getExercises, getExerciseById, getFilters } = require('../controllers/exerciseController');

// /filters debe ir ANTES de /:id para que no lo interprete como un ID
// Los ejercicios son datos públicos, no requieren auth
router.get('/filters', getFilters);
router.get('/', getExercises);
router.get('/:id', getExerciseById);

module.exports = router;
