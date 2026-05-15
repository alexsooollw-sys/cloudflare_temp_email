<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api, isLoggedIn, type PublicPreview } from '../api/client'
import CreateDialog from '../components/CreateDialog.vue'
import LoginDialog from '../components/LoginDialog.vue'

const { t } = useI18n()
const router = useRouter()

const showCreate = ref(false)
const showLogin = ref(false)
const preview = ref<PublicPreview | null>(null)

onMounted(async () => {
  if (isLoggedIn.value) {
    router.replace('/inbox')
    return
  }
  try {
    preview.value = await api.recentPreview()
  } catch (e) {
    // preview is best-effort; ignore
    console.warn('public preview failed', e)
  }
})

const features = [
  { icon: 'mdi-shield-check', titleKey: 'features.secure.title', textKey: 'features.secure.text' },
  { icon: 'mdi-flash', titleKey: 'features.instant.title', textKey: 'features.instant.text' },
  { icon: 'mdi-clock-fast', titleKey: 'features.fast.title', textKey: 'features.fast.text' },
]
</script>

<template>
  <v-container class="py-12" style="max-width: 1100px">
    <!-- Hero -->
    <v-row justify="center" class="mb-10">
      <v-col cols="12" md="10" lg="8" class="text-center">
        <v-avatar size="72" color="primary" class="mb-4">
          <v-icon size="40" icon="mdi-email-fast" />
        </v-avatar>
        <h1 class="text-h2 font-weight-bold mb-4">{{ t('hero.title') }}</h1>
        <p class="text-h6 text-medium-emphasis mb-6">{{ t('hero.tagline') }}</p>
        <div class="d-flex justify-center gap-3 flex-wrap">
          <v-btn color="primary" size="x-large" variant="flat" prepend-icon="mdi-plus" @click="showCreate = true">
            {{ t('actions.create') }}
          </v-btn>
          <v-btn color="primary" size="x-large" variant="outlined" prepend-icon="mdi-login" @click="showLogin = true">
            {{ t('actions.login') }}
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Feature cards -->
    <v-row class="mb-10">
      <v-col v-for="f in features" :key="f.titleKey" cols="12" md="4">
        <v-card rounded="xl" variant="tonal" class="pa-6 h-100">
          <v-icon :icon="f.icon" size="40" color="primary" class="mb-3" />
          <h3 class="text-h6 mb-2">{{ t(f.titleKey) }}</h3>
          <p class="text-body-2 text-medium-emphasis">{{ t(f.textKey) }}</p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Optional public preview -->
    <v-card v-if="preview?.enabled && preview.messages.length" rounded="xl" variant="outlined" class="pa-4">
      <v-card-title class="text-subtitle-1">
        <v-icon icon="mdi-broadcast" class="me-2" />
        {{ t('preview.title') }}
      </v-card-title>
      <v-card-text class="pa-0">
        <v-list density="compact">
          <v-list-item v-for="m in preview.messages" :key="m.id" :title="m.subject || t('preview.noSubject')"
            :subtitle="`${m.from ?? '?'} · ${m.timestamp}`">
            <template #prepend>
              <v-icon icon="mdi-email-outline" size="small" />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <CreateDialog v-model="showCreate" />
    <LoginDialog v-model="showLogin" />
  </v-container>
</template>

<style scoped>
.gap-3 { gap: 12px; }
.gap-2 { gap: 8px; }
</style>
