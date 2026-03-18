import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trainingService } from '../services/api';

export default function TrainningScreen({ navigation }) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadTrainings = async () => {
        try {
          setLoading(true);
          const result = await trainingService.getTrainings();
          setTrainings(result.data || []);
        } catch (err) {
          // El interceptor de 401 ya maneja el token inválido redirigiendo al login
          if (err?.response?.status !== 401) {
            Alert.alert('Error', 'No se pudieron cargar los entrenamientos');
          }
        } finally {
          setLoading(false);
        }
      };
      loadTrainings();
    }, [])
  );

  const handleDelete = (training) => {
    Alert.alert(
      'Eliminar entrenamiento',
      `¿Seguro que quieres eliminar "${training.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await trainingService.deleteTraining(training._id);
              setTrainings((prev) => prev.filter((t) => t._id !== training._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el entrenamiento');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ActiveSession', { trainingId: item._id, trainingName: item.name })}
      activeOpacity={0.8}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>
          {item.exercises?.length ?? 0} ejercicio{item.exercises?.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Entrenamientos</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : trainings.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="barbell-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>Aún no tienes entrenamientos</Text>
          <Text style={styles.emptySubtext}>Crea tu primer entrenamiento</Text>
        </View>
      ) : (
        <FlatList
          data={trainings}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('NewTrainning')}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.createButtonText}>Crear Nuevo Entrenamiento</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  footer: {
    padding: 16,
  },
  createButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});



