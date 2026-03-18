const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { register, login, refresh, logout } = require('../controllers/authController');

// Validaciones
const registerValidation = [
  body('name').trim().notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
];

const loginValidation = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es requerida')
];

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
