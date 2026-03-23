import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sessionService } from '../services/api';
import { MUSCLE_LABELS, getExerciseName } from '../config/translations';

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
  const { session } = route.params;
  const trainingName = session.trainingId?.name || 'Entrenamiento';
  const { totalVolume, completedSets, sortedMuscles, muscleSets } = calcStats(session);

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
          <Text style={styles.trainingName}>{trainingName}</Text>
          <Text style={styles.dateText}>{formatDate(session.date)}</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Ionicons name="time-outline" size={20} color="#6366f1" />
              <Text style={styles.statVal}>{formatDuration(session.duration)}</Text>
              <Text style={styles.statLbl}>Duración</Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
              <Text style={styles.statVal}>{completedSets}</Text>
              <Text style={styles.statLbl}>Series completas</Text>
            </View>
            <View style={styles.statCell}>
              <Ionicons name="barbell-outline" size={20} color="#f59e0b" />
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
                    <Text style={[styles.colLabel, styles.colRir]}>RIR</Text>
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
                      <Text style={[styles.colRir, styles.cellText]}>{s.rir > 0 ? s.rir : '—'}</Text>
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
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text style={styles.deleteBtnText}>Eliminar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  // Summary card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  trainingName: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 2 },
  dateText: { fontSize: 13, color: '#9ca3af', marginBottom: 16, textTransform: 'capitalize' },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statLbl: { fontSize: 10, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },

  // Volume per muscle
  muscleSection: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 14, gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 4 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleName: { fontSize: 12, color: '#374151', fontWeight: '600' },
  muscleSets: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
  muscleNameWrap: { width: 90, gap: 1 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', flexDirection: 'row', overflow: 'hidden' },
  barFill: { backgroundColor: '#6366f1', borderRadius: 3 },
  muscleVol: { width: 70, fontSize: 11, color: '#6b7280', textAlign: 'right' },

  // Exercise card
  exCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  exName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  colLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '700', textAlign: 'center' },
  colSet:  { width: 36, textAlign: 'center' },
  colKg:   { width: 60, textAlign: 'center' },
  colReps: { width: 60, textAlign: 'center' },
  colRir:  { width: 48, textAlign: 'center' },
  colKm:   { width: 64, textAlign: 'center' },
  colDone: { width: 30, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
  },
  setRowDone: { backgroundColor: '#f0fdf4' },
  setNum: { fontSize: 13, fontWeight: '700', color: '#6366f1', textAlign: 'center' },
  cellText: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { borderColor: '#22c55e', backgroundColor: '#22c55e' },

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
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
});
