const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getLastSession, getSessionHistory, createSession, getAllSessions, updateSession, deleteSession } = require('../controllers/trainingSessionController');

router.get('/all', auth, getAllSessions);
router.get('/last/:trainingId', auth, getLastSession);
router.get('/history/:trainingId', auth, getSessionHistory);
router.post('/', auth, createSession);
router.put('/:id', auth, updateSession);
router.delete('/:id', auth, deleteSession);

module.exports = router;
