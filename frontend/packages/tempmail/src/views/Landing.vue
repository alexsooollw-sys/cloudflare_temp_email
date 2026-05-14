<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <v-container class="d-flex align-center justify-center" style="min-height: 100vh">
    <v-card max-width="600" class="pa-8 text-center" elevation="2">
      <v-card-title class="text-h3 mb-4">{{ t('title') }}</v-card-title>
      <v-card-subtitle class="text-h6 mb-6">{{ t('tagline') }}</v-card-subtitle>
      <v-card-text>
        <v-alert type="info" variant="tonal" density="comfortable">
          {{ t('comingSoon') }}
        </v-alert>
      </v-card-text>
      <v-card-actions class="justify-center mt-4">
        <v-btn color="primary" variant="flat" size="large" disabled>{{ t('create') }}</v-btn>
        <v-btn color="primary" variant="outlined" size="large" disabled>{{ t('login') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
