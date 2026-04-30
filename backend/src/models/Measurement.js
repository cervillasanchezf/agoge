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
  peso:         { type: Number, default: null, min: [20,  'Peso mínimo 20 kg'],  max: [400, 'Peso máximo 400 kg']  }, // kg
  cintura:      { type: Number, default: null, min: [30,  'Mínimo 30 cm'],  max: [250, 'Máximo 250 cm'] }, // cm
  cuello:       { type: Number, default: null, min: [20,  'Mínimo 20 cm'],  max: [80,  'Máximo 80 cm']  }, // cm
  hombro:       { type: Number, default: null, min: [50,  'Mínimo 50 cm'],  max: [200, 'Máximo 200 cm'] }, // cm
  pecho:        { type: Number, default: null, min: [40,  'Mínimo 40 cm'],  max: [250, 'Máximo 250 cm'] }, // cm
  bicepsIzq:    { type: Number, default: null, min: [10,  'Mínimo 10 cm'],  max: [80,  'Máximo 80 cm']  }, // cm
  bicepsDer:    { type: Number, default: null, min: [10,  'Mínimo 10 cm'],  max: [80,  'Máximo 80 cm']  }, // cm
  antebrazoIzq: { type: Number, default: null, min: [10,  'Mínimo 10 cm'],  max: [60,  'Máximo 60 cm']  }, // cm
  antebrazoDer: { type: Number, default: null, min: [10,  'Mínimo 10 cm'],  max: [60,  'Máximo 60 cm']  }, // cm
  abdomen:      { type: Number, default: null, min: [30,  'Mínimo 30 cm'],  max: [250, 'Máximo 250 cm'] }, // cm
  cadera:       { type: Number, default: null, min: [40,  'Mínimo 40 cm'],  max: [250, 'Máximo 250 cm'] }, // cm
  musloIzq:     { type: Number, default: null, min: [20,  'Mínimo 20 cm'],  max: [150, 'Máximo 150 cm'] }, // cm
  musloDer:     { type: Number, default: null, min: [20,  'Mínimo 20 cm'],  max: [150, 'Máximo 150 cm'] }, // cm
  gemeloIzq:    { type: Number, default: null, min: [15,  'Mínimo 15 cm'],  max: [100, 'Máximo 100 cm'] }, // cm
  gemeloDer:    { type: Number, default: null, min: [15,  'Mínimo 15 cm'],  max: [100, 'Máximo 100 cm'] }, // cm
}, {
  timestamps: true,
});

// Ordenar siempre por fecha descendente por defecto
measurementSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Measurement', measurementSchema);
