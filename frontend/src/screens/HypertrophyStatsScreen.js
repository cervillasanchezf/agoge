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
  const CHART_H = 180;
  const CHART_PAD = { top: 16, bottom: 36, left: 42, right: 16 };
  const X_INSET = 12;
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

    const minVal = Math.floor(rawMin / niceStep - 0.0001) * niceStep;
    const maxVal = Math.ceil(rawMax / niceStep + 0.0001) * niceStep;
    const range = maxVal - minVal || 1;

    const xFor = (i) =>
      CHART_PAD.left + X_INSET +
      (n === 1 ? innerW / 2 : (i / (n - 1)) * (innerW - 2 * X_INSET));
    const yFor = (v) =>
      CHART_PAD.top + innerH - ((v - minVal) / range) * innerH;

    // Line path
    const linePath = chartData
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(d.val).toFixed(1)}`)
      .join(' ');

    const areaPath = n > 1
      ? linePath +
        ` L${xFor(n - 1).toFixed(1)},${(CHART_PAD.top + innerH).toFixed(1)}` +
        ` L${xFor(0).toFixed(1)},${(CHART_PAD.top + innerH).toFixed(1)} Z`
      : null;

    // Y ticks
    const yTicks = [];
    for (let v = minVal; v <= maxVal + niceStep * 0.001; v += niceStep) {
      yTicks.push(parseFloat(v.toFixed(6)));
    }

    // X label indices (up to 4)
    const xLabelIndices = n <= 4
      ? chartData.map((_, i) => i)
      : [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3), n - 1];

    return { xFor, yFor, linePath, areaPath, yTicks, xLabelIndices, minVal, maxVal, range, innerH };
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
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Volumen semanal</Text>

          {/* Chart mode pills */}
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

          {/* ── Contextual filter row ── */}
          {chartMode === 'muscle' && (
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

          {chartMode === 'training' && trainingOptions.length > 0 && (
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

          {chartMode === 'exercise' && (
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
            {chartData.length === 0 ? (
              <Text style={styles.emptyText}>Sin datos en el período seleccionado.</Text>
            ) : (
              <Svg width={chartW} height={CHART_H}>
                <Defs>
                  <LinearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#C9A44C" stopOpacity="0.3" />
                    <Stop offset="1" stopColor="#C9A44C" stopOpacity="0" />
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
                      stroke="#252525"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={CHART_PAD.left - 5}
                      y={chartGeometry.yFor(v) + 4}
                      fontSize={9}
                      fill="#6A6A6A"
                      textAnchor="end"
                    >
                      {chartMode === 'hi'
                        ? v.toFixed(1)
                        : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`
                      }
                    </SvgText>
                  </React.Fragment>
                ))}

                {/* Area fill */}
                {chartGeometry?.areaPath && (
                  <Path d={chartGeometry.areaPath} fill="url(#volGrad)" />
                )}

                {/* Line */}
                <Path
                  d={chartGeometry?.linePath ?? ''}
                  stroke="#C9A44C"
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Dots */}
                {chartData.map((d, i) => (
                  <Circle
                    key={i}
                    cx={chartGeometry?.xFor(i) ?? 0}
                    cy={chartGeometry?.yFor(d.val) ?? 0}
                    r={3.5}
                    fill="#C9A44C"
                    stroke="#0D0D0D"
                    strokeWidth={1.5}
                  />
                ))}

                {/* X-axis labels */}
                {chartGeometry?.xLabelIndices.map(i => {
                  const parts = chartData[i].wk.split('-');
                  return (
                    <SvgText
                      key={i}
                      x={chartGeometry.xFor(i)}
                      y={CHART_H - 4}
                      fontSize={9}
                      fill="#6A6A6A"
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
          </View>

          {/* avg HI KPI */}
          <View style={[styles.card, { alignItems: 'center', marginBottom: 10 }]}>
            <Text style={styles.hiKpiValue}>
              {sessionHIData.avgHI > 0 ? sessionHIData.avgHI.toFixed(2) : '—'}
            </Text>
            <Text style={styles.hiKpiLabel}>HI medio (período)</Text>
          </View>

          {/* Per-muscle avg HI */}
          {sessionHIData.muscles.length > 0 && (
            <View style={styles.card}>
              {sessionHIData.muscles.map(({ group, avg_HI }) => {
                const maxHI = sessionHIData.muscles[0]?.avg_HI || 1;
                const barW = Math.min((avg_HI / maxHI) * 100, 100);
                const barColor = avg_HI >= maxHI * 0.75
                  ? '#C9A44C'
                  : avg_HI >= maxHI * 0.4
                    ? '#B11226'
                    : '#5A0000';
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
              <View style={[styles.legendDot, { backgroundColor: '#8B0000' }]} />
              <Text style={styles.legendText}>Por debajo MEV</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#C9A44C' }]} />
              <Text style={styles.legendText}>Zona óptima</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#2E6B3E' }]} />
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
                    ? '#2A2A2A'
                    : sets < mev
                      ? '#8B0000'
                      : sets > mav
                        ? '#2E6B3E'
                        : '#C9A44C';
                  const barW = sets === 0 ? 0 : Math.min((sets / (mav * 1.3)) * 100, 100);
                  return (
                    <View key={group} style={styles.muscleRow}>
                      <Text style={styles.muscleLabel}>{group}</Text>
                      <View style={styles.muscleBarBg}>
                        <View style={[styles.muscleBarFill, { width: `${barW}%`, backgroundColor: barColor }]} />
                        <View style={[styles.muscleRefLine, { left: `${(mev / (mav * 1.3)) * 100}%`, backgroundColor: '#9A9A9A' }]} />
                        <View style={[styles.muscleRefLine, { left: `${(mav / (mav * 1.3)) * 100}%`, backgroundColor: '#555' }]} />
                      </View>
                      <Text style={[styles.muscleSetCount, { color: barColor === '#2A2A2A' ? '#555' : barColor }]}>
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
  container:   { flex: 1, backgroundColor: '#0D0D0D' },
  scroll:      { paddingHorizontal: 16, paddingTop: 12 },

  // Period selector
  periodRow:           { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 3, marginBottom: 16 },
  periodBtn:           { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  periodBtnActive:     { backgroundColor: '#2E2E2E' },
  periodBtnText:       { fontSize: 13, color: '#9A9A9A', fontWeight: '500' },
  periodBtnTextActive: { color: '#EAEAEA', fontWeight: '700' },

  // Sections
  section:          { marginBottom: 16 },
  sectionTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle:     { fontSize: 15, fontWeight: '700', color: '#EAEAEA' },
  planBadge:        { backgroundColor: '#1C2E1C', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  planBadgeText:    { fontSize: 10, color: '#4CAF50', fontWeight: '700' },
  card:             { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16 },
  emptyText:        { fontSize: 13, color: '#9A9A9A', textAlign: 'center', paddingVertical: 8 },

  // Chart mode pills
  modeScroll:          { marginBottom: 8 },
  modeContainer:       { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  modeBtn:             { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1A1A1A' },
  modeBtnActive:       { backgroundColor: '#C9A44C18', borderWidth: 1, borderColor: '#C9A44C' },
  modeBtnText:         { fontSize: 12, color: '#9A9A9A', fontWeight: '500' },
  modeBtnTextActive:   { color: '#C9A44C', fontWeight: '700' },

  // Secondary selector pills
  subScroll:           { marginBottom: 8 },
  subContainer:        { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  subBtn:              { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#1A1A1A', maxWidth: 160 },
  subBtnActive:        { backgroundColor: '#2E2E2E', borderWidth: 1, borderColor: '#9A9A9A55' },
  subBtnText:          { fontSize: 11, color: '#9A9A9A' },
  subBtnTextActive:    { color: '#EAEAEA', fontWeight: '600' },

  // Chart header
  chartHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chartMax:     { fontSize: 12, color: '#9A9A9A', fontWeight: '600' },
  chartHint:    { fontSize: 10, color: '#555', fontStyle: 'italic' },

  // Legend
  legendRow:    { flexDirection: 'row', gap: 12, marginBottom: 8, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { fontSize: 11, color: '#9A9A9A' },

  // Muscle chart
  muscleRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  muscleLabel:  { width: 90, fontSize: 12, color: '#EAEAEA' },
  muscleBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  muscleBarFill:  { height: '100%', borderRadius: 5 },
  muscleRefLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  muscleSetCount:      { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  muscleRangeHint:     { marginTop: 8, borderTopWidth: 1, borderTopColor: '#2A2A2A', paddingTop: 8 },
  muscleRangeHintText: { fontSize: 10, color: '#555', textAlign: 'center' },

  // Push/Pull/Legs
  pplRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pplLabel: { width: 60, fontSize: 13, color: '#EAEAEA', fontWeight: '600' },
  pplBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pplBarFill:  { height: '100%', borderRadius: 6 },
  pplCount:    { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '700' },

  // Exercise picker trigger
  dualTriggerRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    gap: 6,
  },
  pickerTriggerHalf: { flex: 1, marginBottom: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 1 },
  pickerTriggerLabel: { fontSize: 10, color: '#555', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerTriggerText: { flex: 1, fontSize: 13, color: '#EAEAEA', fontWeight: '500' },
  pickerChevron:     { fontSize: 12, color: '#555' },

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
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 14,
  },
  modalTitle:  { fontSize: 16, fontWeight: '700', color: '#EAEAEA', marginBottom: 12 },
  modalSearch: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#EAEAEA',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
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
  modalItemText:       { fontSize: 14, color: '#BDBDBD' },
  modalItemTextActive: { color: '#C9A44C', fontWeight: '700' },
  modalItemCheck:      { fontSize: 14, color: '#C9A44C' },

  // HI section
  hiKpiValue:     { fontSize: 28, fontWeight: '700', color: '#C9A44C' },
  hiKpiLabel:     { fontSize: 10, color: '#9A9A9A', textAlign: 'center', marginTop: 2 },
  hiKpiDivider:   { width: 1, backgroundColor: '#2E2E2E', alignSelf: 'stretch' },
  hiBalanceHint:  { fontSize: 10, color: '#555', marginTop: 4 },
});
