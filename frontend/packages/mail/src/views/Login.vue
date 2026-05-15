<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api, isLoggedIn, mailAddress, mailToken } from '../api/client'
import { hashPassword } from '../utils/hash'

const { t } = useI18n()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const title = ref('NOTLETTERS')

onMounted(async () => {
  if (isLoggedIn.value) {
    router.replace('/inbox')
    return
  }
  try {
    const s = await api.openSettings()
    if (s.title) title.value = s.title
  } catch { /* tolerate */ }
})

const login = async () => {
  if (!email.value || !password.value) {
    error.value = t('errors.required')
    return
  }
  loading.value = true
  error.value = null
  try {
    const hash = await hashPassword(password.value)
    const res = await api.login({ email: email.value.trim(), password: hash })
    mailToken.value = res.jwt
    mailAddress.value = res.address
    router.replace('/inbox')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container class="d-flex flex-column align-center justify-center" style="min-height: 100vh">
    <div class="d-flex align-center gap-3 mb-6">
      <v-avatar size="48" color="primary">
        <v-icon icon="mdi-email-fast" size="28" />
      </v-avatar>
      <h1 class="text-h4 font-weight-bold">{{ title }}</h1>
    </div>
    <v-card max-width="440" width="100%" class="pa-6" rounded="xl" elevation="2">
      <v-card-title class="text-h5 text-center mb-2">{{ t('login.title') }}</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="login">
          <v-text-field
            v-model="email"
            :label="t('login.email')"
            type="email"
            prepend-inner-icon="mdi-email"
            autocomplete="email"
            :disabled="loading"
            class="mb-2"
          />
          <v-text-field
            v-model="password"
            :label="t('login.password')"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            prepend-inner-icon="mdi-key"
            autocomplete="current-password"
            :disabled="loading"
            @keyup.enter="login"
          />
          <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="mt-3">
            {{ error }}
          </v-alert>
          <v-btn color="primary" variant="flat" size="large" block class="mt-4" :loading="loading"
            @click="login">
            {{ t('login.cta') }}
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.gap-3 { gap: 12px; }
</style>
