const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '90d' });

const formatUserResponse = (user, token, refreshToken) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  profileImage: user.profileImage,
  height: user.height,
  weight: user.weight,
  goal: user.goal,
  profileCompleted: user.profileCompleted,
  token,
  refreshToken,
});

// @desc    Registrar usuario
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'El usuario ya existe' });
    }

    const user = await User.create({ name, email, password });
    const token = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: formatUserResponse(user, token, refreshToken),
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error al registrar usuario' });
  }
};

// @desc    Login usuario
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const token = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      data: formatUserResponse(user, token, refreshToken),
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
};

// @desc    Renovar access token usando refresh token
// @route   POST /api/auth/refresh
// @access  Public
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token requerido' });
    }

    // Verificar firma del JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token inválido o expirado' });
    }

    // Verificar que el token coincide con el guardado en BD
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Sesión no válida' });
    }

    // Emitir nuevo access token (el refresh token se mantiene)
    const newToken = generateAccessToken(user._id);

    res.json({ success: true, data: { token: newToken } });
  } catch (error) {
    console.error('Error al renovar token:', error);
    res.status(500).json({ success: false, message: 'Error al renovar sesión' });
  }
};

// @desc    Cerrar sesión (invalida el refresh token)
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await User.findOneAndUpdate({ refreshToken }, { refreshToken: null });
    }
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
  }
};
