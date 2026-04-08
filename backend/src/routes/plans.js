const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  activatePlan,
  finishPlan,
  deletePlan,
} = require('../controllers/planController');

router.get('/', auth, getPlans);
router.get('/:id', auth, getPlanById);
router.post('/', auth, createPlan);
router.put('/:id', auth, updatePlan);
router.patch('/:id/activate', auth, activatePlan);
router.patch('/:id/finish', auth, finishPlan);
router.delete('/:id', auth, deletePlan);

module.exports = router;
