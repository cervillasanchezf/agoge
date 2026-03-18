import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { trainingService } from '../services/api';
import { getExerciseName, CATEGORY_LABELS, MUSCLE_LABELS } from '../config/translations';


export default function NewTrainningScreen({ navigation }) {
  const { user } = useAuth();
  const [trainingName, setTrainingName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAddExercise = () => {
    if (!trainingName.trim()) {
      Alert.alert('Atención', 'Escribe primero un nombre para el entrenamiento');
      return;
    }
    navigation.navigate('ExercisePicker', {
      selectedExercises: exercises,
      onSelect: (selected) => {
        // Mantiene el orden previo y añade los nuevos al final
        const existingIds = new Set(exercises.map(e => e._id));
        const newOnes = selected.filter(e => !existingIds.has(e._id));
        setExercises([...exercises, ...newOnes]);
      },
    });
  };

  const handleRemoveExercise = (id) => {
    setExercises(prev => prev.filter(e => e._id !== id));
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
        exercises: exercises.map((ex, idx) => ({
          exerciseId: ex._id,
          order: idx,
        })),
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView}>
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
                    <View key={exercise._id} style={styles.exerciseItem}>
                      <View style={styles.exerciseItemLeft}>
                        <Text style={styles.exerciseOrder}>{index + 1}</Text>
                        <View>
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
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addExerciseButton}
                onPress={handleAddExercise}
              >
                <Ionicons name="add-circle-outline" size={18} color="#6366f1" style={{ marginRight: 6 }} />
                <Text style={styles.addExerciseButtonText}>Añadir Ejercicio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
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
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  exerciseItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
});