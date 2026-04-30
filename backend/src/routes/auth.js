const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { register, login, refresh, logout } = require('../controllers/authController');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

// Rate limiting: máximo 10 intentos por IP cada 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Por favor, espera 15 minutos.' },
});

// Validaciones
const registerValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 12 }).withMessage('La contraseña debe tener al menos 12 caracteres')
];

const loginValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
];

const refreshValidation = [
  body('refreshToken').notEmpty().isString().withMessage('Refresh token requerido'),
];

router.post('/register', authLimiter, registerValidation, handleValidation, register);
router.post('/login', authLimiter, loginValidation, handleValidation, login);
router.post('/refresh', refreshValidation, handleValidation, refresh);
router.post('/logout', logout);

module.exports = router;
