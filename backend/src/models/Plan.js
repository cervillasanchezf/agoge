const mongoose = require('mongoose');

const daySchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number,
    required: true,
    min: 1,
    max: 7, // 1=Lunes … 7=Domingo
  },
  trainings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
    },
  ],
}, { _id: false });

// Cada semana del plan puede tener su propia configuración de días
const weekSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true }, // 1-based
  isDeload:   { type: Boolean, default: false },
  label:      { type: String, default: '' },    // e.g. "Semana de descarga"
  days:       { type: [daySchema], default: [] },
}, { _id: false });

const planSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'El nombre de la planificación es requerido'],
    trim: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null,
  },
  // Configuración semana a semana; planWeeks.length = duración total del plan
  planWeeks: {
    type: [weekSchema],
    default: [],
  },
  measurementDay: {
    type: Number,
    default: null,
    min: 1,
    max: 7, // 1=Lunes … 7=Domingo
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Plan', planSchema);
