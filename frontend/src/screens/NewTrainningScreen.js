import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { trainingService } from '../services/api';
import { getExerciseName, CATEGORY_LABELS, MUSCLE_LABELS } from '../config/translations';

const DEFAULT_SET = { kg: '', reps: '', repsTo: '', rir: '' };
const DEFAULT_CARDIO_SET = { km: '', h: 0, m: 0, s: 0 };
const initExerciseConfig = () => ({ repMode: 'reps', sets: [{ ...DEFAULT_SET }] });
const initCardioConfig = () => ({ repMode: 'cardio', sets: [{ ...DEFAULT_CARDIO_SET }] });

// ─── Drum Picker ─────────────────────────────────────────────────────────────
const DRUM_ITEM_H = 44;
const DRUM_H = DRUM_ITEM_H * 5;

function DrumColumn({ values, initialIndex, onChange, label }) {
  const scrollRef = useRef(null);
  const [selectedI, setSelectedI] = useState(initialIndex);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initialIndex * DRUM_ITEM_H, animated: false });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.drumLabel}>{label}</Text>
      <View style={{ height: DRUM_H, overflow: 'hidden' }}>
        <ScrollView
          ref={scrollRef}
          snapToInterval={DRUM_ITEM_H}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={e => {
            const i = Math.round(e.nativeEvent.contentOffset.y / DRUM_ITEM_H);
            const c = Math.max(0, Math.min(values.length - 1, i));
            setSelectedI(c);
            onChange(c);
          }}
        >
          <View style={{ height: DRUM_ITEM_H * 2 }} />
          {values.map((v, i) => (
            <View key={i} style={{ height: DRUM_ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={i === selectedI ? styles.drumItemSelected : styles.drumItem}>
                {String(v).padStart(2, '0')}
              </Text>
            </View>
          ))}
          <View style={{ height: DRUM_ITEM_H * 2 }} />
        </ScrollView>
        <View pointerEvents="none" style={{
          position: 'absolute', left: 8, right: 8,
          top: DRUM_ITEM_H * 2, height: DRUM_ITEM_H,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#c7d2fe',
          backgroundColor: 'rgba(99,102,241,0.06)', borderRadius: 6,
        }} />
      </View>
    </View>
  );
}

function TiempoPickerModal({ value, onClose, onConfirm }) {
  const [h, setH] = useState(value.h ?? 0);
  const [m, setM] = useState(value.m ?? 0);
  const [s, setS] = useState(value.s ?? 0);
  const hours = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);
  const mins  = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const secs  = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity style={{ ...StyleSheet.absoluteFillObject }} onPress={onClose} />
        <View style={styles.drumSheet}>
          <View style={styles.drumHandle} />
          <Text style={styles.drumTitle}>Establecer Tiempo</Text>
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16 }}>
            <DrumColumn values={hours} initialIndex={h} onChange={setH} label="Horas" />
            <DrumColumn values={mins}  initialIndex={m} onChange={setM} label="Minutos" />
            <DrumColumn values={secs}  initialIndex={s} onChange={setS} label="Segundos" />
          </View>
          <TouchableOpacity style={styles.drumConfirmBtn} onPress={() => onConfirm({ h, m, s })}>
            <Text style={styles.drumConfirmText}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function NewTrainningScreen({ navigation }) {
  const { user } = useAuth();
  const [trainingName, setTrainingName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [exerciseConfigs, setExerciseConfigs] = useState({});
  const [loading, setLoading] = useState(false);
  const [tiempoTarget, setTiempoTarget] = useState(null);

  const handleAddExercise = () => {
    if (!trainingName.trim()) {
      Alert.alert('Atención', 'Escribe primero un nombre para el entrenamiento');
      return;
    }
    navigation.navigate('ExercisePicker', {
      selectedExercises: exercises,
      onSelect: (selected) => {
        const existingIds = new Set(exercises.map(e => e._id));
        const newOnes = selected.filter(e => !existingIds.has(e._id));
        setExercises(prev => [...prev, ...newOnes]);
        setExerciseConfigs(prev => {
          const next = { ...prev };
          newOnes.forEach(ex => { next[ex._id] = ex.category === 'cardio' ? initCardioConfig() : initExerciseConfig(); });
          return next;
        });
      },
    });
  };

  const handleRemoveExercise = (id) => {
    setExercises(prev => prev.filter(e => e._id !== id));
    setExerciseConfigs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addSet = (exerciseId) => {
    setExerciseConfigs(prev => {
      const config = prev[exerciseId];
      const template = config.repMode === 'cardio' ? DEFAULT_CARDIO_SET : DEFAULT_SET;
      return {
        ...prev,
        [exerciseId]: { ...config, sets: [...config.sets, { ...template }] },
      };
    });
  };

  const updateSet = (exerciseId, setIdx, fieldOrObject, value) => {
    setExerciseConfigs(prev => {
      const config = prev[exerciseId];
      const updates = typeof fieldOrObject === 'object' ? fieldOrObject : { [fieldOrObject]: value };
      const sets = config.sets.map((s, i) => i === setIdx ? { ...s, ...updates } : s);
      return { ...prev, [exerciseId]: { ...config, sets } };
    });
  };

  const toggleRepMode = (exerciseId) => {
    Alert.alert(
      'Tipo de repeticiones',
      undefined,
      [
        {
          text: 'Repeticiones',
          onPress: () => setExerciseConfigs(prev => ({
            ...prev,
            [exerciseId]: { ...prev[exerciseId], repMode: 'reps' },
          })),
        },
        {
          text: 'Rango de repeticiones',
          onPress: () => setExerciseConfigs(prev => ({
            ...prev,
            [exerciseId]: { ...prev[exerciseId], repMode: 'range' },
          })),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSaveTraining = async () => {
    if (!trainingName.trim()) {
      Alert.alert('Error', 'Por favor, ingresa un nombre para el entrenamiento');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Error', 'Debes añadir al menos un ejercicio');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: trainingName.trim(),
        exercises: exercises.map((ex, idx) => {
          const config = exerciseConfigs[ex._id] || initExerciseConfig();
          return {
            exerciseId: ex._id,
            order: idx,
            repMode: config.repMode,
            sets: config.sets,
          };
        }),
      };
      const result = await trainingService.createTraining(payload);
      if (result.success) {
        navigation.goBack();
      } else {
        Alert.alert('Error', result.message || 'Error al guardar el entrenamiento');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el entrenamiento');
    } finally {
      setLoading(false);
    }
  };

  const renderCardioTable = (exercise) => {
    const config = exerciseConfigs[exercise._id];
    if (!config) return null;
    return (
      <View style={styles.setsTable}>
        <View style={styles.setsHeaderRow}>
          <Text style={[styles.setsHeaderCell, styles.colSerie]}>SERIE</Text>
          <Text style={[styles.setsHeaderCell, styles.colKm]}>KM</Text>
          <Text style={[styles.setsHeaderCell, styles.colTiempo]}>TIEMPO</Text>
        </View>
        {config.sets.map((set, idx) => (
          <View key={idx} style={styles.setsRow}>
            <View style={[styles.setsSerieCell, styles.colSerie]}>
              <Text style={styles.setsSerieText}>{idx + 1}</Text>
            </View>
            <TextInput
              style={[styles.setsInputCell, styles.colKm]}
              value={set.km}
              onChangeText={v => updateSet(exercise._id, idx, 'km', v)}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor="#bbb"
              textAlign="center"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.setsInputCell, styles.colTiempo, { alignItems: 'center', justifyContent: 'center' }]}
              onPress={() => setTiempoTarget({ exerciseId: exercise._id, setIdx: idx })}
            >
              <Text style={[styles.setsTimeTxt, (set.h === 0 && set.m === 0 && set.s === 0) && { color: '#bbb' }]}>
                {(set.h === 0 && set.m === 0 && set.s === 0)
                  ? '—'
                  : `${String(set.h).padStart(2, '0')}:${String(set.m).padStart(2, '0')}:${String(set.s).padStart(2, '0')}`}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise._id)}>
          <Ionicons name="add" size={15} color="#6366f1" />
          <Text style={styles.addSetBtnText}>Agregar Serie</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSetsTable = (exercise) => {
    if (exercise.category === 'cardio') return renderCardioTable(exercise);
    const config = exerciseConfigs[exercise._id];
    if (!config) return null;
    const isRange = config.repMode === 'range';

    return (
      <View style={styles.setsTable}>
        {/* Header */}
        <View style={styles.setsHeaderRow}>
          <Text style={[styles.setsHeaderCell, styles.colSerie]}>SERIE</Text>
          <Text style={[styles.setsHeaderCell, styles.colKg]}>KG</Text>
          <TouchableOpacity
            style={[styles.setsHeaderCellBtn, isRange ? styles.colRepsRange : styles.colReps]}
            onPress={() => toggleRepMode(exercise._id)}
          >
            <Text style={styles.setsHeaderCellBtnText}>
              {isRange ? 'RANGO REPS' : 'REPS'}
            </Text>
            <Ionicons name="chevron-down" size={11} color="#6366f1" style={{ marginLeft: 3 }} />
          </TouchableOpacity>
          <Text style={[styles.setsHeaderCell, styles.colRir]}>RIR</Text>
        </View>

        {/* Filas */}
        {config.sets.map((set, idx) => (
          <View key={idx} style={styles.setsRow}>
            {/* Número de serie */}
            <View style={[styles.setsSerieCell, styles.colSerie]}>
              <Text style={styles.setsSerieText}>{idx + 1}</Text>
            </View>

            {/* KG */}
            <TextInput
              style={[styles.setsInputCell, styles.colKg]}
              value={set.kg}
              onChangeText={v => updateSet(exercise._id, idx, 'kg', v)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#bbb"
              textAlign="center"
              maxLength={5}
            />

            {/* Reps o Rango */}
            {isRange ? (
              <View style={[styles.colRepsRange, styles.setsRangeCell]}>
                <TextInput
                  style={styles.setsRangeInput}
                  value={set.reps}
                  onChangeText={v => updateSet(exercise._id, idx, 'reps', v)}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor="#bbb"
                  textAlign="center"
                  maxLength={3}
                />
                <Text style={styles.setsRangeSep}>a</Text>
                <TextInput
                  style={styles.setsRangeInput}
                  value={set.repsTo}
                  onChangeText={v => updateSet(exercise._id, idx, 'repsTo', v)}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor="#bbb"
                  textAlign="center"
                  maxLength={3}
                />
              </View>
            ) : (
              <TextInput
                style={[styles.setsInputCell, styles.colReps]}
                value={set.reps}
                onChangeText={v => updateSet(exercise._id, idx, 'reps', v)}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor="#bbb"
                textAlign="center"
                maxLength={4}
              />
            )}

            {/* RIR */}
            <TextInput
              style={[styles.setsInputCell, styles.colRir]}
              value={set.rir}
              onChangeText={v => updateSet(exercise._id, idx, 'rir', v)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#bbb"
              textAlign="center"
              maxLength={2}
            />
          </View>
        ))}

        {/* Agregar serie */}
        <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise._id)}>
          <Ionicons name="add" size={15} color="#6366f1" />
          <Text style={styles.addSetBtnText}>Agregar Serie</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Nombre del Entrenamiento</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Rutina de Fuerza"
                value={trainingName}
                onChangeText={setTrainingName}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Ejercicios</Text>
                <Text style={styles.exerciseCount}>
                  {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}
                </Text>
              </View>

              {exercises.length === 0 ? (
                <View style={styles.emptyExercises}>
                  <Text style={styles.emptyText}>No hay ejercicios añadidos</Text>
                  <Text style={styles.emptySubtext}>
                    Comienza añadiendo ejercicios a tu entrenamiento
                  </Text>
                </View>
              ) : (
                <View style={styles.exercisesList}>
                  {exercises.map((exercise, index) => (
                    <View key={exercise._id} style={styles.exerciseCard}>
                      {/* Cabecera del ejercicio */}
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseHeaderLeft}>
                          <Text style={styles.exerciseOrder}>{index + 1}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.exerciseName}>{getExerciseName(exercise)}</Text>
                            <Text style={styles.exerciseMeta}>
                              {CATEGORY_LABELS[exercise.category] || exercise.category}
                              {exercise.primaryMuscles?.[0]
                                ? ` · ${MUSCLE_LABELS[exercise.primaryMuscles[0]] || exercise.primaryMuscles[0]}`
                                : ''}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveExercise(exercise._id)}>
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Tabla de series */}
                      {renderSetsTable(exercise)}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.addExerciseButton} onPress={handleAddExercise}>
                <Ionicons name="add-circle-outline" size={18} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={styles.addExerciseButtonText}>Añadir Ejercicio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveTraining}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveButtonText}>Guardar Entrenamiento</Text>
          }
        </TouchableOpacity>
      </View>
      {tiempoTarget && (
        <TiempoPickerModal
          value={(exerciseConfigs[tiempoTarget.exerciseId]?.sets[tiempoTarget.setIdx]) ?? { h: 0, m: 0, s: 0 }}
          onClose={() => setTiempoTarget(null)}
          onConfirm={({ h, m, s }) => {
            updateSet(tiempoTarget.exerciseId, tiempoTarget.setIdx, { h, m, s });
            setTiempoTarget(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 20 },
  section: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  exerciseCount: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
  },
  emptyExercises: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  emptyText: { fontSize: 16, color: '#999', marginBottom: 5 },
  emptySubtext: { fontSize: 14, color: '#bbb', textAlign: 'center' },
  exercisesList: { marginBottom: 15 },

  // Card de ejercicio
  exerciseCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  exerciseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  exerciseOrder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  exerciseName: { fontSize: 15, color: '#333', fontWeight: '600' },
  exerciseMeta: { fontSize: 12, color: '#888', marginTop: 2 },

  // Tabla de series
  setsTable: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  setsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'space-between',
  },
  // Anchos de columna
  colSerie: { width: 44 },
  colKg: { width: 60 },
  colReps: { width: 60 },
  colRepsRange: { width: 110 },
  colRir: { width: 46 },
  colKm: { width: 70 },
  colTiempo: { width: 90 },
  setsHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#aaa',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  setsHeaderCellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsHeaderCellBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 0.5,
  },
  setsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#fafafa',
    justifyContent: 'space-between',
  },
  setsSerieCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsSerieText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
    textAlign: 'center',
  },
  setsInputCell: {
    height: 34,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  setsRangeCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  setsRangeInput: {
    width: 44,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  setsRangeSep: {
    fontSize: 13,
    color: '#aaa',
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 2,
    gap: 4,
  },
  addSetBtnText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },

  // Botón añadir ejercicio
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  addExerciseButtonText: { color: '#6366f1', fontSize: 16, fontWeight: 'bold' },

  // Footer
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Cardio table
  setsTimeTxt: { fontSize: 13, fontWeight: '600', color: '#333', textAlign: 'center' },

  // Drum time picker
  drumSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  drumHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd',
    alignSelf: 'center', marginBottom: 16,
  },
  drumTitle: {
    textAlign: 'center', fontSize: 16, fontWeight: '700',
    color: '#333', marginBottom: 12,
  },
  drumLabel: {
    fontSize: 11, fontWeight: '700', color: '#aaa',
    letterSpacing: 0.5, marginBottom: 4, textAlign: 'center',
  },
  drumItem: { fontSize: 22, color: '#ccc', fontWeight: '500' },
  drumItemSelected: { fontSize: 26, color: '#333', fontWeight: '700' },
  drumConfirmBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: '#6366f1', borderRadius: 10, padding: 16, alignItems: 'center',
  },
  drumConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});