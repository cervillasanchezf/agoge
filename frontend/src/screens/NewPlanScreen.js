import React, { useState, useEffect } from 'react';
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

const DAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
];

function initDayMap(existing) {
  const map = {};
  DAYS.forEach(({ num }) => { map[num] = []; });
  if (existing) {
    existing.days.forEach((d) => {
      map[d.dayOfWeek] = d.trainings || [];
    });
  }
  return map;
}

export default function NewPlanScreen({ navigation, route }) {
  const existing = route.params?.plan || null;

  const [name, setName] = useState(existing?.name || '');
  const [weeks, setWeeks] = useState(existing?.weeks ?? 6);
  const [dayMap, setDayMap] = useState(() => initDayMap(existing));
  const [trainings, setTrainings] = useState([]);
  const [loadingTrainings, setLoadingTrainings] = useState(true);
  const [pickerDay, setPickerDay] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const toggleTraining = (training) => {
    setDayMap((prev) => {
      const current = prev[pickerDay] || [];
      const idx = current.findIndex((t) => t._id === training._id);
      if (idx >= 0) {
        return { ...prev, [pickerDay]: current.filter((t) => t._id !== training._id) };
      }
      if (current.length >= 2) {
        Alert.alert('Máximo 2 sesiones', 'Puedes asignar hasta 2 rutinas por día');
        return prev;
      }
      return { ...prev, [pickerDay]: [...current, { _id: training._id, name: training.name }] };
    });
  };

  const clearDay = () => {
    setDayMap((prev) => ({ ...prev, [pickerDay]: [] }));
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
        weeks,
        days: Object.entries(dayMap)
          .filter(([, ts]) => ts.length > 0)
          .map(([dayOfWeek, ts]) => ({
            dayOfWeek: Number(dayOfWeek),
            trainings: ts.map((t) => t._id),
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

  const pickerDaySelected = pickerDay ? (dayMap[pickerDay] || []) : [];
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
          placeholder="Ej: Volumen Bloque 1"
          placeholderTextColor="#4A4A4A"
          maxLength={50}
        />

        {/* Semanas */}
        <Text style={styles.label}>Duración</Text>
        <View style={styles.weeksRow}>
          <TouchableOpacity
            style={styles.weeksBtn}
            onPress={() => setWeeks((w) => Math.max(1, w - 1))}
          >
            <Ionicons name="remove" size={20} color="#EAEAEA" />
          </TouchableOpacity>
          <Text style={styles.weeksValue}>
            {weeks} semana{weeks !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={styles.weeksBtn}
            onPress={() => setWeeks((w) => Math.min(52, w + 1))}
          >
            <Ionicons name="add" size={20} color="#EAEAEA" />
          </TouchableOpacity>
        </View>

        {/* Días */}
        <Text style={styles.label}>Días</Text>
        {loadingTrainings ? (
          <ActivityIndicator color="#B11226" style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.daysCard}>
            {DAYS.map(({ num, label }, index) => {
              const assigned = dayMap[num] || [];
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
                      <Ionicons name="chevron-forward" size={16} color="#4A4A4A" style={styles.chevron} />
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        )}

        {/* Guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#EAEAEA" />
          ) : (
            <Text style={styles.saveBtnText}>
              {existing ? 'Guardar cambios' : 'Crear planificación'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Day picker modal */}
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
          <Text style={styles.modalSubtitle}>Selecciona hasta 2 rutinas para este día</Text>

          {trainings.length === 0 ? (
            <View style={styles.noTrainingsMsg}>
              <Text style={styles.noTrainingsText}>No tienes rutinas creadas todavía</Text>
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
                      {isSelected && <Ionicons name="checkmark" size={14} color="#EAEAEA" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.trainingDivider} />}
            />
          )}

          <TouchableOpacity
            style={styles.modalDoneBtn}
            onPress={() => setPickerDay(null)}
          >
            <Text style={styles.modalDoneBtnText}>Hecho</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6A6A6A',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#EAEAEA',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  weeksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    fontSize: 16,
    fontWeight: '700',
    color: '#EAEAEA',
  },
  daysCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  dayDivider: {
    height: 1,
    backgroundColor: '#252525',
    marginHorizontal: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayLabel: {
    fontSize: 15,
    color: '#EAEAEA',
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
    fontSize: 14,
    color: '#3A3A3A',
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
    backgroundColor: '#2A1515',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#5A1A1A',
  },
  chipText: {
    fontSize: 12,
    color: '#CC6666',
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 8,
  },
  saveBtn: {
    backgroundColor: '#B11226',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    shadowColor: '#B11226',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EAEAEA',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingBottom: 30,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3A3A3A',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#EAEAEA',
  },
  clearText: {
    fontSize: 14,
    color: '#9A9A9A',
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6A6A6A',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  noTrainingsMsg: {
    padding: 32,
    alignItems: 'center',
  },
  noTrainingsText: {
    color: '#6A6A6A',
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '600',
    color: '#EAEAEA',
    marginBottom: 2,
  },
  trainingItemMeta: {
    fontSize: 12,
    color: '#6A6A6A',
  },
  trainingDivider: {
    height: 1,
    backgroundColor: '#252525',
    marginHorizontal: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#B11226',
    borderColor: '#B11226',
  },
  modalDoneBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: '#B11226',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAEAEA',
  },
});
