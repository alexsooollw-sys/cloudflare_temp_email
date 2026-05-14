<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh">
    <v-card max-width="420" class="pa-6" elevation="2">
      <v-card-title class="text-h5">{{ t('title') }}</v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" density="comfortable">
          {{ t('comingSoon') }}
        </v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>
