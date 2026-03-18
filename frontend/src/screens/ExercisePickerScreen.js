import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { exerciseService } from '../services/api';
import {
  CATEGORY_LABELS,
  LEVEL_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  FORCE_LABELS,
  MECHANIC_LABELS,
  getExerciseName,
} from '../config/translations';

const FILTER_KEYS = ['category', 'level', 'equipment', 'primaryMuscle'];
const ADVANCED_FILTER_KEYS = ['mechanic', 'force'];

const LABEL_MAPS = {
  category: CATEGORY_LABELS,
  level: LEVEL_LABELS,
  equipment: EQUIPMENT_LABELS,
  primaryMuscle: MUSCLE_LABELS,
  mechanic: MECHANIC_LABELS,
  force: FORCE_LABELS,
};

const FILTER_TITLES = {
  category: 'Categoría',
  level: 'Nivel',
  equipment: 'Material',
  primaryMuscle: 'Músculo',
  mechanic: 'Movimiento',
  force: 'Fuerza',
};

export default function ExercisePickerScreen({ navigation, route }) {
  const { selectedExercises = [], onSelect } = route.params || {};

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(selectedExercises);

  // Cargar opciones de filtros al montar
  useEffect(() => {
    exerciseService.getFilters()
      .then(res => { if (res.success) setFilterOptions(res.data); })
      .catch(() => {});
  }, []);

  // Cargar ejercicios cuando cambian búsqueda o filtros
  useEffect(() => {
    loadExercises(1);
  }, [search, filters]);

  const loadExercises = async (page) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = { search, ...filters, page, limit: 20 };
      const res = await exerciseService.getExercises(params);
      if (res.success) {
        setExercises(page === 1 ? res.data : prev => [...prev, ...res.data]);
        setPagination(res.pagination);
      }
    } catch (err) {
      if (page === 1) {
        const msg = err?.response?.data?.message || err?.message || 'Error de red';
        Alert.alert('Error al cargar ejercicios', msg);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && pagination.page < pagination.totalPages) {
      loadExercises(pagination.page + 1);
    }
  };

  const toggleSelect = (exercise) => {
    setSelected(prev =>
      prev.find(e => e._id === exercise._id)
        ? prev.filter(e => e._id !== exercise._id)
        : [...prev, exercise]
    );
  };

  const isSelected = (exercise) => selected.some(e => e._id === exercise._id);

  const handleConfirm = () => {
    if (onSelect) onSelect(selected);
    navigation.goBack();
  };

  const setFilter = (key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const activeAdvancedCount = ADVANCED_FILTER_KEYS.filter(k => filters[k]).length;
  const activeFilterCount = Object.keys(filters).length;

  const renderFilterRow = (keys) => keys.map(key => {
    const options = filterOptions[key + 's'] || filterOptions[key === 'primaryMuscle' ? 'muscles' : key + 's'] || [];
    const labelMap = LABEL_MAPS[key];
    return (
      <View key={key} style={styles.filterGroup}>
        <Text style={styles.filterLabel}>{FILTER_TITLES[key]}</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={options}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, filters[key] === item && styles.chipActive]}
              onPress={() => setFilter(key, item)}
            >
              <Text style={[styles.chipText, filters[key] === item && styles.chipTextActive]}>
                {labelMap[item] || item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  });

  const renderExercise = ({ item }) => {
    const sel = isSelected(item);
    return (
      <TouchableOpacity
        style={[styles.exerciseItem, sel && styles.exerciseItemSelected]}
        onPress={() => toggleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{getExerciseName(item)}</Text>
          <Text style={styles.exerciseMeta}>
            {CATEGORY_LABELS[item.category] || item.category}
            {item.primaryMuscles?.[0] ? ` · ${MUSCLE_LABELS[item.primaryMuscles[0]] || item.primaryMuscles[0]}` : ''}
          </Text>
        </View>
        <Ionicons
          name={sel ? 'checkmark-circle' : 'add-circle-outline'}
          size={24}
          color={sel ? '#6366f1' : '#ccc'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ejercicio..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros Tier 1 */}
      <View style={styles.filtersContainer}>
        {renderFilterRow(FILTER_KEYS)}

        {/* Búsqueda avanzada */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(v => !v)}
        >
          <Text style={styles.advancedToggleText}>
            Búsqueda avanzada
            {activeAdvancedCount > 0 ? ` (${activeAdvancedCount})` : ''}
          </Text>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color="#6366f1" />
        </TouchableOpacity>

        {showAdvanced && renderFilterRow(ADVANCED_FILTER_KEYS)}

        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={() => setFilters({})}>
            <Text style={styles.clearFilters}>Limpiar filtros ({activeFilterCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de ejercicios */}
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color="#6366f1" size="large" />
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={item => item._id}
          renderItem={renderExercise}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#6366f1" style={{ padding: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No se encontraron ejercicios</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Footer con seleccionados */}
      {selected.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{selected.length} seleccionado{selected.length !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Añadir al entrenamiento</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },
  filtersContainer: { paddingHorizontal: 12 },
  filterGroup: { marginBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  advancedToggleText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
  clearFilters: { fontSize: 13, color: '#ef4444', marginBottom: 8 },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseItemSelected: { borderWidth: 1.5, borderColor: '#6366f1' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  exerciseMeta: { fontSize: 12, color: '#888' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 15 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 6,
  },
  footerText: { fontSize: 14, color: '#6366f1', fontWeight: '600' },
  confirmButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
