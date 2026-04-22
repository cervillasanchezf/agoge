// ── MUSCLE EFFICIENCY FACTOR (MEF) ──────────────────────────────────────────
// Keyed by lowercase English muscle name (matches Exercise.primaryMuscles values)
const MUSCLE_EFFICIENCY = {
  abdominals:    1.3,
  abductors:     1.2,
  adductors:     1.3,
  biceps:        1.3,
  calves:        1.5,
  chest:         1.1,
  forearms:      1.2,
  glutes:        1.1,
  hamstrings:    1.2,
  lats:          1.1,
  'lower back':  1.0,
  'middle back': 1.1,
  neck:          1.0,
  quadriceps:    1.0,
  shoulders:     1.2,
  traps:         1.2,
  triceps:       1.2,
};

// ── Factor helpers ────────────────────────────────────────────────────────────

function repFactor(reps) {
  if (reps <= 5)  return 0.7;
  if (reps <= 12) return 1.0;
  if (reps <= 20) return 0.9;
  return 0.7; // 20+
}

function rpeFactor(rpe) {
  const r = !rpe ? 8 : rpe; // default 8 when null / 0
  if (r < 6)  return 0.5;
  if (r <= 7) return 0.7;
  if (r <= 8) return 0.9;
  return 1.0; // 9–10
}

// ── e1RM helpers ─────────────────────────────────────────────────────────────

// Epley formula: weight × (1 + reps / 30)
// Returns null when inputs are invalid so callers can detect missing data.
function estimateE1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return null;
  const e1rm = weight * (1 + reps / 30);
  return Math.max(e1rm, weight); // e1RM is always ≥ weight
}

// Best e1RM across all completed sets of an exercise.
// Accepts a future `historicalE1RM` argument so callers can pass a known
// best-ever value when available — without changing any logic now.
function bestE1RM(sets, /* historicalE1RM = null */) {
  let best = null;
  for (const s of sets) {
    if (!s.completed || !s.reps || !s.weight) continue;
    const e = estimateE1RM(s.weight, s.reps);
    if (e !== null && (best === null || e > best)) best = e;
  }
  return best; // null when no valid set found
}

// intensity_factor based on relative intensity (weight / e1RM).
// Bands match standard strength-training zones:
//   < 0.60  → low intensity  → 0.6
//   0.60–0.74 → moderate       → 0.8
//   ≥ 0.75  → high intensity  → 1.0
//
// Extension point: swap the stepped return for a continuous mapping in the
// future, or pass a pre-computed e1RM to incorporate historical bests.
export function computeIntensityFactor(sets) {
  // Edge case: missing data → neutral factor
  if (!sets || sets.length === 0) return 0.7;

  const validSets = sets.filter(s => s.completed && (s.reps || 0) > 0 && (s.weight || 0) > 0);
  if (!validSets.length) return 0.7;

  // High-rep sets are unreliable for e1RM estimation → fixed factor
  const avgReps = validSets.reduce((a, s) => a + s.reps, 0) / validSets.length;
  if (avgReps > 15) return 0.7;

  const e1rm = bestE1RM(validSets);
  if (!e1rm) return 0.7;

  // Use the avg weight of completed sets as the representative load
  const avgWeight = validSets.reduce((a, s) => a + s.weight, 0) / validSets.length;
  const intensity = avgWeight / e1rm; // typically 0.5–1.0

  if (intensity < 0.6)  return 0.6;
  if (intensity < 0.75) return 0.8;
  return 1.0;
}

function mechanicFactor(mechanic) {
  return mechanic === 'isolation' ? 0.9 : 1.0;
}

function muscleEfficiency(primaryMuscles) {
  const m = (primaryMuscles || [])[0]?.toLowerCase();
  return MUSCLE_EFFICIENCY[m] ?? 1.0;
}

// ── CAPA 2: Hypertrophy Index for a single exercise entry ────────────────────
// exerciseEntry: { exerciseId: { primaryMuscles, mechanic }, sets: [{ reps, weight, rpe, completed }] }
// Returns HI (number ≥ 0)
export function calcExerciseHI(exerciseEntry) {
  const { exerciseId, sets = [] } = exerciseEntry;
  const completedSets = sets.filter(s => s.completed && (s.reps || 0) > 0);
  if (!completedSets.length) return 0;

  const mechanic       = exerciseId?.mechanic;
  const primaryMuscles = exerciseId?.primaryMuscles || [];
  const n = completedSets.length;

  const avgReps   = completedSets.reduce((a, s) => a + (s.reps   || 0), 0) / n;
  const avgWeight = completedSets.reduce((a, s) => a + (s.weight || 0), 0) / n;
  const avgRpe    = completedSets.reduce((a, s) => a + (s.rpe    || 0), 0) / n;

  const effectiveWeight = avgWeight || 70; // bodyweight fallback
  const volume = n * avgReps * effectiveWeight;

  return (
    Math.log(1 + volume) *
    repFactor(Math.round(avgReps)) *
    rpeFactor(avgRpe) *
    computeIntensityFactor(completedSets) *
    mechanicFactor(mechanic) *
    muscleEfficiency(primaryMuscles)
  );
}

// ── CAPA 1 helper: secondary activation factor ────────────────────────────────
export function secondaryActivation(mechanic) {
  return mechanic === 'compound' ? 0.5 : 0.3;
}
