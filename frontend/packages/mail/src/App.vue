<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'

import { useThemeSync, useColorMode, useAccentColor } from '@cte/shared/theme/composables'
import { ACCENT_COLORS, type AccentColor, type ColorMode } from '@cte/shared/theme'

const theme = useTheme()
useThemeSync(theme)
const mode = useColorMode()
const accent = useAccentColor()

const { locale } = useI18n()
const setLocale = (v: 'en' | 'ru') => {
  locale.value = v
  if (typeof localStorage !== 'undefined') localStorage.setItem('cte:mail:locale', v)
}

const modeIcon = (m: ColorMode) =>
  m === 'light' ? 'mdi-white-balance-sunny'
  : m === 'dark' ? 'mdi-weather-night'
  : m === 'amoled' ? 'mdi-television-ambient-light'
  : 'mdi-theme-light-dark'

const modeOptions: ColorMode[] = ['light', 'dark', 'amoled', 'auto']
const accentOptions = (Object.keys(ACCENT_COLORS) as AccentColor[])
</script>

<template>
  <v-app>
    <router-view />

    <v-menu location="bottom end" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <v-btn v-bind="menuProps" class="theme-fab" icon="mdi-palette" size="small" variant="tonal"
          color="primary" />
      </template>
      <v-card min-width="280" rounded="xl" class="pa-3">
        <div class="text-overline mb-2">Theme</div>
        <v-btn-toggle v-model="mode" mandatory variant="outlined" density="compact" class="mb-3">
          <v-btn v-for="m in modeOptions" :key="m" :value="m" size="small" :icon="modeIcon(m)" />
        </v-btn-toggle>
        <div class="text-overline mb-2">Accent</div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <v-btn v-for="a in accentOptions" :key="a" size="x-small" variant="flat"
            :color="ACCENT_COLORS[a].light" :class="{ 'accent-selected': accent === a }"
            @click="accent = a" />
        </div>
        <v-divider class="mb-3" />
        <div class="text-overline mb-2">Language</div>
        <v-btn-toggle v-model="locale" mandatory variant="outlined" density="compact"
          @update:model-value="(v: unknown) => typeof v === 'string' && (v === 'en' || v === 'ru') && setLocale(v)">
          <v-btn value="en" size="small">EN</v-btn>
          <v-btn value="ru" size="small">RU</v-btn>
        </v-btn-toggle>
      </v-card>
    </v-menu>
  </v-app>
</template>

<style scoped>
.theme-fab {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 2000;
}
.accent-selected {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.gap-2 { gap: 6px; }
</style>
