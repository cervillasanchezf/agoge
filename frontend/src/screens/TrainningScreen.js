import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrainningScreen({ navigation }) {
  const handleCrearEntrenamiento = () => {
    // Aquí se implementará la funcionalidad para crear un entrenamiento
    navigation.navigate('NewTrainning');
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Entrenamientos</Text>
        <Text style={styles.subtitle}>
          Gestiona y crea tus entrenamientos personalizados
        </Text>


        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Aún no tienes entrenamientos creados
          </Text>
          <Text style={styles.emptySubtext}>
            Comienza creando tu primer entrenamiento
          </Text>
        </View>


        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCrearEntrenamiento}
        >
          <Text style={styles.createButtonText}>+ Crear Nuevo Entrenamiento</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  createButton: {
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
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});



