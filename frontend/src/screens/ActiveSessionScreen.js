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
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { trainingService, sessionService } from '../services/api';
import { CATEGORY_LABELS, MUSCLE_LABELS, getExerciseName } from '../config/translations';
import { useActiveSession } from '../context/ActiveSessionContext';

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
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#5A0000',
          backgroundColor: 'rgba(139,0,0,0.1)', borderRadius: 6,
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
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
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
  const { trainingId, trainingName, scheduledDate } = route.params;
  const { session: activeSession, saveSession: saveToContext, discardSession } = useActiveSession();

  const [training, setTraining]         = useState(null);
  const [exerciseData, setExerciseData] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tiempoTarget, setTiempoTarget] = useState(null);
  const originalSnapshotRef = useRef(null); // snapshot of exercises when session started
  const timerRef          = useRef(null);
  const savingRef         = useRef(false);
  const exerciseDataRef   = useRef([]);
  const elapsedSecondsRef = useRef(0);

  // Keep refs in sync with state so cleanup/unmount always has latest values
  useEffect(() => { exerciseDataRef.current   = exerciseData;   }, [exerciseData]);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; }, [elapsedSeconds]);

  useEffect(() => {
    const isRestoring = activeSession?.trainingId === trainingId;
    if (isRestoring) {
      // Restore exercise data and recompute elapsed time from stored timestamp
      setExerciseData(activeSession.exerciseData);
      setElapsedSeconds(Math.round((Date.now() - activeSession.startTimestamp) / 1000));
      setLoading(false);
      // Load training metadata and rebuild snapshot
      trainingService.getTrainingById(trainingId).then(r => {
        setTraining(r.data);
        originalSnapshotRef.current = {
          exerciseIds: (r.data.exercises || []).map(e => String(e.exerciseId?._id ?? e.exerciseId)),
          setCounts:   (r.data.exercises || []).map(e => e.sets?.length ?? 0),
        };
      }).catch(() => {});
    } else {
      loadSession();
    }
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(timerRef.current);
      // Save session to context on unmount (back press, tab switch, etc.)
      // unless the user explicitly finished and saved to the server.
      if (!savingRef.current && exerciseDataRef.current.length > 0) {
        saveToContext({
          trainingId,
          trainingName,
          exerciseData: exerciseDataRef.current,
          elapsedSeconds: elapsedSecondsRef.current,
        });
      }
    };
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
          note:      item.note || '',
          sets: buildInitialSets(item.sets, lastEx?.sets, repMode),
        };
      });
      setExerciseData(data);
      // Save a snapshot for change detection
      originalSnapshotRef.current = {
        exerciseIds: (trainingData.exercises || []).map(e => String(e.exerciseId?._id ?? e.exerciseId)),
        setCounts:   (trainingData.exercises || []).map(e => e.sets?.length ?? 0),
      };
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

  const removeExercise = (exIndex) => {
    setExerciseData((prev) => prev.filter((_, i) => i !== exIndex));
  };

  const replaceExercise = (exIndex, newExercise) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const old = updated[exIndex];
      const repMode = newExercise.category === 'cardio' ? 'cardio' : 'reps';
      const newSets = Array.from({ length: old.sets.length }, () =>
        repMode === 'cardio'
          ? { km: '', km_default: '', h: 0, m: 0, s: 0, completed: false, prev_km: null, prev_h: null, prev_m: null, prev_s: null }
          : { weight: '', weight_default: '', reps: '', reps_default: '', rir: '', rir_default: '', completed: false, prev_weight: null, prev_reps: null, prev_rir: null }
      );
      updated[exIndex] = { exercise: newExercise, repMode, note: old.note, sets: newSets };
      return updated;
    });
  };

  const handleReplaceExerciseInSession = (exIndex) => {
    const currentExIds = new Set(
      exerciseData.filter((_, i) => i !== exIndex).map(e => String(e.exercise?._id ?? e.exercise))
    );
    navigation.navigate('ExercisePicker', {
      selectedExercises: exerciseData
        .filter((_, i) => i !== exIndex)
        .map(e => e.exercise)
        .filter(Boolean),
      onSelect: (selected) => {
        const newEx = selected.find(e => !currentExIds.has(String(e._id)));
        if (newEx) replaceExercise(exIndex, newEx);
      },
    });
  };

  const addExercisesToSession = (exercises) => {
    const newItems = exercises
      .filter(ex => !exerciseData.some(e => String(e.exercise?._id ?? e.exercise) === String(ex._id)))
      .map(ex => ({
        exercise: ex,
        repMode: ex.category === 'cardio' ? 'cardio' : 'reps',
        note: '',
        sets: buildInitialSets([], [], ex.category === 'cardio' ? 'cardio' : 'reps'),
      }));
    if (newItems.length > 0) {
      setExerciseData(prev => [...prev, ...newItems]);
    }
  };

  const handleAddExercise = () => {
    navigation.navigate('ExercisePicker', {
      selectedExercises: exerciseData.map(e => e.exercise).filter(Boolean),
      onSelect: addExercisesToSession,
    });
  };

  const hasChanges = () => {
    const snap = originalSnapshotRef.current;
    if (!snap) return false;
    const currentIds    = exerciseData.map(e => String(e.exercise?._id ?? e.exercise));
    const currentCounts = exerciseData.map(e => e.sets.length);
    if (currentIds.length !== snap.exerciseIds.length) return true;
    if (currentIds.some((id, i) => id !== snap.exerciseIds[i])) return true;
    if (currentCounts.some((c, i) => c !== snap.setCounts[i])) return true;
    return false;
  };

  const handleFinish = () => {
    Alert.alert(
      'Finalizar entrenamiento',
      '¿Quieres guardar esta sesión?',
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Guardar', style: 'default', onPress: () => {
          if (hasChanges()) {
            Alert.alert(
              'Cambios detectados',
              'Has añadido o modificado ejercicios/series respecto a la plantilla original. ¿Quieres actualizar la plantilla con estos cambios?',
              [
                { text: 'No', style: 'cancel', onPress: () => saveSession(false) },
                { text: 'Actualizar plantilla', style: 'default', onPress: () => saveSession(true) },
              ]
            );
          } else {
            saveSession(false);
          }
        }},
      ]
    );
  };

  const saveSession = async (updateTemplate = false) => {
    try {
      setSaving(true);
      savingRef.current = true;
      clearInterval(timerRef.current);

      if (updateTemplate) {
        const templatePayload = {
          exercises: exerciseData.map((item, idx) => ({
            exerciseId: item.exercise?._id ?? item.exercise,
            order: idx,
            repMode: item.repMode,
            note: item.note || '',
            sets: item.sets.map(s => {
              if (item.repMode === 'cardio') {
                return { km: parseFloat(s.km_default) || 0, h: s.h ?? 0, m: s.m ?? 0, s: s.s ?? 0 };
              }
              return {
                kg:  parseFloat(s.weight_default) || 0,
                reps: parseInt(s.reps_default)    || 0,
                rir:  parseInt(s.rir_default)     || 0,
              };
            }),
          })),
        };
        await trainingService.updateTraining(trainingId, templatePayload);
      }

      const payload = {
        trainingId,
        duration: elapsedSeconds,
        ...(scheduledDate && { date: new Date(`${scheduledDate}T12:00:00`).toISOString() }),
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
      discardSession();
      Alert.alert('¡Genial!', 'Sesión guardada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setSaving(false);
      savingRef.current = false;
      Alert.alert('Error', 'No se pudo guardar la sesión');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B0000" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#EAEAEA" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{trainingName}</Text>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color="#8B0000" />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.finishBtn, saving && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#EAEAEA" />
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
          ListFooterComponent={
            <TouchableOpacity style={styles.addExerciseBtn} onPress={handleAddExercise}>
              <Ionicons name="add-circle-outline" size={20} color="#8B0000" />
              <Text style={styles.addExerciseBtnText}>Añadir ejercicio</Text>
            </TouchableOpacity>
          }
          renderItem={({ item, index: exIndex }) => (            <ExerciseBlock
              item={item}
              exIndex={exIndex}
              updateSet={updateSet}
              toggleComplete={toggleComplete}
              addSet={addSet}
              removeSet={removeSet}
              removeExercise={removeExercise}
              onReplacePress={() => handleReplaceExerciseInSession(exIndex)}
              onOpenTiempo={(setIndex) => setTiempoTarget({ exIndex, setIndex })}
              note={item.note}
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

function ExerciseBlock({ item, exIndex, updateSet, toggleComplete, addSet, removeSet, removeExercise, onReplacePress, onOpenTiempo, note }) {
  const exercise = item.exercise;
  const repMode  = item.repMode ?? 'reps';
  const primaryMuscle = exercise?.primaryMuscles?.[0];
  const [menuVisible, setMenuVisible] = useState(false);

  const isCardio = repMode === 'cardio';
  const isRange  = repMode === 'range';

  const handleRemoveExercise = () => {
    setMenuVisible(false);
    Alert.alert(
      'Eliminar ejercicio',
      `¿Eliminar "${getExerciseName(exercise)}" de la sesión?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeExercise(exIndex) },
      ]
    );
  };

  return (
    <View style={styles.exCard}>
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{getExerciseName(exercise)}</Text>
          <Text style={styles.exMeta}>
            {primaryMuscle ? MUSCLE_LABELS[primaryMuscle] ?? primaryMuscle : ''}
            {exercise?.category ? `  ·  ${CATEGORY_LABELS[exercise.category] ?? exercise.category}` : ''}
          </Text>
          {!!note && (
            <Text style={styles.exNote}>{note}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingLeft: 8 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#6A6A6A" />
        </TouchableOpacity>
      </View>

      {/* Exercise context menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        />
        <View style={styles.exMenu}>
          <TouchableOpacity
            style={styles.exMenuItem}
            onPress={() => { setMenuVisible(false); if (onReplacePress) onReplacePress(); }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#9A9A9A" />
            <Text style={styles.exMenuItemText}>Reemplazar ejercicio</Text>
          </TouchableOpacity>
          <View style={styles.exMenuDivider} />
          <TouchableOpacity style={styles.exMenuItem} onPress={handleRemoveExercise}>
            <Ionicons name="trash-outline" size={16} color="#CC3333" />
            <Text style={[styles.exMenuItemText, { color: '#CC3333' }]}>Eliminar ejercicio</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
        <Ionicons name="add-circle-outline" size={18} color="#8B0000" />
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
    <SwipeableSetRow onDelete={() => removeSet(exIndex, setIndex)}>
      <View style={[styles.setRow, set.completed && styles.setRowDone]}>
        <View style={[styles.colSet, styles.setNumBtn]}>
          <Text style={styles.setNum}>{setIndex + 1}</Text>
        </View>
        <Text style={[styles.colPrev, styles.prevText]}>{prevLabel}</Text>
        <TextInput
          style={[styles.colKg, styles.input]}
          value={set.weight}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'weight', v)}
          keyboardType="decimal-pad"
          placeholder={set.weight_default || '—'}
          placeholderTextColor="#6A6A6A"
        />
        <TextInput
          style={[styles.colReps, styles.input]}
          value={set.reps}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', v)}
          keyboardType="number-pad"
          placeholder={set.reps_default || '—'}
          placeholderTextColor="#6A6A6A"
        />
        <TextInput
          style={[styles.colRir, styles.input]}
          value={set.rir}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'rir', v)}
          keyboardType="number-pad"
          placeholder={set.rir_default || '—'}
          placeholderTextColor="#6A6A6A"
        />
        <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
          <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
            {set.completed && <Ionicons name="checkmark" size={14} color="#EAEAEA" />}
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableSetRow>
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
    <SwipeableSetRow onDelete={() => removeSet(exIndex, setIndex)}>
      <View style={[styles.setRow, set.completed && styles.setRowDone]}>
        <View style={[styles.colSet, styles.setNumBtn]}>
          <Text style={styles.setNum}>{setIndex + 1}</Text>
        </View>
        <Text style={[styles.colPrev, styles.prevText]}>{prevLabel}</Text>
        <TextInput
          style={[styles.colKm, styles.input]}
          value={set.km}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'km', v)}
          keyboardType="decimal-pad"
          placeholder={set.km_default || '—'}
          placeholderTextColor="#6A6A6A"
        />
        <TouchableOpacity
          style={[styles.colTiempo, styles.input, { alignItems: 'center', justifyContent: 'center' }]}
          onPress={onOpenTiempo}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: (set.h === 0 && set.m === 0 && set.s === 0) ? '#6A6A6A' : '#EAEAEA' }}>
            {tiempoLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
          <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
            {set.completed && <Ionicons name="checkmark" size={14} color="#EAEAEA" />}
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableSetRow>
  );
}

const SWIPE_WIDTH = 80;

function SwipeableSetRow({ children, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const next = Math.min(0, Math.max(-SWIPE_WIDTH, currentOffset.current + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const projected = currentOffset.current + g.dx;
        if (projected < -(SWIPE_WIDTH / 2)) {
          currentOffset.current = -SWIPE_WIDTH;
          Animated.spring(translateX, { toValue: -SWIPE_WIDTH, useNativeDriver: true }).start();
        } else {
          currentOffset.current = 0;
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        currentOffset.current = 0;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const close = () => {
    currentOffset.current = 0;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
  };

  return (
    <View style={swipeStyles.wrapper}>
      <View style={swipeStyles.deleteAction}>
        <TouchableOpacity style={swipeStyles.deleteBtn} onPress={() => { close(); onDelete(); }}>
          <Ionicons name="trash-outline" size={18} color="#EAEAEA" />
          <Text style={swipeStyles.deleteBtnText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: '#1F1F1F' }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: 4,
    overflow: 'hidden',
    borderRadius: 8,
  },
  deleteAction: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_WIDTH,
    backgroundColor: '#CC3333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtnText: {
    color: '#EAEAEA',
    fontSize: 11,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#EAEAEA' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  timerText: { fontSize: 12, color: '#8B0000', fontWeight: '600' },
  finishBtn: {
    backgroundColor: '#8B0000',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  finishBtnText: { color: '#EAEAEA', fontWeight: '700', fontSize: 14 },
  listContent: { padding: 16, gap: 16, paddingBottom: 40 },
  exCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  exHeader: { flexDirection: 'row', marginBottom: 12 },
  exName: { fontSize: 16, fontWeight: '700', color: '#EAEAEA', marginBottom: 2 },
  exMeta: { fontSize: 12, color: '#6A6A6A' },
  exNote: { fontSize: 12, color: '#8B0000', marginTop: 4, fontStyle: 'italic' },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  colLabel: { fontSize: 11, color: '#6A6A6A', fontWeight: '600', textAlign: 'center' },
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
    paddingHorizontal: 2,
  },
  setRowDone: { backgroundColor: '#0A1A0A' },
  setNumBtn: { alignItems: 'center', justifyContent: 'center' },
  setNum: { fontSize: 13, fontWeight: '700', color: '#8B0000' },
  prevText: { fontSize: 12, color: '#6A6A6A', textAlign: 'center' },
  rangeSep: { fontSize: 12, color: '#6A6A6A', fontWeight: '600' },
  input: {
    backgroundColor: '#181818',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#EAEAEA',
    textAlign: 'center',
    marginHorizontal: 2,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#333333',
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
    borderTopColor: '#252525',
  },
  addSetText: { fontSize: 13, color: '#8B0000', fontWeight: '600' },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginHorizontal: 0,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
  },
  addExerciseBtnText: {
    fontSize: 15,
    color: '#8B0000',
    fontWeight: '600',
  },
  // Drum picker
  drumSheet: {
    backgroundColor: '#1F1F1F',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 30,
  },
  drumHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#333333',
    alignSelf: 'center', marginBottom: 16,
  },
  drumTitle: {
    textAlign: 'center', fontSize: 16, fontWeight: '700',
    color: '#EAEAEA', marginBottom: 12,
  },
  drumLabel: {
    fontSize: 11, fontWeight: '700', color: '#6A6A6A',
    letterSpacing: 0.5, marginBottom: 4, textAlign: 'center',
  },
  drumItem:         { fontSize: 22, color: '#4A4A4A', fontWeight: '500' },
  drumItemSelected: { fontSize: 26, color: '#EAEAEA', fontWeight: '700' },
  drumConfirmBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: '#8B0000', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  drumConfirmText: { color: '#EAEAEA', fontSize: 16, fontWeight: '700' },

  // Exercise context menu
  exMenu: {
    position: 'absolute',
    right: 16,
    top: '30%',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 210,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  exMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  exMenuItemText: { fontSize: 14, color: '#EAEAEA' },
  exMenuDivider:  { height: 1, backgroundColor: '#333333', marginHorizontal: 8 },
});
