import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { measurementService } from '../services/api';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MEASUREMENT_LABELS = {
  peso: 'Peso',
  cintura: 'Cintura',
  cuello: 'Cuello',
  hombro: 'Hombro',
  pecho: 'Pecho',
  bicepsIzq: 'Bíceps Izq',
  bicepsDer: 'Bíceps Der',
  antebrazoIzq: 'Antebrazo Izq',
  antebrazoDer: 'Antebrazo Der',
  abdomen: 'Abdomen',
  cadera: 'Cadera',
  musloIzq: 'Muslo Izq',
  musloDer: 'Muslo Der',
  gemeloIzq: 'Gemelo Izq',
  gemeloDer: 'Gemelo Der',
};

const MEASUREMENT_UNITS = { peso: 'kg' };

function MeasurementCard({ item, onDelete, onPress }) {
  const keyMetrics = ['peso', 'cintura', 'pecho', 'cadera'].filter(
    (k) => item[k] != null
  );

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color="#CC3333" />
        </TouchableOpacity>
      </View>

      {/* Foto miniatura */}
      {item.photos?.length > 0 && (
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.photoThumb}
          resizeMode="cover"
        />
      )}

      {/* Métricas clave */}
      {keyMetrics.length > 0 && (
        <View style={styles.metricsRow}>
          {keyMetrics.map((k) => (
            <View key={k} style={styles.metricChip}>
              <Text style={styles.metricLabel}>{MEASUREMENT_LABELS[k]}</Text>
              <Text style={styles.metricValue}>
                {item[k]} {MEASUREMENT_UNITS[k] || 'cm'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MeasurementsScreen({ navigation }) {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMeasurements = useCallback(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await measurementService.getMeasurements();
        setMeasurements(res.data || []);
      } catch (e) {
        Alert.alert('Error', 'No se pudieron cargar las medidas.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useFocusEffect(loadMeasurements);

  const handleDelete = (id) => {
    Alert.alert(
      'Eliminar medida',
      '¿Seguro que quieres eliminar este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await measurementService.deleteMeasurement(id);
              setMeasurements((prev) => prev.filter((m) => m._id !== id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el registro.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Botón nuevo registro */}
      <TouchableOpacity
        style={styles.addFab}
        onPress={() => navigation.navigate('NewMeasurement')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {measurements.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="body-outline" size={52} color="#333" />
          <Text style={styles.emptyTitle}>Sin registros</Text>
          <Text style={styles.emptySubtitle}>
            Pulsa el botón + para añadir tu primer registro de medidas
          </Text>
        </View>
      ) : (
        <FlatList
          data={measurements}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MeasurementCard
              item={item}
              onDelete={() => handleDelete(item._id)}
              onPress={() => navigation.navigate('NewMeasurement', { measurement: item })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardDate: {
    color: '#EAEAEA',
    fontSize: 15,
    fontWeight: '600',
  },
  photoThumb: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    backgroundColor: '#252525',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#9A9A9A',
    fontSize: 11,
    marginBottom: 2,
  },
  metricValue: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
  },
  addFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 10,
    backgroundColor: '#8B0000',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6A6A6A',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
