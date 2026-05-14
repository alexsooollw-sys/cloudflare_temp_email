<script setup lang="ts">
import { useTheme } from 'vuetify'
import { useThemeSync } from '@cte/shared/theme/composables'

const theme = useTheme()
useThemeSync(theme)
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
