import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { planService, trainingService } from '../services/api';
import { COLORS } from '../config/theme';

const ITEM_H = 44;
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const THIS_YEAR = new Date().getFullYear();
const PICKER_YEARS = Array.from({ length: 7 }, (_, i) => THIS_YEAR - 1 + i);
const PICKER_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function formatDate(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function DrumColumn({ items, selectedIndex, onSelect, pad = false, scrollTo }) {
  const ref = useRef(null);

  // Re-scroll whenever scrollTo changes (modal opens with a new openCount)
  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, [scrollTo]);

  const handleEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(idx, items.length - 1)));
  };

  return (
    <View style={{ height: ITEM_H * 5, flex: 1, overflow: 'hidden' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleEnd}
        contentContainerStyle={{ paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
      >
        {items.map((item, i) => {
          const label = pad ? String(item).padStart(2, '0') : String(item);
          return (
            <TouchableOpacity
              key={i}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => {
                ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
                onSelect(i);
              }}
            >
              <Text
                style={{
                  fontSize: 19,
                  color: i === selectedIndex ? COLORS.textPrimary : COLORS.iconInactive,
                  fontWeight: i === selectedIndex ? '700' : '400',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Highlight overlay rendered after ScrollView so it appears on top */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_H * 2,
          left: 4,
          right: 4,
          height: ITEM_H,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      />
    </View>
  );
}

function DatePickerModal({ visible, date, onConfirm, onClose }) {
  const [dayIdx, setDayIdx] = useState(date.getDate() - 1);
  const [monthIdx, setMonthIdx] = useState(date.getMonth());
  const [yearIdx, setYearIdx] = useState(() => {
    const yi = PICKER_YEARS.indexOf(date.getFullYear());
    return yi >= 0 ? yi : 1; // index 1 = current year in PICKER_YEARS
  });
  // Increment each time the modal opens so DrumColumn useEffect re-fires
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    if (visible) {
      setDayIdx(date.getDate() - 1);
      setMonthIdx(date.getMonth());
      const yi = PICKER_YEARS.indexOf(date.getFullYear());
      setYearIdx(yi >= 0 ? yi : 1);
      setOpenCount((c) => c + 1);
    }
  }, [visible]);

  const handleConfirm = () => {
    const y = PICKER_YEARS[yearIdx];
    const maxD = new Date(y, monthIdx + 1, 0).getDate();
    const d = Math.min(dayIdx + 1, maxD);
    onConfirm(new Date(y, monthIdx, d));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Fecha de inicio</Text>
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 }}>
          <DrumColumn items={PICKER_DAYS} selectedIndex={dayIdx} onSelect={setDayIdx} pad scrollTo={openCount} />
          <DrumColumn items={MONTHS_ES} selectedIndex={monthIdx} onSelect={setMonthIdx} scrollTo={openCount} />
          <DrumColumn items={PICKER_YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} scrollTo={openCount} />
        </View>
        <TouchableOpacity style={styles.modalDoneBtn} onPress={handleConfirm}>
          <Text style={styles.modalDoneBtnText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const DAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
];

function initWeekEntry(n) {
  const map = {};
  DAYS.forEach(({ num }) => { map[num] = []; });
  return { weekNumber: n, isDeload: false, label: '', dayMap: map };
}

function initPlanWeeks(existing) {
  if (existing?.planWeeks?.length) {
    return existing.planWeeks.map((w) => {
      const map = {};
      DAYS.forEach(({ num }) => { map[num] = []; });
      (w.days || []).forEach((d) => {
        map[d.dayOfWeek] = (d.trainings || []).map((t) =>
          typeof t === 'object' && t._id ? { _id: t._id, name: t.name || '' } : t
        );
      });
      return { weekNumber: w.weekNumber, isDeload: w.isDeload || false, label: w.label || '', dayMap: map };
    });
  }
  return Array.from({ length: 6 }, (_, i) => initWeekEntry(i + 1));
}

export default function NewPlanScreen({ navigation, route }) {
  const existing = route.params?.plan || null;

  const [name, setName] = useState(existing?.name || '');
  const [planWeeks, setPlanWeeks] = useState(() => initPlanWeeks(existing));
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [measurementDay, setMeasurementDay] = useState(existing?.measurementDay ?? null);
  const [trainings, setTrainings] = useState([]);
  const [loadingTrainings, setLoadingTrainings] = useState(true);
  const [pickerDay, setPickerDay] = useState(null);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(() =>
    existing?.startDate ? new Date(existing.startDate) : new Date()
  );
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await trainingService.getTrainings();
        setTrainings(result.data || []);
      } catch {
        Alert.alert('Error', 'No se pudieron cargar los entrenamientos');
      } finally {
        setLoadingTrainings(false);
      }
    };
    load();
  }, []);

  const currentWeek = planWeeks[selectedWeekIdx];

  const addWeek = () => {
    setPlanWeeks((prev) => [...prev, initWeekEntry(prev.length + 1)]);
  };

  const removeWeek = () => {
    const currentLen = planWeeks.length;
    if (currentLen <= 1) return;
    setPlanWeeks((prev) => prev.slice(0, -1));
    setSelectedWeekIdx((idx) => (idx >= currentLen - 1 ? currentLen - 2 : idx));
  };

  const toggleDeload = () => {
    setPlanWeeks((prev) =>
      prev.map((w, i) => (i === selectedWeekIdx ? { ...w, isDeload: !w.isDeload } : w))
    );
  };

  const copyFromWeek = (fromIdx) => {
    setPlanWeeks((prev) =>
      prev.map((w, i) => {
        if (i !== selectedWeekIdx) return w;
        const source = prev[fromIdx];
        const newDayMap = {};
        Object.entries(source.dayMap).forEach(([day, ts]) => { newDayMap[day] = [...ts]; });
        return { ...w, dayMap: newDayMap };
      })
    );
    setCopyModalVisible(false);
  };

  const toggleTraining = (training) => {
    setPlanWeeks((prev) =>
      prev.map((w, i) => {
        if (i !== selectedWeekIdx) return w;
        const current = w.dayMap[pickerDay] || [];
        const idx = current.findIndex((t) => t._id === training._id);
        let next;
        if (idx >= 0) {
          next = current.filter((t) => t._id !== training._id);
        } else {
          if (current.length >= 2) {
            Alert.alert('Máximo 2 sesiones', 'Puedes asignar hasta 2 entrenamientos por día');
            return w;
          }
          next = [...current, { _id: training._id, name: training.name }];
        }
        return { ...w, dayMap: { ...w.dayMap, [pickerDay]: next } };
      })
    );
  };

  const clearDay = () => {
    setPlanWeeks((prev) =>
      prev.map((w, i) =>
        i === selectedWeekIdx ? { ...w, dayMap: { ...w.dayMap, [pickerDay]: [] } } : w
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'Escribe un nombre para la planificación');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        startDate: startDate.toISOString(),
        measurementDay: measurementDay ?? null,
        planWeeks: planWeeks.map((w) => ({
          weekNumber: w.weekNumber,
          isDeload: w.isDeload,
          label: w.label,
          days: Object.entries(w.dayMap)
            .filter(([, ts]) => ts.length > 0)
            .map(([dayOfWeek, ts]) => ({
              dayOfWeek: Number(dayOfWeek),
              trainings: ts.map((t) => t._id),
            })),
        })),
      };
      if (existing) {
        await planService.updatePlan(existing._id, payload);
      } else {
        await planService.createPlan(payload);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la planificación');
    } finally {
      setSaving(false);
    }
  };

  const pickerDaySelected = pickerDay ? (currentWeek?.dayMap[pickerDay] || []) : [];
  const pickerDayLabel = pickerDay ? DAYS.find((d) => d.num === pickerDay)?.label : '';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Nombre */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Spartan Beast 12 semanas"
          placeholderTextColor={COLORS.iconInactive}
          maxLength={50}
        />

        {/* Duración */}
        <Text style={styles.label}>Duración</Text>
        <View style={styles.weeksRow}>
          <TouchableOpacity style={styles.weeksBtn} onPress={removeWeek}>
            <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.weeksValue}>
            {planWeeks.length} semana{planWeeks.length !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={styles.weeksBtn} onPress={addWeek}>
            <Ionicons name="add" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Fecha de inicio */}
        <Text style={styles.label}>Fecha de inicio</Text>
        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setDatePickerVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.dateText}>{formatDate(startDate)}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.iconInactive} />
        </TouchableOpacity>

        {/* Selector de semana */}
        <Text style={styles.label}>Semanas</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.weekStrip}
          contentContainerStyle={styles.weekStripContent}
        >
          {planWeeks.map((w, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.weekTab, i === selectedWeekIdx && styles.weekTabActive]}
              onPress={() => setSelectedWeekIdx(i)}
            >
              <Text style={[styles.weekTabText, i === selectedWeekIdx && styles.weekTabTextActive]}>
                Sem {w.weekNumber}
              </Text>
              {w.isDeload && <View style={styles.deloadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cabecera de la semana activa */}
        {currentWeek && (
          <View style={[styles.weekHeader, currentWeek.isDeload && styles.weekHeaderDeload]}>
            <Text style={styles.weekTitle}>Semana {currentWeek.weekNumber}</Text>
            <View style={styles.weekActions}>
              <TouchableOpacity
                style={[styles.deloadPill, currentWeek.isDeload && styles.deloadPillActive]}
                onPress={toggleDeload}
              >
                <Text style={[styles.deloadPillText, currentWeek.isDeload && styles.deloadPillTextActive]}>
                  Deload
                </Text>
              </TouchableOpacity>
              {planWeeks.length > 1 && (
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => setCopyModalVisible(true)}
                >
                  <Ionicons name="copy-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.copyBtnText}>Copiar de…</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Días de la semana activa */}
        <Text style={styles.label}>Días</Text>
        {loadingTrainings ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.daysCard}>
            {DAYS.map(({ num, label }, index) => {
              const assigned = currentWeek?.dayMap[num] || [];
              return (
                <React.Fragment key={num}>
                  {index > 0 && <View style={styles.dayDivider} />}
                  <TouchableOpacity
                    style={styles.dayRow}
                    onPress={() => setPickerDay(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dayLabel}>{label}</Text>
                    <View style={styles.dayRight}>
                      {assigned.length === 0 ? (
                        <Text style={styles.restLabel}>Descanso</Text>
                      ) : (
                        <View style={styles.chipsRow}>
                          {assigned.map((t, i) => (
                            <View key={i} style={styles.chip}>
                              <Text style={styles.chipText} numberOfLines={1}>{t.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={COLORS.iconInactive} style={styles.chevron} />
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        )}

        {/* Toma de medidas */}
        <Text style={styles.label}>Día de toma de medidas</Text>
        <View style={styles.daysCard}>
          {DAYS.map(({ num, label }, index) => {
            const isSelected = measurementDay === num;
            return (
              <React.Fragment key={num}>
                {index > 0 && <View style={styles.dayDivider} />}
                <TouchableOpacity
                  style={styles.dayRow}
                  onPress={() => setMeasurementDay(isSelected ? null : num)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, isSelected && { color: COLORS.primary }]}>{label}</Text>
                  <View style={styles.dayRight}>
                    {isSelected ? (
                      <View style={[styles.chip, { backgroundColor: COLORS.dangerBg, borderColor: COLORS.primary }]}>
                        <Text style={[styles.chipText, { color: COLORS.primary }]}>Medidas</Text>
                      </View>
                    ) : (
                      <Text style={styles.restLabel}>—</Text>
                    )}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected, { marginLeft: 8 }]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.textPrimary} />}
                    </View>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
        <Text style={styles.measurementHint}>
          Se te recordará en la pantalla de inicio cuando toque tomar medidas.
        </Text>

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>
              {existing ? 'Guardar cambios' : 'Crear planificación'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerModal
        visible={datePickerVisible}
        date={startDate}
        onConfirm={setStartDate}
        onClose={() => setDatePickerVisible(false)}
      />

      {/* Modal picker de entrenamientos por día */}
      <Modal
        visible={pickerDay !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerDay(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setPickerDay(null)}
          activeOpacity={1}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{pickerDayLabel}</Text>
            <TouchableOpacity onPress={clearDay} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearText}>Limpiar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Selecciona hasta 2 entrenamientos para este día</Text>

          {trainings.length === 0 ? (
            <View style={styles.noTrainingsMsg}>
              <Text style={styles.noTrainingsText}>No tienes entrenamientos creados todavía</Text>
            </View>
          ) : (
            <FlatList
              data={trainings}
              keyExtractor={(t) => t._id}
              style={styles.trainingList}
              renderItem={({ item }) => {
                const isSelected = pickerDaySelected.some((t) => t._id === item._id);
                return (
                  <TouchableOpacity
                    style={styles.trainingItem}
                    onPress={() => toggleTraining(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trainingItemBody}>
                      <Text style={styles.trainingItemName}>{item.name}</Text>
                      <Text style={styles.trainingItemMeta}>
                        {item.exercises?.length ?? 0} ejercicio{item.exercises?.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.textPrimary} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.trainingDivider} />}
            />
          )}

          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setPickerDay(null)}>
            <Text style={styles.modalDoneBtnText}>Hecho</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Modal copiar semana */}
      <Modal
        visible={copyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCopyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setCopyModalVisible(false)}
          activeOpacity={1}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Copiar de semana…</Text>
          </View>
          <Text style={styles.modalSubtitle}>
            Los días de la semana {currentWeek?.weekNumber} se reemplazarán con los de la semana elegida
          </Text>
          <FlatList
            data={planWeeks.filter((_, i) => i !== selectedWeekIdx)}
            keyExtractor={(w) => String(w.weekNumber)}
            style={styles.trainingList}
            renderItem={({ item }) => {
              const fromIdx = planWeeks.findIndex((w) => w.weekNumber === item.weekNumber);
              return (
                <TouchableOpacity
                  style={styles.trainingItem}
                  onPress={() => copyFromWeek(fromIdx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.trainingItemBody}>
                    <Text style={styles.trainingItemName}>
                      Semana {item.weekNumber}{item.isDeload ? ' — Deload' : ''}
                    </Text>
                    <Text style={styles.trainingItemMeta}>
                      {Object.values(item.dayMap).filter((ts) => ts.length > 0).length} días con entrenamiento
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.iconInactive} />
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.trainingDivider} />}
          />
          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setCopyModalVisible(false)}>
            <Text style={styles.modalDoneBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
  },
  weeksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
    overflow: 'hidden',
  },
  weeksBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeksValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  daysCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderInner,
  },
  dayDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginHorizontal: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayLabel: {
    fontSize: 17,
    color: COLORS.textPrimary,
    width: 90,
    fontWeight: '500',
  },
  dayRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  restLabel: {
    fontSize: 16,
    color: COLORS.border,
    fontStyle: 'italic',
    flex: 1,
  },
  chipsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  chip: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.danger,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 8,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingBottom: 30,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  clearText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  noTrainingsMsg: {
    padding: 32,
    alignItems: 'center',
  },
  noTrainingsText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  trainingList: {
    maxHeight: 300,
  },
  trainingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  trainingItemBody: {
    flex: 1,
  },
  trainingItemName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  trainingItemMeta: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  trainingDivider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginHorizontal: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 18,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  measurementHint: {
    fontSize: 14,
    color: COLORS.iconInactive,
    marginTop: 8,
    marginHorizontal: 2,
    fontStyle: 'italic',
  },
  // Week strip
  weekStrip: {
    marginBottom: 2,
  },
  weekStripContent: {
    gap: 6,
    paddingBottom: 4,
  },
  weekTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    position: 'relative',
  },
  weekTabActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.dangerBg,
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  weekTabTextActive: {
    color: COLORS.primary,
  },
  deloadDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.gold || '#F5A623',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
    marginBottom: 10,
  },
  weekHeaderDeload: {
    borderColor: COLORS.gold || '#F5A623',
    backgroundColor: 'rgba(245,166,35,0.08)',
  },
  weekTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  weekActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deloadPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deloadPillActive: {
    borderColor: COLORS.gold || '#F5A623',
    backgroundColor: 'rgba(245,166,35,0.15)',
  },
  deloadPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  deloadPillTextActive: {
    color: COLORS.gold || '#F5A623',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyBtnText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalDoneBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
