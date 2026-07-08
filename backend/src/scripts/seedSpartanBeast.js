/**
 * seedSpartanBeast.js
 * Siembra el plan "Spartan Beast" de 12 semanas (semanas 1-8 incluidas en el documento)
 * en la base de datos de Agoge.
 *
 *  - Busca cada ejercicio por nombre antes de crearlo.
 *  - Convierte millas → kilómetros (1 mi = 1.60934 km).
 *  - Reutiliza entrenamientos idénticos entre semanas.
 *  - Es idempotente: puede ejecutarse varias veces sin duplicar datos.
 *
 * Uso:
 *   node src/scripts/seedSpartanBeast.js [email_del_usuario]
 *   Si no se pasa email se usa el primer usuario de la base de datos.
 */

'use strict';
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const Exercise = require('../models/Exercise');
const Training = require('../models/Training');
const Plan     = require('../models/Plan');
const User     = require('../models/User');
const TrainingSession = require('../models/TrainingSession');

// ─── Conversión de unidades ───────────────────────────────────────────────────
/** Millas → km, 2 decimales */
const mi = (miles) => parseFloat((miles * 1.60934).toFixed(2));

// ─── Constructores de sets ────────────────────────────────────────────────────
/** Set de fuerza: reps (+ opcionales kg y rpe como string) */
const rSet = (reps, kg = '', rpe = '') => ({ kg: String(kg), reps: String(reps), repsTo: '', rpe: String(rpe) });

/** Set de tiempo: minutos + segundos */
const tSet = (m, s = 0) => ({ h: 0, m, s });

/** Set de cardio: km + esfuerzo% + descanso en segundos */
const cSet = (km, effort = 0, restSecs = 0) => ({
  km: String(km),
  h: 0, m: 0, s: 0,
  ...(effort   > 0 ? { effort }               : {}),
  ...(restSecs > 0 ? { restSeconds: restSecs } : {}),
});

/** Repite el mismo set N veces (para circuitos de N rondas) */
const xN = (set, n = 3) => Array.from({ length: n }, () => ({ ...set }));

/** Constructor de exercise-entry para un Training */
const ex = (exerciseId, order, repMode, sets, note = '', phase = 'main') => ({
  exerciseId, order, phase, repMode, supersetGroup: null, sets, note,
});

// ─── findOrCreate exercise ────────────────────────────────────────────────────
async function foc(searchQuery, createDoc) {
  const found = await Exercise.findOne(searchQuery).lean();
  if (found) {
    console.log(`  ✓  ${found.name}`);
    return found;
  }
  const created = await Exercise.findOneAndUpdate(
    { externalId: createDoc.externalId },
    { $setOnInsert: createDoc },
    { upsert: true, new: true, lean: true }
  );
  console.log(`  +  ${created.name}  (creado)`);
  return created;
}

// ─── Resolución de todos los ejercicios del plan ──────────────────────────────
async function resolveExercises() {
  console.log('\nResolviendo ejercicios...');
  const E = {};

  /* ── Cardio / funcional ── */
  E.running = await foc(
    { name: /^running$/i },
    { externalId: 'Spartan_Running', name: 'Running', name_es: 'Carrera', category: 'cardio', level: 'beginner', force: null, mechanic: null, equipment: 'body only', primaryMuscles: ['quadriceps', 'hamstrings', 'calves'], secondaryMuscles: ['glutes'], instructions: ['Run at the specified pace.'], instructions_es: ['Corre al ritmo indicado.'], images: [] }
  );

  E.hill_sprint = await foc(
    { name: /hill sprint/i },
    { externalId: 'Spartan_Hill_Sprint', name: 'Hill Sprint', name_es: 'Sprint en cuesta', category: 'cardio', level: 'intermediate', force: null, mechanic: null, equipment: 'body only', primaryMuscles: ['quadriceps', 'glutes', 'calves'], secondaryMuscles: ['hamstrings'], instructions: ['Sprint uphill at maximum effort for the specified duration.'], instructions_es: ['Sprint cuesta arriba al máximo esfuerzo durante el tiempo indicado.'], images: [] }
  );

  E.stairmaster = await foc(
    { name: /stairmaster|stair climber|bleacher/i },
    { externalId: 'Spartan_Stairmaster', name: 'Stairmaster', name_es: 'Stairmaster / Escaleras', category: 'cardio', level: 'beginner', force: null, mechanic: null, equipment: 'machine', primaryMuscles: ['quadriceps', 'glutes', 'calves'], secondaryMuscles: ['hamstrings'], instructions: ['Climb stairs or use stairmaster at a steady pace.'], instructions_es: ['Sube escaleras o usa el Stairmaster a paso constante.'], images: [] }
  );

  E.hiking = await foc(
    { name: /hiking|hike/i },
    { externalId: 'Spartan_Hiking', name: 'Hiking', name_es: 'Senderismo', category: 'cardio', level: 'beginner', force: null, mechanic: null, equipment: 'body only', primaryMuscles: ['quadriceps', 'glutes', 'calves'], secondaryMuscles: ['hamstrings', 'abdominals'], instructions: ['Hike at a moderate pace.'], instructions_es: ['Camina a ritmo moderado por terreno variado.'], images: [] }
  );

  /* ── Fuerza – probable en free-exercise-db ── */
  E.squat = await foc(
    { name: /^(bodyweight )?squat$/i, category: 'strength' },
    { externalId: 'Spartan_Squat_BW', name: 'Bodyweight Squat', name_es: 'Sentadilla', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings', 'calves'], instructions: ['Stand with feet shoulder-width apart. Lower hips until thighs are parallel to the floor. Return to standing.'], instructions_es: ['Pies a la anchura de hombros. Baja las caderas hasta que los muslos estén paralelos al suelo. Vuelve.'], images: [] }
  );

  E.push_up = await foc(
    { name: /^push.?ups?$|^pushups?$/i, category: 'strength' },
    { externalId: 'Spartan_Push_Up', name: 'Push-Up', name_es: 'Flexión de brazos', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'], instructions: ['Start in plank. Lower chest to floor. Push back up.'], instructions_es: ['Posición de plancha. Baja el pecho al suelo. Empuja arriba.'], images: [] }
  );

  E.lunge = await foc(
    { name: /^(bodyweight )?lunge$/i, category: 'strength' },
    { externalId: 'Spartan_Lunge_BW', name: 'Lunge', name_es: 'Zancada', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings'], instructions: ['Step forward, lower back knee toward floor. Return to standing.'], instructions_es: ['Da un paso al frente. Baja la rodilla trasera. Vuelve.'], images: [] }
  );

  E.walking_lunge = await foc(
    { name: /walking lunge/i, category: 'strength' },
    { externalId: 'Spartan_Walking_Lunge', name: 'Walking Lunge', name_es: 'Zancada caminando', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings'], instructions: ['Lunge forward alternating legs, walking continuously.'], instructions_es: ['Zancada hacia adelante alternando piernas, avanzando de forma continua.'], images: [] }
  );

  E.tricep_dip = await foc(
    { name: /tricep.?dip|dip.*tricep|^dips?$/i, category: 'strength' },
    { externalId: 'Spartan_Tricep_Dip', name: 'Tricep Dip', name_es: 'Fondo de tríceps', category: 'strength', level: 'beginner', force: 'push', mechanic: 'isolation', equipment: 'body only', primaryMuscles: ['triceps'], secondaryMuscles: ['chest', 'shoulders'], instructions: ['Hands on bench, lower body by bending elbows. Push back up.'], instructions_es: ['Manos en banco. Baja doblando codos. Empuja arriba.'], images: [] }
  );

  E.pull_up = await foc(
    { name: /^pull.?ups?$/i, category: 'strength' },
    { externalId: 'Spartan_Pull_Up', name: 'Pull-Up', name_es: 'Dominada', category: 'strength', level: 'intermediate', force: 'pull', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'middle back'], instructions: ['Hang from bar. Pull chin above bar. Lower slowly.'], instructions_es: ['Cuelga de la barra. Tira hasta que la barbilla supere la barra. Baja lentamente.'], images: [] }
  );

  E.db_deadlift = await foc(
    { name: /dumbbell deadlift/i, category: 'strength' },
    { externalId: 'Spartan_DB_Deadlift', name: 'Dumbbell Deadlift', name_es: 'Peso muerto con mancuernas', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'lower back', 'quadriceps'], instructions: ['Hold dumbbells. Hinge at hips, lower to shin level. Drive hips forward to stand.'], instructions_es: ['Sujeta mancuernas. Bisagra en cadera, baja hasta la espinilla. Empuja caderas al frente.'], images: [] }
  );

  E.db_bench_press = await foc(
    { name: /dumbbell.*bench.*press|dumbbell.*chest.*press/i, category: 'strength' },
    { externalId: 'Spartan_DB_Bench_Press', name: 'Dumbbell Bench Press', name_es: 'Press de banca con mancuernas', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'], instructions: ['Lie on bench, press dumbbells from chest to full extension. Lower slowly.'], instructions_es: ['Túmbate en banco. Empuja mancuernas desde el pecho hasta extensión completa. Baja lentamente.'], images: [] }
  );

  E.sl_deadlift = await foc(
    { name: /single.leg.*deadlift|one.legged.*deadlift|one.leg.*deadlift/i },
    { externalId: 'Spartan_SL_Deadlift', name: 'Single-Leg Deadlift', name_es: 'Peso muerto a una pierna', category: 'strength', level: 'intermediate', force: 'pull', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'lower back', 'abdominals'], instructions: ['Stand on one leg. Hinge forward at hip extending opposite leg behind. Return.'], instructions_es: ['De pie sobre una pierna. Bisagra en cadera extendiendo la pierna contraria. Vuelve.'], images: [] }
  );

  E.db_shoulder_press = await foc(
    { name: /dumbbell.*shoulder.*press|dumbbell.*overhead.*press/i, category: 'strength' },
    { externalId: 'Spartan_DB_Shoulder_Press', name: 'Dumbbell Shoulder Press', name_es: 'Press de hombros con mancuernas', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps', 'traps'], instructions: ['Hold dumbbells at shoulder height. Press overhead. Lower slowly.'], instructions_es: ['Mancuernas a la altura de hombros. Empuja arriba. Baja lentamente.'], images: [] }
  );

  E.calf_raise = await foc(
    { name: /calf raise/i, category: 'strength' },
    { externalId: 'Spartan_Calf_Raise', name: 'Calf Raise', name_es: 'Elevación de talones', category: 'strength', level: 'beginner', force: 'push', mechanic: 'isolation', equipment: 'body only', primaryMuscles: ['calves'], secondaryMuscles: [], instructions: ['Rise up on toes. Lower slowly.'], instructions_es: ['Súbete de puntillas. Baja lentamente.'], images: [] }
  );

  E.skull_crusher = await foc(
    { name: /skull crusher/i, category: 'strength' },
    { externalId: 'Spartan_Skull_Crusher', name: 'Skull Crusher', name_es: 'Rompe-cráneos', category: 'strength', level: 'beginner', force: 'push', mechanic: 'isolation', equipment: 'dumbbell', primaryMuscles: ['triceps'], secondaryMuscles: [], instructions: ['Lie on bench. Hold dumbbells above chest. Lower toward forehead by bending elbows. Extend.'], instructions_es: ['Túmbate en banco. Mancuernas sobre el pecho. Baja hacia la frente. Extiende.'], images: [] }
  );

  E.pistol_squat = await foc(
    { name: /pistol squat|one.legged squat/i },
    { externalId: 'Spartan_Pistol_Squat', name: 'Pistol Squat', name_es: 'Sentadilla pistola', category: 'strength', level: 'expert', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings', 'calves'], instructions: ['Stand on one leg. Lower hips to the floor. Return to standing.'], instructions_es: ['De pie sobre una pierna. Baja las caderas al suelo. Vuelve a la posición inicial.'], images: [] }
  );

  E.jump_squat = await foc(
    { name: /^(barbell )?jump squat$/i },
    { externalId: 'Spartan_Jump_Squat', name: 'Jump Squat', name_es: 'Sentadilla con salto', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings', 'calves'], instructions: ['Squat down, then explosively jump up. Land softly and repeat.'], instructions_es: ['Sentadilla y luego salta explosivamente. Aterriza suave y repite.'], images: [] }
  );

  E.squat_to_press = await foc(
    { name: /squat.*press|dumbbell.*thruster|thruster/i },
    { externalId: 'Spartan_Squat_Press', name: 'Squat to Overhead Press', name_es: 'Sentadilla con press', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['quadriceps', 'shoulders'], secondaryMuscles: ['glutes', 'triceps'], instructions: ['Hold dumbbells at shoulders. Squat. As you stand press dumbbells overhead. Lower back to shoulders.'], instructions_es: ['Mancuernas en hombros. Sentadilla. Al subir lleva las mancuernas arriba. Baja a los hombros.'], images: [] }
  );

  E.db_row = await foc(
    { name: /bent.over.*dumbbell.*row|dumbbell.*row/i, category: 'strength' },
    { externalId: 'Spartan_DB_Row', name: 'Bent-Over Dumbbell Row', name_es: 'Remo con mancuerna inclinado', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['middle back', 'lats'], secondaryMuscles: ['biceps', 'rhomboids'], instructions: ['Hinge forward at hips. Pull dumbbells to ribcage. Lower slowly.'], instructions_es: ['Inclínate hacia adelante. Tira las mancuernas hasta las costillas. Baja lentamente.'], images: [] }
  );

  E.db_pullover = await foc(
    { name: /dumbbell pullover|dumbbell.*pull.over/i, category: 'strength' },
    { externalId: 'Spartan_DB_Pullover', name: 'Dumbbell Pullover', name_es: 'Pull-over con mancuerna', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['chest', 'lats'], secondaryMuscles: ['triceps'], instructions: ['Lie on bench. Hold dumbbell over chest. Lower behind head. Return.'], instructions_es: ['Túmbate en banco. Mancuerna sobre el pecho. Baja detrás de la cabeza. Vuelve.'], images: [] }
  );

  E.db_shrug = await foc(
    { name: /dumbbell shrug|dumbbell.*shoulder shrug/i, category: 'strength' },
    { externalId: 'Spartan_DB_Shrug', name: 'Dumbbell Shoulder Shrug', name_es: 'Encogimiento de hombros con mancuernas', category: 'strength', level: 'beginner', force: null, mechanic: 'isolation', equipment: 'dumbbell', primaryMuscles: ['traps'], secondaryMuscles: [], instructions: ['Hold dumbbells at sides. Shrug shoulders as high as possible. Lower slowly.'], instructions_es: ['Mancuernas a los lados. Encoge los hombros lo máximo. Baja lentamente.'], images: [] }
  );

  E.calf_raise_leg_press = await foc(
    { name: /leg press.*calf|calf.*leg press/i },
    // If not found, reuse the regular calf raise — search for it by externalId
    { externalId: 'Spartan_Calf_Raise', name: 'Calf Raise', name_es: 'Elevación de talones', category: 'strength', level: 'beginner', force: 'push', mechanic: 'isolation', equipment: 'body only', primaryMuscles: ['calves'], secondaryMuscles: [], instructions: ['Rise up on toes. Lower slowly.'], instructions_es: ['Súbete de puntillas. Baja lentamente.'], images: [] }
  );
  // Normalize: if we end up with a dup search result, both keys point to same doc
  if (!E.calf_raise_leg_press) E.calf_raise_leg_press = E.calf_raise;

  E.wrist_curl = await foc(
    { name: /wrist curl/i, category: 'strength' },
    { externalId: 'Spartan_Wrist_Curl', name: 'Dumbbell Wrist Curl', name_es: 'Curl de muñeca con mancuerna', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'isolation', equipment: 'dumbbell', primaryMuscles: ['forearms'], secondaryMuscles: [], instructions: ['Forearms on thighs, palms up. Curl wrists upward. Lower slowly.'], instructions_es: ['Antebrazos apoyados, palmas arriba. Flexiona muñecas arriba. Baja lentamente.'], images: [] }
  );

  /* ── Funcional / OCR – probablemente NO en free-exercise-db ── */
  E.plank_up_down = await foc(
    { name: /plank.*up.*down|up.?down.*plank/i },
    { externalId: 'Spartan_Plank_Up_Down', name: 'Plank Up-Down', name_es: 'Plancha arriba-abajo', category: 'strength', level: 'beginner', force: 'push', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['abdominals', 'triceps'], secondaryMuscles: ['shoulders', 'chest'], instructions: ['High plank → lower one arm at a time to forearm plank → push back up.'], instructions_es: ['Plancha alta → baja un brazo a la vez a plancha de antebrazos → sube.'], images: [] }
  );

  E.burpee = await foc(
    { name: /burpee/i },
    { externalId: 'Spartan_Burpee', name: 'Burpee', name_es: 'Burpee', category: 'cardio', level: 'intermediate', force: null, mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps', 'chest', 'shoulders'], secondaryMuscles: ['hamstrings', 'triceps', 'abdominals'], instructions: ['Drop to push-up position. Do a push-up. Jump feet to hands. Jump up with arms overhead.'], instructions_es: ['Cae a posición de flexión. Flexión. Salta los pies hacia las manos. Salta con brazos arriba.'], images: [] }
  );

  E.supine_leg_lift = await foc(
    { name: /supine.*leg.*lift|lying.*leg.*raise|^leg.*raise$/i, category: 'strength' },
    { externalId: 'Spartan_Supine_Leg_Lift', name: 'Supine Leg Lift', name_es: 'Elevación de piernas tumbado', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'isolation', equipment: 'body only', primaryMuscles: ['abdominals'], secondaryMuscles: ['hip flexors'], instructions: ['Lie flat. Lift legs to 90°. Lower slowly.'], instructions_es: ['Túmbate boca arriba. Eleva las piernas a 90°. Baja lentamente.'], images: [] }
  );

  E.inverted_row = await foc(
    { name: /inverted row|body.?up/i },
    { externalId: 'Spartan_Inverted_Row', name: 'Inverted Row', name_es: 'Remo invertido', category: 'strength', level: 'beginner', force: 'pull', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['middle back', 'lats'], secondaryMuscles: ['biceps', 'rhomboids'], instructions: ['Hang below a bar, body straight. Pull chest to bar. Lower slowly.'], instructions_es: ['Cuelga debajo de una barra con el cuerpo recto. Tira el pecho hasta la barra. Baja lentamente.'], images: [] }
  );

  E.kettlebell_halo = await foc(
    { name: /kettlebell halo|halo/i },
    { externalId: 'Spartan_KB_Halo', name: 'Kettlebell Halo', name_es: 'Halo con kettlebell', category: 'strength', level: 'beginner', force: null, mechanic: 'compound', equipment: 'kettlebell', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps', 'upper back'], instructions: ['Hold kettlebell at chest. Circle it around head in one direction, then the other.'], instructions_es: ['Kettlebell al pecho. Hazla girar alrededor de la cabeza en un sentido y luego en el otro.'], images: [] }
  );

  E.dead_hang = await foc(
    { name: /dead hang/i },
    { externalId: 'Spartan_Dead_Hang', name: 'Dead Hang', name_es: 'Colgada muerta', category: 'strength', level: 'beginner', force: 'static', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['lats', 'forearms'], secondaryMuscles: ['biceps', 'shoulders'], instructions: ['Hang from a bar with arms fully extended. Hold for time.'], instructions_es: ['Cuélgate de una barra con los brazos extendidos. Aguanta el tiempo indicado.'], images: [] }
  );

  E.farmer_carry = await foc(
    { name: /farmer.?(carry|walk)/i },
    { externalId: 'Spartan_Farmer_Carry', name: 'Farmer Carry', name_es: 'Marcha del granjero', category: 'strength', level: 'beginner', force: 'static', mechanic: 'compound', equipment: 'dumbbell', primaryMuscles: ['forearms', 'traps'], secondaryMuscles: ['quadriceps', 'glutes', 'abdominals'], instructions: ['Hold heavy weights at sides. Walk upright for the specified time.'], instructions_es: ['Sostén pesos a los lados. Camina erguido el tiempo indicado.'], images: [] }
  );

  E.bear_crawl = await foc(
    { name: /bear crawl/i },
    { externalId: 'Spartan_Bear_Crawl', name: 'Bear Crawl', name_es: 'Arrastre de oso', category: 'cardio', level: 'beginner', force: null, mechanic: 'compound', equipment: 'body only', primaryMuscles: ['abdominals', 'shoulders', 'quadriceps'], secondaryMuscles: ['chest', 'triceps'], instructions: ['On hands and feet, knees hovering above ground. Crawl forward alternating opposite hand and foot.'], instructions_es: ['Sobre manos y pies con rodillas a ras del suelo. Avanza alternando mano y pie opuestos.'], images: [] }
  );

  E.kb_march = await foc(
    { name: /kettlebell.*march|single.*arm.*march/i },
    { externalId: 'Spartan_KB_March', name: 'Single-Arm Kettlebell March', name_es: 'Marcha con kettlebell a un brazo', category: 'strength', level: 'beginner', force: null, mechanic: 'compound', equipment: 'kettlebell', primaryMuscles: ['abdominals', 'shoulders'], secondaryMuscles: ['quadriceps', 'glutes'], instructions: ['Hold kettlebell in one hand overhead. March in place lifting knees high, alternating sides.'], instructions_es: ['Kettlebell en una mano sobre la cabeza. Marcha en el sitio subiendo las rodillas. Alterna lados.'], images: [] }
  );

  E.dead_ball_throw = await foc(
    { name: /dead ball|over.shoulder.*throw|slam ball.*throw/i },
    { externalId: 'Spartan_Dead_Ball_Throw', name: 'Dead Ball Over-Shoulder Throw', name_es: 'Lanzamiento de balón sobre el hombro', category: 'cardio', level: 'intermediate', force: null, mechanic: 'compound', equipment: 'medicine ball', primaryMuscles: ['glutes', 'hamstrings', 'back'], secondaryMuscles: ['shoulders', 'abdominals'], instructions: ['Pick up heavy ball from ground. Explosively throw it over your shoulder. Alternate sides.'], instructions_es: ['Recoge una pelota pesada del suelo. Lánzala explosivamente por encima del hombro. Alterna lados.'], images: [] }
  );

  E.med_ball_wall_throw = await foc(
    { name: /wall ball|med ball.*sit|medicine ball.*throw|wall.*throw/i },
    { externalId: 'Spartan_Med_Ball_Wall_Throw', name: 'Med Ball Sit-Up Wall Throw', name_es: 'Abdominales con balón medicinal', category: 'strength', level: 'intermediate', force: null, mechanic: 'compound', equipment: 'medicine ball', primaryMuscles: ['abdominals'], secondaryMuscles: ['chest', 'shoulders'], instructions: ['Lie with medicine ball at chest. Sit up and throw ball against a wall. Catch on the way down.'], instructions_es: ['Túmbate con el balón al pecho. Siéntate y lanza el balón contra la pared. Recógelo al bajar.'], images: [] }
  );

  E.inchworm = await foc(
    { name: /inchworm/i },
    { externalId: 'Spartan_Inchworm', name: 'Inchworm', name_es: 'Inchworm', category: 'strength', level: 'beginner', force: null, mechanic: 'compound', equipment: 'body only', primaryMuscles: ['abdominals', 'shoulders', 'hamstrings'], secondaryMuscles: ['chest', 'triceps'], instructions: ['Bend at hips, walk hands forward to plank, do a push-up, walk feet to hands, repeat.'], instructions_es: ['Dobla la cadera, avanza las manos hasta plancha, flexión, acerca los pies. Repite.'], images: [] }
  );

  E.monkey_bars = await foc(
    { name: /monkey bar/i },
    { externalId: 'Spartan_Monkey_Bars', name: 'Monkey Bars', name_es: 'Barras de mono', category: 'strength', level: 'intermediate', force: 'pull', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['lats', 'forearms', 'shoulders'], secondaryMuscles: ['biceps', 'abdominals'], instructions: ['Traverse monkey bars swinging from bar to bar. Hold if traversal unavailable.'], instructions_es: ['Traversar las barras balanceándose de barra en barra. Aguanta si no hay travesía disponible.'], images: [] }
  );

  E.rope_climb = await foc(
    { name: /rope climb/i },
    { externalId: 'Spartan_Rope_Climb', name: 'Rope Climb', name_es: 'Trepa de cuerda', category: 'strength', level: 'intermediate', force: 'pull', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['lats', 'forearms', 'biceps'], secondaryMuscles: ['abdominals', 'shoulders'], instructions: ['Grip rope with hands. Pull yourself up using arms and legs. Touch the top, descend controlled.'], instructions_es: ['Agarra la cuerda. Sube usando brazos y piernas. Toca la cima, baja de forma controlada.'], images: [] }
  );

  E.ball_slam = await foc(
    { name: /ball slam|medicine ball slam/i },
    { externalId: 'Spartan_Ball_Slam', name: 'Ball Slam', name_es: 'Golpe de balón', category: 'cardio', level: 'beginner', force: null, mechanic: 'compound', equipment: 'medicine ball', primaryMuscles: ['abdominals', 'shoulders'], secondaryMuscles: ['back', 'glutes'], instructions: ['Hold medicine ball overhead. Slam it to the floor with full force. Pick up and repeat.'], instructions_es: ['Balón sobre la cabeza. Golpéalo al suelo con toda la fuerza. Recógelo y repite.'], images: [] }
  );

  return E;
}

// ─── Definiciones de todos los entrenamientos únicos ─────────────────────────
function buildTrainingDefs(E) {
  return {
    // ══ CARDIO / RUNNING ════════════════════════════════════════════════════

    run_easy_3km: {
      name: 'Carrera fácil 3.2 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(2))],
          'Ritmo fácil/conversacional · Calentamiento: 10 min trote con estiramientos dinámicos'),
      ],
    },

    run_speed_w1: {
      name: 'Trabajo de velocidad – 4×100m + 4×400m',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio',
          xN(cSet(0.10, 85, 120), 4),
          '4×100m al 80-90% · 2 min descanso entre series'),
        ex(E.running._id, 1, 'cardio',
          xN(cSet(0.40, 65, 120), 4),
          '4×400m al 60-70% · 2 min descanso entre series'),
      ],
    },

    run_moderate_6km: {
      name: 'Carrera moderada 6.4 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(4))], 'Ritmo moderado/cómodo'),
      ],
    },

    run_endurance_intervals: {
      name: 'Carrera de resistencia con intervalos 4.8 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(1))], '1 milla a ritmo constante'),
        ex(E.running._id, 1, 'cardio', [cSet(mi(2))],
          '2 millas alternando: 1 min rápido / 1 min lento (puedes caminar los intervalos lentos)'),
      ],
    },

    run_hill_sprints: {
      name: 'Sprints en cuesta 8×30s + Stairmaster 15 min',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.hill_sprint._id, 0, 'time',
          xN(tSet(0, 30), 8),
          '8×30s al máximo esfuerzo · 90s descanso entre series · Baja andando'),
        ex(E.stairmaster._id, 1, 'time',
          [tSet(15)],
          '15 min a ritmo lento/caminando'),
      ],
    },

    // 6 millas = 9.66 km con 15 burpees tras cada milla
    run_long_10km_burpees: {
      name: 'Carrera larga 9.7 km con burpees',
      type: 'functional', format: 'fortime',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(1))], 'Milla 1'),
        ex(E.burpee._id,  1, 'reps',   [rSet(15)]),
        ex(E.running._id, 2, 'cardio', [cSet(mi(1))], 'Milla 2'),
        ex(E.burpee._id,  3, 'reps',   [rSet(15)]),
        ex(E.running._id, 4, 'cardio', [cSet(mi(1))], 'Milla 3'),
        ex(E.burpee._id,  5, 'reps',   [rSet(15)]),
        ex(E.running._id, 6, 'cardio', [cSet(mi(1))], 'Milla 4'),
        ex(E.burpee._id,  7, 'reps',   [rSet(15)]),
        ex(E.running._id, 8, 'cardio', [cSet(mi(1))], 'Milla 5'),
        ex(E.burpee._id,  9, 'reps',   [rSet(15)]),
        ex(E.running._id,10, 'cardio', [cSet(mi(1))], 'Milla 6'),
      ],
    },

    run_tempo_5km: {
      name: 'Carrera tempo 4.8 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(3), 80)],
          'Ritmo duro pero sostenible (tempo)'),
      ],
    },

    run_intervals_200m: {
      name: 'Intervalos 10×200m al 75%',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio',
          xN(cSet(0.20, 75, 120), 10),
          '10×200m al 75% de esfuerzo · 2 min descanso o 100m caminando'),
      ],
    },

    run_long_13km: {
      name: 'Carrera larga 12.9 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(8))], 'Ritmo moderado y constante'),
      ],
    },

    run_fartlek_5km: {
      name: 'Fartlek 4.8 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(3))],
          'Fartlek: 1 min rápido / 2 min lento · Total 3 millas'),
      ],
    },

    // Circuito con obstáculos (W4 Miér = W8 Miér)
    run_obstacle_sim: {
      name: 'Simulacro circuito con obstáculos',
      type: 'functional', format: 'fortime',
      exercises: [
        ex(E.running._id,    0, 'cardio', [cSet(mi(1))],    '1 milla'),
        ex(E.burpee._id,     1, 'reps',   [rSet(15)],       '15 burpees'),
        ex(E.running._id,    2, 'cardio', [cSet(0.40)],     '400 m'),
        ex(E.bear_crawl._id, 3, 'time',   [tSet(1)],        '1 minuto'),
        ex(E.running._id,    4, 'cardio', [cSet(0.40)],     '400 m'),
        ex(E.burpee._id,     5, 'reps',   [rSet(15)],       '15 burpees'),
        ex(E.running._id,    6, 'cardio', [cSet(0.40)],     '400 m'),
        ex(E.bear_crawl._id, 7, 'time',   [tSet(1)],        '1 minuto'),
        ex(E.running._id,    8, 'cardio', [cSet(mi(1.25))], '1.25 millas (2.0 km)'),
        ex(E.rope_climb._id, 9, 'reps',   [rSet(3)],        'Opcional: 3 ascensos'),
      ],
    },

    run_long_14km: {
      name: 'Carrera larga 14.5 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(9))], 'Ritmo moderado'),
      ],
    },

    run_deload_200m: {
      name: 'Intervalos suaves 5×200m (Descarga)',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio',
          xN(cSet(0.20, 50, 120), 5),
          '5×200m al 50% de esfuerzo · 2 min descanso'),
      ],
    },

    hike_60min: {
      name: 'Senderismo 1 hora',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.hiking._id, 0, 'time', [tSet(60)],
          'Caminata moderada por terreno variado'),
      ],
    },

    // Semana 6 miércoles: 2 millas + 4 sprints en cuesta
    run_hills_w6: {
      name: 'Carrera 3.2 km + Sprints en cuesta',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id,    0, 'cardio', [cSet(mi(2))], 'Ritmo moderado'),
        ex(E.hill_sprint._id,1, 'time',   xN(tSet(0, 30), 4),
          '4×30s al máximo · 90s descanso entre series'),
      ],
    },

    run_long_16km: {
      name: 'Carrera larga 16.1 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(10))], 'Ritmo cómodo'),
      ],
    },

    // Semana 7 miércoles: 3 millas con sprint de 200m al acabar cada milla
    run_intervals_per_mile: {
      name: 'Carrera 4.8 km con sprint por milla',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(1))],       '1ª milla, ritmo moderado'),
        ex(E.running._id, 1, 'cardio', [cSet(0.20, 75, 120)],'Sprint 200m al 75%'),
        ex(E.running._id, 2, 'cardio', [cSet(mi(1))],       '2ª milla, ritmo moderado'),
        ex(E.running._id, 3, 'cardio', [cSet(0.20, 75, 120)],'Sprint 200m al 75%'),
        ex(E.running._id, 4, 'cardio', [cSet(mi(1))],       '3ª milla, ritmo moderado'),
        ex(E.running._id, 5, 'cardio', [cSet(0.20, 75, 120)],'Sprint 200m al 75%'),
      ],
    },

    run_fartlek_6km: {
      name: 'Fartlek 6.4 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(4))],
          'Fartlek: 1 min rápido / 2 min lento · Total 4 millas'),
      ],
    },

    run_long_18km: {
      name: 'Carrera larga 17.7 km',
      type: 'cardio', format: 'straight',
      exercises: [
        ex(E.running._id, 0, 'cardio', [cSet(mi(11))], 'Ritmo cómodo'),
      ],
    },

    // ══ CIRCUITOS DE FUERZA ═════════════════════════════════════════════════

    // Sem 1 Martes (= base del plan)
    push_lower_a: {
      name: 'Push & Lower – Circuito A (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.squat._id,        0, 'reps', xN(rSet(12))),
        ex(E.push_up._id,      1, 'reps', xN(rSet(12))),
        ex(E.lunge._id,        2, 'reps', xN(rSet(12)), '12 reps por pierna'),
        ex(E.plank_up_down._id,3, 'time', xN(tSet(1)),  '1 minuto'),
        ex(E.tricep_dip._id,   4, 'reps', xN(rSet(12))),
        ex(E.pistol_squat._id, 5, 'reps', xN(rSet(12)), '12 reps alternando'),
        ex(E.burpee._id,       6, 'reps', xN(rSet(5))),
      ],
    },

    // Sem 1 Viernes
    pull_core_a: {
      name: 'Pull & Core – Circuito A (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.pull_up._id,        0, 'reps', xN(rSet(10)), 'Hasta el fallo si no llegas a 10'),
        ex(E.supine_leg_lift._id,1, 'reps', xN(rSet(12))),
        ex(E.inverted_row._id,   2, 'reps', xN(rSet(12))),
        ex(E.kettlebell_halo._id,3, 'reps', xN(rSet(12)), '12 reps alternando lados'),
        ex(E.dead_hang._id,      4, 'time', xN(tSet(1)),  'Hasta el fallo'),
        ex(E.wrist_curl._id,     5, 'reps', xN(rSet(12)), 'Peso ligero · 12 reps por lado'),
        ex(E.farmer_carry._id,   6, 'time', xN(tSet(1)),  'Peso ligero'),
      ],
    },

    // Sem 2 Martes
    push_lower_b: {
      name: 'Push & Lower – Circuito B (3 rondas)',
      type: 'strength', format: 'circuit',
      exercises: [
        ex(E.db_deadlift._id,    0, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.db_bench_press._id, 1, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.sl_deadlift._id,    2, 'reps', xN(rSet(12)), '12 reps por pierna · Sin peso'),
        ex(E.db_shoulder_press._id,3,'reps',xN(rSet(12)), 'Peso ligero'),
        ex(E.calf_raise._id,     4, 'reps', xN(rSet(12)), 'Leg press · Peso ligero · 12 reps por pierna'),
        ex(E.skull_crusher._id,  5, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.bear_crawl._id,     6, 'time', xN(tSet(1)),  '1 minuto'),
      ],
    },

    // Sem 2 Viernes (= Sem 4 Viernes)
    pull_core_b: {
      name: 'Pull & Core – Circuito B (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.pull_up._id,        0, 'reps', xN(rSet(10)), 'Hasta el fallo si no llegas a 10'),
        ex(E.supine_leg_lift._id,1, 'reps', xN(rSet(12))),
        ex(E.inverted_row._id,   2, 'reps', xN(rSet(12))),
        ex(E.kb_march._id,       3, 'reps', xN(rSet(12)), '12 reps alternando lados · De pie'),
        ex(E.dead_hang._id,      4, 'time', xN(tSet(1)),  'Hasta el fallo'),
        ex(E.wrist_curl._id,     5, 'reps', xN(rSet(12)), '12 reps por lado · Peso ligero'),
        ex(E.dead_ball_throw._id,6, 'time', xN(tSet(1)),  '1 minuto alternando lados'),
      ],
    },

    // Sem 3 Martes (= Sem 5 Martes = Sem 8 Martes)
    push_lower_c: {
      name: 'Push & Lower – Circuito C (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.jump_squat._id,     0, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.push_up._id,        1, 'reps', xN(rSet(12)), 'Con banda elástica de resistencia'),
        ex(E.walking_lunge._id,  2, 'reps', xN(rSet(12)), 'Peso ligero · 12 reps por pierna'),
        ex(E.db_bench_press._id, 3, 'reps', xN(rSet(12)), 'Supino · Peso ligero'),
        ex(E.pistol_squat._id,   4, 'reps', xN(rSet(12)), 'Con kettlebell · 12 reps alternando'),
        ex(E.tricep_dip._id,     5, 'reps', xN(rSet(12))),
        ex(E.burpee._id,         6, 'reps', xN(rSet(5))),
      ],
    },

    // Sem 3 Viernes (= Sem 5 Viernes)
    pull_core_c: {
      name: 'Pull & Core – Circuito C (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.db_row._id,            0, 'reps', xN(rSet(12)), 'Doble brazo inclinado · Peso ligero'),
        ex(E.med_ball_wall_throw._id,1,'reps', xN(rSet(12))),
        ex(E.db_pullover._id,       2, 'reps', xN(rSet(12)), 'Supino · Peso ligero'),
        ex(E.inchworm._id,          3, 'reps', xN(rSet(12))),
        ex(E.db_shrug._id,          4, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.monkey_bars._id,       5, 'time', xN(tSet(1)),  'O dead hang hasta el fallo'),
        ex(E.burpee._id,            6, 'reps', xN(rSet(5))),
      ],
    },

    // Sem 4 Martes (= Sem 6 Martes = Sem 7 Martes)
    push_lower_d: {
      name: 'Push & Lower – Circuito D (3 rondas)',
      type: 'strength', format: 'circuit',
      exercises: [
        ex(E.squat_to_press._id,  0, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.db_bench_press._id,  1, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.sl_deadlift._id,     2, 'reps', xN(rSet(12)), 'Con kettlebell · 12 reps por pierna'),
        ex(E.db_shoulder_press._id,3,'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.calf_raise._id,      4, 'reps', xN(rSet(12)), 'En leg press · Peso ligero · 12 por pierna'),
        ex(E.tricep_dip._id,      5, 'reps', xN(rSet(12))),
        ex(E.bear_crawl._id,      6, 'time', xN(tSet(1)),  '1 minuto'),
      ],
    },

    // Sem 6 Viernes
    pull_core_d: {
      name: 'Pull & Core – Circuito D (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.db_row._id,            0, 'reps', xN(rSet(12)), 'Inclinado · Peso ligero'),
        ex(E.med_ball_wall_throw._id,1,'reps', xN(rSet(12))),
        ex(E.db_pullover._id,       2, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.inchworm._id,          3, 'reps', xN(rSet(12))),
        ex(E.db_shrug._id,          4, 'reps', xN(rSet(12)), 'Peso ligero'),
        ex(E.monkey_bars._id,       5, 'time', xN(tSet(1)),  'O dead hang'),
        ex(E.farmer_carry._id,      6, 'time', xN(tSet(1)),  'Peso ligero'),
      ],
    },

    // Sem 7 Viernes (= Sem 8 Viernes)
    pull_core_e: {
      name: 'Pull & Core – Circuito E (3 rondas)',
      type: 'functional', format: 'circuit',
      exercises: [
        ex(E.pull_up._id,        0, 'reps', xN(rSet(10)), 'Hasta el fallo si no llegas a 10'),
        ex(E.supine_leg_lift._id,1, 'reps', xN(rSet(12))),
        ex(E.inverted_row._id,   2, 'reps', xN(rSet(12))),
        ex(E.kb_march._id,       3, 'reps', xN(rSet(12)), '12 reps alternando lados'),
        ex(E.dead_hang._id,      4, 'time', xN(tSet(1)),  'Hasta el fallo'),
        ex(E.wrist_curl._id,     5, 'reps', xN(rSet(12)), '12 reps por lado · Peso ligero'),
        ex(E.ball_slam._id,      6, 'time', xN(tSet(1)),  '1 minuto'),
        ex(E.farmer_carry._id,   7, 'time', xN(tSet(1)),  '1 minuto'),
      ],
    },
  };
}

// ─── Crea o reutiliza un Training ─────────────────────────────────────────────
async function ensureTraining(userId, def) {
  const existing = await Training.findOne({ userId, name: def.name }).lean();
  if (existing) {
    console.log(`  ≡  ${def.name}`);
    return existing;
  }
  const t = await Training.create({ userId, ...def });
  console.log(`  +  ${def.name}`);
  return t;
}

// ─── Estructura del plan (semanas 1-8) ───────────────────────────────────────
function buildPlanWeeks(T) {
  const day = (dow, ...keys) => ({ dayOfWeek: dow, trainings: keys.map(k => T[k]._id) });

  return [
    {
      weekNumber: 1, isDeload: false, label: 'Semana 1',
      days: [
        day(1, 'run_easy_3km'),
        day(2, 'push_lower_a'),
        day(3, 'run_speed_w1'),
        day(5, 'pull_core_a'),
        day(6, 'run_moderate_6km'),
      ],
    },
    {
      weekNumber: 2, isDeload: false, label: 'Semana 2',
      days: [
        day(1, 'run_endurance_intervals'),
        day(2, 'push_lower_b'),
        day(3, 'run_hill_sprints'),
        day(5, 'pull_core_b'),
        day(6, 'run_long_10km_burpees'),
      ],
    },
    {
      weekNumber: 3, isDeload: false, label: 'Semana 3',
      days: [
        day(1, 'run_tempo_5km'),
        day(2, 'push_lower_c'),
        day(3, 'run_intervals_200m'),
        day(5, 'pull_core_c'),
        day(6, 'run_long_13km'),
      ],
    },
    {
      weekNumber: 4, isDeload: false, label: 'Semana 4',
      days: [
        day(1, 'run_fartlek_5km'),
        day(2, 'push_lower_d'),
        day(3, 'run_obstacle_sim'),
        day(5, 'pull_core_b'),      // "Same structure as Week 2 Friday"
        day(6, 'run_long_14km'),
      ],
    },
    {
      weekNumber: 5, isDeload: true, label: 'Semana 5 – Descarga',
      days: [
        day(1, 'run_easy_3km'),     // reuse
        day(2, 'push_lower_c'),     // "Same as Week 3 Tuesday"
        day(3, 'run_deload_200m'),
        day(5, 'pull_core_c'),      // "Same as Week 3 Friday"
        day(6, 'hike_60min'),
      ],
    },
    {
      weekNumber: 6, isDeload: false, label: 'Semana 6',
      days: [
        day(1, 'run_moderate_6km'), // reuse (4 miles)
        day(2, 'push_lower_d'),     // "Same as Week 4 Tuesday"
        day(3, 'run_hills_w6'),
        day(5, 'pull_core_d'),
        day(6, 'run_long_16km'),
      ],
    },
    {
      weekNumber: 7, isDeload: false, label: 'Semana 7',
      days: [
        day(1, 'run_tempo_5km'),    // reuse
        day(2, 'push_lower_d'),     // "Same as Week 6"
        day(3, 'run_intervals_per_mile'),
        day(5, 'pull_core_e'),
        day(6, 'run_long_16km'),    // reuse
      ],
    },
    {
      weekNumber: 8, isDeload: false, label: 'Semana 8',
      days: [
        day(1, 'run_fartlek_6km'),
        day(2, 'push_lower_c'),     // "Same as Week 3 Tuesday"
        day(3, 'run_obstacle_sim'), // reuse
        day(5, 'pull_core_e'),      // "Same as Week 7 Friday"
        day(6, 'run_long_18km'),
      ],
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const userEmail = process.argv[2] ?? null;

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado');

  // Buscar usuario
  const user = userEmail
    ? await User.findOne({ email: userEmail }).lean()
    : await User.findOne({}).lean();

  if (!user) {
    console.error('\n⛔  No se encontró ningún usuario. Pasa el email como argumento:\n   node src/scripts/seedSpartanBeast.js tu@email.com');
    process.exit(1);
  }
  console.log(`\nUsuario: ${user.email} (${user._id})`);

  // 1. Ejercicios
  const E = await resolveExercises();

  // 2. Entrenamientos
  console.log('\nCreando/reutilizando entrenamientos...');
  const defs = buildTrainingDefs(E);
  const T = {};
  for (const [key, def] of Object.entries(defs)) {
    T[key] = await ensureTraining(user._id, def);
  }

  // 3. Plan
  console.log('\nCreando plan...');
  const planName = 'Spartan Beast 12 Semanas';
  const startDate = new Date('2026-06-15T00:00:00.000Z'); // Lunes 15/06/2026

  // Desactivar planes activos previos del usuario
  await Plan.updateMany({ userId: user._id, active: true }, { $set: { active: false } });

  const planWeeks = buildPlanWeeks(T);

  const plan = await Plan.findOneAndUpdate(
    { userId: user._id, name: planName },
    {
      $set: {
        active: true,
        startDate,
        planWeeks,
      },
      $setOnInsert: { name: planName, userId: user._id },
    },
    { upsert: true, new: true }
  );

  console.log(`\n✅  Plan "${plan.name}" listo:`);
  console.log(`    ID:       ${plan._id}`);
  console.log(`    Semanas:  ${plan.planWeeks.length}`);
  console.log(`    Inicio:   ${plan.startDate.toISOString().slice(0, 10)}`);
  console.log(`    Activo:   ${plan.active}`);

  // ── Sesión del lunes 15/06 (primera sesión ya completada) ───────────────────
  console.log('\nRegistrando sesión completada del 15/06/2026...');
  const sessionDate = new Date('2026-06-15T12:00:00.000Z');
  const firstTraining = T['run_easy_3km'];
  const existingSession = await TrainingSession.findOne({
    userId: user._id,
    trainingId: firstTraining._id,
    date: { $gte: new Date('2026-06-15T00:00:00.000Z'), $lt: new Date('2026-06-16T00:00:00.000Z') },
  }).lean();

  if (existingSession) {
    console.log('  ≡  Sesión ya existente, se omite');
  } else {
    // Construir los sets de la sesión a partir de la plantilla del entrenamiento
    const sessionExercises = (firstTraining.exercises || []).map((e, idx) => ({
      exerciseId: e.exerciseId,
      order: e.order ?? idx,
      repMode: e.repMode ?? 'cardio',
      phase: e.phase ?? 'main',
      supersetGroup: e.supersetGroup ?? null,
      sets: (e.sets || []).map(s => ({
        km: parseFloat(s.km) || 0,
        h: s.h ?? 0, m: s.m ?? 0, s: s.s ?? 0,
        completed: true,
      })),
    }));
    await TrainingSession.create({
      userId: user._id,
      trainingId: firstTraining._id,
      date: sessionDate,
      exercises: sessionExercises,
      duration: 18 * 60, // ~18 minutos
      notes: 'Primera sesión del plan Spartan Beast',
    });
    console.log('  +  Sesión creada: Carrera fácil 3.2 km · 15/06/2026');
  }

  await mongoose.disconnect();
  console.log('\nDesconectado. ¡Todo listo! 🏆');
}

main().catch(err => {
  console.error('\n⛔  Error:', err.message ?? err);
  process.exit(1);
});
