import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sessionService } from '../services/api';
import { MUSCLE_LABELS, getExerciseName } from '../config/translations';
import { calcExerciseHI } from '../utils/hypertrophyMetrics';
import { COLORS } from '../config/theme';
import Svg, { Path } from 'react-native-svg';

function hiColor(hi) {
  if (hi >= 7) return COLORS.success;
  if (hi >= 4) return COLORS.gold;
  if (hi > 0)  return COLORS.warning;
  return COLORS.iconInactive;
}

const MUSCLE_COLORS = [
  '#C9A44C', '#4A90D9', '#27AE60', '#E07A2F',
  '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12',
];

function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatTime(h, m, s) {
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${String(m).padStart(2, '0')}m`);
  parts.push(`${String(s).padStart(2, '0')}s`);
  return parts.join(' ');
}

function calcStats(session) {
  let totalVolume = 0;
  let completedSets = 0;
  let totalSets = 0;
  const muscleVolume = {};
  const muscleSets   = {};

  session.exercises.forEach((ex) => {
    const muscle = ex.exerciseId?.primaryMuscles?.[0];

    ex.sets.forEach((s) => {
      totalSets++;
      if (s.completed) completedSets++;

      if (ex.repMode !== 'cardio') {
        const vol = (s.weight || 0) * (s.reps || 0);
        totalVolume += vol;
        if (muscle) {
          if (vol > 0) muscleVolume[muscle] = (muscleVolume[muscle] || 0) + vol;
          muscleSets[muscle] = (muscleSets[muscle] || 0) + 1;
        }
      }
    });
  });

  const sortedMuscles = Object.entries(muscleVolume).sort((a, b) => b[1] - a[1]);
  return { totalVolume, completedSets, totalSets, sortedMuscles, muscleSets };
}

export default function SessionDetailScreen({ route, navigation }) {
  const [session, setSession] = useState(route.params.session);
  const trainingName = session.sessionName || session.trainingId?.name || 'Entrenamiento';
  const { totalVolume, completedSets, totalSets, sortedMuscles, muscleSets } = calcStats(session);

  const nonCardioExercises = session.exercises.filter(ex => ex.repMode !== 'cardio');
  const sessionHI = nonCardioExercises.length > 0
    ? nonCardioExercises.reduce((acc, ex) => acc + calcExerciseHI(ex), 0) / nonCardioExercises.length
    : 0;

  // ── Edit modal state ──────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName]           = useState('');
  const [editDay, setEditDay]         = useState(1);
  const [editMonth, setEditMonth]     = useState(1);
  const [editYear, setEditYear]       = useState(new Date().getFullYear());
  const [editH, setEditH]             = useState(0);
  const [editM, setEditM]             = useState(0);
  const [editS, setEditS]             = useState(0);
  const [editNotes, setEditNotes]     = useState('');
  const [saving, setSaving]           = useState(false);

  const openEdit = () => {
    const d = new Date(session.date);
    const pad = (n) => String(n).padStart(2, '0');
    setEditDay(d.getDate());
    setEditMonth(d.getMonth() + 1);
    setEditYear(d.getFullYear());
    const secs = session.duration || 0;
    setEditH(Math.floor(secs / 3600));
    setEditM(Math.floor((secs % 3600) / 60));
    setEditS(secs % 60);
    setEditNotes(session.notes || '');
    setEditName(session.sessionName || session.trainingId?.name || '');
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${editYear}-${pad(editMonth)}-${pad(editDay)}`;
    setSaving(true);
    try {
      const duration = editH * 3600 + editM * 60 + Math.min(editS, 59);
      const result = await sessionService.updateSession(session._id, {
        date:        new Date(dateStr + 'T12:00:00').toISOString(),
        duration,
        notes:       editNotes,
        sessionName: editName.trim(),
      });
      setSession(result.data || { ...session, date: dateStr, duration, notes: editNotes, sessionName: editName.trim() });
      setShowEdit(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Eliminar sesión',
      '¿Seguro que quieres eliminar esta sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await sessionService.deleteSession(session._id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la sesión');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{trainingName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openEdit} style={styles.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Resumen ─────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.dateText}>{formatDate(session.date)}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.statVal}>{formatDuration(session.duration)}</Text>
              <Text style={styles.statLbl}>Duración</Text>
            </View>
            <View style={[styles.statCell, styles.statCellMid]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
              <Text style={styles.statVal}>{completedSets}/{totalSets}</Text>
              <Text style={styles.statLbl}>Series hechas</Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="trending-up-outline" size={20} color={hiColor(sessionHI)} />
              <Text style={[styles.statVal, { color: hiColor(sessionHI) }]}>
                {sessionHI > 0 ? sessionHI.toFixed(1) : '—'}
              </Text>
              <Text style={styles.statLbl}>HI sesión</Text>
            </View>
          </View>

          {/* Volumen por músculo */}
          {sortedMuscles.length > 0 && (
            <View style={styles.muscleSection}>
              <Text style={styles.sectionTitle}>Volumen por músculo</Text>
              <View style={styles.ringRow}>
                {/* Donut ring */}
                <View style={styles.ringWrap}>
                  <Svg width={140} height={140}>
                    <Path
                      d={arcPath(70, 70, 50, 0, 359.99)}
                      stroke={COLORS.surfaceDeep}
                      strokeWidth={14}
                      fill="none"
                    />
                    {(() => {
                      const GAP = 3;
                      let angle = 0;
                      return sortedMuscles.map(([muscle, vol], i) => {
                        const pct = totalVolume > 0 ? vol / totalVolume : 0;
                        const sweep = Math.max(pct * 360 - GAP, 0);
                        const start = angle + GAP / 2;
                        const end = start + sweep;
                        angle += pct * 360;
                        if (sweep < 0.5) return null;
                        return (
                          <Path
                            key={muscle}
                            d={arcPath(70, 70, 50, start, end)}
                            stroke={MUSCLE_COLORS[i % MUSCLE_COLORS.length]}
                            strokeWidth={14}
                            fill="none"
                            strokeLinecap="butt"
                          />
                        );
                      });
                    })()}
                  </Svg>
                  <View style={styles.ringCenter} pointerEvents="none">
                    <Text style={styles.ringCenterVal}>
                      {totalVolume > 0 ? totalVolume.toLocaleString('es-ES') : '—'}
                    </Text>
                    <Text style={styles.ringCenterLbl}>kg</Text>
                  </View>
                </View>
                {/* Legend */}
                <View style={styles.ringLegend}>
                  {sortedMuscles.map(([muscle, vol], i) => {
                    const pct = totalVolume > 0 ? vol / totalVolume : 0;
                    const sets = muscleSets[muscle] || 0;
                    return (
                      <View key={muscle} style={styles.ringLegendRow}>
                        <View style={[styles.ringDot, { backgroundColor: MUSCLE_COLORS[i % MUSCLE_COLORS.length] }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ringMuscleName}>{MUSCLE_LABELS[muscle] ?? muscle}</Text>
                          <Text style={styles.ringMuscleMeta}>{Math.round(pct * 100)}% · {sets} series</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
          {/* Notas de sesión */}
          {session.notes ? (
            <View style={styles.notesBlock}>
              <Text style={styles.notesLabel}>Notas</Text>
              <Text style={styles.notesText}>{session.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Ejercicios ───────────────────────────── */}
        {session.exercises.map((ex, exIdx) => {
          const isCardio = ex.repMode === 'cardio';
          const hi = isCardio ? null : calcExerciseHI(ex);
          return (
            <View key={exIdx} style={styles.exCard}>
              <View style={styles.exHeader}>
                <View style={styles.exIndexBadge}>
                  <Text style={styles.exIndexText}>{exIdx + 1}</Text>
                </View>
                <Text style={styles.exName}>{getExerciseName(ex.exerciseId)}</Text>
                {hi !== null && hi > 0 && (
                  <View style={[styles.hiBadge, { borderColor: hiColor(hi) + '55', backgroundColor: hiColor(hi) + '18' }]}>
                    <Text style={[styles.hiLabel, { color: hiColor(hi) }]}>HI</Text>
                    <Text style={[styles.hiValue, { color: hiColor(hi) }]}>{hi.toFixed(1)}</Text>
                  </View>
                )}
              </View>

              {/* Cabecera tabla */}
              <View style={styles.tableHeader}>
                <Text style={[styles.colLabel, styles.colSet]}>SERIE</Text>
                {isCardio ? (
                  <>
                    <Text style={[styles.colLabel, styles.colKm]}>KM</Text>
                    <Text style={[styles.colLabel, { flex: 1 }]}>TIEMPO</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.colLabel, styles.colKg]}>KG</Text>
                    <Text style={[styles.colLabel, styles.colReps]}>REPS</Text>
                    <Text style={[styles.colLabel, styles.colRpe]}>RPE</Text>
                  </>
                )}
                <Text style={[styles.colLabel, styles.colDone]}></Text>
              </View>

              {ex.sets.map((s, sIdx) => (
                <View key={sIdx} style={[styles.setRow, s.completed && styles.setRowDone]}>
                  <Text style={[styles.colSet, styles.setNum, s.completed && { color: COLORS.success }]}>{sIdx + 1}</Text>
                  {isCardio ? (
                    <>
                      <Text style={[styles.colKm, s.completed ? styles.cellTextDone : styles.cellText]}>{s.km > 0 ? s.km : '—'}</Text>
                      <Text style={[{ flex: 1 }, s.completed ? styles.cellTextDone : styles.cellText]}>
                        {(s.h === 0 && s.m === 0 && s.s === 0)
                          ? '—'
                          : formatTime(s.h, s.m, s.s)
                        }
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.colKg, s.completed ? styles.cellTextDone : styles.cellText]}>{s.weight > 0 ? s.weight : '—'}</Text>
                      <Text style={[styles.colReps, s.completed ? styles.cellTextDone : styles.cellText]}>{s.reps > 0 ? s.reps : '—'}</Text>
                      <View style={[styles.colRpe, { alignItems: 'center' }]}>
                        {s.rpe > 0
                          ? <View style={[styles.rpeBadge, s.rpe >= 9 ? styles.rpeBadgeHigh : s.rpe >= 7 ? styles.rpeBadgeMid : styles.rpeBadgeLow]}>
                              <Text style={styles.rpeBadgeText}>{s.rpe}</Text>
                            </View>
                          : <Text style={styles.cellText}>—</Text>
                        }
                      </View>
                    </>
                  )}
                  <View style={styles.colDone}>
                    <View style={[styles.checkCircle, s.completed && styles.checkCircleDone]}>
                      {s.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          );
        })}

      </ScrollView>

      {/* ── Modal de edición ─────────────────────── */}
      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEdit(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Editar sesión</Text>

            {/* Nombre */}
            <Text style={styles.fieldLabel}>Nombre</Text>
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nombre del entrenamiento"
              placeholderTextColor={COLORS.iconInactive}
              maxLength={80}
            />

            {/* Fecha */}
            <Text style={styles.fieldLabel}>Fecha</Text>
            <View style={styles.durationRow}>
              {[
                { label: 'dd',   value: editDay,   set: setEditDay,   min: 1, max: 31 },
                { label: 'mm',   value: editMonth, set: setEditMonth, min: 1, max: 12 },
                { label: 'aaaa', value: editYear,  set: setEditYear,  min: 2020, max: new Date().getFullYear() },
              ].map(({ label, value, set, min, max }) => {
                const isYear = label === 'aaaa';
                const displayVal = isYear ? String(value) : String(value).padStart(2, '0');
                return (
                  <View key={label} style={styles.durationUnit}>
                    <TouchableOpacity onPress={() => set((v) => v < max ? v + 1 : min)} style={styles.durationBtn}>
                      <Ionicons name="chevron-up" size={16} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.durationValue}
                      value={displayVal}
                      keyboardType="number-pad"
                      maxLength={isYear ? 4 : 2}
                      textAlign="center"
                      selectTextOnFocus
                      onChangeText={(txt) => {
                        const n = parseInt(txt, 10);
                        if (!isNaN(n)) set(Math.min(Math.max(n, min), max));
                      }}
                      onBlur={() => set((v) => Math.min(Math.max(v, min), max))}
                    />
                    <TouchableOpacity onPress={() => set((v) => v > min ? v - 1 : max)} style={styles.durationBtn}>
                      <Ionicons name="chevron-down" size={16} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.durationLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Duración */}
            <Text style={styles.fieldLabel}>Duración</Text>
            <View style={styles.durationRow}>
              {[
                { label: 'h', value: editH, set: setEditH, min: 0, max: 23 },
                { label: 'm', value: editM, set: setEditM, min: 0, max: 59 },
                { label: 's', value: editS, set: setEditS, min: 0, max: 59 },
              ].map(({ label, value, set, min, max }) => (
                <View key={label} style={styles.durationUnit}>
                  <TouchableOpacity onPress={() => set((v) => Math.min(v + 1, max))} style={styles.durationBtn}>
                    <Ionicons name="chevron-up" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.durationValue}
                    value={String(value).padStart(2, '0')}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                    selectTextOnFocus
                    onChangeText={(txt) => {
                      const n = parseInt(txt, 10);
                      if (!isNaN(n)) set(Math.min(Math.max(n, min), max));
                    }}
                    onBlur={() => set((v) => Math.min(Math.max(v, min), max))}
                  />
                  <TouchableOpacity onPress={() => set((v) => Math.max(v - 1, 0))} style={styles.durationBtn}>
                    <Ionicons name="chevron-down" size={16} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.durationLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Notas */}
            <Text style={styles.fieldLabel}>Notas</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldTextarea]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Añade notas sobre la sesión..."
              placeholderTextColor={COLORS.iconInactive}
              multiline
              numberOfLines={4}
            />

            {/* Guardar */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving}>
              {saving
                ? <ActivityIndicator color={COLORS.textPrimary} />
                : <Text style={styles.saveBtnText}>Guardar cambios</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  // Navigation header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
    backgroundColor: COLORS.background,
  },
  headerBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },

  // Summary card
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  trainingName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
  dateText: { fontSize: 15, color: COLORS.textMuted, marginBottom: 16, textTransform: 'capitalize' },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  statLbl: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },
  statCellMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.surfaceDeep },

  // Volume per muscle — donut ring
  muscleSection: { borderTopWidth: 1, borderTopColor: COLORS.surfaceDeep, paddingTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 12 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringCenterVal: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  ringCenterLbl: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' },
  ringLegend: { flex: 1, gap: 10 },
  ringLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ringDot: { width: 8, height: 8, borderRadius: 4, marginTop: 1 },
  ringMuscleName: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  ringMuscleMeta: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },

  // Exercise card
  exCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 1,
  },
  exName: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  exIndexBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: COLORS.surfaceInner, alignItems: 'center', justifyContent: 'center' },
  exIndexText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
  },
  colLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '700', textAlign: 'center' },
  colSet:  { width: 36, textAlign: 'center' },
  colKg:   { flex: 1, textAlign: 'center' },
  colReps: { flex: 1, textAlign: 'center' },
  colRpe:  { flex: 1, textAlign: 'center' },
  colKm:   { flex: 1, textAlign: 'center' },
  colDone: { width: 30, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
  },
  setRowDone: { backgroundColor: COLORS.successBg },
  setNum: { fontSize: 17, fontWeight: '700', color: COLORS.textMuted, textAlign: 'center' },
  cellText: { fontSize: 17, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  cellTextDone: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { borderColor: COLORS.success, backgroundColor: COLORS.success },

  // RPE badges
  rpeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, backgroundColor: COLORS.surfaceInner, alignItems: 'center' },
  rpeBadgeHigh: { backgroundColor: '#3D1515' },
  rpeBadgeMid: { backgroundColor: '#2A2010' },
  rpeBadgeLow: { backgroundColor: COLORS.surfaceElevated },
  rpeBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },

  // HI badge
  hiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A1A2E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  hiLabel: { fontSize: 11, fontWeight: '700', color: '#7A8AC9', letterSpacing: 0.5 },
  hiValue: { fontSize: 13, fontWeight: '700', color: '#A0B0E8' },

  // Summary header with edit button
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },

  // Notes
  notesBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceDeep,
    paddingTop: 12,
  },
  notesLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  notesText:  { fontSize: 16, color: COLORS.textSecondary, lineHeight: 20 },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 19, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: 17,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldTextarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  durationRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  durationUnit: { flex: 1, alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 8 },
  durationBtn: { padding: 6 },
  durationValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginVertical: 2,
    paddingVertical: 2,
    minWidth: 48,
    textAlign: 'center',
  },
  durationLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerBg,
  },
  deleteBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.danger },
});
