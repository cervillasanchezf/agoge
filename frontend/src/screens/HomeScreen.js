import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { planService, sessionService, measurementService } from '../services/api';

const logoXml = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 846 246" width="846px" height="246px" xmlns:xlink="http://www.w3.org/1999/xlink">
<g><path fill-rule="evenodd" fill="#B11226" d="M 312.5,25.5 C 313.552,25.3505 314.552,25.5172 315.5,26C 322,31.8333 328.167,38 334,44.5C 334.667,45.1667 334.667,45.8333 334,46.5C 307.167,73.3333 280.333,100.167 253.5,127C 274.667,145.5 295.833,164 317,182.5C 317.5,169.504 317.667,156.504 317.5,143.5C 309.5,143.5 301.5,143.5 293.5,143.5C 293.553,133.953 293.22,124.619 292.5,115.5C 310.167,115.5 327.833,115.5 345.5,115.5C 345.83,153.073 345.496,190.573 344.5,228C 337.5,228.667 330.5,228.667 323.5,228C 289.129,197.294 254.463,166.961 219.5,137C 216.65,134.318 213.984,131.484 211.5,128.5C 244.568,94.9328 277.734,61.5994 311,28.5C 311.513,27.4734 312.013,26.4734 312.5,25.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#B11226" d="M 635.5,25.5 C 636.552,25.3505 637.552,25.5172 638.5,26C 643.333,30.8333 648.167,35.6667 653,40.5C 654.602,42.3687 655.602,44.3687 656,46.5C 629.113,73.3874 602.279,100.221 575.5,127C 596.667,145.5 617.833,164 639,182.5C 639.638,181.391 640.138,180.225 640.5,179C 640.767,167.199 640.434,155.365 639.5,143.5C 631.5,143.5 623.5,143.5 615.5,143.5C 615.5,134.167 615.5,124.833 615.5,115.5C 632.833,115.5 650.167,115.5 667.5,115.5C 667.5,153.167 667.5,190.833 667.5,228.5C 659.721,228.932 652.054,228.432 644.5,227C 609.463,195.628 574.13,164.628 538.5,134C 536.773,132.611 535.439,130.944 534.5,129C 536.206,126.428 538.039,123.928 540,121.5C 571.953,89.7129 603.787,57.7129 635.5,25.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#B11226" d="M 129.5,28.5 C 133.921,28.9567 138.587,29.29 143.5,29.5C 165.33,95.4896 187.663,161.323 210.5,227C 198.995,228.477 187.328,228.977 175.5,228.5C 171.019,212.225 165.852,196.225 160,180.5C 154.096,187.074 147.596,192.908 140.5,198C 127.167,198.667 113.833,198.667 100.5,198C 93.3725,192.541 86.5392,186.708 80,180.5C 74.5123,196.295 69.0123,212.128 63.5,228C 52.505,228.5 41.505,228.667 30.5,228.5C 52.7608,163.186 74.5941,97.5196 96,31.5C 107.091,29.8576 118.258,28.8576 129.5,28.5 Z M 119.5,68.5 C 124.311,71.4092 128.978,74.5759 133.5,78C 130.76,86.4537 128.094,94.9537 125.5,103.5C 126.002,104.521 126.668,104.688 127.5,104C 128.723,101.056 130.556,98.556 133,96.5C 148.785,101.794 157.285,112.794 158.5,129.5C 158.405,134.414 158.239,139.414 158,144.5C 156.704,147.951 155.204,151.285 153.5,154.5C 155.299,159.378 156.132,164.378 156,169.5C 149.974,179.859 141.64,187.859 131,193.5C 131.67,180.134 133.003,166.8 135,153.5C 135.374,152.584 135.874,151.75 136.5,151C 140.983,148.667 145.316,146.167 149.5,143.5C 150.6,139.558 150.767,135.558 150,131.5C 141.759,135.038 133.592,138.705 125.5,142.5C 125.072,147.456 124.905,152.456 125,157.5C 121.667,162.833 118.333,162.833 115,157.5C 114.336,153.304 114.503,149.138 115.5,145C 115.561,143.289 114.894,141.956 113.5,141C 106.389,138.028 99.2227,135.195 92,132.5C 91.228,132.645 90.5613,132.978 90,133.5C 89.8859,136.833 90.2192,140.166 91,143.5C 95.5038,146.42 100.171,149.086 105,151.5C 106.437,164.18 107.937,176.847 109.5,189.5C 109.167,190.5 108.833,191.5 108.5,192.5C 101.899,188.068 95.732,183.068 90,177.5C 87.3136,174.125 85.1469,170.459 83.5,166.5C 86.6311,159.194 86.1311,152.194 82,145.5C 78.5104,128.937 82.6771,114.771 94.5,103C 98.4622,100.436 102.629,98.269 107,96.5C 108.833,98.8333 110.667,101.167 112.5,103.5C 112.833,102.833 113.167,102.167 113.5,101.5C 111.502,93.838 109.502,86.1714 107.5,78.5C 107.608,77.5581 107.941,76.7247 108.5,76C 112.345,73.637 116.011,71.137 119.5,68.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#B11226" d="M 441.5,28.5 C 442.239,28.369 442.906,28.5357 443.5,29C 470.689,62.0216 497.689,95.1883 524.5,128.5C 498.271,162.73 470.937,196.064 442.5,228.5C 414.063,196.064 386.729,162.73 360.5,128.5C 387.523,95.1476 414.523,61.8143 441.5,28.5 Z M 441.5,75.5 C 456.363,93.355 471.363,111.188 486.5,129C 472.355,146.643 457.688,163.81 442.5,180.5C 428.196,163.191 413.863,145.858 399.5,128.5C 413.758,110.955 427.758,93.288 441.5,75.5 Z"/></g>
<g><path fill-rule="evenodd" fill="#B11226" d="M 789.5,26.5 C 791.371,26.8588 792.871,27.8588 794,29.5C 798.64,36.3066 803.473,42.9732 808.5,49.5C 781.645,71.5229 754.645,93.3562 727.5,115C 751.84,115.167 776.174,115.667 800.5,116.5C 801.744,125.48 801.744,134.48 800.5,143.5C 778.164,143.333 755.831,143.5 733.5,144C 759.62,163.785 785.453,183.952 811,204.5C 805.798,213.168 799.798,221.501 793,229.5C 760.333,203.5 727.667,177.5 695,151.5C 694.333,135.5 694.333,119.5 695,103.5C 726.689,77.9692 758.189,52.3025 789.5,26.5 Z"/></g>
</svg>`;

//---- Date helpers -------------

function toKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(date) {
  const d = new Date(date);
  const jsDay = d.getDay();
  d.setDate(d.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function jsToPlanDay(jsDay) {
  return jsDay === 0 ? 7 : jsDay;
}

function calcWeeklyCardioHours(sessions) {
  let totalSeconds = 0;
  sessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.repMode === 'cardio') {
        (ex.sets || []).forEach(set => {
          if (set.completed) {
            totalSeconds += (set.h || 0) * 3600 + (set.m || 0) * 60 + (set.s || 0);
          }
        });
      }
    });
  });
  return totalSeconds / 3600;
}

function fmtCardioHours(hours) {
  if (hours === 0) return '0 min';
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h}h ${m}m`;
}

function calcVolume(sessions) {
  return sessions.reduce(
    (t, s) =>
      t +
      (s.exercises || []).reduce(
        (t2, ex) =>
          t2 +
          (ex.sets || []).reduce(
            (t3, set) =>
              set.completed && set.weight > 0 && set.reps > 0
                ? t3 + set.weight * set.reps
                : t3,
            0,
          ),
        0,
      ),
    0,
  );
}

function fmtVolume(kg) {
  if (kg === 0) return '0 kg';
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

function getNextPlanDay(plan, todayPlanDay) {
  for (let i = 1; i <= 7; i++) {
    const checkDay = ((todayPlanDay - 1 + i) % 7) + 1;
    const found = (plan.days || []).find(
      d => d.dayOfWeek === checkDay && d.trainings.length > 0,
    );
    if (found) return { ...found, daysFromNow: i };
  }
  return null;
}

function buildMonthGrid(year, month) {
  const firstJsDay = new Date(year, month, 1).getDay();
  const offset = firstJsDay === 0 ? 6 : firstJsDay - 1;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_GEN = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const PLAN_DAY_NAMES = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
  5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
};
const STRIP_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

//---- Component -------------

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayPlanDay = useMemo(() => jsToPlanDay(today.getDay()), [today]);
  const todayKey = useMemo(() => toKey(today), [today]);

  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [allMeasurements, setAllMeasurements] = useState([]);

  // Calendar modal
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // Day sheet (bottom sheet for strip/calendar day details)
  const [daySheet, setDaySheet] = useState(null); // { key, label, plannedDay, sessions }

  // Date-edit picker
  const [editingSession, setEditingSession] = useState(null); // session object
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickYear, setPickYear] = useState(() => today.getFullYear());
  const [pickMonth, setPickMonth] = useState(() => today.getMonth());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    try {
      setLoading(true);
      const ninetyAgo = new Date();
      ninetyAgo.setDate(ninetyAgo.getDate() - 90);
      const [plansRes, sessionsRes, measurementsRes] = await Promise.all([
        planService.getPlans(),
        sessionService.getAllSessions({ startDate: ninetyAgo.toISOString(), limit: 500 }),
        measurementService.getMeasurements(),
      ]);
      const plans = plansRes?.data || [];
      setActivePlan(plans.find(p => p.active) || null);
      setSessions(sessionsRes?.data || []);
      setAllMeasurements(measurementsRes?.data || []);
    } catch (e) {
      console.error('HomeScreen load:', e);
    } finally {
      setLoading(false);
    }
  }

  //---- Derived -------------
  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const k = toKey(s.date);
      if (!map[k]) map[k] = [];
      map[k].push(s);
    });
    return map;
  }, [sessions]);

  const measurementsByDate = useMemo(() => {
    const map = {};
    allMeasurements.forEach(m => { map[toKey(m.date)] = m; });
    return map;
  }, [allMeasurements]);

  const todayMeasurement = useMemo(
    () => measurementsByDate[todayKey] || null,
    [measurementsByDate, todayKey],
  );

  const weekDays = useMemo(() => {
    const mon = getMonday(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, [today]);

  const weekSessions = useMemo(() => {
    const minKey = toKey(weekDays[0]);
    const maxKey = toKey(weekDays[6]);
    return sessions.filter(s => {
      const k = toKey(s.date);
      return k >= minKey && k <= maxKey;
    });
  }, [sessions, weekDays]);

  const weeklyCardioHours = useMemo(() => calcWeeklyCardioHours(weekSessions), [weekSessions]);
  const weeklyVolume = useMemo(() => calcVolume(weekSessions), [weekSessions]);

  // Set of trainingId strings completed during the current week (for strip missed-day logic)
  const weekDoneTrainingIds = useMemo(() => {
    const s = new Set();
    weekSessions.forEach(sess => {
      if (sess.trainingId?._id) s.add(String(sess.trainingId._id));
    });
    return s;
  }, [weekSessions]);

  // Map: Monday key of any week -> Set of trainingId strings done that week (for monthly calendar)
  const weekTrainingIdMap = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      if (!s.trainingId?._id) return;
      const mon = getMonday(new Date(s.date));
      const wk = toKey(mon);
      if (!map[wk]) map[wk] = new Set();
      map[wk].add(String(s.trainingId._id));
    });
    return map;
  }, [sessions]);

  // Map from plan dayOfWeek (1=Mon…7=Sun) -> plan day object
  const planDayMap = useMemo(() => {
    if (!activePlan) return {};
    const map = {};
    (activePlan.days || []).forEach(d => {
      if ((d.trainings || []).filter(Boolean).length > 0) map[d.dayOfWeek] = d;
    });
    return map;
  }, [activePlan]);

  const planProgress = useMemo(() => {
    if (!activePlan?.startDate || !activePlan?.weeks) return null;
    const elapsed = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(activePlan.startDate).getTime()) /
        (7 * 24 * 3600 * 1000),
      ),
    );
    return { elapsed, weeks: activePlan.weeks };
  }, [activePlan]);

  const isLastPlanWeek = planProgress
    ? planProgress.elapsed >= planProgress.weeks - 1
    : false;

  const todayTrainings = useMemo(() => {
    if (!activePlan) return null;
    return (activePlan.days || []).find(d => d.dayOfWeek === todayPlanDay) || null;
  }, [activePlan, todayPlanDay]);

  const nextPlanDay = useMemo(() => {
    if (!activePlan) return null;
    return getNextPlanDay(activePlan, todayPlanDay);
  }, [activePlan, todayPlanDay]);

  const weekPlannedCount = useMemo(
    () => weekDays.filter(d => !!planDayMap[jsToPlanDay(d.getDay())]).length,
    [weekDays, planDayMap],
  );

  const todayDone = useMemo(
    () => sessionsByDate[todayKey] || [],
    [sessionsByDate, todayKey],
  );

  const calendarGrid = useMemo(
    () => buildMonthGrid(calYear, calMonth),
    [calYear, calMonth],
  );

  // Plan date bounds for calendar navigation
  const planBounds = useMemo(() => {
    if (!activePlan?.startDate || !activePlan?.weeks) return null;
    const start = new Date(activePlan.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + activePlan.weeks * 7 - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [activePlan]);

  //---- Month nav -------------
  function prevMonth() {
    let newYear = calYear;
    let newMonth = calMonth - 1;
    if (newMonth < 0) { newYear -= 1; newMonth = 11; }
    setCalYear(newYear);
    setCalMonth(newMonth);
  }

  function nextMonth() {
    let newYear = calYear;
    let newMonth = calMonth + 1;
    if (newMonth > 11) { newYear += 1; newMonth = 0; }
    setCalYear(newYear);
    setCalMonth(newMonth);
  }

  function openCalendar() {
    setCalYear(today.getFullYear());
    setCalMonth(today.getMonth());
    setSelectedDayKey(null);
    setShowCalendar(true);
  }

  // Returns the Set of planned dayOfWeek numbers for a given date,
  // using the versioned dayHistory so past stats are not retroactively affected.
  const getPlannedDaysSet = useCallback((date) => {
    if (!activePlan) return new Set();
    const history = [...(activePlan.dayHistory || [])]
      .map(h => ({ effectiveFrom: new Date(h.effectiveFrom), days: h.days }))
      .sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    if (history.length === 0) {
      history.push({ effectiveFrom: new Date(activePlan.startDate), days: activePlan.days });
    }
    let activeDays = history[0].days;
    for (const entry of history) {
      if (entry.effectiveFrom <= date) activeDays = entry.days;
      else break;
    }
    return new Set(
      (activeDays || []).filter(d => d.trainings?.length > 0).map(d => d.dayOfWeek)
    );
  }, [activePlan]);

  function openDaySheet(d) {
    const key = toKey(d);
    let planDay = planDayMap[jsToPlanDay(d.getDay())] || null;
    const daySessions = sessionsByDate[key] || [];
    // If this day has no sessions of its own but its training was done elsewhere this week → hide PLANIFICADO
    if (planDay && !daySessions.length) {
      const covered = planDay.trainings.some(t => weekDoneTrainingIds.has(String(t._id)));
      if (covered) planDay = null;
    }
    const label = `${WEEKDAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_GEN[d.getMonth()]}`;
    setDaySheet({ key, label, planDay, sessions: daySessions, date: d });
  }

  async function handleUpdateSessionDate(sessionId, newDateKey) {
    try {
      await sessionService.updateSession(sessionId, { date: new Date(`${newDateKey}T12:00:00`).toISOString() });
      setShowDatePicker(false);
      setEditingSession(null);
      setDaySheet(null);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo actualizar la fecha de la sesión');
    }
  }

  function openDatePicker(session) {
    const d = new Date(session.date);
    setPickYear(d.getFullYear());
    setPickMonth(d.getMonth());
    setEditingSession(session);
    setShowDatePicker(true);
  }

  const selectedDaySessions = selectedDayKey
    ? sessionsByDate[selectedDayKey] || []
    : [];

  const selectedDayPlanDay = useMemo(() => {
    if (!selectedDayKey || !activePlan) return null;
    const d = new Date(`${selectedDayKey}T12:00:00`);
    const planDay = planDayMap[jsToPlanDay(d.getDay())] || null;
    if (!planDay) return null;
    const daySessions = sessionsByDate[selectedDayKey] || [];
    if (daySessions.length) return planDay; // session done on this exact day → show PLANIFICADO
    // Check if training was done on another day of the same week
    const weekDoneIds = weekTrainingIdMap[toKey(getMonday(d))] || new Set();
    const covered = planDay.trainings.some(t => weekDoneIds.has(String(t._id)));
    return covered ? null : planDay;
  }, [selectedDayKey, activePlan, planDayMap, sessionsByDate, weekTrainingIdMap]);

  const selectedDayIsMeasurementDay = useMemo(() => {
    if (!selectedDayKey || !activePlan?.measurementDay || !planBounds) return false;
    const d = new Date(`${selectedDayKey}T12:00:00`);
    if (d < planBounds.start || d > planBounds.end) return false;
    return jsToPlanDay(d.getDay()) === activePlan.measurementDay;
  }, [selectedDayKey, activePlan, planBounds]);

  const isMeasurementDay = useMemo(
    () => !!(activePlan?.measurementDay && activePlan.measurementDay === todayPlanDay),
    [activePlan, todayPlanDay],
  );

  const todayFormatted = `${WEEKDAYS_ES[today.getDay()]}, ${today.getDate()} de ${MONTHS_GEN[today.getMonth()]}`;

  // ---- Loading -------------
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#B11226" style={styles.loader} />
      </SafeAreaView>
    );
  }

  // ---- Render -------------
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <SvgXml xml={logoXml} width="160" height="50" />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hola, {user?.name?.split(' ')[0] || user?.name}
          </Text>
          <Text style={styles.dateText}>{todayFormatted}</Text>
        </View>

        {/* End-of-cycle banner */}
        {isLastPlanWeek && (
          <View style={styles.endBanner}>
            <Ionicons name="flag-outline" size={16} color="#C9A44C" />
            <Text style={styles.endBannerText}>
              Última semana de la planificación "{activePlan.name}". ¡Aprieta fuerte!
            </Text>
          </View>
        )}

        {/*  Esta semana  */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={styles.sectionTitle}>Esta semana</Text>
              {weekPlannedCount > 0 && (
                <Text style={styles.weekProgressBadge}>
                  {weekSessions.length}/{weekPlannedCount}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={openCalendar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="calendar-outline" size={22} color="#C9A44C" />
            </TouchableOpacity>
          </View>
          <View style={styles.strip}>
            {weekDays.map((d, i) => {
              const key = toKey(d);
              const isToday = key === todayKey;
              const hasSess = !!sessionsByDate[key]?.length;
              const planDay = planDayMap[jsToPlanDay(d.getDay())];
              const hasPlanned = !!planDay;
              const isPast = key <= todayKey;
              // training fulfilled elsewhere this week (done on a different day)
              const trainingCoveredElsewhere = hasPlanned && !hasSess
                ? planDay.trainings.some(t => weekDoneTrainingIds.has(String(t._id)))
                : false;
              // bar: gold if session done, dark red if planned+past+missed+not compensated, nothing otherwise
              const barColor = hasSess
                ? '#C9A44C'
                : hasPlanned && isPast && key !== todayKey && !trainingCoveredElsewhere
                  ? '#5A0000'
                  : hasPlanned && !trainingCoveredElsewhere
                    ? '#3A1010'
                    : null;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.stripDay, isToday && styles.stripDayToday]}
                  onPress={() => openDaySheet(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stripLabel, isToday && styles.redText]}>
                    {STRIP_LABELS[i]}
                  </Text>
                  <Text style={[styles.stripNum, isToday && styles.redText]}>
                    {d.getDate()}
                  </Text>
                  <View style={[styles.stripBar, barColor && { backgroundColor: barColor }]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/*  Hoy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hoy</Text>
          {!activePlan ? (
            <View style={styles.card}>
              <Ionicons
                name="calendar-clear-outline"
                size={28}
                color="#9A9A9A"
                style={styles.cardIcon}
              />
              <Text style={styles.cardEmptyTitle}>Sin planificación activa</Text>
              <Text style={styles.cardEmptyDesc}>
                Crea una planificación para ver aquí tu entrenamiento del día.
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  navigation.navigate('TrainningTab', { screen: 'Plans' })
                }
              >
                <Text style={styles.primaryBtnText}>Crear planificación</Text>
              </TouchableOpacity>
            </View>
          ) : todayTrainings && todayTrainings.trainings.length > 0 ? (() => {
            const pendingTraining = todayTrainings.trainings[todayDone.length] || null;
            const CardWrapper = pendingTraining ? TouchableOpacity : View;
            const cardWrapperProps = pendingTraining
              ? {
                style: [styles.card, styles.trainingCard],
                activeOpacity: 0.8,
                onPress: () =>
                  navigation.navigate('TrainningTab', {
                    screen: 'TrainingSummary',
                    params: { trainingId: pendingTraining._id, trainingName: pendingTraining.name },
                  }),
              }
              : { style: [styles.card, styles.trainingCard] };
            return (
              <CardWrapper {...cardWrapperProps}>
                {todayDone.length > 0 ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Ionicons name="checkmark-circle" size={16} color="#C9A44C" />
                      <Text style={[styles.microLabel, { marginBottom: 0, marginLeft: 6 }]}>COMPLETADO HOY</Text>
                    </View>
                    {todayDone.map((s, i) => (
                      <View key={i} style={{ marginBottom: i < todayDone.length - 1 ? 10 : 0 }}>
                        <Text style={styles.todayName} numberOfLines={1}>
                          {s.trainingId?.name || 'Entrenamiento'}
                        </Text>
                        <Text style={styles.sessionRowMeta}>
                          {Math.floor((s.duration || 0) / 60)} min · {(s.exercises || []).length} ejercicios
                        </Text>
                      </View>
                    ))}
                    {pendingTraining && (
                      <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2E2E2E' }]}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={[styles.microLabel, { marginBottom: 2 }]}>PENDIENTE</Text>
                          <Text style={styles.todayName} numberOfLines={1}>
                            {pendingTraining.name}
                          </Text>
                        </View>
                        <View style={styles.playBtn}>
                          <Ionicons name="play" size={20} color="#EAEAEA" />
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.microLabel}>DÍA DE ENTRENO</Text>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        {todayTrainings.trainings.map((t, i) => (
                          <Text key={i} style={styles.todayName}>
                            {t.name}
                          </Text>
                        ))}
                        {todayTrainings.trainings.length > 1 && (
                          <Text style={styles.doubleTag}>Doble sesión</Text>
                        )}
                      </View>
                      <View style={styles.playBtn}>
                        <Ionicons name="play" size={20} color="#EAEAEA" />
                      </View>
                    </View>
                  </>
                )}
              </CardWrapper>
            );
          })() : (
            <View style={styles.card}>
              <Text style={styles.restTitle}>Hoy toca descanso</Text>
              {nextPlanDay && (
                <Text style={styles.nextText}>
                  {'Próximo: '}
                  {PLAN_DAY_NAMES[nextPlanDay.dayOfWeek]}
                  {nextPlanDay.daysFromNow === 1
                    ? ' (mañana)'
                    : ` (en ${nextPlanDay.daysFromNow} días)`}
                  {' – '}
                  {nextPlanDay.trainings.map(t => t.name).join(', ')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Toma de medidas de hoy */}
        {isMeasurementDay && (
          <View style={[styles.section, { marginTop: 16 }]}>
            {todayMeasurement ? (
              <TouchableOpacity
                style={[styles.card, styles.measurementCardDone]}
                onPress={() => navigation.navigate('ProfileTab', { screen: 'Medidas' })}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#B11226" />
                  <Text style={[styles.microLabel, { marginBottom: 0, marginLeft: 6 }]}>TOMA DE MEDIDAS</Text>
                </View>
                <Text style={[styles.todayName, { color: '#EAEAEA' }]}>Realizada hoy</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.card, styles.measurementCardPending]}
                onPress={() => navigation.navigate('ProfileTab', { screen: 'Medidas' })}
                activeOpacity={0.8}
              >
                <Text style={styles.microLabel}>TOMA DE MEDIDAS</Text>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.todayName}>Pendiente de registrar</Text>
                  </View>
                  <View style={[styles.playBtn, { backgroundColor: '#1A0005', borderWidth: 1, borderColor: '#B11226' }]}>
                    <Ionicons name="body-outline" size={20} color="#B11226" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Estadísticas ── */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Estadísticas</Text>
          </View>
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HomeStats', { sessions, activePlan })}
            >
              <Ionicons name="bicycle-outline" size={22} color="#B11226" />
              <Text style={styles.statValue}>{fmtCardioHours(weeklyCardioHours)}</Text>
              <Text style={styles.statLabel}>{'Cardio\nsemana'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HomeStats', { sessions, activePlan })}
            >
              <Ionicons name="checkmark-circle-outline" size={22} color="#C9A44C" />
              <Text style={styles.statValue}>{weekSessions.length}</Text>
              <Text style={styles.statLabel}>{'Sesiones\nsemana'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('HomeStats', { sessions, activePlan })}
            >
              <Ionicons name="barbell-outline" size={22} color="#9A9A9A" />
              <Text style={styles.statValue}>{fmtVolume(weeklyVolume)}</Text>
              <Text style={styles.statLabel}>{'Volumen\nsemana'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.statsAdvBtn}
            onPress={() =>
              navigation.navigate('HomeStats', {
                sessions,
                activePlan,
              })
            }
            activeOpacity={0.7}
          >
            <Ionicons name="analytics-outline" size={16} color="#C9A44C" />
            <Text style={styles.statsAdvBtnText}>Ver estadísticas avanzadas</Text>
            <Ionicons name="chevron-forward" size={14} color="#C9A44C" />
          </TouchableOpacity>
        </View>

        {/* Planificación activa */}
        {activePlan && planProgress && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planificación activa</Text>
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('TrainningTab', { screen: 'Plans' })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.planName} numberOfLines={1}>
                  {activePlan.name}
                </Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>EN CURSO</Text>
                </View>
              </View>
              <Text style={styles.progressLabel}>
                Semana{' '}
                {Math.min(planProgress.elapsed + 1, planProgress.weeks)} de{' '}
                {planProgress.weeks}
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        (planProgress.elapsed / planProgress.weeks) * 100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Monthly Calendar Modal */}
      <Modal
        visible={showCalendar}
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowCalendar(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="#EAEAEA" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Calendario</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Month navigation */}
            {(() => {
              let weekRangeLabel = null;
              if (planBounds && activePlan?.weeks) {
                const firstOfMonth = new Date(calYear, calMonth, 1);
                const lastOfMonth = new Date(calYear, calMonth + 1, 0);
                const wFirst = Math.floor((firstOfMonth - planBounds.start) / (7 * 24 * 3600 * 1000)) + 1;
                const wLast = Math.floor((lastOfMonth - planBounds.start) / (7 * 24 * 3600 * 1000)) + 1;
                const wFrom = Math.max(1, wFirst);
                const wTo = Math.min(activePlan.weeks, wLast);
                if (wFrom <= activePlan.weeks && wTo >= 1) {
                  weekRangeLabel = wFrom === wTo
                    ? `Semana ${wFrom} de ${activePlan.weeks}`
                    : `Semanas ${wFrom}–${wTo} de ${activePlan.weeks}`;
                }
              }
              return (
                <View style={styles.monthNav}>
                  <TouchableOpacity
                    onPress={prevMonth}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="chevron-back" size={22} color="#EAEAEA" />
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.monthTitle}>{MONTHS_ES[calMonth]} {calYear}</Text>
                    {weekRangeLabel && (
                      <Text style={styles.calWeekRangeLabel}>{weekRangeLabel}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={nextMonth}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="chevron-forward" size={22} color="#EAEAEA" />
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Week day headers */}
            <View style={styles.calWeekRow}>
              <View style={{ width: 30 }} />
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(l => (
                <Text key={l} style={styles.calWeekLabel}>
                  {l}
                </Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calGrid}>
              {Array.from({ length: calendarGrid.length / 7 }, (_, row) => {
                const rowCells = calendarGrid.slice(row * 7, row * 7 + 7);
                const firstDay = rowCells.find(d => d !== null);
                let weekNum = null;
                if (firstDay && planBounds && activePlan?.weeks) {
                  const firstDate = new Date(calYear, calMonth, firstDay);
                  const weekIdx = Math.floor((firstDate - planBounds.start) / (7 * 24 * 3600 * 1000));
                  if (weekIdx >= 0 && weekIdx < activePlan.weeks) weekNum = weekIdx + 1;
                }
                return (
                  <View key={row} style={styles.calRow}>
                    <View style={styles.calWeekNumCol}>
                      {weekNum !== null && (
                        <Text style={styles.calWeekNumText}>S{weekNum}</Text>
                      )}
                    </View>
                    {rowCells.map((day, col) => {
                      if (day === null) {
                        return <View key={col} style={styles.calCell} />;
                      }
                      const cellKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isToday = cellKey === todayKey;
                      const hasSess = !!sessionsByDate[cellKey]?.length;
                      const cellDate = new Date(`${cellKey}T12:00:00`);
                      const hasPlanned = !!planDayMap[jsToPlanDay(cellDate.getDay())];
                      const isSelected = cellKey === selectedDayKey;
                      const isOutOfPlan = !!planBounds && (cellDate < planBounds.start || cellDate > planBounds.end);
                      const isMeasDay = !isOutOfPlan && !!(activePlan?.measurementDay && jsToPlanDay(cellDate.getDay()) === activePlan.measurementDay);
                      const hasMeasurement = !!measurementsByDate[cellKey];
                      // Check if this planned day's training was fulfilled on another day of the same week
                      const cellPlanDay = planDayMap[jsToPlanDay(cellDate.getDay())];
                      const cellWeekDoneIds = weekTrainingIdMap[toKey(getMonday(cellDate))] || new Set();
                      const calTrainingCoveredElsewhere = hasPlanned && !hasSess && !isOutOfPlan && !!cellPlanDay
                        && cellPlanDay.trainings.some(t => cellWeekDoneIds.has(String(t._id)));
                      // Out-of-plan days are only interactive if they have a completed session
                      const isInteractive = !isOutOfPlan || hasSess;
                      return (
                        <TouchableOpacity
                          key={col}
                          style={[
                            styles.calCell,
                            isToday && styles.calCellToday,
                            isSelected && styles.calCellSelected,
                          ]}
                          onPress={() =>
                            isInteractive && setSelectedDayKey(isSelected ? null : cellKey)
                          }
                          activeOpacity={isInteractive ? 0.7 : 1}
                          disabled={!isInteractive}
                        >
                          <View style={styles.calCellInner}>
                            <Text
                              style={[
                                styles.calCellNum,
                                isToday && styles.calCellTodayNum,
                                isSelected && styles.calCellSelectedNum,
                              ]}
                            >
                              {day}
                            </Text>
                            {(hasSess || (hasPlanned && !isOutOfPlan && !calTrainingCoveredElsewhere) || isMeasDay) && (
                              <View style={styles.calDotsRow}>
                                {hasPlanned && !isOutOfPlan && !calTrainingCoveredElsewhere && (
                                  <View style={[
                                    styles.calDot,
                                    { backgroundColor: hasSess ? '#C9A44C' : '#B11226' },
                                    (isToday || isSelected) && { backgroundColor: '#EAEAEA' },
                                  ]} />
                                )}
                                {hasSess && (isOutOfPlan || !hasPlanned) && (
                                  <View style={[
                                    styles.calDot,
                                    { backgroundColor: '#C9A44C' },
                                    (isToday || isSelected) && { backgroundColor: '#EAEAEA' },
                                  ]} />
                                )}
                                {isMeasDay && (
                                  <View style={[
                                    styles.calDot,
                                    { backgroundColor: hasMeasurement ? '#9A9A9A' : '#444' },
                                    (isToday || isSelected) && { backgroundColor: '#EAEAEA' },
                                  ]} />
                                )}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* Selected day details */}
            {selectedDayKey && (
              <View style={styles.dayPanel}>
                <Text style={styles.dayPanelTitle}>
                  {(() => {
                    const d = new Date(`${selectedDayKey}T12:00:00`);
                    return `${WEEKDAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_GEN[d.getMonth()]}`;
                  })()}
                </Text>

                {/* Planificado */}
                {selectedDayPlanDay && (
                  <View style={styles.dayPanelSection}>
                    <Text style={styles.dayPanelSectionLabel}>PLANIFICADO</Text>
                    {selectedDayPlanDay.trainings.map((t, i) => (
                      <View key={i} style={styles.sessionRow}>
                        <Ionicons name="calendar-outline" size={16} color="#B11226" />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.sessionRowName}>{t.name}</Text>
                        </View>
                        {!selectedDaySessions.length && (
                          <TouchableOpacity
                            style={styles.dayPanelPlayBtn}
                            onPress={() => {
                              setShowCalendar(false);
                              navigation.navigate('TrainningTab', {
                                screen: 'TrainingSummary',
                                params: {
                                  trainingId: t._id,
                                  trainingName: t.name,
                                  scheduledDate: selectedDayKey,
                                },
                              });
                            }}
                          >
                            <Ionicons name="play" size={14} color="#EAEAEA" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Completado */}
                {selectedDaySessions.length > 0 && (
                  <View style={styles.dayPanelSection}>
                    <Text style={styles.dayPanelSectionLabel}>COMPLETADO</Text>
                    {selectedDaySessions.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.sessionRow}
                        onPress={() => {
                          setShowCalendar(false);
                          navigation.navigate('HomeSessionDetail', { session: s });
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="barbell-outline" size={16} color="#C9A44C" />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.sessionRowName}>
                            {s.trainingId?.name || 'Entrenamiento'}
                          </Text>
                          <Text style={styles.sessionRowMeta}>
                            {Math.floor((s.duration || 0) / 60)} min ·{' '}
                            {(s.exercises || []).length} ejercicios
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#555" />
                        <TouchableOpacity
                          style={[styles.editDateBtn, { marginLeft: 4 }]}
                          onPress={(e) => { e.stopPropagation(); setShowCalendar(false); openDatePicker(s); }}
                        >
                          <Ionicons name="calendar-outline" size={14} color="#C9A44C" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Medidas */}
                {selectedDayIsMeasurementDay && (
                  <View style={styles.dayPanelSection}>
                    <Text style={styles.dayPanelSectionLabel}>TOMA DE MEDIDAS</Text>
                    <TouchableOpacity
                      style={styles.sessionRow}
                      onPress={() => {
                        setShowCalendar(false);
                        navigation.navigate('ProfileTab', { screen: 'Medidas' });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={measurementsByDate[selectedDayKey] ? 'checkmark-circle' : 'body-outline'}
                        size={16}
                        color={measurementsByDate[selectedDayKey] ? '#B11226' : '#9A9A9A'}
                      />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.sessionRowName}>
                          {measurementsByDate[selectedDayKey] ? 'Realizada' : 'Pendiente de registrar'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#555" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Descanso */}
                {!selectedDayPlanDay && !selectedDaySessions.length && !selectedDayIsMeasurementDay && (
                  <Text style={styles.noSessionsText}>Día de descanso</Text>
                )}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Day Sheet – bottom sheet for strip day taps */}
      <Modal
        visible={!!daySheet}
        animationType="slide"
        transparent
        onRequestClose={() => setDaySheet(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setDaySheet(null)}
        />
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {daySheet?.label}
          </Text>

          {/* Planned workout */}
          {daySheet?.planDay && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionLabel}>PLANIFICADO</Text>
              {daySheet.planDay.trainings.map((t, i) => (
                <View key={i} style={styles.sheetTrainingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTrainingName}>{t.name}</Text>
                  </View>
                  {/* Only show start button if there's no session yet for that day */}
                  {!daySheet.sessions?.length && (
                    <TouchableOpacity
                      style={styles.sheetPlayBtn}
                      onPress={() => {
                        setDaySheet(null);
                        navigation.navigate('TrainningTab', {
                          screen: 'TrainingSummary',
                          params: {
                            trainingId: t._id,
                            trainingName: t.name,
                            scheduledDate: daySheet.key,
                          },
                        });
                      }}
                    >
                      <Ionicons name="play" size={16} color="#EAEAEA" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Completed sessions */}
          {daySheet?.sessions?.length > 0 && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionLabel}>COMPLETADO</Text>
              {daySheet.sessions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.sheetSessionCard}
                  onPress={() => {
                    setDaySheet(null);
                    navigation.navigate('HomeSessionDetail', { session: s });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetSessionName}>
                      {s.trainingId?.name || 'Entrenamiento'}
                    </Text>
                    <Text style={styles.sheetSessionMeta}>
                      {Math.floor((s.duration || 0) / 60)} min · {(s.exercises || []).length} ejercicios
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#555" style={{ marginRight: 4 }} />
                  <TouchableOpacity
                    style={styles.editDateBtn}
                    onPress={(e) => { e.stopPropagation(); openDatePicker(s); }}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#C9A44C" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Rest day – no plan, no session */}
          {!daySheet?.planDay && !daySheet?.sessions?.length && (
            <Text style={styles.sheetRestText}>Sin entrenamiento planificado</Text>
          )}

          <View style={{ height: 24 }} />
        </View>
      </Modal>

      {/* Date Picker Modal – change a session's date */}
      <Modal
        visible={showDatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowDatePicker(false); setEditingSession(null); }}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => { setShowDatePicker(false); setEditingSession(null); }}
        />
        <View style={[styles.sheetContainer, { maxHeight: '75%' }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Cambiar fecha</Text>

          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                if (pickMonth === 0) { setPickYear(y => y - 1); setPickMonth(11); }
                else setPickMonth(m => m - 1);
              }}
            >
              <Ionicons name="chevron-back" size={22} color="#EAEAEA" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS_ES[pickMonth]} {pickYear}</Text>
            <TouchableOpacity
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => {
                if (pickMonth === 11) { setPickYear(y => y + 1); setPickMonth(0); }
                else setPickMonth(m => m + 1);
              }}
            >
              <Ionicons name="chevron-forward" size={22} color="#EAEAEA" />
            </TouchableOpacity>
          </View>

          <View style={styles.calWeekRow}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(l => (
              <Text key={l} style={styles.calWeekLabel}>{l}</Text>
            ))}
          </View>

          {(() => {
            const grid = buildMonthGrid(pickYear, pickMonth);
            const currentKey = editingSession ? toKey(new Date(editingSession.date)) : null;
            return (
              <View style={styles.calGrid}>
                {Array.from({ length: grid.length / 7 }, (_, row) => (
                  <View key={row} style={styles.calRow}>
                    {grid.slice(row * 7, row * 7 + 7).map((day, col) => {
                      if (!day) return <View key={col} style={styles.calCell} />;
                      const cellKey = `${pickYear}-${String(pickMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isSelected = cellKey === currentKey;
                      const isTodayCell = cellKey === todayKey;
                      return (
                        <TouchableOpacity
                          key={col}
                          style={[
                            styles.calCell,
                            isTodayCell && styles.calCellToday,
                            isSelected && styles.calCellSelected,
                          ]}
                          onPress={() => {
                            if (editingSession) {
                              Alert.alert(
                                'Cambiar fecha',
                                `¿Mover la sesión al ${day} de ${MONTHS_GEN[pickMonth]}?`,
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  { text: 'Confirmar', onPress: () => handleUpdateSessionDate(editingSession._id, cellKey) },
                                ]
                              );
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.calCellInner}>
                            <Text style={[
                              styles.calCellNum,
                              isTodayCell && styles.calCellTodayNum,
                              isSelected && styles.calCellSelectedNum,
                            ]}>{day}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })()}

          <View style={{ height: 24 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  loader: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 0 },

  // Header
  header: { marginBottom: 12 },
  logoContainer: { alignItems: 'center', paddingTop: 0, paddingBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#EAEAEA' },
  dateText: { fontSize: 13, color: '#9A9A9A', marginTop: 3, textTransform: 'capitalize' },

  // End-of-cycle banner
  endBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1D1700',
    borderLeftWidth: 3,
    borderLeftColor: '#C9A44C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  endBannerText: { flex: 1, fontSize: 13, color: '#C9A44C' },

  // Measurement cards
  measurementCardDone: {
    borderLeftWidth: 3,
    borderLeftColor: '#B11226',
    marginTop: 0,
  },
  measurementCardPending: {
    borderLeftWidth: 3,
    borderLeftColor: '#B11226',
    marginTop: 0,
  },

  // Training card with left border accent
  trainingCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#B11226',
  },

  // Section
  section: { marginBottom: 0 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#EAEAEA', marginBottom: 8, marginTop: 8 },

  // Weekly strip
  strip: { flexDirection: 'row' },
  stripDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 2,
    borderRadius: 10,
  },
  stripDayToday: {
    backgroundColor: '#1A0000',
    borderWidth: 1,
    borderColor: '#B11226',
  },
  stripLabel: { fontSize: 11, color: '#9A9A9A', marginBottom: 6 },
  stripNum: { fontSize: 15, fontWeight: '600', color: '#EAEAEA' },
  redText: { color: '#B11226', fontWeight: '700' },
  stripBar: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  dotActive: { backgroundColor: '#C9A44C' },

  // Card
  card: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16 },
  cardIcon: { alignSelf: 'center', marginBottom: 8 },
  cardEmptyTitle: { fontSize: 16, fontWeight: '600', color: '#EAEAEA', textAlign: 'center', marginBottom: 6 },
  cardEmptyDesc: { fontSize: 13, color: '#9A9A9A', textAlign: 'center', marginBottom: 16 },
  primaryBtn: { backgroundColor: '#B11226', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#EAEAEA', fontWeight: '700', fontSize: 14 },

  // Week progress badge
  weekProgressBadge: { fontSize: 13, fontWeight: '600', color: '#C9A44C' },

  // Advanced stats button
  statsAdvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    backgroundColor: '#1A1A1A',
  },
  statsAdvBtnText: { fontSize: 13, color: '#C9A44C', fontWeight: '600' },

  // Today training
  microLabel: { fontSize: 10, fontWeight: '700', color: '#B11226', letterSpacing: 1, marginBottom: 8 },
  todayName: { fontSize: 18, fontWeight: '700', color: '#EAEAEA' },
  doubleTag: { marginTop: 4, fontSize: 12, color: '#C9A44C' },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#B11226',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restTitle: { fontSize: 17, fontWeight: '600', color: '#EAEAEA', marginBottom: 6 },
  nextText: { fontSize: 13, color: '#9A9A9A', lineHeight: 20 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#EAEAEA', marginVertical: 4 },
  statLabel: { fontSize: 11, color: '#9A9A9A', textAlign: 'center' },

  // Planificación
  planName: { fontSize: 16, fontWeight: '700', color: '#EAEAEA', flex: 1, marginRight: 8 },
  activeBadge: {
    backgroundColor: '#1A0000',
    borderWidth: 1,
    borderColor: '#B11226',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#B11226', letterSpacing: 0.5 },
  progressLabel: { fontSize: 13, color: '#9A9A9A', marginTop: 8, marginBottom: 8 },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, backgroundColor: '#B11226', borderRadius: 3 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  linkBtnText: { fontSize: 13, color: '#B11226', marginRight: 2 },

  // Calendar modal
  modalContainer: { flex: 1, backgroundColor: '#0D0D0D' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E2E',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#EAEAEA' },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  monthTitle: { fontSize: 18, fontWeight: '700', color: '#EAEAEA' },
  calWeekRow: { flexDirection: 'row', paddingHorizontal: 10, marginBottom: 4 },
  calWeekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#9A9A9A' },
  calGrid: { paddingHorizontal: 10 },
  calRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  calCellToday: { backgroundColor: '#1A0000', borderWidth: 1, borderColor: '#B11226' },
  calCellSelected: { backgroundColor: '#B11226' },
  calCellInner: { alignItems: 'center' },
  calCellNum: { fontSize: 14, color: '#EAEAEA' },
  calCellTodayNum: { color: '#B11226', fontWeight: '700' },
  calCellSelectedNum: { color: '#EAEAEA', fontWeight: '700' },
  calCellOutOfPlan: { opacity: 0.2 },
  calCellOutOfPlanNum: { color: '#555' },

  // Week range label under month title
  calWeekRangeLabel: { fontSize: 11, color: '#C9A44C', marginTop: 2, fontWeight: '600', letterSpacing: 0.3 },

  // Week number column
  calWeekNumCol: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calWeekNumText: { fontSize: 9, color: '#555', fontWeight: '600' },

  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: '#C9A44C',
  },
  calDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
  },

  // Day details panel
  dayPanel: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2E2E2E',
    marginTop: 4,
  },
  dayPanelTitle: { fontSize: 15, fontWeight: '700', color: '#EAEAEA', marginBottom: 12, textTransform: 'capitalize' },
  dayPanelSection: { marginBottom: 12 },
  dayPanelSectionLabel: { fontSize: 10, fontWeight: '700', color: '#B11226', letterSpacing: 1, marginBottom: 6 },
  dayPanelPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#B11226',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  noSessionsText: { fontSize: 14, color: '#9A9A9A', textAlign: 'center', paddingVertical: 16 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  sessionRowName: { fontSize: 15, fontWeight: '600', color: '#EAEAEA' },
  sessionRowMeta: { fontSize: 12, color: '#9A9A9A', marginTop: 2 },

  // Day Sheet (bottom sheet)
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '65%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EAEAEA',
    textTransform: 'capitalize',
    marginBottom: 16,
  },
  sheetSection: { marginBottom: 16 },
  sheetSectionLabel: { fontSize: 10, fontWeight: '700', color: '#B11226', letterSpacing: 1, marginBottom: 8 },
  sheetTrainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  sheetTrainingName: { fontSize: 15, fontWeight: '600', color: '#EAEAEA' },
  sheetPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#B11226',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sheetSessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  sheetSessionName: { fontSize: 15, fontWeight: '600', color: '#EAEAEA' },
  sheetSessionMeta: { fontSize: 12, color: '#9A9A9A', marginTop: 2 },
  editDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C9A44C',
    marginLeft: 8,
  },
  editDateBtnText: { fontSize: 11, color: '#C9A44C', fontWeight: '600' },
  sheetRestText: { fontSize: 15, color: '#9A9A9A', textAlign: 'center', paddingVertical: 24 },
});

