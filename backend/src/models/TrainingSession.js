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
    required: false,
    default: null,
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
      repMode: { type: String, enum: ['reps', 'range', 'cardio', 'plyometric', 'time'], default: 'reps' },
      phase:         { type: String, enum: ['warmup', 'main', 'cooldown'], default: 'main' },
      supersetGroup: { type: String, default: null },
      sets: [
        {
          // Fuerza
          reps:      { type: Number, default: 0 },
          repsTo:    { type: Number, default: 0 }, // para repMode 'range'
          weight:    { type: Number, default: 0 }, // kg
          rpe:       { type: Number, default: 0 },
          completed: { type: Boolean, default: false },
          // Cardio
          km: { type: Number, default: 0 },
          h:  { type: Number, default: 0 },
          m:  { type: Number, default: 0 },
          s:  { type: Number, default: 0 },
          // Pliométrico
          height:   { type: Number, default: 0 }, // cm — altura de caja/plataforma
          distance: { type: Number, default: 0 }, // cm — distancia de salto
        },
      ],
    },
  ],
  sessionName: { type: String, default: '' }, // nombre personalizado (sobreescribe trainingId.name)
  notes: { type: String, default: '' },
  duration:  { type: Number, default: 0 }, // segundos
  // Resultados de formatos funcionales/circuito
  rounds:    { type: Number, default: 0 }, // rondas completadas (AMRAP, ForTime, circuit)
  totalTime: { type: Number, default: 0 }, // tiempo real del WOD en segundos (ForTime)
}, {
  timestamps: true,
});

// Índices compuestos para las queries más frecuentes
trainingSessionSchema.index({ userId: 1, date: -1 });       // historial general
trainingSessionSchema.index({ userId: 1, trainingId: 1, date: -1 }); // historial por plantilla

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);
