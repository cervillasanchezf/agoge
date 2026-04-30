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
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { trainingService } from '../services/api';
import { getExerciseName, CATEGORY_LABELS, MUSCLE_LABELS } from '../config/translations';
import { COLORS } from '../config/theme';

const DEFAULT_SET = { kg: '', reps: '', repsTo: '', rpe: '' };
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
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#5A0000',
          backgroundColor: 'rgba(139,0,0,0.1)', borderRadius: 6,
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
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
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

export default function NewTrainningScreen({ navigation, route }) {
  const { user } = useAuth();
  const editTraining = route.params?.editTraining ?? null;

  const [trainingName, setTrainingName] = useState(() => editTraining?.name ?? '');
  const [exercises, setExercises] = useState(() => {
    if (!editTraining) return [];
    return editTraining.exercises.map(e => e.exerciseId);
  });
  const [exerciseConfigs, setExerciseConfigs] = useState(() => {
    if (!editTraining) return {};
    const configs = {};
    editTraining.exercises.forEach(e => {
      const exId = e.exerciseId._id;
      configs[exId] = {
        repMode: e.repMode || 'reps',
        sets: e.sets && e.sets.length > 0 ? e.sets : [e.repMode === 'cardio' ? { ...DEFAULT_CARDIO_SET } : { ...DEFAULT_SET }],
      };
    });
    return configs;
  });
  const [exerciseNotes, setExerciseNotes] = useState(() => {
    if (!editTraining) return {};
    const notes = {};
    editTraining.exercises.forEach(e => {
      if (e.note) notes[e.exerciseId._id] = e.note;
    });
    return notes;
  });
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [tiempoTarget, setTiempoTarget] = useState(null);
  const [exMenuVisible, setExMenuVisible] = useState(false);
  const [exMenuId, setExMenuId] = useState(null);
  const [exMenuPos, setExMenuPos] = useState({ x: 0, y: 0 });
  const [supersets, setSupersets] = useState({});
  const [supersetPickerForId, setSupersetPickerForId] = useState(null);
  const [supersetPickerSelected, setSupersetPickerSelected] = useState([]);
  const supersetGroupCounter = useRef(0);

  // ─── Drag & Drop ────────────────────────────────────────────────────────────
  const exercisesRef = useRef(exercises);
  useEffect(() => { exercisesRef.current = exercises; }, [exercises]);

  const [activeDragId, setActiveDragId] = useState(null);
  const activeDragIdRef = useRef(null);
  const [dropTargetIdx, setDropTargetIdx] = useState(null);
  const dropTargetIdxRef = useRef(null);

  const ghostY = useRef(new Animated.Value(0)).current;
  const ghostInitY = useRef(0);
  const cardViewRefs = useRef({});
  const cardHeightsRef = useRef({});
  const boundaryMids = useRef([]);
  const panRespCache = useRef({});
  const scrollViewRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const autoScrollRef = useRef(null);
  const currentMoveYRef = useRef(0);

  const SCROLL_ZONE = 120; // px desde el borde que activa el auto-scroll
  const SCROLL_SPEED = 8;  // px por tick
  const SCROLL_INTERVAL = 16; // ms (~60fps)

  const startAutoScroll = () => {
    if (autoScrollRef.current) return;
    autoScrollRef.current = setInterval(() => {
      const screenH = Dimensions.get('window').height;
      const my = currentMoveYRef.current;
      let delta = 0;
      if (my > screenH - SCROLL_ZONE) {
        delta = SCROLL_SPEED * ((my - (screenH - SCROLL_ZONE)) / SCROLL_ZONE + 1);
      } else if (my < SCROLL_ZONE) {
        delta = -SCROLL_SPEED * ((SCROLL_ZONE - my) / SCROLL_ZONE + 1);
      }
      if (delta !== 0 && scrollViewRef.current) {
        const newOffset = Math.max(0, scrollOffsetRef.current + delta);
        scrollViewRef.current.scrollTo({ y: newOffset, animated: false });
        scrollOffsetRef.current = newOffset;
        // Los cards se mueven en pantalla: actualiza los midpoints de referencia
        boundaryMids.current = boundaryMids.current.map(y => y - delta);
      }
    }, SCROLL_INTERVAL);
  };

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const buildBoundaries = (draggedId, draggedPageY) => {
    const exList = exercisesRef.current;
    const draggedIdx = exList.findIndex(e => e._id === draggedId);
    const GAP = 10;
    const heights = exList.map(ex => cardHeightsRef.current[ex._id] || 80);
    const absYs = Array(exList.length);
    absYs[draggedIdx] = draggedPageY;
    for (let i = draggedIdx - 1; i >= 0; i--) {
      absYs[i] = absYs[i + 1] - heights[i] - GAP;
    }
    for (let i = draggedIdx + 1; i < exList.length; i++) {
      absYs[i] = absYs[i - 1] + heights[i - 1] + GAP;
    }
    boundaryMids.current = absYs.map((y, i) => y + heights[i] / 2);
  };

  const getDropIndex = (dy) => {
    const draggedId = activeDragIdRef.current;
    const draggedH = cardHeightsRef.current[draggedId] || 80;
    const draggedMid = ghostInitY.current + dy + draggedH / 2;
    const mids = boundaryMids.current;
    for (let i = 0; i < mids.length; i++) {
      if (draggedMid < mids[i] + 20) return i;
    }
    return exercisesRef.current.length;
  };

  const getPanResponder = (id) => {
    if (!panRespCache.current[id]) {
      panRespCache.current[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const viewRef = cardViewRefs.current[id];
          if (!viewRef) return;
          viewRef.measure((fx, fy, w, h, px, py) => {
            ghostInitY.current = py;
            ghostY.setValue(0);
            buildBoundaries(id, py);
            activeDragIdRef.current = id;
            setActiveDragId(id);
            const idx = exercisesRef.current.findIndex(e => e._id === id);
            dropTargetIdxRef.current = idx;
            setDropTargetIdx(idx);
          });
        },
        onPanResponderMove: (evt, gs) => {
          currentMoveYRef.current = evt.nativeEvent.pageY;
          ghostY.setValue(gs.dy);
          startAutoScroll();
          const newIdx = getDropIndex(gs.dy);
          if (newIdx !== dropTargetIdxRef.current) {
            dropTargetIdxRef.current = newIdx;
            setDropTargetIdx(newIdx);
          }
        },
        onPanResponderRelease: (_, gs) => {
          stopAutoScroll();
          const exList = exercisesRef.current;
          const fromIdx = exList.findIndex(e => e._id === id);
          const toIdx = dropTargetIdxRef.current ?? fromIdx;
          activeDragIdRef.current = null;
          setActiveDragId(null);
          setDropTargetIdx(null);
          ghostY.setValue(0);
          if (fromIdx !== toIdx) {
            setExercises(prev => {
              const next = [...prev];
              const [item] = next.splice(fromIdx, 1);
              next.splice(toIdx, 0, item);
              return next;
            });
          }
        },
        onPanResponderTerminate: () => {
          stopAutoScroll();
          activeDragIdRef.current = null;
          setActiveDragId(null);
          setDropTargetIdx(null);
          ghostY.setValue(0);
        },
      });
    }
    return panRespCache.current[id];
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleAddExercise = () => {
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
        setExerciseNotes(prev => {
          const next = { ...prev };
          newOnes.forEach(ex => { if (!(ex._id in next)) next[ex._id] = ''; });
          return next;
        });
      },
    });
  };

  const handleRemoveExercise = (id) => {
    setExercises(prev => prev.filter(e => e._id !== id));
    setExerciseNotes(prev => { const next = { ...prev }; delete next[id]; return next; });
    setExerciseConfigs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSupersets(prev => {
      const next = { ...prev };
      const groupId = next[id];
      delete next[id];
      if (groupId) {
        const remaining = Object.entries(next).filter(([, g]) => g === groupId);
        if (remaining.length === 1) next[remaining[0][0]] = null;
      }
      return next;
    });
  };

  const handleOpenExMenu = (id, event) => {
    setExMenuId(id);
    setExMenuPos({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
    setExMenuVisible(true);
  };

  const handleReplaceExercise = (id) => {
    const remainingExercises = exercises.filter(e => e._id !== id);
    const remainingIds = new Set(remainingExercises.map(e => e._id));
    navigation.navigate('ExercisePicker', {
      selectedExercises: remainingExercises,
      onSelect: (selected) => {
        const newEx = selected.find(e => !remainingIds.has(e._id));
        if (!newEx) return;
        const oldConfig = exerciseConfigs[id];
        setExercises(prev => prev.map(e => e._id === id ? newEx : e));
        setExerciseConfigs(prev => {
          const next = { ...prev };
          next[newEx._id] = newEx.category === 'cardio' ? initCardioConfig() : { ...oldConfig };
          delete next[id];
          return next;
        });
        setExerciseNotes(prev => {
          const next = { ...prev };
          next[newEx._id] = next[id] || '';
          delete next[id];
          return next;
        });
        setSupersets(prev => {
          const next = { ...prev };
          const groupId = next[id];
          if (groupId) next[newEx._id] = groupId;
          delete next[id];
          return next;
        });
      },
    });
  };

  const toggleSupersetSelection = (id) => {
    setSupersetPickerSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleApplySuperset = (sourceId) => {
    if (supersetPickerSelected.length === 0) {
      // Remove from existing superset if any
      setSupersets(prev => {
        const next = { ...prev };
        const groupId = next[sourceId];
        next[sourceId] = null;
        if (groupId) {
          const remaining = Object.entries(next).filter(([, g]) => g === groupId);
          if (remaining.length === 1) next[remaining[0][0]] = null;
        }
        return next;
      });
    } else {
      setSupersets(prev => {
        const existing = prev[sourceId];
        const groupId = existing || `ss_${++supersetGroupCounter.current}`;
        const next = { ...prev };
        next[sourceId] = groupId;
        supersetPickerSelected.forEach(id => { next[id] = groupId; });
        return next;
      });
    }
    setSupersetPickerForId(null);
    setSupersetPickerSelected([]);
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

  const removeSet = (exerciseId, setIdx) => {
    setExerciseConfigs(prev => {
      const config = prev[exerciseId];
      if (config.sets.length <= 1) return prev;
      const sets = config.sets.filter((_, i) => i !== setIdx);
      return { ...prev, [exerciseId]: { ...config, sets } };
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
      setNameError(true);
      return;
    }
    setNameError(false);
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
            note: exerciseNotes[ex._id] || '',
          };
        }),
      };
      if (editTraining?._id) {
        const result = await trainingService.updateTraining(editTraining._id, payload);
        if (result.success) {
          navigation.goBack();
        } else {
          Alert.alert('Error', result.message || 'Error al actualizar el entrenamiento');
        }
      } else {
        const result = await trainingService.createTraining(payload);
        if (result.success) {
          navigation.goBack();
        } else {
          Alert.alert('Error', result.message || 'Error al guardar el entrenamiento');
        }
      }
    } catch (e) {
      Alert.alert('Error', editTraining ? 'No se pudo actualizar el entrenamiento' : 'No se pudo guardar el entrenamiento');
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
          <View style={styles.colDel} />
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
              placeholderTextColor="#6A6A6A"
              textAlign="center"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.setsInputCell, styles.colTiempo, { alignItems: 'center', justifyContent: 'center' }]}
              onPress={() => setTiempoTarget({ exerciseId: exercise._id, setIdx: idx })}
            >
              <Text style={[styles.setsTimeTxt, (set.h === 0 && set.m === 0 && set.s === 0) && { color: COLORS.textMuted }]}>
                {(set.h === 0 && set.m === 0 && set.s === 0)
                  ? '—'
                  : `${String(set.h).padStart(2, '0')}:${String(set.m).padStart(2, '0')}:${String(set.s).padStart(2, '0')}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.colDel, styles.setsDelBtn, config.sets.length <= 1 && { opacity: 0.2 }]}
              onPress={() => removeSet(exercise._id, idx)}
              disabled={config.sets.length <= 1}
            >
              <Ionicons name="remove-circle-outline" size={18} color="#CC3333" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise._id)}>
          <Ionicons name="add" size={15} color="#8B0000" />
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
          <Text style={[styles.setsHeaderCell, styles.colRpe]}>RPE</Text>
          <View style={styles.colDel} />
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
              placeholderTextColor="#6A6A6A"
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
                  placeholderTextColor="#6A6A6A"
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
                  placeholderTextColor="#6A6A6A"
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
                placeholderTextColor="#6A6A6A"
                textAlign="center"
                maxLength={4}
              />
            )}

            {/* RPE */}
            <TextInput
              style={[styles.setsInputCell, styles.colRpe]}
              value={set.rpe}
              onChangeText={v => updateSet(exercise._id, idx, 'rpe', v)}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor="#6A6A6A"
              textAlign="center"
              maxLength={2}
            />

            {/* Eliminar serie */}
            <TouchableOpacity
              style={[styles.colDel, styles.setsDelBtn, config.sets.length <= 1 && { opacity: 0.2 }]}
              onPress={() => removeSet(exercise._id, idx)}
              disabled={config.sets.length <= 1}
            >
              <Ionicons name="remove-circle-outline" size={18} color="#CC3333" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Agregar serie */}
        <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exercise._id)}>
          <Ionicons name="add" size={15} color="#8B0000" />
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
        <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!activeDragId}
            onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.label}>Nombre del Entrenamiento</Text>
              <TextInput
                style={[styles.input, nameError && styles.inputError]}
                placeholder="Ej: Rutina de Fuerza"
                value={trainingName}
                onChangeText={v => { setTrainingName(v); if (v.trim()) setNameError(false); }}
                placeholderTextColor="#6A6A6A"
              />
              {nameError && (
                <Text style={styles.inputErrorText}>El nombre es obligatorio para guardar</Text>
              )}
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
                    <View
                      key={exercise._id}
                      ref={r => { cardViewRefs.current[exercise._id] = r; }}
                      onLayout={e => { cardHeightsRef.current[exercise._id] = e.nativeEvent.layout.height; }}
                    >
                      {dropTargetIdx === index && activeDragId && activeDragId !== exercise._id && (
                        <View style={styles.dropIndicator} />
                      )}
                      <View style={[
                        styles.exerciseCard,
                        supersets[exercise._id] && styles.exerciseCardSuperset,
                        activeDragId === exercise._id && styles.exerciseCardDragging,
                      ]}>
                        {/* Cabecera del ejercicio */}
                        <View style={styles.exerciseHeader}>
                          <View style={styles.exerciseHeaderLeft}>
                            <View
                              {...getPanResponder(exercise._id).panHandlers}
                              style={styles.dragHandle}
                            >
                              <Ionicons name="reorder-three" size={22} color="#6A6A6A" />
                            </View>
                            <Text style={styles.exerciseOrder}>{index + 1}</Text>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={styles.exerciseName}>{getExerciseName(exercise)}</Text>
                                {supersets[exercise._id] && (
                                  <View style={styles.supersetBadge}>
                                    <Text style={styles.supersetBadgeText}>Superset</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.exerciseMeta}>
                                {CATEGORY_LABELS[exercise.category] || exercise.category}
                                {exercise.primaryMuscles?.[0]
                                  ? ` · ${MUSCLE_LABELS[exercise.primaryMuscles[0]] || exercise.primaryMuscles[0]}`
                                  : ''}
                              </Text>
                              {/* Nota del ejercicio */}
                              <TextInput
                                style={styles.exerciseNoteInput}
                                placeholder="Añadir nota..."
                                placeholderTextColor="#6A6A6A"
                                value={exerciseNotes[exercise._id] || ''}
                                onChangeText={v => setExerciseNotes(prev => ({ ...prev, [exercise._id]: v }))}
                                multiline
                                numberOfLines={2}
                              />
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={(e) => handleOpenExMenu(exercise._id, e)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color="#6A6A6A" />
                          </TouchableOpacity>
                        </View>

                        {/* Tabla de series */}
                        {renderSetsTable(exercise)}
                      </View>

                      {/* Superset picker inline */}
                      {supersetPickerForId === exercise._id && (
                        <View style={styles.supersetPicker}>
                          <Text style={styles.supersetPickerTitle}>Selecciona ejercicios para la superserie</Text>
                          {exercises.filter(e => e._id !== exercise._id).map(e => (
                            <TouchableOpacity
                              key={e._id}
                              style={styles.supersetPickerItem}
                              onPress={() => toggleSupersetSelection(e._id)}
                            >
                              <View style={[styles.supersetCheckbox, supersetPickerSelected.includes(e._id) && styles.supersetCheckboxChecked]}>
                                {supersetPickerSelected.includes(e._id) && (
                                  <Ionicons name="checkmark" size={12} color="#EAEAEA" />
                                )}
                              </View>
                              <Text style={styles.supersetPickerItemText}>{getExerciseName(e)}</Text>
                              {supersets[e._id] && (
                                <View style={styles.supersetBadge}>
                                  <Text style={styles.supersetBadgeText}>Superset</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                          <View style={styles.supersetPickerActions}>
                            <TouchableOpacity
                              style={styles.supersetCancelBtn}
                              onPress={() => { setSupersetPickerForId(null); setSupersetPickerSelected([]); }}
                            >
                              <Text style={styles.supersetCancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.supersetConfirmBtn}
                              onPress={() => handleApplySuperset(exercise._id)}
                            >
                              <Text style={styles.supersetConfirmBtnText}>Confirmar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                  {dropTargetIdx === exercises.length && activeDragId && (
                    <View style={styles.dropIndicator} />
                  )}
                </View>
              )}

              <TouchableOpacity style={styles.addExerciseButton} onPress={handleAddExercise}>
                <Ionicons name="add-circle-outline" size={18} color="#8B0000" style={{ marginRight: 6 }} />
                <Text style={styles.addExerciseButtonText}>Añadir Ejercicio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSaveTraining}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#EAEAEA" />
                  : <Text style={styles.saveButtonText}>{editTraining ? 'Actualizar Entrenamiento' : 'Guardar Entrenamiento'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {activeDragId !== null && (() => {
        const draggedEx = exercises.find(e => e._id === activeDragId);
        return draggedEx ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dragGhost,
              {
                top: ghostInitY.current,
                transform: [{ translateY: ghostY }],
              },
            ]}
          >
            <View style={[styles.exerciseCard, styles.exerciseCardGhost]}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderLeft}>
                  <Ionicons name="reorder-three" size={22} color="#B11226" />
                  <Text style={styles.exerciseOrder}>
                    {exercises.findIndex(e => e._id === activeDragId) + 1}
                  </Text>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {getExerciseName(draggedEx)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null;
      })()}

      <Modal
        visible={exMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExMenuVisible(false)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setExMenuVisible(false)}
          activeOpacity={1}
        />
        <View style={[styles.exDropdown, { top: exMenuPos.y + 8 }]}>
          {supersets[exMenuId] ? (
            <TouchableOpacity
              style={styles.exDropdownItem}
              onPress={() => {
                setExMenuVisible(false);
                const groupId = supersets[exMenuId];
                setSupersets(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => { if (next[k] === groupId) next[k] = null; });
                  return next;
                });
              }}
            >
              <Ionicons name="git-merge-outline" size={16} color="#CC3333" />
              <Text style={[styles.exDropdownItemText, { color: COLORS.danger }]}>Eliminar Superserie</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.exDropdownItem}
              onPress={() => {
                setExMenuVisible(false);
                setSupersetPickerSelected([]);
                setSupersetPickerForId(exMenuId);
              }}
            >
              <Ionicons name="git-merge-outline" size={16} color="#9A9A9A" />
              <Text style={styles.exDropdownItemText}>Añadir Superserie</Text>
            </TouchableOpacity>
          )}
          <View style={styles.exDropdownDivider} />
          <TouchableOpacity
            style={styles.exDropdownItem}
            onPress={() => { setExMenuVisible(false); handleReplaceExercise(exMenuId); }}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#9A9A9A" />
            <Text style={styles.exDropdownItemText}>Reemplazar Ejercicio</Text>
          </TouchableOpacity>
          <View style={styles.exDropdownDivider} />
          <TouchableOpacity
            style={styles.exDropdownItem}
            onPress={() => { setExMenuVisible(false); handleRemoveExercise(exMenuId); }}
          >
            <Ionicons name="trash-outline" size={16} color="#CC3333" />
            <Text style={[styles.exDropdownItemText, { color: COLORS.danger }]}>Eliminar Ejercicio</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: COLORS.background },
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
  label: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 10 },
  exerciseCount: { fontSize: 14, color: COLORS.primaryDark, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  inputError: {
    borderColor: COLORS.primary,
  },
  inputErrorText: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 6,
  },
  emptyExercises: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  emptyText: { fontSize: 16, color: COLORS.textMuted, marginBottom: 5 },
  emptySubtext: { fontSize: 14, color: '#4A4A4A', textAlign: 'center' },
  exercisesList: { marginBottom: 15 },

  // Card de ejercicio
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.primaryDark,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  exerciseName: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  exerciseMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Tabla de series
  setsTable: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceDeep,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  setsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
    justifyContent: 'space-between',
  },
  // Anchos de columna
  colSerie: { width: 44 },
  colKg: { width: 60 },
  colReps: { width: 60 },
  colRepsRange: { width: 110 },
  colRpe: { width: 46 },
  colKm: { width: 70 },
  colTiempo: { width: 90 },
  setsHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
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
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },
  setsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    justifyContent: 'space-between',
  },
  setsSerieCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsSerieText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  setsInputCell: {
    height: 34,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.surfaceAlt,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  setsRangeSep: {
    fontSize: 13,
    color: COLORS.textMuted,
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
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  colDel: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsDelBtn: {
    paddingVertical: 4,
  },
  exerciseNoteInput: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: 0,
    paddingVertical: 2,
    minHeight: 18,
  },

  // Botón añadir ejercicio
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
  },
  addExerciseButtonText: { color: COLORS.primaryDark, fontSize: 14, fontWeight: '600' },

  saveButton: {
    marginTop: 16,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },

  // Cardio table
  setsTimeTxt: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },

  // Drum time picker
  drumSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  drumHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 16,
  },
  drumTitle: {
    textAlign: 'center', fontSize: 16, fontWeight: '700',
    color: COLORS.textPrimary, marginBottom: 12,
  },
  drumLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.5, marginBottom: 4, textAlign: 'center',
  },
  drumItem: { fontSize: 22, color: '#4A4A4A', fontWeight: '500' },
  drumItemSelected: { fontSize: 26, color: COLORS.textPrimary, fontWeight: '700' },
  drumConfirmBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: COLORS.primaryDark, borderRadius: 10, padding: 16, alignItems: 'center',
  },
  drumConfirmText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },

  // Superset badge
  supersetBadge: {
    backgroundColor: '#2A0A0A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  supersetBadgeText: {
    fontSize: 10,
    color: COLORS.primaryDark,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  exerciseCardSuperset: {
    borderColor: COLORS.primaryDark,
  },

  // Superset picker
  supersetPicker: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A0A0A',
    padding: 14,
  },
  supersetPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  supersetPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceDeep,
  },
  supersetPickerItemText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  supersetCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supersetCheckboxChecked: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  supersetPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  supersetCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supersetCancelBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  supersetConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primaryDark,
  },
  supersetConfirmBtnText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // Exercise context menu
  exDropdown: {
    position: 'absolute',
    right: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  exDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  exDropdownItemText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  exDropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },

  // Drag & Drop
  dragHandle: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseCardDragging: {
    opacity: 0.15,
  },
  exerciseCardGhost: {
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  dragGhost: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
    elevation: 999,
  },
  dropIndicator: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginBottom: 6,
    marginHorizontal: 4,
  },
});
