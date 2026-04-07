const express = require('express');
const router = express.Router();
const { updateProfile, getProfile } = require('../controllers/profileController');
const auth = require('../middleware/auth');

router.put('/:id', auth, updateProfile);
router.get('/:id', auth, getProfile);

module.exports = router;
