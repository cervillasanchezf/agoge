const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getLastSession, getSessionHistory, createSession } = require('../controllers/trainingSessionController');

router.get('/last/:trainingId', auth, getLastSession);
router.get('/history/:trainingId', auth, getSessionHistory);
router.post('/', auth, createSession);

module.exports = router;
