const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  // ID original del dataset externo (e.g. "Bench_Press")
  externalId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },

  // Nombre original en inglés — siempre presente
  name: { type: String, required: true },
  // Nombre traducido al castellano — vacío hasta traducción futura
  name_es: { type: String, default: '' },

  // Instrucciones en inglés
  instructions: [{ type: String }],
  // Instrucciones traducidas — array vacío hasta traducción futura
  instructions_es: [{ type: String }],

  // Campos de clasificación / filtrado
  category: { type: String, index: true },   // strength, cardio, stretching...
  level: { type: String, index: true },      // beginner, intermediate, expert
  force: { type: String },                   // push, pull, static
  mechanic: { type: String },                // compound, isolation
  equipment: { type: String, index: true },  // dumbbell, barbell, machine...

  // Músculos (usados como filtros)
  primaryMuscles: [{ type: String }],
  secondaryMuscles: [{ type: String }],

  // Paths de imágenes del dataset original
  // Para construir la URL: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<path>
  images: [{ type: String }],
}, {
  timestamps: false,
});

// Índice de texto para búsqueda por nombre
exerciseSchema.index({ name: 'text', name_es: 'text' });

module.exports = mongoose.model('Exercise', exerciseSchema);
