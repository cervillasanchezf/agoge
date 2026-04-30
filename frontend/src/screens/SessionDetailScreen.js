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
import { COLORS } from '../config/theme';

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
  const muscleVolume = {};
  const muscleSets   = {};

  session.exercises.forEach((ex) => {
    const muscle = ex.exerciseId?.primaryMuscles?.[0];

    ex.sets.forEach((s) => {
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
  return { totalVolume, completedSets, sortedMuscles, muscleSets };
}

export default function SessionDetailScreen({ route, navigation }) {
  const [session, setSession] = useState(route.params.session);
  const trainingName = session.trainingId?.name || 'Entrenamiento';
  const { totalVolume, completedSets, sortedMuscles, muscleSets } = calcStats(session);

  // ── Edit modal state ──────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editDate, setEditDate]       = useState('');
  const [editH, setEditH]             = useState(0);
  const [editM, setEditM]             = useState(0);
  const [editS, setEditS]             = useState(0);
  const [editNotes, setEditNotes]     = useState('');
  const [saving, setSaving]           = useState(false);

  const openEdit = () => {
    const d = new Date(session.date);
    const pad = (n) => String(n).padStart(2, '0');
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    const secs = session.duration || 0;
    setEditH(Math.floor(secs / 3600));
    setEditM(Math.floor((secs % 3600) / 60));
    setEditS(secs % 60);
    setEditNotes(session.notes || '');
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD');
      return;
    }
    setSaving(true);
    try {
      const duration = editH * 3600 + editM * 60 + Math.min(editS, 59);
      const result = await sessionService.updateSession(session._id, {
        date:     new Date(editDate + 'T12:00:00').toISOString(),
        duration,
        notes:    editNotes,
      });
      setSession(result.data || { ...session, date: editDate, duration, notes: editNotes });
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
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Resumen ─────────────────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trainingName}>{trainingName}</Text>
              <Text style={styles.dateText}>{formatDate(session.date)}</Text>
            </View>
            <TouchableOpacity onPress={openEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil-outline" size={20} color="#9A9A9A" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Ionicons name="time-outline" size={20} color="#B11226" />
              <Text style={styles.statVal}>{formatDuration(session.duration)}</Text>
              <Text style={styles.statLbl}>Duración</Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
              <Text style={styles.statVal}>{completedSets}</Text>
              <Text style={styles.statLbl}>Series completas</Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="barbell-outline" size={20} color="#C9A44C" />
              <Text style={styles.statVal}>
                {totalVolume > 0 ? `${totalVolume.toLocaleString('es-ES')} kg` : '—'}
              </Text>
              <Text style={styles.statLbl}>Volumen total</Text>
            </View>
          </View>

          {/* Volumen por músculo */}
          {sortedMuscles.length > 0 && (
            <View style={styles.muscleSection}>
              <Text style={styles.sectionTitle}>Volumen por músculo</Text>
              {sortedMuscles.map(([muscle, vol]) => {
                const pct = totalVolume > 0 ? vol / totalVolume : 0;
                const sets = muscleSets[muscle] || 0;
                return (
                  <View key={muscle} style={styles.muscleRow}>
                    <View style={styles.muscleNameWrap}>
                      <Text style={styles.muscleName}>
                        {MUSCLE_LABELS[muscle] ?? muscle}
                      </Text>
                      <Text style={styles.muscleSets}>{sets} series</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { flex: pct }]} />
                      <View style={{ flex: 1 - pct }} />
                    </View>
                    <Text style={styles.muscleVol}>{vol.toLocaleString('es-ES')} kg</Text>
                  </View>
                );
              })}
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
          return (
            <View key={exIdx} style={styles.exCard}>
              <Text style={styles.exName}>{getExerciseName(ex.exerciseId)}</Text>

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
                  <Text style={[styles.colSet, styles.setNum]}>{sIdx + 1}</Text>
                  {isCardio ? (
                    <>
                      <Text style={[styles.colKm, styles.cellText]}>{s.km > 0 ? s.km : '—'}</Text>
                      <Text style={[{ flex: 1 }, styles.cellText]}>
                        {(s.h === 0 && s.m === 0 && s.s === 0)
                          ? '—'
                          : formatTime(s.h, s.m, s.s)
                        }
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.colKg, styles.cellText]}>{s.weight > 0 ? s.weight : '—'}</Text>
                      <Text style={[styles.colReps, styles.cellText]}>{s.reps > 0 ? s.reps : '—'}</Text>
                      <Text style={[styles.colRpe, styles.cellText]}>{s.rpe > 0 ? s.rpe : '—'}</Text>
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

        {/* ── Eliminar ─────────────────────────────── */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color="#FF3B3B" />
          <Text style={styles.deleteBtnText}>Eliminar sesión</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modal de edición ─────────────────────── */}
      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEdit(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Editar sesión</Text>

            {/* Fecha */}
            <Text style={styles.fieldLabel}>Fecha (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.fieldInput}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="2026-04-22"
              placeholderTextColor="#4A4A4A"
              keyboardType="numeric"
            />

            {/* Duración */}
            <Text style={styles.fieldLabel}>Duración</Text>
            <View style={styles.durationRow}>
              {[
                { label: 'h', value: editH, set: setEditH, max: 23 },
                { label: 'm', value: editM, set: setEditM, max: 59 },
                { label: 's', value: editS, set: setEditS, max: 59 },
              ].map(({ label, value, set, max }) => (
                <View key={label} style={styles.durationUnit}>
                  <TouchableOpacity onPress={() => set((v) => Math.min(v + 1, max))} style={styles.durationBtn}>
                    <Ionicons name="chevron-up" size={16} color="#EAEAEA" />
                  </TouchableOpacity>
                  <Text style={styles.durationValue}>{String(value).padStart(2, '0')}</Text>
                  <TouchableOpacity onPress={() => set((v) => Math.max(v - 1, 0))} style={styles.durationBtn}>
                    <Ionicons name="chevron-down" size={16} color="#EAEAEA" />
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
              placeholderTextColor="#4A4A4A"
              multiline
              numberOfLines={4}
            />

            {/* Guardar */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#EAEAEA" />
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
  trainingName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 2 },
  dateText: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, textTransform: 'capitalize' },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statLbl: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },

  // Volume per muscle
  muscleSection: { borderTopWidth: 1, borderTopColor: COLORS.surfaceDeep, paddingTop: 14, gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleName: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  muscleSets: { fontSize: 10, color: COLORS.textMuted, fontWeight: '500' },
  muscleNameWrap: { width: 90, gap: 1 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceDeep, flexDirection: 'row', overflow: 'hidden' },
  barFill: { backgroundColor: COLORS.primary, borderRadius: 3 },
  muscleVol: { width: 70, fontSize: 11, color: COLORS.textSecondary, textAlign: 'right' },

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
  exName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
  },
  colLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', textAlign: 'center' },
  colSet:  { width: 36, textAlign: 'center' },
  colKg:   { width: 60, textAlign: 'center' },
  colReps: { width: 60, textAlign: 'center' },
  colRpe:  { width: 48, textAlign: 'center' },
  colKm:   { width: 64, textAlign: 'center' },
  colDone: { width: 30, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
  },
  setRowDone: { backgroundColor: '#0A1A0A' },
  setNum: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  cellText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { borderColor: COLORS.success, backgroundColor: COLORS.success },

  // Summary header with edit button
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },

  // Notes
  notesBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceDeep,
    paddingTop: 12,
  },
  notesLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  notesText:  { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },

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
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  fieldInput: {
    backgroundColor: '#111111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    color: COLORS.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldTextarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  durationRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  durationUnit: { flex: 1, alignItems: 'center', backgroundColor: '#111111', borderRadius: 10, borderWidth: 1, borderColor: '#2E2E2E', paddingVertical: 8 },
  durationBtn: { padding: 6 },
  durationValue: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginVertical: 4 },
  durationLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  saveBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

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
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
});
