import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trainingService, sessionService } from '../services/api';
import { CATEGORY_LABELS, MUSCLE_LABELS, getExerciseName } from '../config/translations';

const DEFAULT_SETS = 3;

function buildInitialSets(lastSets) {
  if (lastSets && lastSets.length > 0) {
    return lastSets.map((s) => ({
      reps: String(s.reps ?? ''),
      weight: String(s.weight ?? ''),
      completed: false,
      prev_reps: s.reps,
      prev_weight: s.weight,
    }));
  }
  return Array.from({ length: DEFAULT_SETS }, () => ({
    reps: '',
    weight: '',
    completed: false,
    prev_reps: null,
    prev_weight: null,
  }));
}

export default function ActiveSessionScreen({ route, navigation }) {
  const { trainingId, trainingName } = route.params;

  const [training, setTraining] = useState(null);
  const [exerciseData, setExerciseData] = useState([]); // [{exercise, sets}]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    loadSession();
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const loadSession = async () => {
    try {
      setLoading(true);
      const [trainingResult, lastSessionResult] = await Promise.all([
        trainingService.getTrainingById(trainingId),
        sessionService.getLastSession(trainingId).catch(() => null),
      ]);
      const trainingData = trainingResult.data;
      setTraining(trainingData);

      const lastSession = lastSessionResult?.data || null;
      const lastSetsMap = {};
      if (lastSession?.exercises) {
        lastSession.exercises.forEach((ex) => {
          lastSetsMap[String(ex.exerciseId)] = ex.sets;
        });
      }

      const data = (trainingData.exercises || []).map((item) => ({
        exercise: item.exerciseId,
        sets: buildInitialSets(lastSetsMap[String(item.exerciseId?._id ?? item.exerciseId)]),
      }));
      setExerciseData(data);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el entrenamiento');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const updateSet = (exIndex, setIndex, field, value) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      sets[setIndex] = { ...sets[setIndex], [field]: value };
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  const toggleComplete = (exIndex, setIndex) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed };
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  const addSet = (exIndex) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const lastSet = updated[exIndex].sets[updated[exIndex].sets.length - 1];
      updated[exIndex] = {
        ...updated[exIndex],
        sets: [
          ...updated[exIndex].sets,
          { reps: lastSet?.reps ?? '', weight: lastSet?.weight ?? '', completed: false, prev_reps: null, prev_weight: null },
        ],
      };
      return updated;
    });
  };

  const removeSet = (exIndex, setIndex) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      if (updated[exIndex].sets.length <= 1) return prev;
      const sets = updated[exIndex].sets.filter((_, i) => i !== setIndex);
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  const handleFinish = () => {
    Alert.alert(
      'Finalizar entrenamiento',
      '¿Quieres guardar esta sesión?',
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Guardar', style: 'default', onPress: saveSession },
      ]
    );
  };

  const saveSession = async () => {
    try {
      setSaving(true);
      clearInterval(timerRef.current);

      const payload = {
        trainingId,
        exercises: exerciseData.map((item) => ({
          exerciseId: item.exercise?._id ?? item.exercise,
          sets: item.sets.map((s) => ({
            reps: parseInt(s.reps) || 0,
            weight: parseFloat(s.weight) || 0,
            completed: s.completed,
          })),
        })),
        notes: '',
      };

      await sessionService.createSession(payload);
      Alert.alert('¡Genial!', 'Sesión guardada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', 'No se pudo guardar la sesión');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{trainingName}</Text>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color="#6366f1" />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.finishBtn, saving && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.finishBtnText}>Finalizar</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={exerciseData}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index: exIndex }) => (
            <ExerciseBlock
              item={item}
              exIndex={exIndex}
              updateSet={updateSet}
              toggleComplete={toggleComplete}
              addSet={addSet}
              removeSet={removeSet}
            />
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ExerciseBlock({ item, exIndex, updateSet, toggleComplete, addSet, removeSet }) {
  const exercise = item.exercise;
  const primaryMuscle = exercise?.primaryMuscles?.[0];

  return (
    <View style={styles.exCard}>
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{getExerciseName(exercise)}</Text>
          <Text style={styles.exMeta}>
            {primaryMuscle ? MUSCLE_LABELS[primaryMuscle] ?? primaryMuscle : ''}
            {exercise?.category ? `  ·  ${CATEGORY_LABELS[exercise.category] ?? exercise.category}` : ''}
          </Text>
        </View>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colLabel, styles.colSet]}>Serie</Text>
        <Text style={[styles.colLabel, styles.colPrev]}>Anterior</Text>
        <Text style={[styles.colLabel, styles.colKg]}>kg</Text>
        <Text style={[styles.colLabel, styles.colReps]}>Reps</Text>
        <Text style={[styles.colLabel, styles.colDone]}></Text>
      </View>

      {item.sets.map((set, setIndex) => (
        <SetRow
          key={setIndex}
          set={set}
          setIndex={setIndex}
          exIndex={exIndex}
          updateSet={updateSet}
          toggleComplete={toggleComplete}
          removeSet={removeSet}
        />
      ))}

      <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIndex)}>
        <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

function SetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet }) {
  const prevLabel =
    set.prev_weight != null && set.prev_reps != null
      ? `${set.prev_weight}kg × ${set.prev_reps}`
      : '—';

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <TouchableOpacity style={[styles.colSet, styles.setNumBtn]} onLongPress={() => removeSet(exIndex, setIndex)}>
        <Text style={styles.setNum}>{setIndex + 1}</Text>
      </TouchableOpacity>
      <Text style={[styles.colPrev, styles.prevText]}>{prevLabel}</Text>
      <TextInput
        style={[styles.colKg, styles.input]}
        value={set.weight}
        onChangeText={(v) => updateSet(exIndex, setIndex, 'weight', v)}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#d1d5db"
      />
      <TextInput
        style={[styles.colReps, styles.input]}
        value={set.reps}
        onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', v)}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#d1d5db"
      />
      <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
        <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
          {set.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  timerText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  finishBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  finishBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  exCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  exHeader: { flexDirection: 'row', marginBottom: 12 },
  exName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  exMeta: { fontSize: 12, color: '#9ca3af' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  colLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },
  colSet: { width: 36 },
  colPrev: { flex: 1, textAlign: 'center' },
  colKg: { width: 60, textAlign: 'center' },
  colReps: { width: 60, textAlign: 'center' },
  colDone: { width: 36, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  setRowDone: { backgroundColor: '#f0fdf4' },
  setNumBtn: { alignItems: 'center', justifyContent: 'center' },
  setNum: { fontSize: 13, fontWeight: '700', color: '#6366f1' },
  prevText: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 3,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  addSetText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
});
