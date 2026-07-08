import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { sessionService, planService, measurementService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/theme';

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

const BASE_PERIODS = [
  { key: '1w',    label: 'Semana' },
  { key: '4w',    label: '4 semanas' },
  { key: '3m',    label: '3 meses' },
  { key: 'cycle', label: 'Planificación' },
];

export default function StatsScreen({ route, navigation }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState(route.params?.sessions ?? []);
  const [activePlan, setActivePlan] = useState(route.params?.activePlan ?? null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        try {
          const [sessRes, planRes, measRes] = await Promise.all([
            sessionService.getAllSessions({ populate: true }),
            planService.getPlans(),
            measurementService.getMeasurements(),
          ]);
          if (cancelled) return;
          setSessions(sessRes?.data ?? sessRes ?? []);
          const plans = planRes?.data ?? planRes ?? [];
          setActivePlan(plans.find(p => p.active) ?? null);
          setMeasurements(Array.isArray(measRes) ? measRes : (measRes?.data ?? []));
        } catch (e) {
          // silently keep previous data
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [])
  );

  const [period, setPeriod] = useState('4w');

  const periods = activePlan
    ? BASE_PERIODS
    : BASE_PERIODS.filter(p => p.key !== 'cycle');

  // If plan disappears while 'cycle' is selected, fall back to '3m'
  const effectivePeriod = period === 'cycle' && !activePlan ? '3m' : period;

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

  // ─── Series per muscle group ─────────────────────────────────────────────────
  const muscleSetData = useMemo(() => {
    const map = {};
    filteredSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const muscles = ex.exerciseId?.primaryMuscles || [];
        const completedSets = (ex.sets || []).filter(set => set.completed).length;
        if (completedSets === 0) return;
        muscles.forEach(m => {
          const group = MUSCLE_MAP[m.toLowerCase()];
          if (!group) return;
          map[group] = (map[group] || 0) + completedSets;
        });
      });
    });

    return Object.entries(MUSCLE_RANGES)
      .map(([group, range]) => ({ group, sets: map[group] || 0, ...range }))
      .sort((a, b) => b.sets - a.sets);
  }, [filteredSessions]);

  // ─── Push / Pull / Legs ──────────────────────────────────────────────────────
  const pplData = useMemo(() => {
    let push = 0, pull = 0, legs = 0;
    filteredSessions.forEach(s => {
      const allMuscles = (s.exercises || []).flatMap(
        ex => ex.exerciseId?.primaryMuscles || []
      );
      const { isPush, isPull, isLegs } = classifySession(allMuscles);
      if (isPush) push++;
      if (isPull) pull++;
      if (isLegs) legs++;
    });
    return { push, pull, legs, total: push + pull + legs || 1 };
  }, [filteredSessions]);

  // ─── Adherence ───────────────────────────────────────────────────────────────
  const adherence = useMemo(() => {
    if (!activePlan?.startDate || !activePlan?.planWeeks?.length) return null;
    const start = new Date(activePlan.startDate);
    start.setHours(0, 0, 0, 0);
    const totalWeeks = activePlan.planWeeks.length;
    const planEnd = new Date(start.getTime() + totalWeeks * 7 * 24 * 3600 * 1000);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Exclude today from the denominator: the day is still in progress,
    // so counting it now would make it look like a missed session prematurely.
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 1);

    function jsToDow(jsDay) { return jsDay === 0 ? 7 : jsDay; }

    let planned = 0;
    const cursor = new Date(start);
    while (cursor <= cutoff && cursor < planEnd) {
      const weekIdx = Math.floor((cursor - start) / (7 * 24 * 3600 * 1000));
      const week = activePlan.planWeeks[weekIdx];
      if (week) {
        const dow = jsToDow(cursor.getDay());
        const dayEntry = (week.days || []).find(d => d.dayOfWeek === dow);
        if (dayEntry && (dayEntry.trainings || []).filter(Boolean).length > 0) {
          planned++;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // done includes sessions completed today (registered in real time)
    const done = sessions.filter(s => new Date(s.date) >= start && new Date(s.date) <= now).length;
    if (planned === 0 && done === 0) return null;
    return { done, planned: Math.max(planned, done), pct: planned > 0 ? Math.round((done / planned) * 100) : 100 };
  }, [activePlan, sessions]);

  // ─── Physical summary ─────────────────────────────────────────────────────
  const physicalSummary = useMemo(() => {
    const sorted = [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest  = sorted[0] ?? null;
    const previous = sorted[1] ?? null;
    if (!latest) return null;

    const peso = latest.peso ?? null;
    const pesoPrev = previous?.peso ?? null;
    const pesoDelta = peso != null && pesoPrev != null ? peso - pesoPrev : null;

    let imc = null;
    let imcLabel = null;
    if (peso && user?.height) {
      const hm = user.height / 100;
      const v = peso / (hm * hm);
      imc = v;
      imcLabel = v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad';
    }

    const oldest = sorted[sorted.length - 1];
    const totalDelta = peso != null && oldest?.peso != null && oldest !== latest
      ? peso - oldest.peso
      : null;

    return { peso, pesoDelta, imc, imcLabel, totalDelta, count: sorted.length };
  }, [measurements, user]);

  // ─── Hypertrophy summary ────────────────────────────────────────────────────
  const topMuscle = useMemo(() => {
    const withSets = muscleSetData.filter(d => d.sets > 0);
    return withSets.length > 0 ? withSets[0].group : null;
  }, [muscleSetData]);

  const dominantPPL = useMemo(() => {
    const { push, pull, legs } = pplData;
    if (push === 0 && pull === 0 && legs === 0) return null;
    if (push >= pull && push >= legs) return { label: 'Push' };
    if (pull >= push && pull >= legs) return { label: 'Pull' };
    return { label: 'Piernas' };
  }, [pplData]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={COLORS.gold}
          style={{ position: 'absolute', top: 12, right: 16, zIndex: 10 }}
        />
      )}
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
                    { width: `${adherence.pct}%`, backgroundColor: COLORS.gold },
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

        {/* ── Fuerza & Hipertrofia ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fuerza & Hipertrofia</Text>
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('HypertrophyStats', { sessions, activePlan })}>
            {/* Period selector */}
            <View style={styles.periodRow}>
              {periods.map(p => (
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
            <View style={styles.hypertrophyMetrics}>
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="trending-up-outline" size={20} color={COLORS.gold} />
                <Text style={styles.hypertrophyMetricValue}>{fmtVolume(totalVolume)}</Text>
                <Text style={styles.hypertrophyMetricLabel}>Volumen</Text>
              </View>
              <View style={styles.hypertrophyDivider} />
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="body-outline" size={20} color={COLORS.gold} />
                <Text style={styles.hypertrophyMetricValue} numberOfLines={1}>
                  {topMuscle ?? '—'}
                </Text>
                <Text style={styles.hypertrophyMetricLabel}>Grupo ppal.</Text>
              </View>
              <View style={styles.hypertrophyDivider} />
              <View style={styles.hypertrophyMetric}>
                <Ionicons name="swap-horizontal-outline" size={20} color={COLORS.gold} />
                <Text style={styles.hypertrophyMetricValue}>
                  {dominantPPL?.label ?? '—'}
                </Text>
                <Text style={styles.hypertrophyMetricLabel}>Tipo dom.</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.hypertrophyBtn}
              onPress={() => navigation.navigate('HypertrophyStats', { sessions, activePlan })}
              activeOpacity={0.7}
            >
              <Ionicons name="analytics-outline" size={15} color={COLORS.gold} />
              <Text style={styles.hypertrophyBtnText}>Ver análisis detallado</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.gold} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* ── Físico & Medidas ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Físico & Medidas</Text>
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('PhysicalStats')}>
            {physicalSummary ? (
              <View style={styles.hypertrophyMetrics}>
                <View style={styles.hypertrophyMetric}>
                  <Ionicons name="scale-outline" size={20} color={COLORS.gold} />
                  <Text style={styles.hypertrophyMetricValue}>
                    {physicalSummary.peso != null ? `${physicalSummary.peso.toFixed(1)} kg` : '—'}
                  </Text>
                  <Text style={styles.hypertrophyMetricLabel}>Peso actual</Text>
                </View>
                <View style={styles.hypertrophyDivider} />
                <View style={styles.hypertrophyMetric}>
                  <Ionicons name="analytics-outline" size={20} color={COLORS.gold} />
                  <Text style={styles.hypertrophyMetricValue} numberOfLines={1}>
                    {physicalSummary.imc != null ? physicalSummary.imc.toFixed(1) : '—'}
                  </Text>
                  <Text style={styles.hypertrophyMetricLabel}>IMC</Text>
                </View>
                <View style={styles.hypertrophyDivider} />
                <View style={styles.hypertrophyMetric}>
                  <Ionicons name="git-compare-outline" size={20} color={COLORS.gold} />
                  <Text style={styles.hypertrophyMetricValue}>
                    {physicalSummary.pesoDelta != null
                      ? `${physicalSummary.pesoDelta > 0 ? '+' : ''}${physicalSummary.pesoDelta.toFixed(1)} kg`
                      : '—'}
                  </Text>
                  <Text style={styles.hypertrophyMetricLabel}>vs anterior</Text>
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.hypertrophyBtn}
              onPress={() => navigation.navigate('PhysicalStats')}
              activeOpacity={0.7}
            >
              <Ionicons name="body-outline" size={15} color={COLORS.gold} />
              <Text style={styles.hypertrophyBtnText}>Ver composición, simetría y progresión</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.gold} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  scroll:         { paddingHorizontal: 16, paddingTop: 12 },

  // Period selector (inside Fuerza & Hipertrofia card)
  periodRow:      { flexDirection: 'row', backgroundColor: '#242424', borderRadius: 8, padding: 3, marginBottom: 14 },
  periodBtn:      { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  periodBtnActive:{ backgroundColor: COLORS.border },
  periodBtnText:  { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
  periodBtnTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // KPI row
  kpiRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  kpiValue:       { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  kpiLabel:       { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },

  // Sections
  section:        { marginBottom: 16 },
  sectionTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  card:           { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16 },
  emptyText:      { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8 },

  // Adherence
  adherenceHeader:{ alignItems: 'center', marginBottom: 12 },
  adherencePct:   { fontSize: 42, fontWeight: '700', color: COLORS.textPrimary },
  adherenceSubtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.surfaceInner,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill:{ height: '100%', borderRadius: 4 },
  adherenceHint:  { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Hypertrophy summary card
  hypertrophyMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  hypertrophyMetric:  { flex: 1, alignItems: 'center', gap: 4 },
  hypertrophyMetricValue: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  hypertrophyMetricLabel: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  hypertrophyDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
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
  hypertrophyBtnText: { fontSize: 15, color: COLORS.gold, fontWeight: '600' },
});
