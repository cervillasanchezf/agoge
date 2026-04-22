import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trainingService } from '../services/api';
import { MUSCLE_LABELS, CATEGORY_LABELS, getExerciseName } from '../config/translations';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSetSummary(set, repMode) {
  if (repMode === 'cardio') {
    const kmPart = set.km ? `${set.km} km` : '';
    const hPart = set.h > 0 ? `${String(set.h).padStart(2, '0')}:` : '';
    const timePart = (set.h > 0 || set.m > 0 || set.s > 0)
      ? `${hPart}${String(set.m ?? 0).padStart(2, '0')}:${String(set.s ?? 0).padStart(2, '0')}`
      : '';
    return [kmPart, timePart].filter(Boolean).join('  ') || '—';
  }

  const kgPart = set.kg ? `${set.kg} kg` : '';
  const repsPart = repMode === 'range' && set.reps && set.repsTo
    ? `${set.reps}-${set.repsTo} reps`
    : set.reps
      ? `${set.reps} reps`
      : '';
  const rpePart = set.rpe != null && set.rpe !== '' ? `RPE ${set.rpe}` : '';
  return [kgPart, repsPart, rpePart].filter(Boolean).join('  ') || '—';
}

/**
 * Builds a concise summary line for all sets of an exercise.
 * Groups consecutive identical lines: "3 × 80 kg  8 reps  RPE 8"
 */
function buildExerciseSummaryLines(sets, repMode) {
  if (!sets?.length) return [];

  const lines = sets.map(s => formatSetSummary(s, repMode));

  // Group consecutive identical lines
  const groups = [];
  let count = 1;
  for (let i = 1; i <= lines.length; i++) {
    if (i < lines.length && lines[i] === lines[i - 1]) {
      count++;
    } else {
      groups.push(count > 1 ? `${count} × ${lines[i - 1]}` : lines[i - 1]);
      count = 1;
    }
  }
  return groups;
}

// ─── Sub-componente: tarjeta de ejercicio ───────────────────────────────────

function ExerciseCard({ item, index }) {
  const exercise = item.exerciseId;
  const repMode  = item.repMode ?? 'reps';
  const primaryMuscle = exercise?.primaryMuscles?.[0];
  const summaryLines = buildExerciseSummaryLines(item.sets, repMode);

  return (
    <View style={styles.exCard}>
      <View style={styles.exCardLeft}>
        <View style={styles.exIndexBadge}>
          <Text style={styles.exIndexText}>{index + 1}</Text>
        </View>
      </View>
      <View style={styles.exCardBody}>
        <View style={styles.exNameRow}>
          <Text style={styles.exName} numberOfLines={1}>{getExerciseName(exercise)}</Text>
        </View>

        {(primaryMuscle || exercise?.category) ? (
          <Text style={styles.exMeta}>
            {primaryMuscle ? (MUSCLE_LABELS[primaryMuscle] ?? primaryMuscle) : ''}
            {primaryMuscle && exercise?.category ? '  ·  ' : ''}
            {exercise?.category ? (CATEGORY_LABELS[exercise.category] ?? exercise.category) : ''}
          </Text>
        ) : null}

        {item.note ? (
          <Text style={styles.exNote} numberOfLines={2}>{item.note}</Text>
        ) : null}

        <View style={styles.setsContainer}>
          <Text style={styles.setsCount}>
            {item.sets?.length ?? 0} serie{(item.sets?.length ?? 0) !== 1 ? 's' : ''}
          </Text>
          {summaryLines.map((line, i) => (
            <Text key={i} style={styles.summaryLine}>{line}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────────────────

export default function TrainingSummaryScreen({ route, navigation }) {
  const { trainingId, trainingName, scheduledDate } = route.params;

  const [training, setTraining] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let isMounted = true;
    trainingService.getTrainingById(trainingId)
      .then(r => { if (isMounted) { setTraining(r.data); setLoading(false); } })
      .catch(() => {
        Alert.alert('Error', 'No se pudo cargar el entrenamiento', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      });
    return () => { isMounted = false; };
  }, [trainingId]);

  const handleStart = () => {
    navigation.replace('ActiveSession', {
      trainingId,
      trainingName,
      scheduledDate,
    });
  };

  const totalSets = training?.exercises?.reduce(
    (acc, ex) => acc + (ex.sets?.length ?? 0), 0
  ) ?? 0;

  const muscleSet = new Set(
    (training?.exercises ?? []).flatMap(
      ex => ex.exerciseId?.primaryMuscles ?? []
    )
  );
  const muscles = [...muscleSet]
    .map(m => MUSCLE_LABELS[m] ?? m)
    .slice(0, 5);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B11226" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color="#EAEAEA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{trainingName}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{training?.exercises?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Ejercicios</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalSets}</Text>
          <Text style={styles.statLabel}>Series totales</Text>
        </View>
        {muscles.length > 0 && (
          <>
            <View style={styles.statDivider} />
            <View style={[styles.statItem, { flex: 2 }]}>
              <Text style={styles.statValue} numberOfLines={1}>
                {muscles.join(', ')}
              </Text>
              <Text style={styles.statLabel}>Músculos</Text>
            </View>
          </>
        )}
      </View>

      {/* Exercise list */}
      <FlatList
        data={training?.exercises ?? []}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <ExerciseCard item={item} index={index} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={40} color="#333333" />
            <Text style={styles.emptyText}>Este entrenamiento no tiene ejercicios</Text>
          </View>
        }
      />

      {/* Start button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <Ionicons name="play" size={20} color="#EAEAEA" style={{ marginRight: 8 }} />
          <Text style={styles.startBtnText}>Comenzar entrenamiento</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1F1F1F',
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#EAEAEA',
    textAlign: 'center',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#252525',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAEAEA',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6A6A6A',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2E2E2E',
    marginHorizontal: 8,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 16,
    gap: 10,
  },

  // Exercise card
  exCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#252525',
  },
  exCardLeft: {
    alignItems: 'center',
    paddingTop: 2,
  },
  exIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A0008',
    borderWidth: 1,
    borderColor: '#5A0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exIndexText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B11226',
  },
  exCardBody: {
    flex: 1,
    gap: 4,
  },
  exNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAEAEA',
    flexShrink: 1,
  },
  repModeBadge: {
    backgroundColor: '#1A2A1A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#2A4A2A',
  },
  repModeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
  },
  exMeta: {
    fontSize: 12,
    color: '#6A6A6A',
  },
  exNote: {
    fontSize: 12,
    color: '#8B0000',
    fontStyle: 'italic',
  },
  setsContainer: {
    marginTop: 6,
    gap: 2,
  },
  setsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A9A9A',
    marginBottom: 2,
  },
  summaryLine: {
    fontSize: 12,
    color: '#6A6A6A',
    fontVariant: ['tabular-nums'],
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6A6A6A',
    textAlign: 'center',
  },

  // Footer / Start button
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  startBtn: {
    backgroundColor: '#B11226',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '700',
  },
});
