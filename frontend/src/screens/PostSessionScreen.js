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

function DeltaBadge({ current, previous }) {
  if (previous == null || previous === 0) return null;
  const diff = current - previous;
  const pct  = Math.round(Math.abs(diff / previous) * 100);
  if (diff === 0) {
    return <Text style={styles.deltaEqual}>Sin cambios vs anterior</Text>;
  }
  const up = diff > 0;
  return (
    <View style={styles.deltaRow}>
      <Ionicons
        name={up ? 'trending-up-outline' : 'trending-down-outline'}
        size={12}
        color={up ? '#22c55e' : '#ef4444'}
      />
      <Text style={[styles.deltaText, { color: up ? '#22c55e' : '#ef4444' }]}>
        {up ? '+' : '-'}{pct}% vs anterior
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Cabecera celebración ─────────────────── */}
        <View style={styles.celebHeader}>
          <View style={styles.trophyRing}>
            <Ionicons name="trophy" size={44} color="#C9A44C" />
          </View>
          <Text style={styles.celebTitle}>¡Gran trabajo!</Text>
          <Text style={styles.celebSub}>{trainingName}</Text>
          <View style={styles.durationPill}>
            <Ionicons name="time-outline" size={14} color="#B11226" />
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        </View>

        {/* ── Stats principales ────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="barbell-outline" size={24} color="#C9A44C" />
            <Text style={styles.statVal}>
              {totalVolume > 0 ? totalVolume.toLocaleString('es-ES') : '—'}
            </Text>
            {totalVolume > 0 && <Text style={styles.statUnit}>kg volumen</Text>}
            <DeltaBadge current={totalVolume} previous={prevStats?.prevVolume} />
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#22c55e" />
            <Text style={styles.statVal}>{completedSets}</Text>
            <Text style={styles.statUnit}>series hechas</Text>
            <DeltaBadge current={completedSets} previous={prevStats?.prevCompleted} />
          </View>
        </View>

        {/* ── PRs ─────────────────────────────────── */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={15} color="#B11226" />
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
                <Ionicons name="arrow-up-circle" size={22} color="#22c55e" />
              </View>
            ))}
          </View>
        )}

        {/* ── Ejercicios realizados ────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={15} color="#9A9A9A" />
            <Text style={styles.sectionTitle}>Ejercicios realizados</Text>
          </View>
          {exerciseData.map((item, i) => {
            const done  = item.sets.filter(s => s.completed).length;
            const total = item.sets.length;
            const allDone = done === total && total > 0;
            return (
              <View key={i} style={styles.exRow}>
                <View style={[styles.exBadge, allDone && styles.exBadgeDone]}>
                  <Text style={styles.exBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.exName} numberOfLines={1}>
                  {getExerciseName(item.exercise)}
                </Text>
                <Text style={[styles.exSets, !allDone && styles.exSetsPartial]}>
                  {done}/{total}
                </Text>
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
  container: { flex: 1, backgroundColor: '#0D0D0D' },
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
    backgroundColor: '#1F1F1F',
    borderWidth: 2,
    borderColor: '#C9A44C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#C9A44C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  celebTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#EAEAEA',
    letterSpacing: -0.5,
  },
  celebSub: {
    fontSize: 15,
    color: '#9A9A9A',
    fontWeight: '500',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1F1F1F',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2A0A0A',
    marginTop: 6,
  },
  durationText: {
    fontSize: 14,
    color: '#B11226',
    fontWeight: '700',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#252525',
  },
  statVal: {
    fontSize: 26,
    fontWeight: '800',
    color: '#EAEAEA',
    marginTop: 6,
  },
  statUnit: {
    fontSize: 11,
    color: '#6A6A6A',
    fontWeight: '500',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deltaEqual: {
    fontSize: 11,
    color: '#6A6A6A',
    marginTop: 4,
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1F1F1F',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#252525',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A6A6A',
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
    borderTopColor: '#252525',
  },
  prBadge: {
    backgroundColor: '#B11226',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EAEAEA',
    letterSpacing: 0.5,
  },
  prName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EAEAEA',
  },
  prBestSet: {
    fontSize: 13,
    color: '#EAEAEA',
    fontWeight: '700',
    marginTop: 2,
  },
  prCompare: {
    fontSize: 12,
    color: '#9A9A9A',
    marginTop: 2,
  },
  prDeltaUp: {
    color: '#22c55e',
    fontWeight: '700',
  },
  prFirst: {
    fontSize: 12,
    color: '#6A6A6A',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Exercise list
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  exBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A0A0A',
    borderWidth: 1,
    borderColor: '#5A0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exBadgeDone: {
    backgroundColor: '#0A2A0A',
    borderColor: '#1A5A1A',
  },
  exBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A9A9A',
  },
  exName: {
    flex: 1,
    fontSize: 14,
    color: '#EAEAEA',
    fontWeight: '500',
  },
  exSets: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
  exSetsPartial: {
    color: '#C9A44C',
  },

  // Footer
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  doneBtn: {
    backgroundColor: '#B11226',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '700',
  },
});
