import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getExerciseName } from '../config/translations';
import { calcExerciseHI } from '../utils/hypertrophyMetrics';
import { COLORS } from '../config/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Epley 1RM estimate: weight × (1 + reps / 30) */
function calc1RM(weight, reps) {
  return weight * (1 + reps / 30);
}

function hiColor(hi) {
  if (hi >= 7) return COLORS.success;
  if (hi >= 4) return COLORS.gold;
  if (hi > 0)  return COLORS.warning;
  return COLORS.textMuted;
}

/** Compute total volume and completed sets from a previous session object. */
function calcPrevStats(prevSession) {
  if (!prevSession?.exercises) return null;
  let prevVolume = 0;
  let prevCompleted = 0;
  prevSession.exercises.forEach((ex) => {
    ex.sets?.forEach((s) => {
      if (s.completed) {
        prevCompleted++;
        if (ex.repMode !== 'cardio') {
          prevVolume += (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0);
        }
      }
    });
  });
  return { prevVolume, prevCompleted };
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function DeltaBadge({ current, previous, unit }) {
  if (previous == null || previous === 0) return null;
  const diff = current - previous;
  if (diff === 0) {
    return <Text style={styles.deltaEqual}>Sin cambios vs anterior</Text>;
  }
  const up = diff > 0;
  const label = unit
    ? `${up ? '+' : ''}${diff.toLocaleString('es-ES')} ${unit} vs anterior`
    : `${up ? '+' : '-'}${Math.round(Math.abs(diff / previous) * 100)}% vs anterior`;
  return (
    <View style={styles.deltaRow}>
      <Ionicons
        name={up ? 'trending-up-outline' : 'trending-down-outline'}
        size={12}
        color={up ? COLORS.success : COLORS.danger}
      />
      <Text style={[styles.deltaText, { color: up ? COLORS.success : COLORS.danger }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function PostSessionScreen({ route, navigation }) {
  const { trainingName, duration, exerciseData, prevSession, histPrMap = {} } = route.params;

  const prevStats = useMemo(() => calcPrevStats(prevSession), [prevSession]);

  const { totalVolume, completedSets, prs } = useMemo(() => {
    let totalVolume   = 0;
    let completedSets = 0;
    const prs = [];

    exerciseData.forEach((item) => {
      // Best set by 1RM
      let bestSet = null; // { weight, reps, orm }

      item.sets.forEach((s) => {
        if (s.completed) {
          completedSets++;
          if (item.repMode !== 'cardio') {
            const w = parseFloat(s.weight) || 0;
            const r = parseInt(s.reps)    || 0;
            totalVolume += w * r;
            if (w > 0) {
              const orm = calc1RM(w, r);
              if (!bestSet || orm > bestSet.orm) {
                bestSet = { weight: w, reps: r, orm };
              }
            }
          }
        }
      });

      if (item.repMode !== 'cardio' && bestSet) {
        const exId    = String(item.exercise?._id ?? item.exercise ?? '');
        const prevEntry = histPrMap[exId]; // { max1RM, weight, reps } | undefined
        const prevMax1RM = prevEntry?.max1RM ?? 0;
        if (bestSet.orm > prevMax1RM) {
          prs.push({
            name:       getExerciseName(item.exercise),
            bestWeight: bestSet.weight,
            bestReps:   bestSet.reps,
            current1RM: bestSet.orm,
            prev1RM:    prevMax1RM,
          });
        }
      }
    });

    return { totalVolume, completedSets, prs };
  }, [exerciseData, histPrMap]);

  const sessionHI = useMemo(() => {
    const his = exerciseData
      .filter(item => item.repMode !== 'cardio')
      .map(item => calcExerciseHI({
        exerciseId: item.exercise,
        sets: item.sets.map(s => ({
          completed: s.completed,
          reps:   parseInt(s.reps)     || parseInt(s.reps_default)    || 0,
          weight: parseFloat(s.weight) || parseFloat(s.weight_default) || 0,
          rpe:    parseInt(s.rpe)      || parseInt(s.rpe_default)      || 0,
        })),
      }))
      .filter(hi => hi > 0);
    return his.length ? his.reduce((a, b) => a + b, 0) / his.length : 0;
  }, [exerciseData]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Cabecera celebración ─────────────────── */}
        <View style={styles.celebHeader}>
          <View style={styles.trophyRing}>
            <Ionicons name="trophy" size={44} color={COLORS.gold} />
          </View>
          <Text style={styles.celebTitle}>¡Gran trabajo!</Text>
          <Text style={styles.celebSub}>{trainingName}</Text>
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* ── Stats principales ────────────────────── */}
        <View style={styles.statsCol}>
          {/* Volumen — fila ancha */}
          <View style={[styles.statCard, styles.statCardWide]}>
            <View style={styles.statCardRow}>
              <Ionicons name="barbell-outline" size={20} color={COLORS.gold} />
              <Text style={styles.statUnit}>Volumen total</Text>
            </View>
            <Text style={styles.statValLarge}>
              {totalVolume > 0 ? totalVolume.toLocaleString('es-ES') : '—'}
              {totalVolume > 0 && <Text style={styles.statUnitInline}> kg</Text>}
            </Text>
            <DeltaBadge current={totalVolume} previous={prevStats?.prevVolume} unit="kg" />
          </View>

          {/* Series + HI — fila dividida */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />
              <Text style={styles.statVal}>{completedSets}</Text>
              <Text style={styles.statUnit}>series hechas</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="flash-outline" size={22} color={hiColor(sessionHI)} />
              <Text style={[styles.statVal, { color: hiColor(sessionHI) }]}>
                {sessionHI > 0 ? sessionHI.toFixed(1) : '—'}
              </Text>
              <Text style={styles.statUnit}>índice HI</Text>
            </View>
          </View>
        </View>

        {/* ── PRs ─────────────────────────────────── */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={15} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>
                Nuevos récords · {prs.length}
              </Text>
            </View>
            {prs.map((pr, i) => (
              <View key={i} style={styles.prRow}>
                <View style={styles.prBadge}>
                  <Text style={styles.prBadgeText}>PR</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prName}>{pr.name}</Text>
                  <Text style={styles.prBestSet}>
                    {pr.bestWeight} kg × {pr.bestReps} rep{pr.bestReps !== 1 ? 's' : ''}
                  </Text>
                  {pr.prev1RM > 0 ? (
                    <Text style={styles.prCompare}>
                      1RM est. ~{Math.round(pr.current1RM)} kg{'  '}
                      <Text style={styles.prDeltaUp}>
                        (+{Math.round(pr.current1RM - pr.prev1RM)} kg vs récord)
                      </Text>
                    </Text>
                  ) : (
                    <Text style={styles.prFirst}>
                      1RM est. ~{Math.round(pr.current1RM)} kg · Primer registro
                    </Text>
                  )}
                </View>
                <Ionicons name="arrow-up-circle" size={22} color={COLORS.success} />
              </View>
            ))}
          </View>
        )}

        {/* ── Ejercicios realizados ────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={15} color={COLORS.textSecondary} />
            <Text style={styles.sectionTitle}>Ejercicios realizados</Text>
          </View>
          {exerciseData.map((item, i) => {
            const done  = item.sets.filter(s => s.completed).length;
            const total = item.sets.length;
            const allDone = done === total && total > 0;

            let bestSet = null;
            let exVolume = 0;
            let totalKm = 0;
            item.sets.forEach(s => {
              if (!s.completed) return;
              if (item.repMode === 'cardio') {
                totalKm += parseFloat(s.km) || 0;
              } else {
                const w = parseFloat(s.weight) || parseFloat(s.weight_default) || 0;
                const r = parseInt(s.reps)     || parseInt(s.reps_default)     || 0;
                exVolume += w * r;
                if (w > 0) {
                  const orm = calc1RM(w, r);
                  if (!bestSet || orm > bestSet.orm)
                    bestSet = { weight: w, reps: r, orm };
                }
              }
            });

            return (
              <View key={i} style={styles.exRow}>
                <View style={[styles.exBadge, allDone && styles.exBadgeDone]}>
                  <Text style={styles.exBadgeText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.exName} numberOfLines={1}>
                      {getExerciseName(item.exercise)}
                    </Text>
                    <Text style={[styles.exSets, !allDone && styles.exSetsPartial]}>
                      {done}/{total}
                    </Text>
                  </View>
                  {item.repMode === 'cardio' ? (
                    totalKm > 0 && (
                      <Text style={styles.exDetail}>
                        {totalKm % 1 === 0 ? totalKm : totalKm.toFixed(2)} km
                      </Text>
                    )
                  ) : (
                    (bestSet || exVolume > 0) && (
                      <Text style={styles.exDetail}>
                        {bestSet ? `${bestSet.weight} kg × ${bestSet.reps} reps` : ''}
                        {bestSet && exVolume > 0 ? ' · ' : ''}
                        {exVolume > 0 ? `${exVolume.toLocaleString('es-ES')} kg vol` : ''}
                      </Text>
                    )
                  )}
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>

      {/* ── Botón volver ─────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('TrainningList')}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { paddingBottom: 24 },

  // Celebration header
  celebHeader: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 20,
    gap: 6,
  },
  trophyRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  celebTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  celebSub: {
    fontSize: 17,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.dangerBg,
    marginTop: 6,
  },
  durationText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Stats
  statsCol: {
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  statCardWide: {
    alignItems: 'flex-start',
    gap: 6,
  },
  statCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 42,
  },
  statUnitInline: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statVal: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  statUnit: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deltaEqual: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // PRs
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  prBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  prBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  prName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  prBestSet: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  prCompare: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  prDeltaUp: {
    color: COLORS.success,
    fontWeight: '700',
  },
  prFirst: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Exercise list
  exRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  exBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exBadgeDone: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  exBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  exName: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  exSets: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
  },
  exSetsPartial: {
    color: COLORS.gold,
  },
  exDetail: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceElevated,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
