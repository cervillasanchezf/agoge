/**
 * Seed script — importa los 873 ejercicios de free-exercise-db en MongoDB
 * Uso: node src/scripts/seedExercises.js
 *
 * Es idempotente: usa updateOne+upsert para no duplicar registros.
 */

const https = require('https');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Exercise = require('../models/Exercise');

const EXERCISES_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    let data = '';
    https.get(url, (res) => {
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado');

  console.log('Descargando ejercicios desde free-exercise-db...');
  const exercises = await fetchJSON(EXERCISES_URL);
  console.log(`${exercises.length} ejercicios descargados`);

  let inserted = 0;
  let updated = 0;

  for (const ex of exercises) {
    const doc = {
      externalId: ex.id,
      name: ex.name,
      name_es: '',            // pendiente de traducción futura
      instructions: ex.instructions || [],
      instructions_es: [],    // pendiente de traducción futura
      category: ex.category || null,
      level: ex.level || null,
      force: ex.force || null,
      mechanic: ex.mechanic || null,
      equipment: ex.equipment || null,
      primaryMuscles: ex.primaryMuscles || [],
      secondaryMuscles: ex.secondaryMuscles || [],
      images: ex.images || [],
    };

    const result = await Exercise.updateOne(
      { externalId: ex.id },
      { $set: doc },
      { upsert: true }
    );

    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }

  console.log(`Seed completado: ${inserted} insertados, ${updated} actualizados`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
