/**
 * Vuetify 3 theme adapter.
 *
 * Builds a Vuetify ThemeDefinition for a (mode, accent) pair and exposes
 * the full set of MD3-style color tokens.
 */

import type { ThemeDefinition } from 'vuetify'

import {
  ACCENT_COLORS,
  type AccentColor,
  type ColorMode,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  getAccentColorHex,
  getModeTokens,
} from './index'

export const resolveMode = (mode: ColorMode): Exclude<ColorMode, 'auto'> => {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  }
  return mode
}

export const buildVuetifyTheme = (mode: ColorMode, accent: AccentColor): ThemeDefinition => {
  const resolvedMode = resolveMode(mode)
  const tokens = getModeTokens(resolvedMode)
  const primary = getAccentColorHex(accent, resolvedMode)

  return {
    dark: resolvedMode !== 'light',
    colors: {
      background: tokens.background,
      surface: tokens.surface,
      'surface-variant': tokens.surfaceVariant,
      'surface-bright': tokens.surfaceContainerHighest,
      'surface-light': tokens.surfaceContainer,
      'on-background': tokens.onSurface,
      'on-surface': tokens.onSurface,
      'on-surface-variant': tokens.onSurfaceVariant,
      primary,
      'on-primary': resolvedMode === 'light' ? '#FFFFFF' : '#000000',
      secondary: primary,
      'on-secondary': resolvedMode === 'light' ? '#FFFFFF' : '#000000',
      tertiary: primary,
      'on-tertiary': resolvedMode === 'light' ? '#FFFFFF' : '#000000',
      error: tokens.error,
      'on-error': tokens.onError,
      info: tokens.info,
      'on-info': '#FFFFFF',
      success: tokens.success,
      'on-success': '#FFFFFF',
      warning: tokens.warning,
      'on-warning': '#FFFFFF',
    },
    variables: {
      'border-color': tokens.outline,
      'border-opacity': 0.12,
      'high-emphasis-opacity': 0.87,
      'medium-emphasis-opacity': 0.6,
      'disabled-opacity': 0.38,
      'idle-opacity': 0.04,
      'hover-opacity': 0.08,
      'focus-opacity': 0.12,
      'selected-opacity': 0.12,
      'activated-opacity': 0.12,
      'pressed-opacity': 0.16,
      'dragged-opacity': 0.08,
      'theme-kbd': tokens.surfaceContainerHigh,
      'theme-on-kbd': tokens.onSurface,
      'theme-code': tokens.surfaceContainer,
      'theme-on-code': tokens.onSurface,
    },
  }
}

/**
 * Generate ALL (mode × accent) theme combinations up front so switching
 * themes at runtime is just `theme.global.name = key`.
 *
 * Theme key format: `${mode}-${accent}` — e.g. `dark-indigo`, `amoled-purple`.
 */
export const buildAllVuetifyThemes = (): Record<string, ThemeDefinition> => {
  const modes: Array<Exclude<ColorMode, 'auto'>> = ['light', 'dark', 'amoled']
  const accents = Object.keys(ACCENT_COLORS) as AccentColor[]
  const out: Record<string, ThemeDefinition> = {}
  for (const mode of modes) {
    for (const accent of accents) {
      out[`${mode}-${accent}`] = buildVuetifyTheme(mode, accent)
    }
  }
  return out
}

export const getThemeKey = (mode: ColorMode, accent: AccentColor): string => {
  const resolved = resolveMode(mode)
  return `${resolved}-${accent}`
}

export { DEFAULT_ACCENT, DEFAULT_MODE }
