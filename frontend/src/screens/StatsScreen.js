import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { calcExerciseHI, secondaryActivation } from '../utils/hypertrophyMetrics';

// ─── Muscle group mapping ────────────────────────────────────────────────────
// Maps Exercise.primaryMuscles strings → Spanish canonical group
const MUSCLE_MAP = {
  chest: 'Pecho',
  'middle chest': 'Pecho',
  'lower chest': 'Pecho',
  'upper chest': 'Pecho',
  lats: 'Espalda',
  'lower back': 'Espalda',
  'middle back': 'Espalda',
  traps: 'Espalda',
  rhomboids: 'Espalda',
  shoulders: 'Hombros',
  'front shoulders': 'Hombros',
  'side shoulders': 'Hombros',
  'rear shoulders': 'Hombros',
  'anterior deltoid': 'Hombros',
  'lateral deltoid': 'Hombros',
  'posterior deltoid': 'Hombros',
  biceps: 'Bíceps',
  'biceps brachii': 'Bíceps',
  triceps: 'Tríceps',
  'triceps brachii': 'Tríceps',
  quadriceps: 'Cuádriceps',
  quads: 'Cuádriceps',
  hamstrings: 'Isquios',
  glutes: 'Glúteos',
  'gluteus maximus': 'Glúteos',
  calves: 'Gemelos',
  gastrocnemius: 'Gemelos',
  soleus: 'Gemelos',
  abdominals: 'Abdomen',
  abs: 'Abdomen',
  obliques: 'Abdomen',
  core: 'Abdomen',
  forearms: 'Antebrazos',
};

// MEV / MRV reference ranges (Israetel et al.) — sets per week
const MUSCLE_RANGES = {
  Pecho:       { mev: 10, mav: 20 },
  Espalda:     { mev: 10, mav: 25 },
  Hombros:     { mev: 8,  mav: 20 },
  Bíceps:      { mev: 8,  mav: 20 },
  Tríceps:     { mev: 8,  mav: 20 },
  Cuádriceps:  { mev: 8,  mav: 20 },
  Isquios:     { mev: 6,  mav: 16 },
  Glúteos:     { mev: 4,  mav: 16 },
  Gemelos:     { mev: 8,  mav: 16 },
  Abdomen:     { mev: 8,  mav: 20 },
  Antebrazos:  { mev: 4,  mav: 14 },
};

// Push / Pull / Legs classification rules (primary muscles)
function classifySession(primaryMuscles = []) {
  const ms = primaryMuscles.map(m => m.toLowerCase());
  const isPush = ms.some(m =>
    ['chest', 'triceps', 'shoulders', 'anterior deltoid', 'lateral deltoid'].some(k => m.includes(k))
  );
  const isPull = ms.some(m =>
    ['lats', 'middle back', 'lower back', 'traps', 'rhomboids', 'biceps', 'rear shoulders', 'posterior deltoid'].some(k => m.includes(k))
  );
  const isLegs = ms.some(m =>
    ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'gastrocnemius', 'soleus'].some(k => m.includes(k))
  );
  return { isPush, isPull, isLegs };
}

function toWeekKey(date) {
  const d = new Date(date);
  const jsDay = d.getDay();
  d.setDate(d.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcVolume(sessions) {
  return sessions.reduce(
    (t, s) =>
      t + (s.exercises || []).reduce(
        (t2, ex) =>
          t2 + (ex.sets || []).reduce(
            (t3, set) =>
              set.completed && set.weight > 0 && set.reps > 0
                ? t3 + set.weight * set.reps
                : t3,
            0,
          ),
        0,
      ),
    0,
  );
}

function fmtVolume(kg) {
  if (kg === 0) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

const PERIODS = [
  { key: '1w',    label: 'Semana' },
  { key: '4w',    label: '4 semanas' },
  { key: '3m',    label: '3 meses' },
  { key: 'cycle', label: 'Ciclo' },
];

export default function StatsScreen({ route, navigation }) {
  const { sessions = [], activePlan = null } = route.params || {};

  const [period, setPeriod] = useState('4w');

  const effectivePeriod = (period === 'cycle' && !activePlan) ? '4w'
    : (period === '3m' && !!activePlan) ? '4w'
    : period;

  // ─── Filter sessions by period ──────────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    const now = new Date();
    if (effectivePeriod === '1w') {
      const cutoff = new Date(now);
      const jsDay = cutoff.getDay();
      cutoff.setDate(cutoff.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
      cutoff.setHours(0, 0, 0, 0);
      return sessions.filter(s => new Date(s.date) >= cutoff);
    }
    if (effectivePeriod === '4w') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 27);
      cutoff.setHours(0, 0, 0, 0);
      return sessions.filter(s => new Date(s.date) >= cutoff);
    }
    if (effectivePeriod === '3m') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 89);
      cutoff.setHours(0, 0, 0, 0);
      return sessions.filter(s => new Date(s.date) >= cutoff);
    }
    if (effectivePeriod === 'cycle' && activePlan?.startDate) {
      const cutoff = new Date(activePlan.startDate);
      cutoff.setHours(0, 0, 0, 0);
      return sessions.filter(s => new Date(s.date) >= cutoff);
    }
    return sessions;
  }, [sessions, effectivePeriod, activePlan]);

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const totalSessions = filteredSessions.length;
  const totalVolume = useMemo(() => calcVolume(filteredSessions), [filteredSessions]);
  const avgDuration = useMemo(() => {
    if (!filteredSessions.length) return 0;
    const total = filteredSessions.reduce((t, s) => t + (s.duration || 0), 0);
    return Math.round(total / filteredSessions.length / 60);
  }, [filteredSessions]);

  // ─── Series por grupo muscular (CAPA 1: series efectivas) ──────────────────
  // Primary muscles:   activation = 1.0
  // Secondary muscles: activation = 0.5 (compound) | 0.3 (isolation)
  const muscleSetData = useMemo(() => {
    const map = {};
    filteredSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const completedSets = (ex.sets || []).filter(set => set.completed).length;
        if (completedSets === 0) return;
        const secFactor = secondaryActivation(ex.exerciseId?.mechanic);
        (ex.exerciseId?.primaryMuscles || []).forEach(m => {
          const group = MUSCLE_MAP[m.toLowerCase()];
          if (!group) return;
          map[group] = (map[group] || 0) + completedSets;
        });
        (ex.exerciseId?.secondaryMuscles || []).forEach(m => {
          const group = MUSCLE_MAP[m.toLowerCase()];
          if (!group) return;
          map[group] = (map[group] || 0) + completedSets * secFactor;
        });
      });
    });

    return Object.entries(MUSCLE_RANGES)
      .map(([group, range]) => ({ group, sets: Math.round((map[group] || 0) * 10) / 10, ...range }))
      .sort((a, b) => b.sets - a.sets);
  }, [filteredSessions]);

  // ─── Push / Pull / Legs ──────────────────────────────────────────────────────
  // Push/Pull: usa el campo force del ejercicio (push | pull | static)
  // Legs: clasificación por músculo (force no distingue piernas)
  const pplData = useMemo(() => {
    let push = 0, pull = 0, legs = 0;
    filteredSessions.forEach(s => {
      let hasPush = false, hasPull = false;
      const allMuscles = [];
      (s.exercises || []).forEach(ex => {
        const force = ex.exerciseId?.force?.toLowerCase();
        if (force === 'push') hasPush = true;
        if (force === 'pull') hasPull = true;
        (ex.exerciseId?.primaryMuscles || []).forEach(m => allMuscles.push(m));
      });
      const { isLegs } = classifySession(allMuscles);
      if (hasPush) push++;
      if (hasPull) pull++;
      if (isLegs) legs++;
    });
    return { push, pull, legs, total: push + pull + legs || 1 };
  }, [filteredSessions]);

  // ─── Adherence ───────────────────────────────────────────────────────────────
  const adherence = useMemo(() => {
    if (!activePlan?.startDate || !activePlan?.days) return null;
    const start = new Date(activePlan.startDate);
    start.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // count planned sessions from start to today
    let planned = 0;
    const planDaysWithTraining = new Set(
      (activePlan.days || [])
        .filter(d => d.trainings?.length > 0)
        .map(d => d.dayOfWeek)
    );

    function jsToPlanDay(jsDay) { return jsDay === 0 ? 7 : jsDay; }

    const cursor = new Date(start);
    while (cursor <= now) {
      if (planDaysWithTraining.has(jsToPlanDay(cursor.getDay()))) {
        planned++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const done = sessions.filter(s => new Date(s.date) >= start && new Date(s.date) <= now).length;
    if (planned === 0 && done === 0) return null;
    return { done, planned: Math.max(planned, done), pct: planned > 0 ? Math.round((done / planned) * 100) : 100 };
  }, [activePlan, sessions]);

  // ─── Hypertrophy summary ────────────────────────────────────────────────────
  const topMuscle = useMemo(() => {
    const withSets = muscleSetData.filter(d => d.sets > 0);
    return withSets.length > 0 ? withSets[0].group : null;
  }, [muscleSetData]);

  // ─── CAPA 2: avg HI de la sesión ─────────────────────────────────────────────
  const sessionAvgHI = useMemo(() => {
    const hiValues = [];
    filteredSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const hi = calcExerciseHI(ex);
        if (hi > 0) hiValues.push(hi);
      });
    });
    if (!hiValues.length) return null;
    return hiValues.reduce((a, v) => a + v, 0) / hiValues.length;
  }, [filteredSessions]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Adherencia al plan ── */}
        {adherence && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Adherencia al mesociclo</Text>
            <View style={styles.card}>
              <View style={styles.adherenceHeader}>
                <Text style={styles.adherencePct}>{adherence.pct}%</Text>
                <Text style={styles.adherenceSubtitle}>
                  {adherence.done} sesiones completadas de {adherence.planned} planificadas
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${adherence.pct}%`, backgroundColor: adherence.pct >= 80 ? '#C9A44C' : adherence.pct >= 60 ? '#B11226' : '#5A0000' },
                  ]}
                />
              </View>
              <Text style={styles.adherenceHint}>
                {adherence.pct >= 80
                  ? '🔥 Excelente adherencia. ¡Sigue así!'
                  : adherence.pct >= 60
                    ? '💪 Buena adherencia. Intenta no fallar más sesiones.'
                    : '⚠️ Adherencia baja. Revisa tu planificación.'}
              </Text>
            </View>
          </View>
        )}

        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.filter(p =>
            (p.key !== 'cycle' || !!activePlan) &&
            (p.key !== '3m'    || !activePlan)
          ).map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Fuerza & Hipertrofia ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fuerza & Hipertrofia</Text>
          <View style={styles.card}>
            <View style={styles.hypertrophyMetrics}>
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="trending-up-outline" size={20} color="#C9A44C" />
                <Text style={styles.hypertrophyMetricValue}>{fmtVolume(totalVolume)}</Text>
                <Text style={styles.hypertrophyMetricLabel}>Volumen</Text>
              </View>
              <View style={styles.hypertrophyDivider} />
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="body-outline" size={20} color="#C9A44C" />
                <Text style={styles.hypertrophyMetricValue} numberOfLines={1}>
                  {topMuscle ?? '—'}
                </Text>
                <Text style={styles.hypertrophyMetricLabel}>Grupo ppal.</Text>
              </View>
              <View style={styles.hypertrophyDivider} />
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="flash-outline" size={20} color="#C9A44C" />
                <Text style={styles.hypertrophyMetricValue}>
                  {sessionAvgHI != null ? sessionAvgHI.toFixed(1) : '—'}
                </Text>
                <Text style={styles.hypertrophyMetricLabel}>HI medio</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hypertrophyBtn}
              onPress={() => navigation.navigate('HypertrophyStats', { sessions, activePlan })}
              activeOpacity={0.7}
            >
              <Ionicons name="analytics-outline" size={15} color="#C9A44C" />
              <Text style={styles.hypertrophyBtnText}>Ver análisis detallado</Text>
              <Ionicons name="chevron-forward" size={14} color="#C9A44C" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:         { paddingHorizontal: 16, paddingTop: 12 },

  // Period selector
  periodRow:      { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 3, marginBottom: 16 },
  periodBtn:      { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  periodBtnActive:{ backgroundColor: '#2E2E2E' },
  periodBtnText:  { fontSize: 13, color: '#9A9A9A', fontWeight: '500' },
  periodBtnTextActive: { color: '#EAEAEA', fontWeight: '700' },

  // KPI row
  kpiRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  kpiValue:       { fontSize: 14, fontWeight: '700', color: '#EAEAEA' },
  kpiLabel:       { fontSize: 10, color: '#9A9A9A', textAlign: 'center' },

  // Sections
  section:        { marginBottom: 16 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: '#EAEAEA', marginBottom: 10 },
  card:           { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16 },
  emptyText:      { fontSize: 13, color: '#9A9A9A', textAlign: 'center', paddingVertical: 8 },

  // Adherence
  adherenceHeader:{ alignItems: 'center', marginBottom: 12 },
  adherencePct:   { fontSize: 40, fontWeight: '700', color: '#EAEAEA' },
  adherenceSubtitle: { fontSize: 13, color: '#9A9A9A', marginTop: 4 },
  progressBarBg: {
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill:{ height: '100%', borderRadius: 4 },
  adherenceHint:  { fontSize: 13, color: '#9A9A9A', textAlign: 'center', lineHeight: 20 },

  // Hypertrophy summary card
  hypertrophyMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  hypertrophyMetric:  { flex: 1, alignItems: 'center', gap: 4 },
  hypertrophyMetricValue: { fontSize: 14, fontWeight: '700', color: '#EAEAEA', textAlign: 'center' },
  hypertrophyMetricLabel: { fontSize: 10, color: '#9A9A9A', textAlign: 'center' },
  hypertrophyDivider: { width: 1, backgroundColor: '#2E2E2E', marginHorizontal: 8 },
  hypertrophyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C9A44C22',
    backgroundColor: '#C9A44C11',
  },
  hypertrophyBtnText: { fontSize: 13, color: '#C9A44C', fontWeight: '600' },
});
