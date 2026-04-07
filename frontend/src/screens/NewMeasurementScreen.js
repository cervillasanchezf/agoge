import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { measurementService } from '../services/api';

// ---------- helpers ----------
function padZ(n) {
  return String(n).padStart(2, '0');
}

function dateToDisplay(d) {
  return `${padZ(d.getDate())}/${padZ(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseDisplayDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 2000 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

// ---------- campos de medidas ----------
const FIELDS = [
  { key: 'peso',         label: 'Peso',            unit: 'kg' },
  { key: 'cintura',      label: 'Cintura',          unit: 'cm' },
  { key: 'cuello',       label: 'Cuello',           unit: 'cm' },
  { key: 'hombro',       label: 'Hombro',           unit: 'cm' },
  { key: 'pecho',        label: 'Pecho',            unit: 'cm' },
  { key: 'bicepsIzq',    label: 'Bíceps Izquierdo', unit: 'cm' },
  { key: 'bicepsDer',    label: 'Bíceps Derecho',   unit: 'cm' },
  { key: 'antebrazoIzq', label: 'Antebrazo Izq.',   unit: 'cm' },
  { key: 'antebrazoDer', label: 'Antebrazo Der.',   unit: 'cm' },
  { key: 'abdomen',      label: 'Abdomen',          unit: 'cm' },
  { key: 'cadera',       label: 'Cadera',           unit: 'cm' },
  { key: 'musloIzq',     label: 'Muslo Izquierdo',  unit: 'cm' },
  { key: 'musloDer',     label: 'Muslo Derecho',    unit: 'cm' },
  { key: 'gemeloIzq',    label: 'Gemelo Izquierdo', unit: 'cm' },
  { key: 'gemeloDer',    label: 'Gemelo Derecho',   unit: 'cm' },
];

// ---------- date picker modal ----------
function DatePickerModal({ visible, date, onConfirm, onClose }) {
  const [day, setDay]     = useState(padZ(date.getDate()));
  const [month, setMonth] = useState(padZ(date.getMonth() + 1));
  const [year, setYear]   = useState(String(date.getFullYear()));

  useEffect(() => {
    setDay(padZ(date.getDate()));
    setMonth(padZ(date.getMonth() + 1));
    setYear(String(date.getFullYear()));
  }, [date, visible]);

  const handleConfirm = () => {
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (isNaN(d.getTime())) {
      Alert.alert('Fecha inválida', 'Comprueba el día, mes y año.');
      return;
    }
    onConfirm(d);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dp.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={dp.box} activeOpacity={1}>
          <Text style={dp.title}>Seleccionar fecha</Text>

          <View style={dp.row}>
            {/* Día */}
            <View style={dp.col}>
              <Text style={dp.colLabel}>Día</Text>
              <TextInput
                style={dp.input}
                value={day}
                onChangeText={setDay}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
            </View>
            <Text style={dp.sep}>/</Text>
            {/* Mes */}
            <View style={dp.col}>
              <Text style={dp.colLabel}>Mes</Text>
              <TextInput
                style={dp.input}
                value={month}
                onChangeText={setMonth}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
            </View>
            <Text style={dp.sep}>/</Text>
            {/* Año */}
            <View style={[dp.col, { flex: 2 }]}>
              <Text style={dp.colLabel}>Año</Text>
              <TextInput
                style={dp.input}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
              />
            </View>
          </View>

          <View style={dp.actions}>
            <TouchableOpacity style={dp.btnCancel} onPress={onClose}>
              <Text style={dp.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dp.btnConfirm} onPress={handleConfirm}>
              <Text style={dp.btnConfirmText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============================================================
// PANTALLA PRINCIPAL
// ============================================================
export default function NewMeasurementScreen({ route, navigation }) {
  const existing = route.params?.measurement;
  const isEdit = !!existing;

  // Fecha
  const [date, setDate]           = useState(existing ? new Date(existing.date) : new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Fotos
  const [photos, setPhotos]       = useState(existing?.photos || []);

  // Medidas numéricas
  const initialValues = () => {
    const vals = {};
    FIELDS.forEach(({ key }) => {
      vals[key] = existing?.[key] != null ? String(existing[key]) : '';
    });
    return vals;
  };
  const [values, setValues] = useState(initialValues);

  // Notas


  const [saving, setSaving] = useState(false);

  // ---------- fotos ----------
  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu galería para añadir fotos.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: false,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setPhotos((prev) => [...prev, ...uris]);
    }
  };

  const removePhoto = (idx) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---------- guardar ----------
  const handleSave = async () => {
    const payload = {
      date: date.toISOString(),
      photos,
    };

    FIELDS.forEach(({ key }) => {
      const v = values[key];
      payload[key] = v !== '' && v !== undefined ? Number(v) : null;
    });

    try {
      setSaving(true);
      if (isEdit) {
        await measurementService.updateMeasurement(existing._id, payload);
      } else {
        await measurementService.createMeasurement(payload);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el registro. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── FECHA ── */}
        <Text style={styles.sectionTitle}>Fecha</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setDatePickerOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={18} color="#8B0000" />
          <Text style={styles.dateText}>{dateToDisplay(date)}</Text>
          <Ionicons name="chevron-down" size={16} color="#9A9A9A" />
        </TouchableOpacity>

        {/* ── FOTOS ── */}
        <Text style={styles.sectionTitle}>Fotos de progreso</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photosRow}
          contentContainerStyle={{ gap: 10, paddingRight: 16 }}
        >
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => removePhoto(idx)}
              >
                <Ionicons name="close-circle" size={20} color="#CC3333" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto} activeOpacity={0.7}>
            <Ionicons name="add" size={28} color="#8B0000" />
            <Text style={styles.photoAddLabel}>Añadir</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── MEDIDAS ── */}
        <Text style={styles.sectionTitle}>Medidas</Text>
        <View style={styles.fieldsGrid}>
          {FIELDS.map(({ key, label, unit }) => (
            <View key={key} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <View style={styles.fieldInputWrap}>
                <TextInput
                  style={styles.fieldInput}
                  value={values[key]}
                  onChangeText={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor="#6A6A6A"
                  returnKeyType="next"
                />
                <Text style={styles.fieldUnit}>{unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── GUARDAR ── */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEdit ? 'Guardar cambios' : 'Guardar registro'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerModal
        visible={datePickerOpen}
        date={date}
        onConfirm={(d) => { setDate(d); setDatePickerOpen(false); }}
        onClose={() => setDatePickerOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Estilos pantalla ──────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#9A9A9A',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 20,
  },
  // Fecha
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 10,
  },
  dateText: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 15,
    fontWeight: '600',
  },
  // Fotos
  photosRow: {
    marginBottom: 4,
  },
  photoWrap: {
    position: 'relative',
  },
  photo: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
  },
  photoAdd: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#1F1F1F',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoAddLabel: {
    color: '#8B0000',
    fontSize: 12,
    fontWeight: '600',
  },
  // Campos de medidas
  fieldsGrid: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  fieldLabel: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 14,
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldInput: {
    backgroundColor: '#1F1F1F',
    color: '#EAEAEA',
    fontSize: 15,
    fontWeight: '600',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 70,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#333',
  },
  fieldUnit: {
    color: '#6A6A6A',
    fontSize: 13,
    width: 24,
  },
  // Guardar
  saveButton: {
    backgroundColor: '#8B0000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

// ── Estilos DatePickerModal ───────────────────────────────
const dp = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: '#1F1F1F',
    borderRadius: 16,
    padding: 24,
    width: 300,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 20,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colLabel: {
    color: '#9A9A9A',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#252525',
    color: '#EAEAEA',
    fontSize: 20,
    fontWeight: '700',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  sep: {
    color: '#6A6A6A',
    fontSize: 22,
    fontWeight: '300',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    backgroundColor: '#252525',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnCancelText: {
    color: '#9A9A9A',
    fontSize: 14,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1,
    backgroundColor: '#8B0000',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
