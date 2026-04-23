import React, { useState, useCallback, useMemo, memo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { sessionService } from '../services/api';
import { MUSCLE_LABELS, getExerciseName } from '../config/translations';

const PERIODS = [
  { label: 'Semana', days: 7 },
  { label: 'Mes',    days: 30 },
  { label: '3 meses', days: 90 },
  { label: 'Todo',   days: null },
];

function getStartDate(days) {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function calcSessionStats(session) {
  let totalVolume = 0;
  let completedSets = 0;

  session.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      if (s.completed) completedSets++;
      if (ex.repMode !== 'cardio') {
        totalVolume += (s.weight || 0) * (s.reps || 0);
      }
    });
  });

  return { totalVolume, completedSets };
}

// Memoized card — recalculates stats only when the session object changes
const SessionCard = memo(({ item, onPress, onDelete }) => {
  const { totalVolume, completedSets } = useMemo(() => calcSessionStats(item), [item]);
  const trainingName = item.trainingId?.name || 'Entrenamiento';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{trainingName}</Text>
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B3B" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={14} color="#B11226" />
          <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#22c55e" />
          <Text style={styles.statValue}>{completedSets} series</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="barbell-outline" size={14} color="#C9A44C" />
          <Text style={styles.statValue}>
            {totalVolume > 0 ? `${totalVolume.toLocaleString('es-ES')} kg` : '—'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function HistorialScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activePeriod, setActivePeriod] = useState(2); // índice en PERIODS (90 días por defecto)

  const loadSessions = useCallback(async (pageNum = 1, periodIdx = activePeriod) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const startDate = getStartDate(PERIODS[periodIdx].days);
      const result = await sessionService.getAllSessions({
        page: pageNum,
        limit: 20,
        ...(startDate && { startDate }),
      });
      const newSessions = result.data || [];

      setSessions((prev) => pageNum === 1 ? newSessions : [...prev, ...newSessions]);
      setHasMore(pageNum < (result.pagination?.totalPages || 1));
      setPage(pageNum);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activePeriod]);

  useFocusEffect(
    useCallback(() => {
      loadSessions(1, activePeriod);
    }, [loadSessions])
  );

  const handlePeriodChange = (idx) => {
    setActivePeriod(idx);
    loadSessions(1, idx);
  };

  const handleDelete = (session) => {
    Alert.alert(
      'Eliminar sesión',
      `¿Seguro que quieres eliminar la sesión del ${formatDate(session.date)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await sessionService.deleteSession(session._id);
              setSessions((prev) => prev.filter((s) => s._id !== session._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la sesión');
            }
          },
        },
      ]
    );
  };

  const renderItem = useCallback(({ item }) => (
    <SessionCard
      item={item}
      onPress={(s) => navigation.navigate('SessionDetail', { session: s })}
      onDelete={handleDelete}
    />
  ), [handleDelete, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B11226" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Barra de filtros de período */}
      <View style={styles.periodBar}>
        {PERIODS.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.periodBtn, activePeriod === i && styles.periodBtnActive]}
            onPress={() => handlePeriodChange(i)}
          >
            <Text style={[styles.periodBtnText, activePeriod === i && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => { if (hasMore && !loadingMore) loadSessions(page + 1); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color="#333333" />
            <Text style={styles.emptyText}>Aún no hay sesiones registradas</Text>
          </View>
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color="#B11226" /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Filtros de período
  periodBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  periodBtnActive: {
    backgroundColor: '#8B0000',
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6A6A6A',
  },
  periodBtnTextActive: {
    color: '#EAEAEA',
  },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#EAEAEA', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#6A6A6A' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statValue: { fontSize: 12, fontWeight: '600', color: '#9A9A9A' },
  statDivider: { width: 1, height: 16, backgroundColor: '#333333' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: '#6A6A6A', fontWeight: '500' },
});
