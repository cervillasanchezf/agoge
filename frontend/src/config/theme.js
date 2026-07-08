// AGOGE — Paleta oficial de colores
export const COLORS = {
  // ── Fondos ────────────────────────────────────────────────────────────────
  background:      '#0D0D0D',   // Fondo principal
  surface:         '#1A1A1A',   // Cards, modales, inputs
  surfaceElevated: '#1F1F1F',   // Cards elevadas (PostSession, ActiveSession footer…)
  surfaceAlt:      '#181818',   // Fondo sutil alternativo (inputs dentro de cards)
  surfaceDeep:     '#252525',   // Divisores sutiles
  surfaceInner:    '#2A2A2A',   // Filas/items dentro de cards (sheet rows, progress bg…)

  // ── Marca ─────────────────────────────────────────────────────────────────
  primary:       '#B11226',     // Rojo — botones principales, activos
  primaryDark:   '#8A0E1E',     // Rojo oscuro — timer, confirmar
  primaryLight:  '#1A0000',     // Tinte rojo muy oscuro — fondos activos
  primaryBorder: '#5A0000',     // Borde rojo oscuro — exercise badges, drum picker

  // ── Dorado ────────────────────────────────────────────────────────────────
  gold:   '#C9A44C',            // Logros, rachas, gamificación
  goldBg: '#1D1700',            // Fondo dorado muy oscuro — end-of-cycle banner

  // ── Texto ─────────────────────────────────────────────────────────────────
  textPrimary:   '#EAEAEA',     // Texto principal
  textSecondary: '#9A9A9A',     // Texto secundario / estadísticas
  textMuted:     '#767676',     // Placeholders, metadatos (≥4.5:1 contraste WCAG AA)

  // ── Bordes ────────────────────────────────────────────────────────────────
  border:       '#2E2E2E',      // Borde estándar (consolidado)
  borderSubtle: '#252525',      // Borde muy sutil (alias de surfaceDeep)
  borderInner:  '#2A2A2A',      // Divisores internos (alias de surfaceInner)

  // ── Estados ───────────────────────────────────────────────────────────────
  success:       '#22c55e',     // Verde — sets completados, PRs
  successBg:     '#0A1A0A',     // Fondo verde muy oscuro
  successBorder: '#1A5A1A',     // Borde verde oscuro
  warning:       '#E07A2F',     // Naranja — HI medio, alertas
  danger:        '#FF3B3B',     // Rojo — destructivo, acciones críticas
  dangerBg:      '#1A0505',     // Fondo rojo muy oscuro
  dangerBorder:  '#4A1010',     // Borde rojo oscuro
  info:          '#4A90D9',     // Azul — gráficos informativos (PPL, stats)

  // ── Miscelánea ────────────────────────────────────────────────────────────
  iconInactive: '#4A4A4A',      // Iconos inactivos / sin seleccionar
  shadow:       '#000000',
};
