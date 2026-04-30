const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor ingrese un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [12, 'La contraseña debe tener al menos 12 caracteres']
  },
  profileImage: {
    type: String,
    default: 'https://ui-avatars.com/api/?name=User&size=200&background=6366f1&color=fff'
  },
  height: {
    type: Number,
    min: [100, 'La altura debe ser al menos 100 cm'],
    max: [250, 'La altura debe ser máximo 250 cm']
  },
  weight: {
    type: Number,
    min: [30, 'El peso debe ser al menos 30 kg'],
    max: [300, 'El peso debe ser máximo 300 kg']
  },
  goal: {
    type: String,
    enum: ['ganar_masa', 'perder_grasa', 'mantener']
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  refreshToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
