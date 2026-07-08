import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { COLORS } from '../config/theme';

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

function WeeklyGrid({ planWeeks, weekIdx }) {
  const week = planWeeks?.[weekIdx];
  const dayMap = {};
  (week?.days || []).forEach((d) => { dayMap[d.dayOfWeek] = d.trainings || []; });

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
  const [viewWeekIdx, setViewWeekIdx] = useState(0);
  const weekIdxInitialized = useRef(null);

  useEffect(() => {
    const active = plans.find((p) => p.active);
    if (!active?.currentWeek) return;
    if (weekIdxInitialized.current === active._id) return;
    setViewWeekIdx(Math.max(0, active.currentWeek - 1));
    weekIdxInitialized.current = active._id;
  }, [plans]);

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
      'Finalizar planificación',
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

  const activePlan = plans.find((p) => p.active);
  const pastPlans = plans.filter((p) => !p.active);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
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
          <Ionicons name="add" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyText}>Sin planificaciones</Text>
          <Text style={styles.emptySubtext}>Organiza tu entrenamiento por mesociclos</Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => navigation.navigate('NewPlan')}
          >
            <Ionicons name="add" size={16} color={COLORS.textPrimary} />
            <Text style={styles.emptyCreateBtnText}>Nueva planificación</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Active plan */}
          {activePlan ? (() => {
            const totalWeeks = activePlan.planWeeks?.length || activePlan.weeks || 1;
            const currentWeek = activePlan.currentWeek ?? 1;
            const progress = Math.min(currentWeek / totalWeeks, 1);
            const isNearEnd = currentWeek >= totalWeeks;

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
                        Semana {currentWeek} de {totalWeeks}
                      </Text>
                      {isNearEnd && (
                        <View style={styles.endWarning}>
                          <Ionicons name="flag-outline" size={12} color={COLORS.gold} />
                          <Text style={styles.endWarningText}>Fin de ciclo</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                    <Text style={styles.startDateText}>Inicio: {formatDate(activePlan.startDate)}</Text>
                  </View>

                  {/* Navegador de semana */}
                  <View style={styles.weekNav}>
                    <TouchableOpacity
                      style={styles.weekNavBtn}
                      disabled={viewWeekIdx === 0}
                      onPress={() => setViewWeekIdx((v) => v - 1)}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={viewWeekIdx === 0 ? COLORS.border : COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                    <View style={styles.weekNavCenter}>
                      <Text style={styles.weekNavText}>
                        Semana {viewWeekIdx + 1} de {activePlan.planWeeks?.length || 0}
                      </Text>
                      {activePlan.planWeeks?.[viewWeekIdx]?.isDeload && (
                        <View style={styles.deloadBadge}>
                          <Text style={styles.deloadBadgeText}>Deload</Text>
                        </View>
                      )}
                      {viewWeekIdx + 1 === activePlan.currentWeek && (
                        <View style={styles.todayBadge}>
                          <Text style={styles.todayBadgeText}>ACTUAL</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.weekNavBtn}
                      disabled={viewWeekIdx >= (activePlan.planWeeks?.length || 1) - 1}
                      onPress={() => setViewWeekIdx((v) => v + 1)}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={viewWeekIdx >= (activePlan.planWeeks?.length || 1) - 1 ? COLORS.border : COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  <WeeklyGrid planWeeks={activePlan.planWeeks} weekIdx={viewWeekIdx} />

                  <View style={styles.activePlanActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => navigation.navigate('NewPlan', { plan: activePlan })}
                    >
                      <Ionicons name="pencil-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.editBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.finishBtn}
                      onPress={() => handleFinish(activePlan)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.textPrimary} />
                      <Text style={styles.finishBtnText}>Finalizar planificación</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })() : (
            <View style={styles.noActiveBanner}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} />
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
                      {plan.planWeeks?.length || plan.weeks || 0} semanas · Inicio {formatDate(plan.startDate)}
                      {plan.endDate ? ` · Fin ${formatDate(plan.endDate)}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => handleOpenMenu(plan, e)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
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
            <Ionicons name="play-circle-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.dropdownItemText}>Activar plan</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { navigation.navigate('NewPlan', { plan: menuPlan }); setMenuPlan(null); }}
          >
            <Ionicons name="pencil-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.dropdownItemText}>Editar</Text>
          </TouchableOpacity>
          <View style={styles.dropdownDivider} />
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => handleDelete(menuPlan)}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.dropdownItemText, { color: COLORS.danger }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    fontSize: 30,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
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
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 16,
    color: COLORS.iconInactive,
    textAlign: 'center',
  },
  emptyCreateBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyCreateBtnText: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 2,
  },
  noActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
  },
  noActiveText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  // Active plan card
  activePlanCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activePlanTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
  },
  activePlanName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
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
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  endWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  endWarningText: {
    fontSize: 14,
    color: COLORS.gold,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.surfaceInner,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  startDateText: {
    fontSize: 14,
    color: COLORS.iconInactive,
  },
  // Week navigator
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  weekNavBtn: {
    padding: 4,
  },
  weekNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  weekNavText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  deloadBadge: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.4)',
  },
  deloadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold || '#F5A623',
  },
  todayBadge: {
    backgroundColor: '#1A3A1A',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#2E5E2E',
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success || '#4CAF50',
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
    fontSize: 15,
    color: COLORS.textSecondary,
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
    fontSize: 15,
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
    fontSize: 14,
    color: '#CC6666',
    fontWeight: '600',
  },
  // Active plan action buttons
  activePlanActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderInner,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderInner,
  },
  editBtnText: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  // Past plan cards
  pastCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderInner,
  },
  pastCardBody: {
    flex: 1,
  },
  pastPlanName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  pastPlanMeta: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  // Dropdown menu
  dropdown: {
    position: 'absolute',
    right: 16,
    backgroundColor: COLORS.surface,
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
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
});
