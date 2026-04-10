const mongoose = require('mongoose');

// Plantilla de entrenamiento — define qué ejercicios, orden, modo de reps y series por defecto.
// Las series son valores objetivo (plantilla). Los pesos/reps reales van en TrainingSession.
const setSchema = new mongoose.Schema({
  // Ejercicios de fuerza
  kg:     { type: String, default: '' },
  reps:   { type: String, default: '' },
  repsTo: { type: String, default: '' }, // solo para repMode 'range'
  rir:    { type: String, default: '' },
  // Ejercicios de cardio
  km:     { type: String, default: '' },
  h:      { type: Number, default: 0 },
  m:      { type: Number, default: 0 },
  s:      { type: Number, default: 0 },
  // Ejercicios pliométricos
  height:   { type: Number, default: 0 }, // cm — altura de caja/plataforma
  distance: { type: Number, default: 0 }, // cm — distancia de salto (broad jump, etc.)
}, { _id: false });

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
  // Tipo y formato del entrenamiento
  type:    { type: String, enum: ['strength', 'cardio', 'functional', 'plyometrics'], default: 'strength' },
  format:  { type: String, enum: ['straight', 'circuit', 'amrap', 'emom', 'fortime', 'tabata'], default: 'straight' },
  timeCap: { type: Number, default: 0 }, // segundos; 0 = sin límite de tiempo
  exercises: [
    {
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
        required: true,
      },
      order:   { type: Number, required: true },
      repMode: { type: String, enum: ['reps', 'range', 'cardio', 'plyometric'], default: 'reps' },
      sets:    { type: [setSchema], default: [] },
      note:    { type: String, default: '' },
    },
  ],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Training', trainingSchema);
