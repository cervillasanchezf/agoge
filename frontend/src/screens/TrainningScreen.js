import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { trainingService } from '../services/api';

export default function TrainningScreen({ navigation }) {
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTraining, setMenuTraining] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

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

  const handleOpenMenu = (training, event) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuTraining(training);
    setMenuPosition({ x: pageX, y: pageY });
    setMenuVisible(true);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    navigation.navigate('NewTrainning', { editTraining: menuTraining });
  };

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
      <TouchableOpacity
        onPress={(e) => handleOpenMenu(item, e)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#6A6A6A" />
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
          <ActivityIndicator size="large" color="#8B0000" />
        </View>
      ) : trainings.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="barbell-outline" size={64} color="#333333" />
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
        <View style={[styles.dropdown, { top: menuPosition.y + 10 }]}>
          <TouchableOpacity style={styles.dropdownItem} onPress={handleEdit}>
            <Ionicons name="pencil-outline" size={16} color="#9A9A9A" />
            <Text style={styles.dropdownItemText}>Editar entrenamiento</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { setMenuVisible(false); handleDelete(menuTraining); }}
          >
            <Ionicons name="trash-outline" size={16} color="#CC3333" />
            <Text style={[styles.dropdownItemText, { color: '#CC3333' }]}>Eliminar entrenamiento</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('NewTrainning')}
        >
            <Ionicons name="add" size={22} color="#EAEAEA" />
          <Text style={styles.createButtonText}>Crear Nuevo Entrenamiento</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#EAEAEA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    color: '#6A6A6A',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#4A4A4A',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#EAEAEA',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#9A9A9A',
  },
  footer: {
    padding: 16,
  },
  createButton: {
    backgroundColor: '#8B0000',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdown: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 210,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#EAEAEA',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#333333',
    marginHorizontal: 8,
  },
});



