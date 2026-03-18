const mongoose = require('mongoose');

// Plantilla de entrenamiento — define qué ejercicios y en qué orden
// NO guarda pesos ni repeticiones (eso va en TrainingSession)
const trainingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'El nombre del entrenamiento es requerido'],
    trim: true,
  },
  exercises: [
    {
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
        required: true,
      },
      order: { type: Number, required: true },
    },
  ],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Training', trainingSchema);
