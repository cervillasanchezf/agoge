import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { planService } from '../services/api';

const DAYS = [
  { num: 1, label: 'Lunes' },
  { num: 2, label: 'Martes' },
  { num: 3, label: 'Miércoles' },
  { num: 4, label: 'Jueves' },
  { num: 5, label: 'Viernes' },
  { num: 6, label: 'Sábado' },
  { num: 7, label: 'Domingo' },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function WeeklyGrid({ days }) {
  const dayMap = {};
  (days || []).forEach((d) => { dayMap[d.dayOfWeek] = d.trainings || []; });

  return (
    <View style={styles.grid}>
      {DAYS.map(({ num, label }, index) => {
        const trainings = dayMap[num] || [];
        return (
          <View key={num}>
            {index > 0 && <View style={styles.gridDivider} />}
            <View style={styles.gridRow}>
              <Text style={styles.gridDayLabel}>{label}</Text>
              <View style={styles.gridRight}>
                {trainings.length === 0 ? (
                  <Text style={styles.restText}>Descanso</Text>
                ) : (
                  trainings.map((t, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText} numberOfLines={1}>{t.name || t}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function PlanScreen({ navigation }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuPlan, setMenuPlan] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [])
  );

  const loadPlans = async () => {
    try {
      setLoading(true);
      const result = await planService.getPlans();
      setPlans(result.data || []);
    } catch (err) {
      if (err?.response?.status !== 401) {
        Alert.alert('Error', 'No se pudieron cargar las planificaciones');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (plan) => {
    setMenuPlan(null);
    try {
      await planService.activatePlan(plan._id);
      await loadPlans();
    } catch {
      Alert.alert('Error', 'No se pudo activar la planificación');
    }
  };

  const handleFinish = (plan) => {
    Alert.alert(
      'Finalizar mesociclo',
      `¿Finalizar "${plan.name}"? Se archivará y podrás consultarlo en el historial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              await planService.finishPlan(plan._id);
              await loadPlans();
            } catch {
              Alert.alert('Error', 'No se pudo finalizar el plan');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (plan) => {
    setMenuPlan(null);
    Alert.alert(
      'Eliminar planificación',
      `¿Seguro que quieres eliminar "${plan.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await planService.deletePlan(plan._id);
              setPlans((prev) => prev.filter((p) => p._id !== plan._id));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la planificación');
            }
          },
        },
      ]
    );
  };

  const handleOpenMenu = (plan, event) => {
    const { pageY } = event.nativeEvent;
    setMenuPlan(plan);
    setMenuPosition({ y: pageY });
  };

  const getWeeksElapsed = (startDate) => {
    const ms = Date.now() - new Date(startDate).getTime();
    return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  };

  const activePlan = plans.find((p) => p.active);
  const pastPlans = plans.filter((p) => !p.active);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Planificaciones</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('NewPlan')}
        >
          <Ionicons name="add" size={24} color="#EAEAEA" />
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={56} color="#333333" />
          <Text style={styles.emptyText}>Sin planificaciones</Text>
          <Text style={styles.emptySubtext}>Organiza tu entrenamiento por mesociclos</Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => navigation.navigate('NewPlan')}
          >
            <Ionicons name="add" size={16} color="#EAEAEA" />
            <Text style={styles.emptyCreateBtnText}>Nueva planificación</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Active plan */}
          {activePlan ? (() => {
            const elapsed = getWeeksElapsed(activePlan.startDate);
            const progress = Math.min(elapsed / activePlan.weeks, 1);
            const isNearEnd = elapsed >= activePlan.weeks - 1;
            const currentWeek = Math.min(elapsed + 1, activePlan.weeks);

            return (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ACTIVO</Text>
                <View style={styles.activePlanCard}>
                  <View style={styles.activePlanTop}>
                    <Text style={styles.activePlanName}>{activePlan.name}</Text>
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>EN CURSO</Text>
                    </View>
                  </View>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>
                        Semana {currentWeek} de {activePlan.weeks}
                      </Text>
                      {isNearEnd && (
                        <View style={styles.endWarning}>
                          <Ionicons name="flag-outline" size={12} color="#C9A44C" />
                          <Text style={styles.endWarningText}>Fin de ciclo</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                    <Text style={styles.startDateText}>Inicio: {formatDate(activePlan.startDate)}</Text>
                  </View>

                  <WeeklyGrid days={activePlan.days} />

                  <View style={styles.activePlanActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => navigation.navigate('NewPlan', { plan: activePlan })}
                    >
                      <Ionicons name="pencil-outline" size={14} color="#9A9A9A" />
                      <Text style={styles.editBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.finishBtn}
                      onPress={() => handleFinish(activePlan)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color="#EAEAEA" />
                      <Text style={styles.finishBtnText}>Finalizar mesociclo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })() : (
            <View style={styles.noActiveBanner}>
              <Ionicons name="calendar-outline" size={16} color="#6A6A6A" />
              <Text style={styles.noActiveText}>No hay ningún plan activo</Text>
            </View>
          )}

          {/* Past plans */}
          {pastPlans.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ANTERIORES</Text>
              {pastPlans.map((plan) => (
                <View key={plan._id} style={styles.pastCard}>
                  <View style={styles.pastCardBody}>
                    <Text style={styles.pastPlanName}>{plan.name}</Text>
                    <Text style={styles.pastPlanMeta}>
                      {plan.weeks} semanas · Inicio {formatDate(plan.startDate)}
                      {plan.endDate ? ` · Fin ${formatDate(plan.endDate)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => handleOpenMenu(plan, e)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color="#6A6A6A" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Dropdown menu for past plans */}
      <Modal
        visible={!!menuPlan}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuPlan(null)}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setMenuPlan(null)}
          activeOpacity={1}
        />
        <View style={[styles.dropdown, { top: menuPosition.y + 10 }]}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => handleActivate(menuPlan)}
          >
            <Ionicons name="play-circle-outline" size={16} color="#9A9A9A" />
            <Text style={styles.dropdownItemText}>Activar plan</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { navigation.navigate('NewPlan', { plan: menuPlan }); setMenuPlan(null); }}
          >
            <Ionicons name="pencil-outline" size={16} color="#9A9A9A" />
            <Text style={styles.dropdownItemText}>Editar</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => handleDelete(menuPlan)}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B3B" />
            <Text style={[styles.dropdownItemText, { color: '#FF3B3B' }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#EAEAEA',
  },
  addBtn: {
    padding: 4,
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6A6A6A',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#4A4A4A',
    textAlign: 'center',
  },
  emptyCreateBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B11226',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyCreateBtnText: {
    color: '#EAEAEA',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A6A6A',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 2,
  },
  noActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  noActiveText: {
    color: '#6A6A6A',
    fontSize: 14,
  },
  // Active plan card
  activePlanCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  activePlanTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  activePlanName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#EAEAEA',
    flex: 1,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#1A3A1A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2E5E2E',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 0.8,
  },
  progressBlock: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: '#9A9A9A',
    fontWeight: '600',
  },
  endWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  endWarningText: {
    fontSize: 12,
    color: '#C9A44C',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#B11226',
    borderRadius: 3,
  },
  startDateText: {
    fontSize: 12,
    color: '#4A4A4A',
  },
  // Weekly grid
  grid: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#171717',
    borderRadius: 10,
    overflow: 'hidden',
  },
  gridDivider: {
    height: 1,
    backgroundColor: '#222222',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  gridDayLabel: {
    fontSize: 13,
    color: '#9A9A9A',
    width: 80,
    fontWeight: '500',
  },
  gridRight: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  restText: {
    fontSize: 13,
    color: '#3A3A3A',
    fontStyle: 'italic',
  },
  chip: {
    backgroundColor: '#2A1515',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#5A1A1A',
  },
  chipText: {
    fontSize: 12,
    color: '#CC6666',
    fontWeight: '600',
  },
  // Active plan action buttons
  activePlanActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRightWidth: 1,
    borderRightColor: '#2A2A2A',
  },
  editBtnText: {
    fontSize: 14,
    color: '#9A9A9A',
    fontWeight: '600',
  },
  finishBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  finishBtnText: {
    fontSize: 14,
    color: '#EAEAEA',
    fontWeight: '600',
  },
  // Past plan cards
  pastCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pastCardBody: {
    flex: 1,
  },
  pastPlanName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EAEAEA',
    marginBottom: 4,
  },
  pastPlanMeta: {
    fontSize: 13,
    color: '#6A6A6A',
  },
  // Dropdown menu
  dropdown: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 190,
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
    paddingVertical: 13,
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
