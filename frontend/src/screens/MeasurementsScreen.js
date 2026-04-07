import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { measurementService } from '../services/api';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const MEASUREMENT_KEYS = [
  'peso', 'cintura', 'cuello', 'hombro', 'pecho',
  'bicepsIzq', 'bicepsDer', 'antebrazoIzq', 'antebrazoDer',
  'abdomen', 'cadera', 'musloIzq', 'musloDer', 'gemeloIzq', 'gemeloDer',
];

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

// ─── Gráfica SVG ────────────────────────────────────────────
const CHART_H = 180;
const PADDING = { top: 16, bottom: 36, left: 36, right: 36 };

function LineChart({ data, fieldKey }) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32; // padding horizontal de la pantalla

  const points = data
    .map((m) => ({ value: m[fieldKey], date: m.date }))
    .filter((p) => p.value != null)
    .reverse(); // orden cronológico ascendente

  if (points.length < 2) {
    return (
      <View style={chartStyles.empty}>
        <Text style={chartStyles.emptyText}>
          {points.length === 0
            ? 'Sin datos para esta medida'
            : 'Se necesitan al menos 2 registros para mostrar la gráfica'}
        </Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = rawMax - rawMin || 1;

  // Calcular un step "redondo" para el eje Y
  const roughStep = rawRange / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
  const normalized = roughStep / magnitude;
  let niceStep;
  if (normalized < 1.5) niceStep = 1 * magnitude;
  else if (normalized < 3) niceStep = 2 * magnitude;
  else if (normalized < 7) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  // Eje Y: siempre un tick por debajo del min y por encima del max
  const minVal = Math.floor(rawMin / niceStep - 0.0001) * niceStep;
  const maxVal = Math.ceil(rawMax / niceStep + 0.0001) * niceStep;
  const range = maxVal - minVal;

  const innerW = chartWidth - PADDING.left - PADDING.right;
  const innerH = CHART_H - PADDING.top - PADDING.bottom;

  // Inset horizontal para que los puntos extremos no estén al borde
  const X_INSET = 16;
  const xFor = (i) => PADDING.left + X_INSET + (i / (points.length - 1)) * (innerW - 2 * X_INSET);
  const yFor = (v) => PADDING.top + innerH - ((v - minVal) / range) * innerH;

  // Construir path de la línea
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
    .join(' ');

  // Construir path del área rellena
  const areaPath =
    linePath +
    ` L${xFor(points.length - 1).toFixed(1)},${(PADDING.top + innerH).toFixed(1)}` +
    ` L${xFor(0).toFixed(1)},${(PADDING.top + innerH).toFixed(1)} Z`;

  // Etiquetas Y: ticks redondos de minVal a maxVal
  const yTicks = [];
  for (let v = minVal; v <= maxVal + niceStep * 0.001; v += niceStep) {
    yTicks.push(parseFloat(v.toFixed(6)));
  }
  const yLabels = yTicks.map((v) => ({ value: v % 1 === 0 ? String(v) : v.toFixed(1), y: yFor(v) }));

  // Etiquetas X: hasta 4 fechas distribuidas
  const xLabelIndices = points.length <= 4
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 3), Math.floor((2 * (points.length - 1)) / 3), points.length - 1];

  const unit = MEASUREMENT_UNITS[fieldKey] || 'cm';
  const latest = points[points.length - 1];
  const prev = points[points.length - 2];
  const diff = (latest.value - prev.value).toFixed(1);
  const diffPrefix = diff > 0 ? '+' : '';

  return (
    <View>
      {/* Resumen último valor */}
      <View style={chartStyles.summary}>
        <Text style={chartStyles.summaryValue}>
          {latest.value} <Text style={chartStyles.summaryUnit}>{unit}</Text>
        </Text>
        <Text style={[chartStyles.summaryDiff, { color: '#9A9A9A' }]}>
          {diffPrefix}{diff} {unit} vs anterior
        </Text>
      </View>

      <Svg width={chartWidth} height={CHART_H}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8B0000" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#8B0000" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Líneas guía horizontales */}
        {yLabels.map((l, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PADDING.left}
              y1={l.y}
              x2={chartWidth - PADDING.right}
              y2={l.y}
              stroke="#252525"
              strokeWidth="1"
            />
            <SvgText
              x={PADDING.left - 4}
              y={l.y + 4}
              fontSize="9"
              fill="#6A6A6A"
              textAnchor="end"
            >
              {l.value}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Área rellena */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Línea de la gráfica */}
        <Path d={linePath} stroke="#8B0000" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* Puntos */}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r="3.5"
            fill="#8B0000"
            stroke="#0D0D0D"
            strokeWidth="1.5"
          />
        ))}

        {/* Etiquetas eje X */}
        {xLabelIndices.map((i) => (
          <SvgText
            key={i}
            x={xFor(i)}
            y={CHART_H - 4}
            fontSize="9"
            fill="#6A6A6A"
            textAnchor="middle"
          >
            {formatDateShort(points[i].date)}
          </SvgText>
        ))}

      </Svg>
    </View>
  );
}

// ─── Rangos de tiempo ──────────────────────────────────────────
const TIME_RANGES = [
  { key: '1m',  label: '1 mes',   months: 1  },
  { key: '3m',  label: '3 meses', months: 3  },
  { key: '6m',  label: '6 meses', months: 6  },
  { key: '12m', label: '1 año',   months: 12 },
];

function filterByRange(data, months) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return data.filter((m) => new Date(m.date) >= cutoff);
}

function RangeDropdown({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const current = TIME_RANGES.find((r) => r.key === selected);

  return (
    <View>
      <TouchableOpacity
        style={selectorStyles.dropdownBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={selectorStyles.dropdownBtnText}>{current.label}</Text>
        <Ionicons name="chevron-down" size={13} color="#9A9A9A" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={selectorStyles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={selectorStyles.dropdownMenu} activeOpacity={1}>
            {TIME_RANGES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[
                  selectorStyles.dropdownItem,
                  selected === r.key && selectorStyles.dropdownItemActive,
                ]}
                onPress={() => { onSelect(r.key); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  selectorStyles.dropdownItemText,
                  selected === r.key && selectorStyles.dropdownItemTextActive,
                ]}>
                  {r.label}
                </Text>
                {selected === r.key && (
                  <Ionicons name="checkmark" size={14} color="#8B0000" />
                )}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Selector de medida ──────────────────────────────────────
function FieldDropdown({ selected, onSelect, measurements }) {
  const [open, setOpen] = useState(false);
  const available = MEASUREMENT_KEYS.filter((k) =>
    measurements.some((m) => m[k] != null)
  );

  if (available.length === 0) return null;

  return (
    <View>
      <TouchableOpacity
        style={selectorStyles.dropdownBtn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={selectorStyles.dropdownBtnText}>{MEASUREMENT_LABELS[selected]}</Text>
        <Ionicons name="chevron-down" size={13} color="#9A9A9A" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={selectorStyles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={[selectorStyles.dropdownMenu, { maxHeight: 320 }]} activeOpacity={1}>
            <ScrollView>
              {available.map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[
                    selectorStyles.dropdownItem,
                    selected === k && selectorStyles.dropdownItemActive,
                  ]}
                  onPress={() => { onSelect(k); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    selectorStyles.dropdownItemText,
                    selected === k && selectorStyles.dropdownItemTextActive,
                  ]}>
                    {MEASUREMENT_LABELS[k]}
                  </Text>
                  {selected === k && (
                    <Ionicons name="checkmark" size={14} color="#8B0000" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MeasurementCard({ item, onDelete, onPress }) {
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

      {item.photos?.length > 0 && (
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.photoThumb}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );
}

export default function MeasurementsScreen({ navigation }) {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState('peso');
  const [selectedRange, setSelectedRange] = useState('3m');

  // Si al cargar el campo por defecto no tiene datos, saltar al primero con datos
  const resolveField = (data, current) => {
    if (data.some((m) => m[current] != null)) return current;
    const first = MEASUREMENT_KEYS.find((k) => data.some((m) => m[k] != null));
    return first || current;
  };

  const loadMeasurements = useCallback(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await measurementService.getMeasurements();
        const data = res.data || [];
        setMeasurements(data);
        setSelectedField((prev) => resolveField(data, prev));
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
      {measurements.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="body-outline" size={52} color="#333" />
          <Text style={styles.emptyTitle}>Sin registros</Text>
          <Text style={styles.emptySubtitle}>
            Pulsa el botón + para añadir tu primer registro de medidas
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* ── SECCIÓN GRÁFICA ── */}
          <View style={styles.chartCard}>
            <View style={styles.chartCardHeader}>
              <Text style={styles.sectionTitle}>Evolución</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <FieldDropdown
                  selected={selectedField}
                  onSelect={setSelectedField}
                  measurements={measurements}
                />
                <RangeDropdown selected={selectedRange} onSelect={setSelectedRange} />
              </View>
            </View>
            <View style={styles.chartWrap}>
              <LineChart
                data={filterByRange(
                  measurements,
                  TIME_RANGES.find((r) => r.key === selectedRange).months
                )}
                fieldKey={selectedField}
              />
            </View>
          </View>

          {/* ── HISTORIAL ── */}
          <Text style={[styles.sectionTitle, { marginTop: 8, paddingHorizontal: 0 , marginBottom: 8 }]}>Historial</Text>
          {measurements.map((item) => (
            <MeasurementCard
              key={item._id}
              item={item}
              onDelete={() => handleDelete(item._id)}
              onPress={() => navigation.navigate('NewMeasurement', { measurement: item })}
            />
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>
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
  chartCard: {
    backgroundColor: '#1F1F1F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#9A9A9A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chartWrap: {
    marginTop: 10,
    marginHorizontal: -14,
  },
});

const chartStyles = StyleSheet.create({
  empty: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#6A6A6A',
    fontSize: 13,
    textAlign: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
  },
  summaryValue: {
    color: '#EAEAEA',
    fontSize: 22,
    fontWeight: '700',
  },
  summaryUnit: {
    color: '#9A9A9A',
    fontSize: 14,
    fontWeight: '400',
  },
  summaryDiff: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const selectorStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#252525',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownBtnText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 120,
    paddingRight: 16,
  },
  dropdownMenu: {
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 130,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  dropdownItemActive: {
    backgroundColor: '#1A0000',
  },
  dropdownItemText: {
    color: '#9A9A9A',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#EAEAEA',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: '#1A0000',
    borderColor: '#8B0000',
  },
  chipText: {
    color: '#9A9A9A',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#EAEAEA',
  },
});
