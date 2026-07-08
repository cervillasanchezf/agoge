import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { measurementService } from '../services/api';
import { COLORS } from '../config/theme';

// ── Paleta semáforo (#6) ──────────────────────────────────────────────────────
const C = {
  green:  '#27AE60',
  amber:  '#E8A838',
  orange: '#E07A2F',
  red:    '#B11226',
  blue:   '#4A90D9',
  grey:   '#9A9A9A',
};

// ─── Color helpers ────────────────────────────────────────────────────────────
function imcColor(v) {
  if (v < 18.5) return C.blue;
  if (v < 25)   return C.green;
  if (v < 30)   return C.amber;
  return C.red;
}
function bfColor(v, gender) {
  if (gender === 'H') {
    if (v < 6)  return C.blue;
    if (v < 14) return C.green;
    if (v < 25) return C.amber;
    return C.red;
  }
  if (v < 14) return C.blue;
  if (v < 21) return C.green;
  if (v < 32) return C.amber;
  return C.red;
}
function bfLabel(v, gender) {
  if (gender === 'H') {
    if (v < 6)  return 'Esencial';
    if (v < 14) return 'Atlético';
    if (v < 25) return 'Normal';
    return 'Elevado';
  }
  if (v < 14) return 'Esencial';
  if (v < 21) return 'Atlético';
  if (v < 32) return 'Normal';
  return 'Elevado';
}
function ffmiColor(v, gender) {
  if (gender === 'H') {
    if (v < 18) return C.grey;
    if (v < 20) return C.blue;
    if (v < 22) return C.green;
    if (v < 26) return C.amber;
    return C.red;
  }
  if (v < 14) return C.grey;
  if (v < 16) return C.blue;
  if (v < 18) return C.green;
  return C.amber;
}
function ffmiLabel(v, gender) {
  if (gender === 'H') {
    if (v < 18) return 'Principiante';
    if (v < 20) return 'Intermedio';
    if (v < 22) return 'Avanzado';
    if (v < 26) return 'Élite';
    return 'Excepcional';
  }
  if (v < 14) return 'Principiante';
  if (v < 16) return 'Intermedio';
  if (v < 18) return 'Avanzado';
  return 'Élite';
}

// ─── Score global (#5) ────────────────────────────────────────────────────────
function _imcScore(v) {
  if (v <= 15)  return 0;
  if (v < 18.5) return Math.round(((v - 15) / 3.5) * 60);
  if (v <= 22)  return Math.round(60 + ((v - 18.5) / 3.5) * 40);
  if (v < 25)   return Math.round(100 - ((v - 22) / 3) * 25);
  if (v < 30)   return Math.round(75 - ((v - 25) / 5) * 45);
  return Math.max(0, Math.round(30 - (v - 30) * 3));
}
function _bfScore(v, gender) {
  if (gender === 'H') {
    if (v <= 3)  return 10;
    if (v < 6)   return Math.round(10 + ((v - 3) / 3) * 40);
    if (v < 10)  return Math.round(50 + ((v - 6) / 4) * 50);
    if (v < 14)  return 100;
    if (v < 20)  return Math.round(100 - ((v - 14) / 6) * 30);
    if (v < 25)  return Math.round(70 - ((v - 20) / 5) * 30);
    if (v < 35)  return Math.round(40 - ((v - 25) / 10) * 40);
    return 0;
  }
  if (v <= 10) return 10;
  if (v < 14)  return Math.round(10 + ((v - 10) / 4) * 40);
  if (v < 17)  return Math.round(50 + ((v - 14) / 3) * 50);
  if (v < 21)  return 100;
  if (v < 28)  return Math.round(100 - ((v - 21) / 7) * 30);
  if (v < 32)  return Math.round(70 - ((v - 28) / 4) * 30);
  return Math.max(0, Math.round(40 - (v - 32) * 5));
}
function _ffmiScore(v, gender) {
  if (gender === 'H') {
    if (v < 16) return Math.max(0, Math.round(((v - 14) / 2) * 20));
    if (v < 18) return Math.round(20 + ((v - 16) / 2) * 40);
    if (v < 20) return Math.round(60 + ((v - 18) / 2) * 25);
    if (v < 23) return Math.round(85 + ((v - 20) / 3) * 15);
    return 100;
  }
  if (v < 13) return Math.max(0, Math.round(((v - 11) / 2) * 20));
  if (v < 15) return Math.round(20 + ((v - 13) / 2) * 40);
  if (v < 17) return Math.round(60 + ((v - 15) / 2) * 25);
  if (v < 19) return Math.round(85 + ((v - 17) / 2) * 15);
  return 100;
}
function calcGlobalScore(imc, bf, ffmi, gender) {
  const parts = [];
  if (imc  != null) parts.push({ s: _imcScore(imc),           w: 2 });
  if (bf   != null) parts.push({ s: _bfScore(bf, gender),     w: 3 });
  if (ffmi != null) parts.push({ s: _ffmiScore(ffmi, gender), w: 2 });
  if (!parts.length) return null;
  const wTotal = parts.reduce((a, p) => a + p.w, 0);
  return Math.round(parts.reduce((a, p) => a + p.s * p.w, 0) / wTotal);
}
function scoreLabel(s) {
  if (s >= 90) return 'Óptimo';
  if (s >= 75) return 'Muy bueno';
  if (s >= 60) return 'Bueno';
  if (s >= 40) return 'Aceptable';
  return 'Mejorable';
}
function scoreColor(s) {
  if (s >= 75) return C.green;
  if (s >= 55) return C.amber;
  if (s >= 35) return C.orange;
  return C.red;
}

// ─── Score ring SVG (#5) ─────────────────────────────────────────────────────
const RING_SIZE   = 120;
const RING_STROKE = 10;
const RING_R      = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC   = 2 * Math.PI * RING_R;

function ScoreRing({ score }) {
  const color   = scoreColor(score);
  const filled  = (score / 100) * RING_CIRC;
  const gap     = RING_CIRC - filled;
  // Start from top: offset = RING_CIRC/4 shifts start 90° backward (to 12 o'clock)
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={cx} cy={cy} r={RING_R} stroke={COLORS.borderInner} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={cx} cy={cy} r={RING_R}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${filled.toFixed(1)} ${gap.toFixed(1)}`}
          strokeDashoffset={(RING_CIRC / 4).toFixed(1)}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color }]}>{score}</Text>
        <Text style={styles.ringLabel}>{scoreLabel(score)}</Text>
      </View>
    </View>
  );
}

// ─── Stats chip (#1) ─────────────────────────────────────────────────────────
function StatChip({ label, sublabel, value, unit, delta, deltaColor }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      {sublabel ? <Text style={styles.chipSublabel}>{sublabel}</Text> : null}
      <Text style={styles.chipValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.chipUnit}> {unit}</Text> : null}
      </Text>
      {delta ? (
        <Text style={[styles.chipDelta, { color: deltaColor || C.grey }]}>{delta}</Text>
      ) : (
        <Text style={styles.chipDelta}> </Text>
      )}
    </View>
  );
}

// ─── Animated gauge bar (#3) ─────────────────────────────────────────────────
function MetricGauge({ value, min, max, zones }) {
  const pct      = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const [cw, setCw] = useState(0);
  const anim     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cw > 0) {
      Animated.spring(anim, {
        toValue: Math.max(0, (pct / 100) * cw - 2),
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
    }
  }, [pct, cw]);

  return (
    <View style={{ marginTop: 8, height: 12 }} onLayout={e => setCw(e.nativeEvent.layout.width)}>
      <View style={styles.gaugeTrack}>
        {zones.map((z, i) => {
          const w = ((Math.min(z.to, max) - Math.max(z.from, min)) / (max - min)) * 100;
          return <View key={i} style={{ width: `${w}%`, backgroundColor: z.color }} />;
        })}
      </View>
      <Animated.View style={[styles.gaugeMarker, { left: anim }]} />
    </View>
  );
}

const IMC_ZONES  = [
  { from: 15,  to: 18.5, color: C.blue  },
  { from: 18.5,to: 25,   color: C.green },
  { from: 25,  to: 30,   color: C.amber },
  { from: 30,  to: 40,   color: C.red   },
];
const BF_ZONES_H = [
  { from: 3,  to: 6,  color: C.blue  },
  { from: 6,  to: 14, color: C.green },
  { from: 14, to: 25, color: C.amber },
  { from: 25, to: 45, color: C.red   },
];
const BF_ZONES_M = [
  { from: 10, to: 14, color: C.blue  },
  { from: 14, to: 21, color: C.green },
  { from: 21, to: 32, color: C.amber },
  { from: 32, to: 50, color: C.red   },
];

// ─── Sparkline (#2) ──────────────────────────────────────────────────────────
const SPARK_W = 72;
const SPARK_H = 36;

function Sparkline({ values, positive }) {
  if (!values || values.length < 2) return <View style={{ width: SPARK_W, height: SPARK_H }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const PAD = 4;
  const xFor = i => PAD + (i / (values.length - 1)) * (SPARK_W - PAD * 2);
  const yFor = v => (SPARK_H - PAD) - ((v - min) / range) * (SPARK_H - PAD * 2);
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const trend = values[values.length - 1] - values[0];
  const color = Math.abs(trend) < 0.05 ? C.grey : (trend > 0) === positive ? C.green : C.red;
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Body-fat computation (US Navy) ───────────────────────────────────────────
function calcBodyFat(m, h, gender) {
  // m = measurement record, h = height cm
  if (!h) return null;
  if (gender === 'H') {
    if (!m.cintura || !m.cuello || m.cintura <= m.cuello) return null;
    const bf = 86.010 * Math.log10(m.cintura - m.cuello) - 70.041 * Math.log10(h) + 36.76;
    return Math.min(60, Math.max(3, bf));
  }
  if (!m.cintura || !m.cuello || !m.cadera || (m.cintura + m.cadera) <= m.cuello) return null;
  const bf = 163.205 * Math.log10(m.cintura + m.cadera - m.cuello) - 97.684 * Math.log10(h) - 78.387;
  return Math.min(65, Math.max(10, bf));
}

function calcBodyCompMetrics(m, h) {
  const result = {};
  if (m.peso && h) {
    const hm = h / 100;
    const v = m.peso / (hm * hm);
    result.imc = { value: v, label: v < 18.5 ? 'Bajo peso' : v < 25 ? 'Normal' : v < 30 ? 'Sobrepeso' : 'Obesidad' };
  }
  return Object.keys(result).length ? result : null;
}

export default function PhysicalStatsScreen() {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [bfGender, setBfGender] = useState('H'); // 'H' | 'M'

  useEffect(() => {
    measurementService.getMeasurements()
      .then(res => setMeasurements(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => {});
  }, []);

  // newest first (for latest/previous)
  const sorted = useMemo(() =>
    [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [measurements]
  );
  // oldest first (for progression)
  const sortedAsc = useMemo(() =>
    [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [measurements]
  );

  const latest   = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  // ── Composición Corporal (latest + prev for delta) ───────────────────────
  const bodyComposition = useMemo(
    () => latest ? calcBodyCompMetrics(latest, user?.height) : null,
    [latest, user]
  );
  const bodyCompositionPrev = useMemo(
    () => previous ? calcBodyCompMetrics(previous, user?.height) : null,
    [previous, user]
  );

  // ── Grasa corporal / LBM / FFMI ───────────────────────────────────────────
  const fatData = useMemo(() => {
    if (!latest) return null;
    const h = user?.height;
    const bf = calcBodyFat(latest, h, bfGender);
    const bfPrev = previous ? calcBodyFat(previous, h, bfGender) : null;
    if (bf == null) return null;
    const peso = latest.peso;
    const lbm  = peso ? peso * (1 - bf / 100) : null;
    const ffmi = lbm && h   ? lbm / Math.pow(h / 100, 2) : null;
    const lbmPrev  = (bfPrev != null && previous?.peso) ? previous.peso * (1 - bfPrev / 100) : null;
    const ffmiPrev = (lbmPrev && h) ? lbmPrev / Math.pow(h / 100, 2) : null;
    return { bf, bfPrev, lbm, lbmPrev, ffmi, ffmiPrev, peso };
  }, [latest, previous, user, bfGender]);

  // ── Score global (#5) ─────────────────────────────────────────────────────
  const globalScore = useMemo(() => calcGlobalScore(
    bodyComposition?.imc?.value ?? null,
    fatData?.bf ?? null,
    fatData?.ffmi ?? null,
    bfGender,
  ), [bodyComposition, fatData, bfGender]);

  // ── Simetría corporal ──────────────────────────────────────────────────────
  const symmetryData = useMemo(() => {
    if (!latest) return [];
    const pairs = [
      { label: 'Bíceps',    left: latest.bicepsIzq,    right: latest.bicepsDer    },
      { label: 'Antebrazo', left: latest.antebrazoIzq, right: latest.antebrazoDer },
      { label: 'Muslo',     left: latest.musloIzq,     right: latest.musloDer     },
      { label: 'Gemelo',    left: latest.gemeloIzq,    right: latest.gemeloDer    },
    ];
    return pairs
      .filter(p => p.left != null && p.right != null)
      .map(p => {
        const diff = Math.abs(p.left - p.right);
        const maxVal = Math.max(p.left, p.right);
        const asymmetry = maxVal > 0 ? (diff / maxVal) * 100 : 0;
        return { ...p, diff, asymmetry };
      });
  }, [latest]);

  // ── Progresión temporal ────────────────────────────────────────────────────
  const progressionData = useMemo(() => {
    if (measurements.length < 2) return [];
    const fields = [
      { key: 'peso',      label: 'Peso',       unit: 'kg', muscular: false },
      { key: 'cintura',   label: 'Cintura',    unit: 'cm', muscular: false },
      { key: 'pecho',     label: 'Pecho',      unit: 'cm', muscular: true  },
      { key: 'hombro',    label: 'Hombro',     unit: 'cm', muscular: true  },
      { key: 'bicepsIzq', label: 'Bíceps Izq', unit: 'cm', muscular: true  },
      { key: 'musloIzq',  label: 'Muslo Izq',  unit: 'cm', muscular: true  },
    ];
    return fields.map(f => {
      const pts = sortedAsc.filter(m => m[f.key] != null); // oldest → newest
      if (pts.length < 2) return null;
      const first = pts[0];                   // oldest
      const last  = pts[pts.length - 1];      // newest
      const totalChange = last[f.key] - first[f.key];
      const weeks = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 7);
      const weeklyRate = weeks > 0.1 ? totalChange / weeks : 0;
      const sparkData = pts.map(m => m[f.key]);
      return { ...f, first: first[f.key], last: last[f.key], totalChange, weeklyRate, weeks, sparkData };
    }).filter(Boolean);
  }, [sortedAsc]);

  const noData = !measurements.length;

  // ── Delta helpers ─────────────────────────────────────────────────────────
  function metricDelta(key, decimals = 1) {
    if (!bodyCompositionPrev?.[key]) return null;
    const d = bodyComposition?.[key]?.value - bodyCompositionPrev[key].value;
    if (d == null || isNaN(d)) return null;
    return { d, sign: d > 0 ? '+' : '', arrow: Math.abs(d) < 0.005 ? '→' : d > 0 ? '↑' : '↓', text: `${d > 0 ? '+' : ''}${d.toFixed(decimals)}` };
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Score global + chips (#1 #5) ── */}
        {!noData && (
          <View style={[styles.card, styles.heroCard]}>
            <View style={styles.heroLeft}>
              {globalScore != null
                ? <ScoreRing score={globalScore} />
                : <View style={styles.noScoreBox}><Text style={styles.noScoreText}>—</Text></View>
              }
              <Text style={styles.heroHint}>Score{'\n'}global</Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.chipsGrid}>
                <StatChip
                  label="Peso"
                  value={latest?.peso != null ? latest.peso.toFixed(1) : '—'}
                  unit="kg"
                  delta={(() => {
                    if (!previous?.peso || !latest?.peso) return null;
                    const d = latest.peso - previous.peso;
                    return `${d > 0 ? '+' : ''}${d.toFixed(1)} kg`;
                  })()}
                  deltaColor={C.grey}
                />
                <StatChip
                  label="% Grasa"
                  value={fatData ? fatData.bf.toFixed(1) : '—'}
                  unit={fatData ? '%' : ''}
                  delta={fatData?.bfPrev != null ? (() => {
                    const d = fatData.bf - fatData.bfPrev;
                    return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
                  })() : null}
                  deltaColor={fatData?.bfPrev != null ? (fatData.bf < fatData.bfPrev ? C.green : C.red) : C.grey}
                />
                <StatChip
                  label="LBM"
                  sublabel="Masa magra"
                  value={fatData?.lbm != null ? fatData.lbm.toFixed(1) : '—'}
                  unit={fatData?.lbm != null ? 'kg' : ''}
                  delta={fatData?.lbmPrev != null ? (() => {
                    const d = fatData.lbm - fatData.lbmPrev;
                    return `${d > 0 ? '+' : ''}${d.toFixed(1)} kg`;
                  })() : null}
                  deltaColor={fatData?.lbmPrev != null ? (fatData.lbm >= fatData.lbmPrev ? C.green : C.red) : C.grey}
                />
                <StatChip
                  label="FFMI"
                  sublabel="Índice muscular"
                  value={fatData?.ffmi != null ? fatData.ffmi.toFixed(1) : '—'}
                  unit=""
                  delta={fatData?.ffmiPrev != null ? (() => {
                    const d = fatData.ffmi - fatData.ffmiPrev;
                    return `${d > 0 ? '+' : ''}${d.toFixed(2)}`;
                  })() : null}
                  deltaColor={fatData?.ffmiPrev != null ? (fatData.ffmi >= fatData.ffmiPrev ? C.green : C.red) : C.grey}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── Composición Corporal ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Composición Corporal</Text>
          <View style={styles.card}>
            {noData ? (
              <Text style={styles.emptyText}>Sin registros de medidas.</Text>
            ) : !bodyComposition ? (
              <Text style={styles.emptyText}>
                Añade medidas corporales (peso, cintura, hombros…) para ver métricas de composición.{user?.height ? '' : '\n\nTambién necesitas guardar tu altura en el perfil.'}
              </Text>
            ) : (
              <>
                {bodyComposition.imc && (() => {
                  const delta = metricDelta('imc');
                  return (
                    <View style={styles.bodyCompBlock}>
                      <View style={styles.bodyCompRow}>
                        <View style={styles.bodyCompLeft}>
                          <Text style={styles.bodyCompMetric}>IMC</Text>
                          <Text style={styles.bodyCompDesc}>Índice de masa corporal</Text>
                        </View>
                        <View style={styles.bodyCompRight}>
                          <Text style={[styles.bodyCompValue, { color: imcColor(bodyComposition.imc.value) }]}>
                            {bodyComposition.imc.value.toFixed(1)}
                          </Text>
                          <Text style={[styles.bodyCompTag, { color: imcColor(bodyComposition.imc.value) }]}>
                            {bodyComposition.imc.label}
                          </Text>
                          {delta && (
                            <Text style={[styles.bodyCompDelta, { color: COLORS.textMuted }]}>
                              {delta.arrow} {delta.text} vs ant.
                            </Text>
                          )}
                        </View>
                      </View>
                      <MetricGauge value={bodyComposition.imc.value} min={15} max={40} zones={IMC_ZONES} />
                    </View>
                  );
                })()}
                <View style={styles.hint}>
                  <Text style={styles.hintText}>Basado en tu último registro de medidas</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── % Grasa Corporal (US Navy) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>% Grasa Corporal</Text>
            {/* Gender toggle */}
            <View style={styles.genderToggle}>
              <TouchableOpacity
                style={[styles.genderBtn, bfGender === 'H' && styles.genderBtnActive]}
                onPress={() => setBfGender('H')}
              >
                <Text style={[styles.genderBtnText, bfGender === 'H' && styles.genderBtnTextActive]}>H</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderBtn, bfGender === 'M' && styles.genderBtnActive]}
                onPress={() => setBfGender('M')}
              >
                <Text style={[styles.genderBtnText, bfGender === 'M' && styles.genderBtnTextActive]}>M</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.card}>
            {noData ? (
              <Text style={styles.emptyText}>Sin registros de medidas.</Text>
            ) : !fatData ? (
              <Text style={styles.emptyText}>
                {bfGender === 'H'
                  ? 'Necesitas registrar cuello, cintura y tener altura en el perfil.'
                  : 'Necesitas registrar cuello, cintura, cadera y tener altura en el perfil.'}
              </Text>
            ) : (
              <>
                {/* BF% */}
                <View style={[styles.bodyCompBlock, styles.bodyCompBlockBorder]}>
                  <View style={styles.bodyCompRow}>
                    <View style={styles.bodyCompLeft}>
                      <Text style={styles.bodyCompMetric}>Grasa Corporal</Text>
                      <Text style={styles.bodyCompDesc}>Fórmula Marina EE.UU.</Text>
                    </View>
                    <View style={styles.bodyCompRight}>
                      <Text style={[styles.bodyCompValue, { color: bfColor(fatData.bf, bfGender) }]}>
                        {fatData.bf.toFixed(1)}%
                      </Text>
                      <Text style={[styles.bodyCompTag, { color: bfColor(fatData.bf, bfGender) }]}>
                        {bfLabel(fatData.bf, bfGender)}
                      </Text>
                      {fatData.bfPrev != null && (() => {
                        const d = fatData.bf - fatData.bfPrev;
                        return (
                          <Text style={[styles.bodyCompDelta, { color: COLORS.textMuted }]}>
                            {Math.abs(d) < 0.05 ? '→' : d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d.toFixed(1)}% vs ant.
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                  <MetricGauge
                    value={fatData.bf}
                    min={bfGender === 'H' ? 3 : 10}
                    max={bfGender === 'H' ? 45 : 50}
                    zones={bfGender === 'H' ? BF_ZONES_H : BF_ZONES_M}
                  />
                </View>

                {/* LBM */}
                {fatData.lbm != null && (
                  <View style={[styles.bodyCompBlock, fatData.ffmi != null ? styles.bodyCompBlockBorder : null]}>
                    <View style={styles.bodyCompRow}>
                      <View style={styles.bodyCompLeft}>
                        <Text style={styles.bodyCompMetric}>Masa Magra (LBM)</Text>
                        <Text style={styles.bodyCompDesc}>Peso sin grasa corporal</Text>
                      </View>
                      <View style={styles.bodyCompRight}>
                        <Text style={[styles.bodyCompValue, { color: COLORS.textPrimary }]}>
                          {fatData.lbm.toFixed(1)} kg
                        </Text>
                        {fatData.lbmPrev != null && (() => {
                          const d = fatData.lbm - fatData.lbmPrev;
                          return (
                            <Text style={[styles.bodyCompDelta, { color: d > 0 ? C.green : d < 0 ? C.red : C.grey }]}>
                              {Math.abs(d) < 0.05 ? '→' : d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d.toFixed(1)} kg vs ant.
                            </Text>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                )}

                {/* FFMI */}
                {fatData.ffmi != null && (
                  <View style={styles.bodyCompBlock}>
                    <View style={styles.bodyCompRow}>
                      <View style={styles.bodyCompLeft}>
                        <Text style={styles.bodyCompMetric}>FFMI</Text>
                        <Text style={styles.bodyCompDesc}>Índice de masa libre de grasa</Text>
                      </View>
                      <View style={styles.bodyCompRight}>
                        <Text style={[styles.bodyCompValue, { color: ffmiColor(fatData.ffmi, bfGender) }]}>
                          {fatData.ffmi.toFixed(1)}
                        </Text>
                        <Text style={[styles.bodyCompTag, { color: ffmiColor(fatData.ffmi, bfGender) }]}>
                          {ffmiLabel(fatData.ffmi, bfGender)}
                        </Text>
                        {fatData.ffmiPrev != null && (() => {
                          const d = fatData.ffmi - fatData.ffmiPrev;
                          return (
                            <Text style={[styles.bodyCompDelta, { color: d > 0 ? C.green : d < 0 ? C.red : C.grey }]}>
                              {Math.abs(d) < 0.005 ? '→' : d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d.toFixed(2)} vs ant.
                            </Text>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.hint}>
                  <Text style={styles.hintText}>Estimación · no reemplaza medición por DEXA o plicómetro</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Simetría Corporal ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Simetría Corporal</Text>
          <View style={styles.card}>
            {symmetryData.length === 0 ? (
              <Text style={styles.emptyText}>
                Registra medidas bilaterales (bíceps, muslos…) para comparar la simetría.
              </Text>
            ) : (
              <>
                {symmetryData.map((item, idx) => {
                  const maxVal = Math.max(item.left, item.right);
                  const symmPct = 100 - item.asymmetry;
                  const symmColor = item.asymmetry < 3 ? C.green : item.asymmetry < 7 ? C.amber : C.red;
                  return (
                    <View key={item.label} style={[styles.symmRow, idx < symmetryData.length - 1 && styles.symmRowBorder]}>
                      <Text style={styles.symmLabel}>{item.label}</Text>
                      <View style={styles.symmBars}>
                        <View style={styles.symmBarWrap}>
                          <Text style={styles.symmSideVal}>{item.left.toFixed(1)}</Text>
                          <View style={styles.symmBarBg}>
                            <View style={[styles.symmBarFillLeft, { width: `${(item.left / maxVal) * 100}%` }]} />
                          </View>
                        </View>
                        <View style={styles.symmBarWrap}>
                          <View style={styles.symmBarBg}>
                            <View style={[styles.symmBarFillRight, { width: `${(item.right / maxVal) * 100}%` }]} />
                          </View>
                          <Text style={styles.symmSideVal}>{item.right.toFixed(1)}</Text>
                        </View>
                      </View>
                      <Text style={[styles.symmPct, { color: symmColor }]}>
                        {symmPct < 99.95 ? `${symmPct.toFixed(1)}%` : '100%'}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.hint}>
                  <Text style={styles.hintText}>Izq / Der · % simetría (≥97 % óptimo)</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Progresión Temporal ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progresión Temporal</Text>
          <View style={styles.card}>
            {progressionData.length === 0 ? (
              <Text style={styles.emptyText}>
                Necesitas al menos 2 registros de medidas para ver la progresión.
              </Text>
            ) : (
              <>
                {progressionData.map((item, idx) => {
                  const sign     = item.totalChange > 0 ? '+' : '';
                  const rateSign = item.weeklyRate  > 0 ? '+' : '';
                  return (
                    <View key={item.key} style={[styles.progRow, idx < progressionData.length - 1 && styles.progRowBorder]}>
                      <View style={styles.progLabelCol}>
                        <Text style={styles.progLabel}>{item.label}</Text>
                        <Text style={styles.progCurrent}>{item.last.toFixed(1)} {item.unit}</Text>
                      </View>
                      <Sparkline values={item.sparkData} positive={item.muscular} />
                      <View style={styles.progValues}>
                        <Text style={styles.progChange}>
                          {sign}{item.totalChange.toFixed(1)} {item.unit}
                        </Text>
                        <Text style={styles.progRate}>
                          {rateSign}{item.weeklyRate.toFixed(2)} {item.unit}/sem
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <View style={styles.hint}>
                  <Text style={styles.hintText}>Cambio acumulado desde el primer registro</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { paddingHorizontal: 16, paddingTop: 12 },

  section:      { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  card:         { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16 },
  emptyText:    { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 8, lineHeight: 20 },
  hint:         { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderInner, paddingTop: 8 },
  hintText:     { fontSize: 12, color: '#555', textAlign: 'center' },

  // Hero card (#1 #5)
  heroCard:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  heroLeft:    { alignItems: 'center', gap: 4 },
  heroHint:    { fontSize: 12, color: '#555', textAlign: 'center', lineHeight: 13 },
  heroRight:   { flex: 1 },
  noScoreBox:  { width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center' },
  noScoreText: { fontSize: 34, color: COLORS.border },

  // ScoreRing text (#5)
  ringCenter: { position: 'absolute', top: 0, left: 0, width: RING_SIZE, height: RING_SIZE, justifyContent: 'center', alignItems: 'center' },
  ringScore:  { fontSize: 30, fontWeight: '800', lineHeight: 32 },
  ringLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chips (#1)
  chipsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { flex: 1, minWidth: '45%', backgroundColor: COLORS.surfaceDeep, borderRadius: 10, padding: 10, gap: 1 },
  chipLabel:    { fontSize: 12, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chipSublabel: { fontSize: 11, color: '#444', fontWeight: '500', marginBottom: 2 },
  chipValue:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  chipUnit:     { fontSize: 14, fontWeight: '400', color: COLORS.textSecondary },
  chipDelta:    { fontSize: 12, fontWeight: '500' },

  // Gauge track & marker (#3)
  gaugeTrack:  { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', position: 'absolute', left: 0, right: 0, top: 3 },
  gaugeMarker: { position: 'absolute', top: 0, width: 4, height: 12, backgroundColor: '#FFFFFF', borderRadius: 2, elevation: 2, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 2 },

  // Gender toggle
  genderToggle:       { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderInner },
  genderBtn:          { paddingHorizontal: 14, paddingVertical: 5 },
  genderBtnActive:    { backgroundColor: COLORS.primary },
  genderBtnText:      { fontSize: 14, fontWeight: '700', color: '#555' },
  genderBtnTextActive:{ color: COLORS.textPrimary },

  // Body composition blocks (each metric = row + gauge)
  bodyCompBlock:       { paddingVertical: 12 },
  bodyCompBlockBorder: { borderBottomWidth: 1, borderBottomColor: '#242424' },
  bodyCompRow:         { flexDirection: 'row', alignItems: 'center' },
  bodyCompLeft:        { flex: 1, gap: 3 },
  bodyCompRight:       { alignItems: 'flex-end', gap: 2 },
  bodyCompMetric:      { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  bodyCompDesc:        { fontSize: 13, color: '#555' },
  bodyCompValue:       { fontSize: 22, fontWeight: '700' },
  bodyCompTag:         { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyCompDelta:       { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  // Symmetry
  symmRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 6 },
  symmRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#242424' },
  symmLabel:      { width: 76, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  symmBars:       { flex: 1, flexDirection: 'row', gap: 6 },
  symmBarWrap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  symmBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceInner,
    borderRadius: 3,
    overflow: 'hidden',
  },
  symmBarFillLeft:  { height: '100%', borderRadius: 3, backgroundColor: COLORS.success,   alignSelf: 'flex-end' },
  symmBarFillRight: { height: '100%', borderRadius: 3, backgroundColor: '#27AE6088' },
  symmSideVal:      { fontSize: 12, color: COLORS.textMuted, minWidth: 28, textAlign: 'center' },
  symmPct:          { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '700' },

  // Progression
  progRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  progRowBorder: { borderBottomWidth: 1, borderBottomColor: '#242424' },
  progLabelCol:  { flex: 1, gap: 2 },
  progLabel:     { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  progCurrent:   { fontSize: 13, color: '#555' },
  progValues:    { alignItems: 'flex-end' },
  progChange:    { fontSize: 15, fontWeight: '700', textAlign: 'right', color: COLORS.textPrimary },
  progRate:      { fontSize: 12, color: '#555', textAlign: 'right' },
});
