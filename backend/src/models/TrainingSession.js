const mongoose = require('mongoose');

// Cada vez que el usuario ejecuta una plantilla se crea una TrainingSession
// Guarda los pesos y repeticiones reales. El historial nunca se borra.
const trainingSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  trainingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Training',
    required: true,
    index: true,
  },
  // Fecha de la sesión (puede diferir de createdAt si el usuario la registra a posteriori)
  date: {
    type: Date,
    default: Date.now,
    index: true,
  },
  exercises: [
    {
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
        required: true,
      },
      order: { type: Number, required: true },
      sets: [
        {
          reps: { type: Number, default: 0 },
          weight: { type: Number, default: 0 }, // kg
          completed: { type: Boolean, default: false },
        },
      ],
    },
  ],
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);
