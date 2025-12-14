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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function NewTrainningScreen({ navigation }) {
  const [trainingName, setTrainingName] = useState('');
  const [exercises, setExercises] = useState([]);


  const handleAddExercise = () => {
    if (!trainingName.trim()) {
      alert('Por favor, ingresa un nombre para el entrenamiento');
      return;
    }
    // Navegar a la pantalla de añadir ejercicio
    console.log('Navegar a añadir ejercicio');
  };


  const handleSaveTraining = () => {
    if (!trainingName.trim()) {
      alert('Por favor, ingresa un nombre para el entrenamiento');
      return;
    }
   
    if (exercises.length === 0) {
      alert('Debes añadir al menos un ejercicio');
      return;
    }


    // Aquí se guardará el entrenamiento
    console.log('Guardar entrenamiento:', { name: trainingName, exercises });
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
                  <Text style={styles.emptyText}>
                    No hay ejercicios añadidos
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Comienza añadiendo ejercicios a tu entrenamiento
                  </Text>
                </View>
              ) : (
                <View style={styles.exercisesList}>
                  {exercises.map((exercise, index) => (
                    <View key={index} style={styles.exerciseItem}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                    </View>
                  ))}
                </View>
              )}


              <TouchableOpacity
                style={styles.addExerciseButton}
                onPress={handleAddExercise}
              >
                <Text style={styles.addExerciseButtonText}>
                  + Añadir Ejercicio
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>


        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveTraining}
          >
            <Text style={styles.saveButtonText}>Guardar Entrenamiento</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  exerciseCount: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
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
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  exercisesList: {
    marginBottom: 15,
  },
  exerciseItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  exerciseName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  addExerciseButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  addExerciseButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});