import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  AppState,
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
import { COLORS } from '../config/theme';

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
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.primaryBorder,
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
    if (repMode === 'time') {
      return {
        h:          tmpl.h ?? 0,
        m:          tmpl.m ?? 0,
        s:          tmpl.s ?? 0,
        completed:  false,
        prev_h:     last?.h  ?? null,
        prev_m:     last?.m  ?? null,
        prev_s:     last?.s  ?? null,
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
      rpe:             '',
      rpe_default:     String(tmpl.rpe ?? ''),
      completed:       false,
      prev_weight: last?.weight ?? null,
      prev_reps:   last?.reps   ?? null,
      prev_rpe:    last?.rpe    ?? null,
    };
  });
}

export default function ActiveSessionScreen({ route, navigation }) {
  const { trainingId, trainingName, scheduledDate } = route.params;
  const { session: activeSession, saveSession: saveToContext, discardSession } = useActiveSession();
  const restoredSession = activeSession?.trainingId === trainingId ? activeSession : null;

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
  const prevSessionRef    = useRef(null);
  const histPrMapRef      = useRef({});
  const startTimestampRef = useRef(restoredSession?.startTimestamp ?? Date.now());
  const appStateRef       = useRef(AppState.currentState);

  // Keep refs in sync with state so cleanup/unmount always has latest values
  useEffect(() => { exerciseDataRef.current   = exerciseData;   }, [exerciseData]);

  const syncElapsedTime = () => {
    const elapsed = Math.max(0, Math.round((Date.now() - startTimestampRef.current) / 1000));
    setElapsedSeconds(elapsed);
    return elapsed;
  };

  useEffect(() => {
    const isRestoring = restoredSession != null;
    const isFreeSession = !trainingId;

    if (isRestoring) {
      // Restore exercise data and recompute elapsed time from stored timestamp
      startTimestampRef.current = restoredSession.startTimestamp;
      setExerciseData(restoredSession.exerciseData);
      syncElapsedTime();
      setLoading(false);
      // Load training metadata and rebuild snapshot (only for template-based sessions)
      if (trainingId) {
        trainingService.getTrainingById(trainingId).then(r => {
          setTraining(r.data);
          originalSnapshotRef.current = {
            exerciseIds: (r.data.exercises || []).map(e => String(e.exerciseId?._id ?? e.exerciseId)),
            setCounts:   (r.data.exercises || []).map(e => e.sets?.length ?? 0),
          };
        }).catch(() => {});
      } else {
        originalSnapshotRef.current = { exerciseIds: [], setCounts: [] };
      }
    } else if (isFreeSession) {
      // Blank session — no template to load, start immediately
      startTimestampRef.current = Date.now();
      originalSnapshotRef.current = { exerciseIds: [], setCounts: [] };
      setLoading(false);
      // Save immediately so the banner appears even before exercises are added
      saveToContext({
        trainingId,
        trainingName,
        exerciseData: [],
        startTimestamp: startTimestampRef.current,
      });
    } else {
      startTimestampRef.current = Date.now();
      loadSession();
    }

    timerRef.current = setInterval(syncElapsedTime, 1000);

    // Auto-save each 10 s as crash insurance
    const autoSaveInterval = setInterval(() => {
      if (!savingRef.current && (exerciseDataRef.current.length > 0 || isFreeSession)) {
        saveToContext({
          trainingId,
          trainingName,
          exerciseData: exerciseDataRef.current,
          startTimestamp: startTimestampRef.current,
        });
      }
    }, 10000);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextAppState;

      if (nextAppState === 'active') {
        syncElapsedTime();
        return;
      }

      if (wasActive && (exerciseDataRef.current.length > 0 || isFreeSession) && !savingRef.current) {
        saveToContext({
          trainingId,
          trainingName,
          exerciseData: exerciseDataRef.current,
          startTimestamp: startTimestampRef.current,
        });
      }
    });

    return () => {
      clearInterval(timerRef.current);
      clearInterval(autoSaveInterval);
      appStateSubscription.remove();
      // Save session to context on unmount (back press, tab switch, etc.)
      // unless the user explicitly finished and saved to the server.
      if (!savingRef.current && (exerciseDataRef.current.length > 0 || isFreeSession)) {
        saveToContext({
          trainingId,
          trainingName,
          exerciseData: exerciseDataRef.current,
          startTimestamp: startTimestampRef.current,
        });
      }
    };
  }, []);

  const loadSession = async () => {
    try {
      setLoading(true);
      const [trainingResult, lastSessionResult, histMaxesResult] = await Promise.all([
        trainingService.getTrainingById(trainingId),
        sessionService.getLastSession(trainingId).catch(() => null),
        sessionService.getExerciseMaxes(trainingId).catch(() => null),
      ]);
      const trainingData = trainingResult.data;
      setTraining(trainingData);

      const lastSession = lastSessionResult?.data || null;
      prevSessionRef.current = lastSession;
      histPrMapRef.current = histMaxesResult?.data || {};
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
          exercise:     item.exerciseId,
          repMode,
          phase:        item.phase ?? 'main',
          supersetGroup: item.supersetGroup ?? null,
          note:         item.note || '',
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
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const updateSet = (exIndex, setIndex, fieldOrObj, value) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const sets = [...updated[exIndex].sets];
      const updates = typeof fieldOrObj === 'object' ? fieldOrObj : { [fieldOrObj]: value };
      const merged = { ...sets[setIndex], ...updates };

      // Auto-marcar el check cuando los campos clave están rellenos
      if (!merged.completed) {
        const repMode = updated[exIndex].repMode;
        const autoComplete =
          repMode === 'cardio'
            ? merged.km !== ''
            : repMode === 'time'
              ? (merged.h > 0 || merged.m > 0 || merged.s > 0)
              : merged.weight !== '' && merged.reps !== '';
        if (autoComplete) merged.completed = true;
      }

      sets[setIndex] = merged;
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

      let filled = {};
      if (completing) {
        const repMode = updated[exIndex].repMode;

        // Prioridad: valor escrito por el usuario → registro sesión anterior → plantilla
        const weight = set.weight
          || (set.prev_weight != null ? String(set.prev_weight) : '')
          || set.weight_default
          || '';

        // Para range sin registro previo se usa el límite superior (p.ej. "8-12" → "12")
        let repsDefault = set.reps_default || '';
        if (repMode === 'range' && !set.prev_reps && repsDefault.includes('-')) {
          repsDefault = repsDefault.split('-').pop();
        }
        const reps = set.reps
          || (set.prev_reps != null ? String(set.prev_reps) : '')
          || repsDefault
          || '';

        const rpe = set.rpe
          || (set.prev_rpe != null ? String(set.prev_rpe) : '')
          || set.rpe_default
          || '';

        const km = set.km
          || (set.prev_km != null ? String(set.prev_km) : '')
          || set.km_default
          || '';

        filled = { weight, reps, rpe, km };
      }

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
      const effectiveRpe    = lastSet?.rpe    || lastSet?.rpe_default    || '';
      const newSet   = item.repMode === 'cardio'
        ? { km: '', km_default: effectiveKm, h: lastSet?.h ?? 0, m: lastSet?.m ?? 0, s: lastSet?.s ?? 0, completed: false, prev_km: null, prev_h: null, prev_m: null, prev_s: null }
        : item.repMode === 'time'
          ? { h: lastSet?.h ?? 0, m: lastSet?.m ?? 0, s: lastSet?.s ?? 0, completed: false, prev_h: null, prev_m: null, prev_s: null }
          : { weight: '', weight_default: effectiveWeight, reps: '', reps_default: effectiveReps, rpe: '', rpe_default: effectiveRpe, completed: false, prev_weight: null, prev_reps: null, prev_rpe: null };
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

  const moveExercise = (exIndex, direction) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const targetIndex = direction === 'up' ? exIndex - 1 : exIndex + 1;
      if (targetIndex < 0 || targetIndex >= updated.length) return prev;
      [updated[exIndex], updated[targetIndex]] = [updated[targetIndex], updated[exIndex]];
      return updated;
    });
  };

  const replaceExercise = (exIndex, newExercise) => {
    setExerciseData((prev) => {
      const updated = [...prev];
      const old = updated[exIndex];
      const repMode = newExercise.category === 'cardio' ? 'cardio' : 'reps';
      const newSets = Array.from({ length: old.sets.length }, () =>
        repMode === 'cardio'
          ? { km: '', km_default: '', h: 0, m: 0, s: 0, completed: false, prev_km: null, prev_h: null, prev_m: null, prev_s: null }
          : { weight: '', weight_default: '', reps: '', reps_default: '', rpe: '', rpe_default: '', completed: false, prev_weight: null, prev_reps: null, prev_rpe: null }
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
    const isFreeSession = !trainingId;
    Alert.alert(
      'Finalizar entrenamiento',
      '¿Quieres guardar esta sesión?',
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Guardar', style: 'default', onPress: () => {
          // Free sessions have no template to update
          if (!isFreeSession && hasChanges()) {
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
      const sessionDuration = syncElapsedTime();

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
              if (item.repMode === 'time') {
                return { h: s.h ?? 0, m: s.m ?? 0, s: s.s ?? 0 };
              }
              return {
                kg:  parseFloat(s.weight_default) || 0,
                reps: parseInt(s.reps_default)    || 0,
                rpe:  parseInt(s.rpe_default)     || 0,
              };
            }),
          })),
        };
        await trainingService.updateTraining(trainingId, templatePayload);
      }

      const payload = {
        ...(trainingId && { trainingId }),
        duration: sessionDuration,
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
            if (item.repMode === 'time') {
              const userEdited = s.h > 0 || s.m > 0 || s.s > 0;
              return {
                h:         userEdited ? s.h ?? 0 : 0,
                m:         userEdited ? s.m ?? 0 : 0,
                s:         userEdited ? s.s ?? 0 : 0,
                completed: s.completed && userEdited,
              };
            }
            const userEdited = s.weight !== '' || s.reps !== '' || s.rpe !== '';
            return {
              weight:    userEdited ? parseFloat(s.weight) || 0 : 0,
              reps:      userEdited ? parseInt(s.reps)     || 0 : 0,
              rpe:       userEdited ? parseInt(s.rpe)      || 0 : 0,
              completed: s.completed && userEdited,
            };
          }),
        })),
        notes: '',
      };

      await sessionService.createSession(payload);
      discardSession();
      navigation.replace('PostSession', {
        trainingName,
        duration: sessionDuration,
        exerciseData,
        prevSession: prevSessionRef.current,
        histPrMap: histPrMapRef.current,
      });
    } catch (err) {
      setSaving(false);
      savingRef.current = false;
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Error desconocido';
      Alert.alert('Error al guardar', detail);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primaryDark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{trainingName}</Text>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color={COLORS.primaryDark} />
            <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.finishBtn, saving && { opacity: 0.6 }]}
          onPress={handleFinish}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={COLORS.textPrimary} />
            : <Text style={styles.finishBtnText}>Finalizar</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={exerciseData}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          ListEmptyComponent={
            <TouchableOpacity
              style={styles.emptySessionCta}
              onPress={handleAddExercise}
              activeOpacity={0.8}
            >
              <Ionicons name="barbell-outline" size={40} color={COLORS.gold} />
              <Text style={styles.emptySessionCtaTitle}>Sesión vacía</Text>
              <Text style={styles.emptySessionCtaText}>Pulsa para añadir tu primer ejercicio</Text>
            </TouchableOpacity>
          }
          ListFooterComponent={
            <TouchableOpacity style={styles.addExerciseBtn} onPress={handleAddExercise}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primaryDark} />
              <Text style={styles.addExerciseBtnText}>Añadir ejercicio</Text>
            </TouchableOpacity>
          }
          renderItem={({ item, index: exIndex }) => (            <ExerciseBlock
              item={item}
              exIndex={exIndex}
              totalExercises={exerciseData.length}
              updateSet={updateSet}
              toggleComplete={toggleComplete}
              addSet={addSet}
              removeSet={removeSet}
              removeExercise={removeExercise}
              onMoveUp={exIndex > 0 ? () => moveExercise(exIndex, 'up') : null}
              onMoveDown={exIndex < exerciseData.length - 1 ? () => moveExercise(exIndex, 'down') : null}
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

const ExerciseBlock = memo(function ExerciseBlock({ item, exIndex, totalExercises, updateSet, toggleComplete, addSet, removeSet, removeExercise, onMoveUp, onMoveDown, onReplacePress, onOpenTiempo, note }) {
  const exercise = item.exercise;
  const repMode  = item.repMode ?? 'reps';
  const phase    = item.phase ?? 'main';
  const supersetGroup = item.supersetGroup ?? null;
  const primaryMuscle = exercise?.primaryMuscles?.[0];
  const [menuVisible, setMenuVisible] = useState(false);

  const isCardio = repMode === 'cardio';
  const isTime   = repMode === 'time';
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
          {(phase !== 'main' || supersetGroup) && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {phase === 'warmup' && (
                <View style={styles.phaseBadge}>
                  <Text style={styles.phaseBadgeText}>🔥 Calentamiento</Text>
                </View>
              )}
              {phase === 'cooldown' && (
                <View style={[styles.phaseBadge, { backgroundColor: 'rgba(99,179,237,0.15)' }]}>
                  <Text style={[styles.phaseBadgeText, { color: '#63b3ed' }]}>❄️ Vuelta a la calma</Text>
                </View>
              )}
              {supersetGroup && (
                <View style={[styles.phaseBadge, { backgroundColor: 'rgba(139,0,0,0.18)' }]}>
                  <Text style={[styles.phaseBadgeText, { color: COLORS.primaryDark }]}>⚡ Superserie</Text>
                </View>
              )}
            </View>
          )}
          {!!note && (
            <Text style={styles.exNote}>{note}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingLeft: 8 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textMuted} />
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
          {onMoveUp && (
            <>
              <TouchableOpacity
                style={styles.exMenuItem}
                onPress={() => { setMenuVisible(false); onMoveUp(); }}
              >
                <Ionicons name="arrow-up-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.exMenuItemText}>Mover arriba</Text>
              </TouchableOpacity>
              <View style={styles.exMenuDivider} />
            </>
          )}
          {onMoveDown && (
            <>
              <TouchableOpacity
                style={styles.exMenuItem}
                onPress={() => { setMenuVisible(false); onMoveDown(); }}
              >
                <Ionicons name="arrow-down-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.exMenuItemText}>Mover abajo</Text>
              </TouchableOpacity>
              <View style={styles.exMenuDivider} />
            </>
          )}
          <TouchableOpacity
            style={styles.exMenuItem}
            onPress={() => { setMenuVisible(false); if (onReplacePress) onReplacePress(); }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.exMenuItemText}>Reemplazar ejercicio</Text>
          </TouchableOpacity>
          <View style={styles.exMenuDivider} />
          <TouchableOpacity style={styles.exMenuItem} onPress={handleRemoveExercise}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.exMenuItemText, { color: COLORS.danger }]}>Eliminar ejercicio</Text>
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
      ) : isTime ? (
        <View style={styles.tableHeader}>
          <Text style={[styles.colLabel, styles.colSet]}>SERIE</Text>
          <Text style={[styles.colLabel, styles.colPrev]}>ANTERIOR</Text>
          <Text style={[styles.colLabel, styles.colTiempo]}>TIEMPO</Text>
          <Text style={[styles.colLabel, styles.colDone]}></Text>
        </View>
      ) : (
        <View style={styles.tableHeader}>
          <Text style={[styles.colLabel, styles.colSet]}>SERIE</Text>
          <Text style={[styles.colLabel, styles.colPrev]}>ANTERIOR</Text>
          <Text style={[styles.colLabel, styles.colKg]}>KG</Text>
          <Text style={[styles.colLabel, styles.colReps]}>REPS</Text>
          <Text style={[styles.colLabel, styles.colRpe]}>RPE</Text>
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
        ) : isTime ? (
          <TimeSetRow
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
        <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
});

// ── OverlayInput: muestra el valor por defecto aunque el campo tenga foco ──
function OverlayInput({ colStyle, inputStyle, defaultVal, value, ...rest }) {
  const showOverlay = value === '' && defaultVal != null && String(defaultVal) !== '';
  return (
    <View style={[colStyle, { position: 'relative' }]}>
      {showOverlay && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textMuted, textAlign: 'center' }}>
            {String(defaultVal)}
          </Text>
        </View>
      )}
      <TextInput
        style={[inputStyle, { width: '100%' }]}
        value={value}
        placeholder=""
        {...rest}
      />
    </View>
  );
}

const SetRow = memo(function SetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet }) {
  let prevLabel = '—';
  if (set.prev_weight != null && set.prev_reps != null) {
    prevLabel = `${set.prev_weight}kg × ${set.prev_reps}`;
    if (set.prev_rpe != null) prevLabel += ` RPE${set.prev_rpe}`;
  }

  return (
    <SwipeableSetRow onDelete={() => removeSet(exIndex, setIndex)}>
      <View style={[styles.setRow, set.completed && styles.setRowDone]}>
        <View style={[styles.colSet, styles.setNumBtn]}>
          <Text style={styles.setNum}>{setIndex + 1}</Text>
        </View>
        <Text style={[styles.colPrev, styles.prevText]}>{prevLabel}</Text>
        <OverlayInput
          colStyle={styles.colKg}
          inputStyle={styles.input}
          value={set.weight}
          defaultVal={set.weight_default}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'weight', v)}
          keyboardType="decimal-pad"
        />
        <OverlayInput
          colStyle={styles.colReps}
          inputStyle={styles.input}
          value={set.reps}
          defaultVal={set.reps_default}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', v)}
          keyboardType="number-pad"
        />
        <OverlayInput
          colStyle={styles.colRpe}
          inputStyle={styles.input}
          value={set.rpe}
          defaultVal={set.rpe_default}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'rpe', v)}
          keyboardType="number-pad"
        />
        <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
          <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
            {set.completed && <Ionicons name="checkmark" size={14} color={COLORS.textPrimary} />}
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableSetRow>
  );
});

const CardioSetRow = memo(function CardioSetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet, onOpenTiempo }) {
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
        <OverlayInput
          colStyle={styles.colKm}
          inputStyle={styles.input}
          value={set.km}
          defaultVal={set.km_default}
          onChangeText={(v) => updateSet(exIndex, setIndex, 'km', v)}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[styles.colTiempo, styles.input, { alignItems: 'center', justifyContent: 'center' }]}
          onPress={onOpenTiempo}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: (set.h === 0 && set.m === 0 && set.s === 0) ? COLORS.textMuted : COLORS.textPrimary }}>
            {tiempoLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
          <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
            {set.completed && <Ionicons name="checkmark" size={14} color={COLORS.textPrimary} />}
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableSetRow>
  );
});

const TimeSetRow = memo(function TimeSetRow({ set, setIndex, exIndex, updateSet, toggleComplete, removeSet, onOpenTiempo }) {
  const hasPrev = set.prev_h != null || set.prev_m != null || set.prev_s != null;
  const prevLabel = hasPrev
    ? `${String(set.prev_h ?? 0).padStart(2,'0')}:${String(set.prev_m ?? 0).padStart(2,'0')}:${String(set.prev_s ?? 0).padStart(2,'00')}`
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
        <TouchableOpacity
          style={[styles.colTiempo, styles.input, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}
          onPress={onOpenTiempo}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: (set.h === 0 && set.m === 0 && set.s === 0) ? COLORS.textMuted : COLORS.textPrimary }}>
            {tiempoLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.colDone} onPress={() => toggleComplete(exIndex, setIndex)}>
          <View style={[styles.checkCircle, set.completed && styles.checkCircleDone]}>
            {set.completed && <Ionicons name="checkmark" size={14} color={COLORS.textPrimary} />}
          </View>
        </TouchableOpacity>
      </View>
    </SwipeableSetRow>
  );
});

const SWIPE_WIDTH = 80;

const SwipeableSetRow = memo(function SwipeableSetRow({ children, onDelete }) {
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
          <Ionicons name="trash-outline" size={18} color={COLORS.textPrimary} />
          <Text style={swipeStyles.deleteBtnText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: COLORS.surface }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
});

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
    backgroundColor: COLORS.danger,
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
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
    gap: 10,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  timerText: { fontSize: 14, color: COLORS.primaryDark, fontWeight: '600' },
  finishBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  finishBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  listContent: { padding: 16, gap: 16, paddingBottom: 120 },
  exCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  exHeader: { flexDirection: 'row', marginBottom: 12 },
  exName: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  exMeta: { fontSize: 14, color: COLORS.textMuted },
  exNote: { fontSize: 14, color: COLORS.primaryDark, marginTop: 4, fontStyle: 'italic' },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255,165,0,0.15)',
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffa500',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  colLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', textAlign: 'center' },
  // Columnas fuerza
  colSet:      { width: 37 },
  colPrev:     { flex: 1, textAlign: 'center' },
  colKg:       { width: 56, textAlign: 'center' },
  colReps:     { width: 52, textAlign: 'center' },
  colRepsRange:{ width: 96, textAlign: 'center' },
  colRpe:      { width: 44, textAlign: 'center' },
  colDone:     { width: 37, alignItems: 'center' },
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
  setRowDone: { backgroundColor: COLORS.successBg },
  setNumBtn: { alignItems: 'center', justifyContent: 'center' },
  setNum: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
  prevText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  rangeSep: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleDone: { borderColor: COLORS.success, backgroundColor: COLORS.success },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceDeep,
  },
  addSetText: { fontSize: 15, color: COLORS.primaryDark, fontWeight: '600' },
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
    borderColor: COLORS.borderInner,
    borderStyle: 'dashed',
  },
  addExerciseBtnText: {
    fontSize: 17,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  emptySessionCta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptySessionCtaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySessionCtaText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  // Drum picker
  drumSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 30,
  },
  drumHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  drumTitle: {
    textAlign: 'center', fontSize: 18, fontWeight: '700',
    color: COLORS.textPrimary, marginBottom: 12,
  },
  drumLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.5, marginBottom: 4, textAlign: 'center',
  },
  drumItem:         { fontSize: 24, color: COLORS.iconInactive, fontWeight: '500' },
  drumItemSelected: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '700' },
  drumConfirmBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: COLORS.primaryDark, borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  drumConfirmText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },

  // Exercise context menu
  exMenu: {
    position: 'absolute',
    right: 16,
    top: '30%',
    backgroundColor: COLORS.surface,
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
  exMenuItemText: { fontSize: 16, color: COLORS.textPrimary },
  exMenuDivider:  { height: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
});
