import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { exerciseService } from '../services/api';
import {
  CATEGORY_LABELS,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  getExerciseName,
} from '../config/translations';

const FILTER_CONFIG = [
  { key: 'category',      backendKey: 'categories', label: 'Tipo',     labelMap: CATEGORY_LABELS },
  { key: 'equipment',     backendKey: 'equipments',  label: 'Material', labelMap: EQUIPMENT_LABELS },
  { key: 'primaryMuscle', backendKey: 'muscles',     label: 'Músculo',  labelMap: MUSCLE_LABELS },
];

function FilterBottomSheet({ visible, config, options, activeValue, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{config?.label}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => { onSelect(null); onClose(); }}
              >
                <Text style={[styles.sheetOptionText, !activeValue && styles.sheetOptionActive]}>
                  Cualquiera
                </Text>
                {!activeValue && <Ionicons name="checkmark" size={18} color="#6366f1" />}
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const isActive = activeValue === item;
              return (
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <Text style={[styles.sheetOptionText, isActive && styles.sheetOptionActive]}>
                    {config?.labelMap[item] || item}
                  </Text>
                  {isActive && <Ionicons name="checkmark" size={18} color="#6366f1" />}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function ExercisePickerScreen({ navigation, route }) {
  const { selectedExercises = [], onSelect } = route.params || {};

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [exercises, setExercises] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(selectedExercises);
  const [openSheet, setOpenSheet] = useState(null);

  useEffect(() => {
    exerciseService.getFilters()
      .then(res => { if (res.success) setFilterOptions(res.data); })
      .catch(() => {});
  }, []);

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
        if (page === 1) setExercises(res.data);
        else setExercises(prev => [...prev, ...res.data]);
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
    if (!loading && !loadingMore && pagination.page < pagination.totalPages) {
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
      if (!value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const activeFilterCount = Object.keys(filters).length;
  const openConfig = FILTER_CONFIG.find(c => c.key === openSheet);
  const openOptions = openConfig ? (filterOptions[openConfig.backendKey] || []) : [];

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

      {/* Filtros — 3 botones */}
      <View style={styles.filterBar}>
        {FILTER_CONFIG.map(config => {
          const isActive = !!filters[config.key];
          const activeLabel = isActive
            ? (config.labelMap[filters[config.key]] || filters[config.key])
            : config.label;
          return (
            <TouchableOpacity
              key={config.key}
              style={[styles.filterBtn, isActive && styles.filterBtnActive]}
              onPress={() => setOpenSheet(config.key)}
            >
              <Text style={[styles.filterBtnText, isActive && styles.filterBtnTextActive]} numberOfLines={1}>
                {activeLabel}
              </Text>
              <Ionicons name="chevron-down" size={13} color={isActive ? '#6366f1' : '#888'} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          );
        })}
        {activeFilterCount > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setFilters({})}>
            <Ionicons name="close-circle" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
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

      {/* Footer */}
      {selected.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{selected.length} seleccionado{selected.length !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Añadir al entrenamiento</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom sheet de filtro */}
      <FilterBottomSheet
        visible={openSheet !== null}
        config={openConfig}
        options={openOptions}
        activeValue={openSheet ? filters[openSheet] : null}
        onSelect={(value) => setFilter(openSheet, value)}
        onClose={() => setOpenSheet(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Buscador
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 8,
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

  // Barra de filtros
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  filterBtnTextActive: { color: '#6366f1' },
  clearBtn: { padding: 2 },

  // Lista de ejercicios
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

  // Footer de selección
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

  // Bottom sheet
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetOptionText: { fontSize: 15, color: '#374151' },
  sheetOptionActive: { color: '#6366f1', fontWeight: '600' },
});
