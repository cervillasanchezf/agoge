import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trainingService, sessionService } from '../services/api';
import { CATEGORY_LABELS, MUSCLE_LABELS, getExerciseName } from '../config/translations';

// ─── Drum Picker ──────────────────────────────────────────────────────────────
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
  const [h, setH] = useState(value?.h ?? 0);
  const [m, setM] = useState(value?.m ?? 0);
  const [s, setS] = useState(value?.s ?? 0);
  const hours = useMemo(() => Array.from({ length: 6 },  (_, i) => i), []);
  const mins  = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const secs  = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
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
// ──────────────────────────────────────────────────────────────────────────────

// Construye el estado inicial de sets mezclando la plantilla y la última sesión.
// - templateSets: sets guardados en Training (valores objetivo)
// - lastSets: sets de la última TrainingSession (para columna "Anterior")
// - repMode: 'reps' | 'range' | 'cardio'
function buildInitialSets(templateSets, lastSets, repMode) {
  const lastMap = {};
  if (lastSets?.length) {
    lastSets.forEach((s, i) => { lastMap[i] = s; });
  }

  const count = templateSets?.length || 3;
  return Array.from({ length: count }, (_, i) => {
    const tmpl = templateSets?.[i] ?? {};
    const last = lastMap[i] ?? null;

    if (repMode === 'cardio') {
      return {
        km:         '',
        km_default: String(tmpl.km ?? ''),
        h:          tmpl.h ?? 0,
        m:          tmpl.m ?? 0,
        s:          tmpl.s ?? 0,
        completed:  false,
        prev_km:    last?.km   ?? null,
        prev_h:     last?.h    ?? null,
        prev_m:     last?.m    ?? null,
        prev_s:     last?.s    ?? null,
      };
    }
    const repsDisplay = repMode === 'range' && tmpl.reps && tmpl.repsTo
      ? `${tmpl.reps}-${tmpl.repsTo}`
      : String(tmpl.reps ?? '');
    return {
      weight:          '',
      weight_default:  String(tmpl.kg  ?? ''),
      reps:            '',
      reps_default:    repsDisplay,
      rir:             '',
      rir_default:     String(tmpl.rir ?? ''),
      completed:       false,
      prev_weight: last?.weight ?? null,
      prev_reps:   last?.reps   ?? null,
      prev_rir:    last?.rir    ?? null,
    };
  });
}

export default function ActiveSessionScreen({ route, navigation }) {
  const { trainingId, trainingName } = route.params;

  const [training, setTraining]         = useState(null);
  const [exerciseData, setExerciseData] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tiempoTarget, setTiempoTarget] = useState(null); // { exIndex, setIndex }
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
      const lastExMap = {};
      if (lastSession?.exercises) {
        lastSession.exercises.forEach((ex) => {
          lastExMap[String(ex.exerciseId?._id ?? ex.exerciseId)] = ex;
        });
      }

      const data = (trainingData.exercises || []).map((item) => {
        const exId     = String(item.exerciseId?._id ?? item.exerciseId);
        const lastEx   = lastExMap[exId] ?? null;
        const repMode  = item.repMode ?? 'reps';
        return {
          exercise:  item.exerciseId,
          repMode,
          sets: buildInitialSets(item.sets, lastEx?.sets, repMode),
        };
      });
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

  const updateSet = (exIndex, setIndex, fieldOrObj, value) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      const updates = typeof fieldOrObj === 'object' ? fieldOrObj : { [fieldOrObj]: value };
      sets[setIndex] = { ...sets[setIndex], ...updates };
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  const toggleComplete = (exIndex, setIndex) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      const set = sets[setIndex];
      const completing = !set.completed;

      // Al completar, si algún campo está vacío usa su valor por defecto
      const filled = completing ? {
        weight: set.weight || set.weight_default || '',
        reps:   set.reps   || set.reps_default   || '',
        rir:    set.rir    || set.rir_default     || '',
        km:     set.km     || set.km_default      || '',
      } : {};

      sets[setIndex] = { ...set, ...filled, completed: completing };
      updated[exIndex] = { ...updated[exIndex], sets };
      return updated;
    });
  };

  const addSet = (exIndex) => {
    setExerciseData((prev) => {
      const updated  = [...prev];
      const item     = updated[exIndex];
      const lastSet  = item.sets[item.sets.length - 1];
      const effectiveKm     = lastSet?.km     || lastSet?.km_default     || '';
      const effectiveWeight = lastSet?.weight || lastSet?.weight_default || '';
      const effectiveReps   = lastSet?.reps   || lastSet?.reps_default   || '';
      const effectiveRir    = lastSet?.rir    || lastSet?.rir_default    || '';
      const newSet   = item.repMode === 'cardio'
        ? { km: '', km_default: effectiveKm, h: lastSet?.h ?? 0, m: lastSet?.m ?? 0, s: lastSet?.s ?? 0, completed: false, prev_km: null, prev_h: null, prev_m: null, prev_s: null }
        : { weight: '', weight_default: effectiveWeight, reps: '', reps_default: effectiveReps, rir: '', rir_default: effectiveRir, completed: false, prev_weight: null, prev_reps: null, prev_rir: null };
      updated[exIndex] = { ...item, sets: [...item.sets, newSet] };
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
        duration: elapsedSeconds,
        exercises: exerciseData.map((item, idx) => ({
          exerciseId: item.exercise?._id ?? item.exercise,
          order: idx,
          repMode: item.repMode,
          sets: item.sets.map((s) => {
            if (item.repMode === 'cardio') {
              const userEdited = s.km !== '' || s.h > 0 || s.m > 0 || s.s > 0;
              return {
                km:        userEdited ? parseFloat(s.km) || 0 : 0,
                h:         userEdited ? s.h ?? 0 : 0,
                m:         userEdited ? s.m ?? 0 : 0,
                s:         userEdited ? s.s ?? 0 : 0,
                completed: s.completed && userEdited,
              };
            }
            const userEdited = s.weight !== '' || s.reps !== '' || s.rir !== '';
            return {
              weight:    userEdited ? parseFloat(s.weight) || 0 : 0,
              reps:      userEdited ? parseInt(s.reps)     || 0 : 0,
              rir:       userEdited ? parseInt(s.rir)      || 0 : 0,
              completed: s.completed && userEdited,
            };
          }),
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
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.finishBtnText}>Finalizar</Text>
          }
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
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index: exIndex }) => (
            <ExerciseBlock
              item={item}
              exIndex={exIndex}
              updateSet={updateSet}
              toggleComplete={toggleComplete}
              addSet={addSet}
              removeSet={removeSet}
              onOpenTiempo={(setIndex) => setTiempoTarget({ exIndex, setIndex })}
            />
          )}
        />
      </KeyboardAvoidingView>

      {tiempoTarget && (
        <TiempoPickerModal
          value={exerciseData[tiempoTarget.exIndex]?.sets[tiempoTarget.setIndex]}
          onClose={() => setTiempoTarget(null)}
          onConfirm={({ h, m, s }) => {
            updateSet(tiempoTarget.exIndex, tiempoTarget.setIndex, { h, m, s });
            setTiempoTarget(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ExerciseBlock({ item, exIndex, updateSet, toggleComplete, addSet, removeSet, onOpenTiempo }) {
  const exercise = item.exercise;
  const repMode  = item.repMode ?? 'reps';
  const primaryMuscle = exercise?.primaryMuscles?.[0];

  const isCardio = repMode === 'cardio';
  const isRange  = repMode === 'range';

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

      {/* Cabecera tabla */}
      {isCardio ? (
        <View style={styles.tableHeader}>
          <Text style={[styles.colLabel, styles.colSet]}>SERIE</Text>
          <Text style={[styles.colLabel, styles.colPrev]}>ANTERIOR</Text>
          <Text style={[styles.colLabel, styles.colKm]}>KM</Text>
          <Text style={[styles.colLabel, styles.colTiempo]}>TIEMPO</Text>
          <Text style={[styles.colLabel, styles.colDone]}></Text>
        </View>
      ) : (
        <View style={styles.tableHeader}>
          <Text style={[styles.colLabel, styles.colSet]}>SERIE</Text>
          <Text style={[styles.colLabel, styles.colPrev]}>ANTERIOR</Text>
          <Text style={[styles.colLabel, styles.colKg]}>KG</Text>
          <Text style={[styles.colLabel, styles.colReps]}>REPS</Text>
          <Text style={[styles.colLabel, styles.colRir]}>RIR</Text>
          <Text style={[styles.colLabel, styles.colDone]}></Text>
        </View>
      )}

      {item.sets.map((set, setIndex) =>
        isCardio ? (
          <CardioSetRow
            key={setIndex}
            set={set}
            setIndex={setIndex}
            exIndex={exIndex}
            updateSet={updateSet}
            toggleComplete={toggleComplete}
            removeSet={removeSet}
            onOpenTiempo={() => onOpenTiempo(setIndex)}
          />
        ) : (
          <SetRow
            key={setIndex}
            set={set}
            setIndex={setIndex}
            exIndex={exIndex}
            updateSet={updateSet}
            toggleComplete={toggleComplete}
            removeSet={removeSet}
          />
        )
      )}

      <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIndex)}>
        <Ionicons name="add-circle-outline" size={18} color="#6366f1" />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

function SetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet }) {
  let prevLabel = '—';
  if (set.prev_weight != null && set.prev_reps != null) {
    prevLabel = `${set.prev_weight}kg × ${set.prev_reps}`;
    if (set.prev_rir != null) prevLabel += ` RIR${set.prev_rir}`;
  }

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
        placeholder={set.weight_default || '—'}
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={[styles.colReps, styles.input]}
        value={set.reps}
        onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', v)}
        keyboardType="number-pad"
        placeholder={set.reps_default || '—'}
        placeholderTextColor="#9ca3af"
      />
      <TextInput
        style={[styles.colRir, styles.input]}
        value={set.rir}
        onChangeText={(v) => updateSet(exIndex, setIndex, 'rir', v)}
        keyboardType="number-pad"
        placeholder={set.rir_default || '—'}
        placeholderTextColor="#9ca3af"
      />
      <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
        <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
          {set.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function CardioSetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet, onOpenTiempo }) {
  const hasPrev = set.prev_km != null;
  const prevLabel = hasPrev
    ? `${set.prev_km}km ${set.prev_h > 0 ? `${String(set.prev_h).padStart(2,'0')}:` : ''}${String(set.prev_m ?? 0).padStart(2,'0')}:${String(set.prev_s ?? 0).padStart(2,'0')}`
    : '—';
  const tiempoLabel = (set.h === 0 && set.m === 0 && set.s === 0)
    ? '—'
    : `${String(set.h).padStart(2,'0')}:${String(set.m).padStart(2,'0')}:${String(set.s).padStart(2,'0')}`;

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <TouchableOpacity style={[styles.colSet, styles.setNumBtn]} onLongPress={() => removeSet(exIndex, setIndex)}>
        <Text style={styles.setNum}>{setIndex + 1}</Text>
      </TouchableOpacity>
      <Text style={[styles.colPrev, styles.prevText]}>{prevLabel}</Text>
      <TextInput
        style={[styles.colKm, styles.input]}
        value={set.km}
        onChangeText={(v) => updateSet(exIndex, setIndex, 'km', v)}
        keyboardType="decimal-pad"
        placeholder={set.km_default || '—'}
        placeholderTextColor="#9ca3af"
      />
      <TouchableOpacity
        style={[styles.colTiempo, styles.input, { alignItems: 'center', justifyContent: 'center' }]}
        onPress={onOpenTiempo}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: (set.h === 0 && set.m === 0 && set.s === 0) ? '#d1d5db' : '#111827' }}>
          {tiempoLabel}
        </Text>
      </TouchableOpacity>
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
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
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
  // Columnas fuerza
  colSet:      { width: 32 },
  colPrev:     { flex: 1, textAlign: 'center' },
  colKg:       { width: 56, textAlign: 'center' },
  colReps:     { width: 52, textAlign: 'center' },
  colRepsRange:{ width: 96, textAlign: 'center' },
  colRir:      { width: 44, textAlign: 'center' },
  colDone:     { width: 32, alignItems: 'center' },
  // Columnas cardio
  colKm:    { width: 60, textAlign: 'center' },
  colTiempo:{ width: 80, textAlign: 'center' },
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
  rangeSep: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
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
    marginHorizontal: 2,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { borderColor: '#22c55e', backgroundColor: '#22c55e' },
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
  // Drum picker
  drumSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 30,
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
  drumItem:         { fontSize: 22, color: '#ccc', fontWeight: '500' },
  drumItemSelected: { fontSize: 26, color: '#333', fontWeight: '700' },
  drumConfirmBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: '#6366f1', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  drumConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
