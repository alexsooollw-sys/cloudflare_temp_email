/**
 * Theme composables — persistent storage + reactive helpers for
 * mode/accent selection.
 *
 * Storage keys (raw strings, NOT JSON-wrapped, to match the existing
 * VueUse pattern documented in CLAUDE.md):
 *   - cte:theme:mode     → 'light' | 'dark' | 'amoled' | 'auto'
 *   - cte:theme:accent   → 'indigo' | 'blue' | ...
 */

import { computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'

import {
  type AccentColor,
  type ColorMode,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  isAccentColor,
  isColorMode,
} from './index'
import { getThemeKey, resolveMode } from './vuetify'

export const useColorMode = () => {
  const raw = useStorage<string>('cte:theme:mode', DEFAULT_MODE)
  return computed<ColorMode>({
    get: () => (isColorMode(raw.value) ? raw.value : DEFAULT_MODE),
    set: (v) => {
      raw.value = isColorMode(v) ? v : DEFAULT_MODE
    },
  })
}

export const useAccentColor = () => {
  const raw = useStorage<string>('cte:theme:accent', DEFAULT_ACCENT)
  return computed<AccentColor>({
    get: () => (isAccentColor(raw.value) ? raw.value : DEFAULT_ACCENT),
    set: (v) => {
      raw.value = isAccentColor(v) ? v : DEFAULT_ACCENT
    },
  })
}

/**
 * Bind a reactive theme key to vuetify's `theme.global.name`.
 *
 * Usage:
 *   import { useTheme } from 'vuetify'
 *   import { useThemeSync } from '@cte/shared/theme/composables'
 *   const theme = useTheme()
 *   useThemeSync(theme)
 */
export const useThemeSync = (theme: { global: { name: { value: string } } }) => {
  const mode = useColorMode()
  const accent = useAccentColor()
  const key = computed(() => getThemeKey(mode.value, accent.value))

  watch(
    key,
    (k) => {
      theme.global.name.value = k
    },
    { immediate: true },
  )

  // react to system color-scheme changes when user picked 'auto'
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (mode.value === 'auto') {
        theme.global.name.value = getThemeKey(mode.value, accent.value)
      }
    }
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
    } else {
      // older Safari
      mql.addListener?.(handler)
    }
  }

  return { mode, accent, key, resolvedMode: computed(() => resolveMode(mode.value)) }
}
