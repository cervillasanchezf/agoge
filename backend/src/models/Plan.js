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

// Each time the days configuration changes while the plan is active,
// a snapshot is appended so adherence stats remain historically accurate.
const dayHistoryEntrySchema = new mongoose.Schema({
  effectiveFrom: { type: Date, required: true },
  days: { type: [daySchema], default: [] },
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
  weeks: {
    type: Number,
    required: [true, 'La duración en semanas es requerida'],
    min: 1,
    max: 52,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null,
  },
  days: {
    type: [daySchema],
    default: [],
  },
  measurementDay: {
    type: Number,
    default: null,
    min: 1,
    max: 7, // 1=Lunes … 7=Domingo
  },
  // Versioned history of day configurations (appended on each change)
  dayHistory: {
    type: [dayHistoryEntrySchema],
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Plan', planSchema);
