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

// ── Hypertrophy Intensity Index ───────────────────────────────────────────────
// Combines relative intensity (% e1RM) with RPE proximity-to-failure.
//
// Relative intensity curve (peaks at 70–80 % e1RM, the hypertrophy sweet-spot):
//   < 0.50  → 0.50  (too light, little mechanical tension)
//   0.50–1.0 → continuous triangle peaking at 0.75 → 1.0
//   > 1.0   → 0.60  (shouldn't happen with Epley, but guards edge cases)
//
// RPE component: linear scale (RPE / 10), clamped [0.5, 1.0].
// Sets with too few reps (<= 4) are penalised (strength, not hypertrophy zone).
// High-rep sets (> 20) get a small penalty but are still counted.
export function computeIntensityFactor(sets) {
  if (!sets || sets.length === 0) return 0.7;

  const validSets = sets.filter(s => s.completed && (s.reps || 0) > 0 && (s.weight || 0) > 0);
  if (!validSets.length) return 0.7;

  const n = validSets.length;
  const avgReps   = validSets.reduce((a, s) => a + s.reps,          0) / n;
  const avgWeight = validSets.reduce((a, s) => a + s.weight,        0) / n;
  const avgRpe    = validSets.reduce((a, s) => a + (s.rpe || 8),    0) / n;

  // ── Relative-intensity component ───────────────────────────────────────────
  let relIntensityScore;
  if (avgReps <= 4) {
    // Strength zone — low hypertrophic stimulus regardless of load
    relIntensityScore = 0.55;
  } else if (avgReps > 20) {
    // Endurance zone — metabolic stress, less mechanical tension
    const e1rm = bestE1RM(validSets);
    const rel  = e1rm ? avgWeight / e1rm : 0.55;
    relIntensityScore = 0.55 + rel * 0.2; // max ~0.75
  } else {
    const e1rm = bestE1RM(validSets);
    if (!e1rm) {
      relIntensityScore = 0.7; // neutral fallback
    } else {
      const rel = avgWeight / e1rm; // typically 0.5–1.0
      // Continuous triangle: rises from 0.5 at rel=0.5, peaks at 1.0 at rel=0.75,
      // then falls back toward 0.85 at rel=1.0 (very heavy → more strength).
      if (rel < 0.5)       relIntensityScore = 0.5;
      else if (rel <= 0.75) relIntensityScore = 0.5 + (rel - 0.5) / 0.25 * 0.5;  // 0.5→1.0
      else if (rel <= 1.0)  relIntensityScore = 1.0  - (rel - 0.75) / 0.25 * 0.15; // 1.0→0.85
      else                  relIntensityScore = 0.85;
    }
  }

  // ── RPE / proximity-to-failure component ───────────────────────────────────
  // Linear: RPE 6 → 0.60, RPE 8 → 0.80, RPE 10 → 1.00
  const rpeScore = Math.min(1.0, Math.max(0.5, avgRpe / 10));

  // ── Combined index (geometric mean keeps both components balanced) ──────────
  return Math.sqrt(relIntensityScore * rpeScore);
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
