/**
 * Material Design 3 — color tokens, palette and mode presets.
 *
 * Three modes:
 *   - light  : standard light surface
 *   - dark   : standard dark surface (#1C1B1F)
 *   - amoled : pure-black optimised for OLED screens (#000000)
 *
 * Accent palette: 8 Material You colors. The user picks one and it becomes
 * the `primary` color across all 3 modes. Surface/background/text tokens are
 * shared across modes (they depend only on the mode, not the accent).
 */

export type ColorMode = 'light' | 'dark' | 'amoled' | 'auto'

export type AccentColor =
  | 'indigo'
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'teal'
  | 'pink'

export const COLOR_MODES: ColorMode[] = ['light', 'dark', 'amoled', 'auto']

export const ACCENT_COLORS: Record<AccentColor, { light: string; dark: string; label: string }> = {
  indigo: { light: '#3F51B5', dark: '#7986CB', label: 'Indigo' },
  blue: { light: '#1976D2', dark: '#64B5F6', label: 'Blue' },
  green: { light: '#388E3C', dark: '#81C784', label: 'Green' },
  orange: { light: '#F57C00', dark: '#FFB74D', label: 'Orange' },
  red: { light: '#D32F2F', dark: '#EF5350', label: 'Red' },
  purple: { light: '#7B1FA2', dark: '#BA68C8', label: 'Purple' },
  teal: { light: '#00796B', dark: '#4DB6AC', label: 'Teal' },
  pink: { light: '#C2185B', dark: '#F06292', label: 'Pink' },
}

export const DEFAULT_ACCENT: AccentColor = 'indigo'
export const DEFAULT_MODE: ColorMode = 'auto'

/**
 * Static surface/background tokens per mode.
 * Accent-derived colors are computed separately in `vuetify.ts`.
 */
export const MODE_TOKENS = {
  light: {
    surface: '#FFFFFF',
    surfaceVariant: '#F3EFF7',
    surfaceContainer: '#F5F0F7',
    surfaceContainerHigh: '#ECE6F0',
    surfaceContainerHighest: '#E6E0E9',
    background: '#FAFAFA',
    onSurface: '#1C1B1F',
    onSurfaceVariant: '#49454F',
    outline: '#79747E',
    outlineVariant: '#CAC4D0',
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    error: '#B3261E',
    onError: '#FFFFFF',
    success: '#2E7D32',
    warning: '#ED6C02',
    info: '#0288D1',
  },
  dark: {
    surface: '#1C1B1F',
    surfaceVariant: '#49454F',
    surfaceContainer: '#211F26',
    surfaceContainerHigh: '#2B2930',
    surfaceContainerHighest: '#36343B',
    background: '#141218',
    onSurface: '#E6E1E5',
    onSurfaceVariant: '#CAC4D0',
    outline: '#938F99',
    outlineVariant: '#49454F',
    inverseSurface: '#E6E1E5',
    inverseOnSurface: '#313033',
    error: '#F2B8B5',
    onError: '#601410',
    success: '#66BB6A',
    warning: '#FFA726',
    info: '#29B6F6',
  },
  amoled: {
    // pure black optimised for OLED — saves battery, no gray "near black"
    surface: '#000000',
    surfaceVariant: '#161616',
    surfaceContainer: '#0A0A0A',
    surfaceContainerHigh: '#121212',
    surfaceContainerHighest: '#1A1A1A',
    background: '#000000',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#D0D0D0',
    outline: '#3A3A3A',
    outlineVariant: '#2A2A2A',
    inverseSurface: '#FFFFFF',
    inverseOnSurface: '#000000',
    error: '#FF6B6B',
    onError: '#000000',
    success: '#66BB6A',
    warning: '#FFA726',
    info: '#29B6F6',
  },
} as const

export type ModeTokens = (typeof MODE_TOKENS)['light']

export const getModeTokens = (mode: Exclude<ColorMode, 'auto'>): ModeTokens => MODE_TOKENS[mode]

export const getAccentColorHex = (accent: AccentColor, mode: Exclude<ColorMode, 'auto'>): string => {
  const variant = mode === 'light' ? 'light' : 'dark'
  return ACCENT_COLORS[accent][variant]
}

export const isAccentColor = (value: unknown): value is AccentColor =>
  typeof value === 'string' && value in ACCENT_COLORS

export const isColorMode = (value: unknown): value is ColorMode =>
  typeof value === 'string' && (COLOR_MODES as string[]).includes(value)
