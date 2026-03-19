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
      order:   { type: Number, required: true },
      repMode: { type: String, enum: ['reps', 'range', 'cardio'], default: 'reps' },
      sets: [
        {
          // Fuerza
          reps:      { type: Number, default: 0 },
          repsTo:    { type: Number, default: 0 }, // para repMode 'range'
          weight:    { type: Number, default: 0 }, // kg
          rir:       { type: Number, default: 0 },
          completed: { type: Boolean, default: false },
          // Cardio
          km: { type: Number, default: 0 },
          h:  { type: Number, default: 0 },
          m:  { type: Number, default: 0 },
          s:  { type: Number, default: 0 },
        },
      ],
    },
  ],
  notes: { type: String, default: '' },
}, {
  timestamps: true,
});

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);
