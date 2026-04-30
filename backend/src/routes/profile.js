const express = require('express');
const router = express.Router();
const path = require('path');
const { body, validationResult } = require('express-validator');
const { updateProfile, getProfile, uploadProfileImage } = require('../controllers/profileController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const profileValidation = [
  body('height').optional().isFloat({ min: 100, max: 250 }).withMessage('La altura debe estar entre 100 y 250 cm'),
  body('weight').optional().isFloat({ min: 30, max: 300 }).withMessage('El peso debe estar entre 30 y 300 kg'),
  body('goal').optional().isIn(['ganar_masa', 'perder_grasa', 'mantener']).withMessage('Objetivo no válido'),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

router.put('/:id', auth, profileValidation, handleValidation, updateProfile);
router.get('/:id', auth, getProfile);
// POST /api/profile/avatar — sube imagen y devuelve la URL pública
router.post('/avatar', auth, upload.single('avatar'), uploadProfileImage);

module.exports = router;
