const User = require('../models/User');

// @desc    Actualizar perfil de usuario
// @route   PUT /api/profile/:id
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { profileImage, height, weight, goal } = req.body;

    if (req.userId !== id) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (height !== undefined)       user.height       = height;
    if (weight !== undefined)       user.weight       = weight;
    if (goal !== undefined)         user.goal         = goal;

    // Solo marcar perfil completo si los tres campos obligatorios están presentes
    if (user.height && user.weight && user.goal) {
      user.profileCompleted = true;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        height: user.height,
        weight: user.weight,
        goal: user.goal,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
};

// @desc    Obtener perfil de usuario
// @route   GET /api/profile/:id
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }

    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  }
};
