/**
 * Traducciones de los valores del dataset free-exercise-db al castellano.
 * Los nombres de ejercicios e instrucciones se mantienen en inglés por ahora.
 * Cuando se completen los campos name_es / instructions_es en la BD,
 * el frontend los mostrará automáticamente sin tocar este fichero.
 */

export const CATEGORY_LABELS = {
  strength: 'Fuerza',
  stretching: 'Estiramientos',
  plyometrics: 'Pliometría',
  strongman: 'Strongman',
  powerlifting: 'Powerlifting',
  cardio: 'Cardio',
  olympic_weightlifting: 'Halterofilia',
};

export const LEVEL_LABELS = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  expert: 'Experto',
};

export const FORCE_LABELS = {
  push: 'Empuje',
  pull: 'Tracción',
  static: 'Estático',
};

export const MECHANIC_LABELS = {
  compound: 'Compuesto',
  isolation: 'Aislamiento',
};

export const EQUIPMENT_LABELS = {
  bands: 'Bandas',
  barbell: 'Barra',
  'body only': 'Sin material',
  cable: 'Polea',
  dumbbell: 'Mancuernas',
  'e-z curl bar': 'Barra EZ',
  'exercise ball': 'Pelota fitball',
  'foam roll': 'Foam roller',
  kettlebells: 'Kettlebells',
  machine: 'Máquina',
  'medicine ball': 'Balón medicinal',
  other: 'Otro',
};

export const MUSCLE_LABELS = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Pantorrillas',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Lumbar',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
};

/**
 * Devuelve el nombre a mostrar de un ejercicio:
 * usa name_es si está relleno, sino name en inglés.
 */
export function getExerciseName(exercise) {
  return exercise?.name_es || exercise?.name || '';
}

/**
 * Devuelve las instrucciones a mostrar de un ejercicio:
 * usa instructions_es si están rellenas, sino instructions en inglés.
 */
export function getExerciseInstructions(exercise) {
  if (exercise?.instructions_es?.length) return exercise.instructions_es;
  return exercise?.instructions || [];
}
