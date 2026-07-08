import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Modal,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { calcExerciseHI, secondaryActivation } from '../utils/hypertrophyMetrics';
import { COLORS } from '../config/theme';

// ─── Muscle group mapping ─────────────────────────────────────────────────────
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

const CHART_MODES = [
  { key: 'total',    label: 'Total' },
  { key: 'training', label: 'Entreno' },
  { key: 'exercise', label: 'Ejercicio' },
  { key: 'muscle',   label: 'Músculo' },
  { key: 'hi',       label: 'HI' },
];

const CHART_TITLE = {
  total:    'Volumen semanal (kg)',
  training: 'Volumen · Entreno (kg)',
  exercise: 'Volumen · Ejercicio (kg)',
  muscle:   'Volumen · Músculo (kg)',
  hi:       'HI semanal',
};

export default function HypertrophyStatsScreen({ route }) {
  const { sessions = [], activePlan = null } = route.params || {};
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState('4w');

  const effectivePeriod = (period === 'cycle' && !activePlan) ? '4w'
    : (period === '3m' && !!activePlan) ? '4w'
    : period;
  const [chartMode, setChartMode] = useState('total');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);   // exercise or muscle
  const [pickerType, setPickerType] = useState(null);       // 'training' | 'exercise' | null
  const [pickerSearch, setPickerSearch] = useState('');
  const [hiInfoVisible, setHiInfoVisible] = useState(false);
  const [e1rmShowAll, setE1rmShowAll] = useState(false);

  const openPicker = (type) => { setPickerType(type); setPickerSearch(''); };
  const closePicker = () => setPickerType(null);

  // ── Chart sessions (period-filtered) ──────────────────────────────────────
  const chartSessions = useMemo(() => {
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

  const weekMap = useMemo(() => {
    const map = {};
    chartSessions.forEach(s => {
      const wk = toWeekKey(s.date);
      if (!map[wk]) map[wk] = [];
      map[wk].push(s);
    });
    return map;
  }, [chartSessions]);

  const weekKeys = useMemo(() => Object.keys(weekMap).sort(), [weekMap]);

  // ── Secondary selector options ─────────────────────────────────────────────
  const trainingOptions = useMemo(() => {
    const names = new Set();
    (activePlan?.days || []).forEach(d =>
      (d.trainings || []).forEach(t => { if (t.name) names.add(t.name); })
    );
    sessions.forEach(s => { if (s.trainingId?.name) names.add(s.trainingId.name); });
    return Array.from(names);
  }, [activePlan, sessions]);

  const exerciseOptions = useMemo(() => {
    const map = new Map();
    sessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const name = ex.exerciseId?.name_es || ex.exerciseId?.name;
        if (name) map.set(name, name);
      });
    });
    return Array.from(map.keys()).sort();
  }, [sessions]);

  // Exercises filtered to the selected training (for exercise/1rm modes)
  const filteredExerciseOptions = useMemo(() => {
    if (!selectedTraining) return exerciseOptions;
    const map = new Map();
    sessions
      .filter(s => s.trainingId?.name === selectedTraining)
      .forEach(s => {
        (s.exercises || []).forEach(ex => {
          const name = ex.exerciseId?.name_es || ex.exerciseId?.name;
          if (name) map.set(name, name);
        });
      });
    return Array.from(map.keys()).sort();
  }, [selectedTraining, sessions, exerciseOptions]);

  const muscleOptions = useMemo(() => Object.keys(MUSCLE_RANGES), []);

  // ── Weekly summary (used when period === '1w') ───────────────────────────────
  const weeklySummary = useMemo(() => {
    if (effectivePeriod !== '1w') return null;
    let totalVol = 0, totalSets = 0, totalExercises = 0;
    const sessionCount = chartSessions.length;
    chartSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        totalExercises++;
        (ex.sets || []).forEach(set => {
          if (set.completed && (set.weight || 0) > 0 && (set.reps || 0) > 0) {
            totalVol += set.weight * set.reps;
            totalSets++;
          }
        });
      });
    });
    return { sessionCount, totalVol, totalSets, totalExercises };
  }, [chartSessions, effectivePeriod]);

  // Auto-select when chart mode changes
  useEffect(() => {
    if (chartMode === 'training') {
      setSelectedTraining(trainingOptions[0] ?? null);
      setSelectedItem(null);
    } else if (chartMode === 'exercise') {
      const t = trainingOptions[0] ?? null;
      setSelectedTraining(t);
      // exercise reset handled by the training-change effect below
    } else if (chartMode === 'muscle') {
      setSelectedItem(muscleOptions[0]);
    } else {
      setSelectedItem(null);
    }
  }, [chartMode]);

  // Reset selected exercise when training changes in exercise mode
  useEffect(() => {
    if (chartMode === 'exercise') {
      setSelectedItem(filteredExerciseOptions[0] ?? null);
    }
  }, [selectedTraining, chartMode]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return weekKeys.map(wk => {
      const wkSess = weekMap[wk] || [];
      let val = 0;

      if (chartMode === 'total') {
        val = calcVolume(wkSess);
      } else if (chartMode === 'training' && selectedTraining) {
        val = calcVolume(wkSess.filter(s => s.trainingId?.name === selectedTraining));
      } else if (chartMode === 'exercise' && selectedItem) {
        const src = selectedTraining ? wkSess.filter(s => s.trainingId?.name === selectedTraining) : wkSess;
        src.forEach(s => {
          (s.exercises || []).forEach(ex => {
            const name = ex.exerciseId?.name_es || ex.exerciseId?.name;
            if (name === selectedItem)
              val += (ex.sets || []).reduce((t, set) =>
                set.completed && set.weight > 0 && set.reps > 0 ? t + set.weight * set.reps : t, 0);
          });
        });
      } else if (chartMode === 'muscle' && selectedItem) {
        wkSess.forEach(s => {
          (s.exercises || []).forEach(ex => {
            const muscles = ex.exerciseId?.primaryMuscles || [];
            if (muscles.some(m => MUSCLE_MAP[m?.toLowerCase()] === selectedItem))
              val += (ex.sets || []).reduce((t, set) =>
                set.completed && set.weight > 0 && set.reps > 0 ? t + set.weight * set.reps : t, 0);
          });
        });
      } else if (chartMode === 'hi') {
        const hiValues = [];
        wkSess.forEach(s => {
          (s.exercises || []).forEach(ex => {
            const hi = calcExerciseHI(ex);
            if (hi > 0) hiValues.push(hi);
          });
        });
        val = hiValues.length > 0
          ? Math.round((hiValues.reduce((a, v) => a + v, 0) / hiValues.length) * 100) / 100
          : 0;
      }

      return { wk, val };
    });
  }, [chartMode, selectedTraining, selectedItem, weekKeys, weekMap]);

  const fmtVal = (v) => chartMode === 'hi' ? v.toFixed(2) : fmtVolume(v);
  const maxChartVal = Math.max(...chartData.map(d => d.val), 0);

  // ── Plan-based muscle data (CAPA 1: series efectivas) ───────────────────────
  // Primary muscles: activation = 1.0
  // Secondary muscles: activation = 0.5 (compound) | 0.3 (isolation)
  const planMuscleSetData = useMemo(() => {
    const map = {};
    (activePlan?.days || []).forEach(day => {
      (day.trainings || []).forEach(training => {
        (training.exercises || []).forEach(ex => {
          const setCount = (ex.sets || []).length;
          if (!setCount) return;
          const secFactor = secondaryActivation(ex.exerciseId?.mechanic);
          (ex.exerciseId?.primaryMuscles || []).forEach(m => {
            const group = MUSCLE_MAP[m?.toLowerCase()];
            if (group) map[group] = (map[group] || 0) + setCount;
          });
          (ex.exerciseId?.secondaryMuscles || []).forEach(m => {
            const group = MUSCLE_MAP[m?.toLowerCase()];
            if (group) map[group] = (map[group] || 0) + setCount * secFactor;
          });
        });
      });
    });
    return Object.entries(MUSCLE_RANGES)
      .map(([group, range]) => ({ group, sets: Math.round((map[group] || 0) * 10) / 10, ...range }))
      .sort((a, b) => b.sets - a.sets);
  }, [activePlan]);

  const hasPlanExercises = useMemo(() =>
    (activePlan?.days || []).some(d =>
      (d.trainings || []).some(t => (t.exercises || []).length > 0)
    ), [activePlan]);

  // ── Plan-based PPL data ────────────────────────────────────────────────────
  // Push/Pull: usa el campo force del ejercicio; Piernas: por músculo
  const planPPLData = useMemo(() => {
    let push = 0, pull = 0, legs = 0;
    (activePlan?.days || []).forEach(day => {
      let hasPush = false, hasPull = false;
      const allMuscles = [];
      (day.trainings || []).forEach(t => {
        (t.exercises || []).forEach(ex => {
          const force = ex.exerciseId?.force?.toLowerCase();
          if (force === 'push') hasPush = true;
          if (force === 'pull') hasPull = true;
          (ex.exerciseId?.primaryMuscles || []).forEach(m => allMuscles.push(m));
        });
      });
      if (!allMuscles.length && !hasPush && !hasPull) return;
      const { isLegs } = classifySession(allMuscles);
      if (hasPush) push++;
      if (hasPull) pull++;
      if (isLegs) legs++;
    });
    return { push, pull, legs, total: push + pull + legs || 1 };
  }, [activePlan]);

  // ── Session HI metrics (CAPA 2) ────────────────────────────────────────
  const sessionHIData = useMemo(() => {
    const muscleMap = {};
    let totalHI = 0, exerciseCount = 0;

    chartSessions.forEach(session => {
      (session.exercises || []).forEach(ex => {
        const hi = calcExerciseHI(ex);
        if (hi === 0) return;
        exerciseCount++;
        totalHI += hi;
        const secFactor = secondaryActivation(ex.exerciseId?.mechanic);
        const addMuscle = (m, activation) => {
          const group = MUSCLE_MAP[m?.toLowerCase()];
          if (!group) return;
          if (!muscleMap[group]) muscleMap[group] = { hiWeighted: 0, activation: 0 };
          muscleMap[group].hiWeighted += hi * activation;
          muscleMap[group].activation += activation;
        };
        (ex.exerciseId?.primaryMuscles || []).forEach(m => addMuscle(m, 1.0));
        (ex.exerciseId?.secondaryMuscles || []).forEach(m => addMuscle(m, secFactor));
      });
    });

    const avgHI = exerciseCount > 0 ? totalHI / exerciseCount : 0;
    const muscles = Object.entries(muscleMap)
      .map(([group, { hiWeighted, activation }]) => ({
        group,
        avg_HI: activation > 0 ? hiWeighted / activation : 0,
      }))
      .sort((a, b) => b.avg_HI - a.avg_HI);

    return { avgHI, muscles };
  }, [chartSessions]);

  // ── Mejores marcas (e1RM histórico) ─────────────────────────────────────────────────
  // Uses ALL sessions (not period-filtered) — PRs are historical.
  const topE1RM = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const name = ex.exerciseId?.name_es || ex.exerciseId?.name;
        if (!name) return;
        (ex.sets || []).forEach(set => {
          if (!set.completed || !set.weight || !set.reps || set.reps <= 0) return;
          const e1rm = set.weight * (1 + set.reps / 30);
          if (!map[name] || e1rm > map[name].e1rm)
            map[name] = { e1rm, weight: set.weight, reps: set.reps, date: s.date };
        });
      });
    });
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.e1rm - a.e1rm)
      .slice(0, 8);
  }, [sessions]);

  const MEDALS = ['🥇', '🥈', '🥉'];
  const fmtPRDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'ayer';
    if (diffDays < 7) return `hace ${diffDays}d`;
    if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)}sem`;
    if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)}m`;
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear().toString().slice(2)}`;
  };

  // ── Force balance (CAPA 1 + force field) ────────────────────────────
  const forceBalance = useMemo(() => {
    let push = 0, pull = 0;
    chartSessions.forEach(s => {
      (s.exercises || []).forEach(ex => {
        const completed = (ex.sets || []).filter(set => set.completed).length;
        if (!completed) return;
        const force = ex.exerciseId?.force?.toLowerCase();
        if (force === 'push') push += completed;
        else if (force === 'pull') pull += completed;
      });
    });
    return { push, pull, total: push + pull || 1 };
  }, [chartSessions]);

  // ── Chart SVG helpers ──────────────────────────────────────────────────────
  const CHART_H = 220;
  const CHART_PAD = { top: 28, bottom: 30, left: 30, right: 40 };
  const X_INSET = 16;
  const chartW = width - 32;

  const chartGeometry = useMemo(() => {
    const innerW = chartW - CHART_PAD.left - CHART_PAD.right;
    const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
    const n = chartData.length;

    if (n === 0) return null;

    const rawValues = chartData.map(d => d.val);
    const rawMin = Math.min(...rawValues);
    const rawMax = Math.max(...rawValues);
    const rawRange = rawMax - rawMin || rawMax || 1;

    // Nice Y step
    const roughStep = rawRange / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
    const norm = roughStep / magnitude;
    let niceStep;
    if (norm < 1.5) niceStep = 1 * magnitude;
    else if (norm < 3) niceStep = 2 * magnitude;
    else if (norm < 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    // Clamp minVal to 0 — volume and HI are always non-negative
    const minVal = Math.max(0, Math.floor(rawMin / niceStep - 0.0001) * niceStep);
    const maxVal = Math.ceil(rawMax / niceStep + 0.0001) * niceStep;
    const range = maxVal - minVal || 1;

    const xFor = (i) =>
      CHART_PAD.left + X_INSET +
      (n === 1 ? innerW / 2 : (i / (n - 1)) * (innerW - 2 * X_INSET));
    const yFor = (v) =>
      CHART_PAD.top + innerH - ((v - minVal) / range) * innerH;

    // Straight-line path
    const linePath = chartData
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(d.val).toFixed(1)}`)
      .join(' ');
    const baseY = (CHART_PAD.top + innerH).toFixed(1);
    const areaPath = n > 1
      ? linePath +
        ` L${xFor(n - 1).toFixed(1)},${baseY}` +
        ` L${xFor(0).toFixed(1)},${baseY} Z`
      : null;

    // Max and last point indices (used for highlighted dots)
    const maxIdx = rawValues.indexOf(Math.max(...rawValues));
    const lastIdx = n - 1;

    // Y ticks
    const yTicks = [];
    for (let v = minVal; v <= maxVal + niceStep * 0.001; v += niceStep) {
      yTicks.push(parseFloat(v.toFixed(6)));
    }

    // X label indices (up to 4)
    const xLabelIndices = n <= 4
      ? chartData.map((_, i) => i)
      : [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1];

    return { xFor, yFor, linePath, areaPath, yTicks, xLabelIndices, minVal, maxVal, range, innerH, maxIdx, lastIdx };
  }, [chartData, chartW]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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

        {/* ── Volumen semanal (filterable) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {effectivePeriod === '1w' ? 'Resumen semanal' : (CHART_TITLE[chartMode] ?? 'Volumen semanal')}
          </Text>

          {/* Chart mode pills — hidden in weekly view */}
          {effectivePeriod !== '1w' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
              <View style={styles.modeContainer}>
                {CHART_MODES.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.modeBtn, chartMode === m.key && styles.modeBtnActive]}
                    onPress={() => setChartMode(m.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modeBtnText, chartMode === m.key && styles.modeBtnTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* ── Contextual filter row ── */}
          {effectivePeriod !== '1w' && chartMode === 'muscle' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subScroll}>
              <View style={styles.subContainer}>
                {muscleOptions.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.subBtn, selectedItem === opt && styles.subBtnActive]}
                    onPress={() => setSelectedItem(opt)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subBtnText, selectedItem === opt && styles.subBtnTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {effectivePeriod !== '1w' && chartMode === 'training' && trainingOptions.length > 0 && (
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => openPicker('training')}
              activeOpacity={0.75}
            >
              <Text style={styles.pickerTriggerText} numberOfLines={1}>
                {selectedTraining ?? 'Seleccionar entreno'}
              </Text>
              <Text style={styles.pickerChevron}>▾</Text>
            </TouchableOpacity>
          )}

          {effectivePeriod !== '1w' && chartMode === 'exercise' && (
            <View style={styles.dualTriggerRow}>
              <TouchableOpacity
                style={[styles.pickerTrigger, styles.pickerTriggerHalf]}
                onPress={() => openPicker('training')}
                activeOpacity={0.75}
              >
                <Text style={styles.pickerTriggerLabel}>Entreno</Text>
                <Text style={styles.pickerTriggerText} numberOfLines={1}>
                  {selectedTraining ?? '—'}
                </Text>
                <Text style={styles.pickerChevron}>▾</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerTrigger, styles.pickerTriggerHalf]}
                onPress={() => openPicker('exercise')}
                activeOpacity={0.75}
              >
                <Text style={styles.pickerTriggerLabel}>Ejercicio</Text>
                <Text style={styles.pickerTriggerText} numberOfLines={1}>
                  {selectedItem ?? '—'}
                </Text>
                <Text style={styles.pickerChevron}>▾</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            {effectivePeriod === '1w' ? (
              // ── Weekly summary (no chart — single data point has no comparative value) ──
              weeklySummary && weeklySummary.sessionCount > 0 ? (
                <View style={styles.weekSummaryGrid}>
                  <View style={styles.weekSummaryItem}>
                    <Text style={styles.weekSummaryValue}>
                      {weeklySummary.totalVol >= 1000
                        ? `${(weeklySummary.totalVol / 1000).toFixed(1)}k`
                        : `${Math.round(weeklySummary.totalVol)}`}
                    </Text>
                    <Text style={styles.weekSummaryLabel}>kg totales</Text>
                  </View>
                  <View style={styles.weekSummaryDivider} />
                  <View style={styles.weekSummaryItem}>
                    <Text style={styles.weekSummaryValue}>{weeklySummary.sessionCount}</Text>
                    <Text style={styles.weekSummaryLabel}>{weeklySummary.sessionCount === 1 ? 'sesión' : 'sesiones'}</Text>
                  </View>
                  <View style={styles.weekSummaryDivider} />
                  <View style={styles.weekSummaryItem}>
                    <Text style={styles.weekSummaryValue}>{weeklySummary.totalSets}</Text>
                    <Text style={styles.weekSummaryLabel}>series</Text>
                  </View>
                  <View style={styles.weekSummaryDivider} />
                  <View style={styles.weekSummaryItem}>
                    <Text style={styles.weekSummaryValue}>{weeklySummary.totalExercises}</Text>
                    <Text style={styles.weekSummaryLabel}>ejercicios</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyText}>Sin entrenos esta semana.</Text>
              )
            ) : chartData.length === 0 ? (
              <Text style={styles.emptyText}>Sin datos en el período seleccionado.</Text>
            ) : (
              <Svg width={chartW} height={CHART_H}>
                <Defs>
                  <LinearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={COLORS.gold} stopOpacity="0.45" />
                    <Stop offset="0.65" stopColor={COLORS.gold} stopOpacity="0.12" />
                    <Stop offset="1" stopColor={COLORS.gold} stopOpacity="0" />
                  </LinearGradient>
                </Defs>

                {/* Y-axis guide lines + labels */}
                {chartGeometry?.yTicks.map((v, i) => (
                  <React.Fragment key={i}>
                    <Line
                      x1={CHART_PAD.left}
                      y1={chartGeometry.yFor(v)}
                      x2={chartW - CHART_PAD.right}
                      y2={chartGeometry.yFor(v)}
                      stroke={COLORS.borderSubtle}
                      strokeWidth={1}
                    />
                    <SvgText
                      x={CHART_PAD.left - 5}
                      y={chartGeometry.yFor(v) + 4}
                      fontSize={15}
                      fill={COLORS.textSecondary}
                      textAnchor="end"
                    >
                      {chartMode === 'hi'
                        ? v.toFixed(1)
                        : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`
                      }
                    </SvgText>
                  </React.Fragment>
                ))}

                {/* X baseline */}
                {chartGeometry && (
                  <Line
                    x1={CHART_PAD.left}
                    y1={CHART_PAD.top + chartGeometry.innerH}
                    x2={chartW - CHART_PAD.right}
                    y2={CHART_PAD.top + chartGeometry.innerH}
                    stroke="#3A3A3A"
                    strokeWidth={1.5}
                  />
                )}

                {/* Area fill */}
                {chartGeometry?.areaPath && (
                  <Path d={chartGeometry.areaPath} fill="url(#volGrad)" />
                )}

                {/* Line */}
                <Path
                  d={chartGeometry?.linePath ?? ''}
                  stroke={COLORS.gold}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Dots — label only for max and last point */}
                {chartData.map((d, i) => {
                  const isMax  = i === chartGeometry?.maxIdx;
                  const isLast = i === chartGeometry?.lastIdx;
                  const showLabel = isMax || (isLast && !isMax);
                  const cx = chartGeometry?.xFor(i) ?? 0;
                  const cy = chartGeometry?.yFor(d.val) ?? 0;
                  const label = chartMode === 'hi'
                    ? d.val.toFixed(1)
                    : d.val >= 1000 ? `${(d.val / 1000).toFixed(1)}k` : `${Math.round(d.val)}`;
                  return (
                    <React.Fragment key={i}>
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={isMax ? 5.5 : 3.5}
                        fill={COLORS.gold}
                        stroke={COLORS.background}
                        strokeWidth={isMax ? 2 : 1.5}
                      />
                      {showLabel && (
                        <SvgText
                          x={cx}
                          y={cy - 12}
                          fontSize={15}
                          fill={COLORS.gold}
                          textAnchor="middle"
                          fontWeight={'bold'}
                        >
                          {label}
                        </SvgText>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* X-axis labels */}
                {chartGeometry?.xLabelIndices.map(i => {
                  const parts = chartData[i].wk.split('-');
                  return (
                    <SvgText
                      key={i}
                      x={chartGeometry.xFor(i)}
                      y={CHART_H - 4}
                      fontSize={13}
                      fill={COLORS.textSecondary}
                      textAnchor="middle"
                    >
                      {`${parts[2]}/${parts[1]}`}
                    </SvgText>
                  );
                })}
              </Svg>
            )}
          </View>
        </View>

        {/* ── Índice de Hipertrofia (CAPA 2) ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Índice de Hipertrofia</Text>
            <TouchableOpacity onPress={() => setHiInfoVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </TouchableOpacity>
          </View>

          {/* avg HI KPI - ring */}
          <View style={[styles.card, { alignItems: 'center', marginBottom: 10, paddingVertical: 20 }]}>
            {(() => {
              const hi = sessionHIData.avgHI;
              const ringColor = hi >= 7 ? COLORS.success : hi >= 4 ? COLORS.gold : hi > 0 ? COLORS.warning : COLORS.surfaceInner;
              const progress = hi > 0 ? Math.min(hi / 10, 1) : 0;
              const R = 44, SW = 8, SIZE = R * 2 + SW * 2, cx = SIZE / 2;
              const CIRC = 2 * Math.PI * R;
              const dashOffset = CIRC * (1 - progress);
              return (
                <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
                  <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
                    <Circle cx={cx} cy={cx} r={R} stroke={COLORS.surfaceInner} strokeWidth={SW} fill="none" />
                    <Circle
                      cx={cx} cy={cx} r={R}
                      stroke={ringColor} strokeWidth={SW} fill="none"
                      strokeDasharray={`${CIRC}`}
                      strokeDashoffset={`${dashOffset}`}
                      strokeLinecap="round"
                    />
                  </Svg>
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[styles.hiKpiValue, { color: ringColor, fontSize: 30 }]}>
                      {hi > 0 ? hi.toFixed(1) : '—'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>/10</Text>
                  </View>
                </View>
              );
            })()}
            <Text style={[styles.hiKpiLabel, { marginTop: 10 }]}>HI medio del período</Text>
          </View>

          {/* HI bars legend */}
          {sessionHIData.muscles.length > 0 && (
            <View style={[styles.legendRow, { marginBottom: 8 }]}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.legendText}>{'Alto (≥ 7)'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.gold }]} />
                <Text style={styles.legendText}>{'Moderado (≥ 4)'}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.legendText}>{'Bajo (< 4)'}</Text>
              </View>
            </View>
          )}

          {/* Per-muscle avg HI */}
          {sessionHIData.muscles.length > 0 && (
            <View style={styles.card}>
              {sessionHIData.muscles.map(({ group, avg_HI }) => {
                const barW = Math.min((avg_HI / 10) * 100, 100);
                const barColor = avg_HI >= 7
                  ? COLORS.success
                  : avg_HI >= 4
                    ? COLORS.gold
                    : COLORS.warning;
                return (
                  <View key={group} style={styles.muscleRow}>
                    <Text style={styles.muscleLabel}>{group}</Text>
                    <View style={styles.muscleBarBg}>
                      <View style={[styles.muscleBarFill, { width: `${barW}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.muscleSetCount, { color: barColor }]}>
                      {avg_HI.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.muscleRangeHint}>
                <Text style={styles.muscleRangeHintText}>HI promedio ponderado por activación muscular</Text>
              </View>
            </View>
          )}
          {sessionHIData.muscles.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.emptyText}>Sin datos en el período seleccionado.</Text>
            </View>
          )}
        </View>

        {/* ── Mejores marcas (e1RM) ── */}
        {topE1RM.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mejores marcas</Text>
            <View style={styles.card}>
              {(e1rmShowAll ? topE1RM : topE1RM.slice(0, 3)).map((item, i) => {
                const medal = MEDALS[i] ?? null;
                return (
                  <View key={item.name} style={[styles.e1rmRow, i < (e1rmShowAll ? topE1RM.length : Math.min(topE1RM.length, 3)) - 1 && styles.e1rmRowBorder]}>
                    <Text style={styles.e1rmRank}>{medal ?? `#${i + 1}`}</Text>
                    <View style={styles.e1rmInfo}>
                      <View style={styles.e1rmNameRow}>
                        <Text style={styles.e1rmName} numberOfLines={1}>{item.name}</Text>
                        {item.date ? <Text style={styles.e1rmDate}>{fmtPRDate(item.date)}</Text> : null}
                      </View>
                      <Text style={styles.e1rmSet}>{item.weight} kg × {item.reps} reps</Text>
                    </View>
                    <View style={styles.e1rmBadge}>
                      <Text style={styles.e1rmValue}>{Math.round(item.e1rm)} kg</Text>
                      <Text style={styles.e1rmLabel}>e1RM</Text>
                    </View>
                  </View>
                );
              })}
              {topE1RM.length > 3 && (
                <TouchableOpacity
                  style={styles.e1rmToggleBtn}
                  onPress={() => setE1rmShowAll(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.e1rmToggleText}>
                    {e1rmShowAll ? 'Mostrar menos ▴' : `Mostrar más ▾`}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.e1rmHint}>Estimado con Epley · basado en tu historial completo</Text>
            </View>
          </View>
        )}

        {/* ── Series por grupo muscular (from plan) ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Series por grupo muscular</Text>
            {activePlan && (
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>Plan</Text>
              </View>
            )}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
              <Text style={styles.legendText}>Por debajo MEV</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}>Zona óptima</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.info }]} />
              <Text style={styles.legendText}>Por encima MAV</Text>
            </View>
          </View>
          <View style={styles.card}>
            {!activePlan ? (
              <Text style={styles.emptyText}>Sin planificación activa.</Text>
            ) : !hasPlanExercises ? (
              <Text style={styles.emptyText}>La planificación no tiene ejercicios configurados.</Text>
            ) : (
              <>
                {planMuscleSetData.map(({ group, sets, mev, mav }) => {
                  const barColor = sets === 0
                    ? COLORS.surfaceInner
                    : sets < mev
                      ? COLORS.warning
                      : sets > mav
                        ? COLORS.info
                        : COLORS.success;
                  const barW = sets === 0 ? 0 : Math.min((sets / (mav * 1.3)) * 100, 100);
                  return (
                    <View key={group} style={styles.muscleRow}>
                      <Text style={styles.muscleLabel}>{group}</Text>
                      <View style={styles.muscleBarBg}>
                        <View style={[styles.muscleBarFill, { width: `${barW}%`, backgroundColor: barColor }]} />
                        <View style={[styles.muscleRefLine, { left: `${(mev / (mav * 1.3)) * 100}%`, backgroundColor: '#BDBDBD' }]} />
                        <View style={[styles.muscleRefLine, { left: `${(mav / (mav * 1.3)) * 100}%`, backgroundColor: '#888' }]} />
                      </View>
                      <Text style={[styles.muscleSetCount, { color: barColor === COLORS.surfaceInner ? '#777' : barColor }]}>
                        {sets}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.muscleRangeHint}>
                  <Text style={styles.muscleRangeHintText}>
                    Líneas: MEV (mínimo efectivo) · MAV (máximo adaptable)
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── HI Info modal ── */}
      <Modal
        visible={hiInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHiInfoVisible(false)}
      >
        <Pressable style={styles.infoOverlay} onPress={() => setHiInfoVisible(false)}>
          <Pressable style={styles.infoSheet} onPress={() => {}}>
            <Text style={styles.infoTitle}>¿Cómo se calcula el HI?</Text>

            <Text style={styles.infoBody}>
              El <Text style={styles.infoHighlight}>Índice de Hipertrofia (HI)</Text> mide el estímulo real de crecimiento muscular de cada ejercicio combinando cinco factores:
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>📦</Text>
              <Text style={styles.infoRowText}><Text style={styles.infoHighlight}>Volumen</Text> — series × reps × peso. La base del estímulo.</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>🔢</Text>
              <Text style={styles.infoRowText}><Text style={styles.infoHighlight}>Rango de reps</Text> — la zona óptima es 6-12 reps. Muy pocas o muchas reducen el factor.</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>⚡</Text>
              <Text style={styles.infoRowText}><Text style={styles.infoHighlight}>Intensidad relativa</Text> — el peso usado como % de tu máximo estimado (e1RM). El pico está en 70-80 %.</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>🎯</Text>
              <Text style={styles.infoRowText}><Text style={styles.infoHighlight}>RPE</Text> — proximidad al fallo. Más cerca del límite = mayor estímulo.</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>💪</Text>
              <Text style={styles.infoRowText}><Text style={styles.infoHighlight}>Músculo y mecánica</Text> — músculos con menor eficiencia mecánica (bíceps, gemelos) reciben un bonus.</Text>
            </View>

            <Text style={styles.infoFormula}>HI = log(volumen) × reps × intensidad × RPE × músculo</Text>

            <View style={styles.infoDisclaimer}>
              <Text style={styles.infoDisclaimerText}>
                ⚠️ El HI es una <Text style={{ fontWeight: '700' }}>estimación orientativa</Text>, no una métrica científica exacta. Úsalo como referencia para comparar sesiones entre sí, no como un valor absoluto a alcanzar.
              </Text>
            </View>

            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setHiInfoVisible(false)}>
              <Text style={styles.infoCloseBtnText}>Entendido</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Picker modal (training or exercise) ── */}
      <Modal
        visible={pickerType !== null}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalOverlay} onPress={closePicker}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {pickerType === 'training' ? 'Seleccionar entreno' : 'Seleccionar ejercicio'}
            </Text>
            {pickerType === 'exercise' && (
              <TextInput
                style={styles.modalSearch}
                placeholder="Buscar..."
                placeholderTextColor="#555"
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            )}
            <FlatList
              data={
                pickerType === 'training'
                  ? trainingOptions.filter(o => o.toLowerCase().includes(pickerSearch.toLowerCase()))
                  : filteredExerciseOptions.filter(o => o.toLowerCase().includes(pickerSearch.toLowerCase()))
              }
              keyExtractor={item => item}
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = pickerType === 'training'
                  ? selectedTraining === item
                  : selectedItem === item;
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      if (pickerType === 'training') {
                        setSelectedTraining(item);
                      } else {
                        setSelectedItem(item);
                      }
                      closePicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, isActive && styles.modalItemTextActive]}>
                      {item}
                    </Text>
                    {isActive && <Text style={styles.modalItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { paddingHorizontal: 16, paddingTop: 12 },

  // Period selector
  periodRow:           { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10, padding: 3, marginBottom: 16 },
  periodBtn:           { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  periodBtnActive:     { backgroundColor: COLORS.border },
  periodBtnText:       { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
  periodBtnTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // Sections
  section:          { marginBottom: 16 },
  sectionTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle:     { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  planBadge:        { backgroundColor: '#1C2E1C', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  planBadgeText:    { fontSize: 12, color: COLORS.success, fontWeight: '700' },
  card:             { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16 },
  emptyText:        { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8 },

  // Chart mode pills
  modeScroll:          { marginBottom: 8 },
  modeContainer:       { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  modeBtn:             { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#242424' },
  modeBtnActive:       { backgroundColor: '#C9A44C18', borderWidth: 1, borderColor: COLORS.gold },
  modeBtnText:         { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  modeBtnTextActive:   { color: COLORS.gold, fontWeight: '700' },

  // Secondary selector pills
  subScroll:           { marginBottom: 8 },
  subContainer:        { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  subBtn:              { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: COLORS.surface, maxWidth: 160 },
  subBtnActive:        { backgroundColor: COLORS.border, borderWidth: 1, borderColor: '#9A9A9A55' },
  subBtnText:          { fontSize: 13, color: COLORS.textSecondary },
  subBtnTextActive:    { color: COLORS.textPrimary, fontWeight: '600' },

  // Chart header
  chartHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chartMax:     { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  chartHint:    { fontSize: 12, color: '#555', fontStyle: 'italic' },

  // Legend
  legendRow:    { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { fontSize: 13, color: COLORS.textSecondary },

  // Muscle chart
  muscleRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  muscleLabel:  { width: 90, fontSize: 14, color: COLORS.textPrimary },
  muscleBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.surfaceInner,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  muscleBarFill:  { height: '100%', borderRadius: 6 },
  muscleRefLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  muscleSetCount:      { width: 28, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  muscleRangeHint:     { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.surfaceInner, paddingTop: 8 },
  muscleRangeHintText: { fontSize: 12, color: '#777', textAlign: 'center' },

  // Push/Pull/Legs
  pplRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pplLabel: { width: 60, fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  pplBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.surfaceInner,
    borderRadius: 6,
    overflow: 'hidden',
  },
  pplBarFill:  { height: '100%', borderRadius: 6 },
  pplCount:    { width: 28, textAlign: 'right', fontSize: 15, fontWeight: '700' },

  // Exercise picker trigger
  dualTriggerRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  pickerTriggerHalf: { flex: 1, marginBottom: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 1 },
  pickerTriggerLabel: { fontSize: 12, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerTriggerText: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  pickerChevron:     { fontSize: 14, color: '#555' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.surfaceInner,
    alignSelf: 'center',
    marginTop: 10, marginBottom: 14,
  },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  modalSearch: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalList:         { flexGrow: 0 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  modalItemActive:     { },
  modalItemText:       { fontSize: 16, color: '#BDBDBD' },
  modalItemTextActive: { color: COLORS.gold, fontWeight: '700' },
  modalItemCheck:      { fontSize: 16, color: COLORS.gold },

  // Weekly summary grid
  weekSummaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  weekSummaryItem:    { flex: 1, alignItems: 'center', gap: 4 },
  weekSummaryValue:   { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  weekSummaryLabel:   { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  weekSummaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },

  // HI section
  hiKpiValue:     { fontSize: 38, fontWeight: '700', color: COLORS.gold },
  hiKpiLabel:     { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  hiKpiDivider:   { width: 1, backgroundColor: COLORS.border, alignSelf: 'stretch' },
  hiBalanceHint:  { fontSize: 12, color: '#555', marginTop: 4 },

  // e1RM leaderboard
  e1rmRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  e1rmRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#242424' },
  e1rmRank:       { fontSize: 20, width: 28, textAlign: 'center', color: COLORS.textPrimary },
  e1rmInfo:       { flex: 1, gap: 3 },
  e1rmNameRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  e1rmName:       { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  e1rmDate:       { fontSize: 12, color: '#888', flexShrink: 0 },
  e1rmSet:        { fontSize: 13, color: COLORS.textSecondary },
  e1rmBadge:      { alignItems: 'flex-end', gap: 1 },
  e1rmValue:      { fontSize: 17, fontWeight: '700', color: COLORS.gold },
  e1rmLabel:      { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  e1rmToggleBtn:  { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#242424', marginTop: 4 },
  e1rmToggleText: { fontSize: 14, color: COLORS.gold, fontWeight: '600' },
  e1rmHint:       { fontSize: 12, color: '#555', textAlign: 'center', marginTop: 10 },

  // Info icon
  infoIcon: { fontSize: 17, color: COLORS.gold, lineHeight: 18 },

  // HI Info modal
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  infoSheet: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  infoBody: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },
  infoHighlight: {
    color: COLORS.gold,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  infoBullet: { fontSize: 16, lineHeight: 20 },
  infoRowText: { flex: 1, fontSize: 15, color: COLORS.textSecondary, lineHeight: 20 },
  infoFormula: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceInner,
    paddingTop: 12,
  },
  infoCloseBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  infoCloseBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.background },

  // HI disclaimer
  infoDisclaimer: {
    backgroundColor: COLORS.goldBg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  infoDisclaimerText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 18 },
});
