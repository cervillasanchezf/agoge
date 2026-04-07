const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    default: Date.now,
    index: true,
  },
  // Fotos de seguimiento (URIs o base64)
  photos: {
    type: [String],
    default: [],
  },
  // Medidas corporales (todas en cm excepto peso en kg)
  peso:            { type: Number, default: null }, // kg
  cintura:         { type: Number, default: null }, // cm
  cuello:          { type: Number, default: null }, // cm
  hombro:          { type: Number, default: null }, // cm
  pecho:           { type: Number, default: null }, // cm
  bicepsIzq:       { type: Number, default: null }, // cm
  bicepsDer:       { type: Number, default: null }, // cm
  antebrazoIzq:    { type: Number, default: null }, // cm
  antebrazoDer:    { type: Number, default: null }, // cm
  abdomen:         { type: Number, default: null }, // cm
  cadera:          { type: Number, default: null }, // cm
  musloIzq:        { type: Number, default: null }, // cm
  musloDer:        { type: Number, default: null }, // cm
  gemeloIzq:    { type: Number, default: null }, // cm
  gemeloDer:     { type: Number, default: null }, // cm
}, {
  timestamps: true,
});

// Ordenar siempre por fecha descendente por defecto
measurementSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Measurement', measurementSchema);
