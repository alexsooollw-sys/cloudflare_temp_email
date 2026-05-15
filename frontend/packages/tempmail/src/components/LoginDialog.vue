<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api, tempmailAddress, tempmailExpiresAt, tempmailToken } from '../api/client'
import { hashPassword } from '../utils/hash'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const { t } = useI18n()
const router = useRouter()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)

const login = async () => {
  if (!email.value || !password.value) {
    error.value = t('errors.required')
    return
  }
  loading.value = true
  error.value = null
  try {
    const hash = await hashPassword(password.value)
    const res = await api.login({ address: email.value.trim(), password: hash })
    tempmailToken.value = res.token
    tempmailAddress.value = res.address
    tempmailExpiresAt.value = res.expires_at || ''
    open.value = false
    router.push('/inbox')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="460" persistent>
    <v-card rounded="xl" class="pa-2">
      <v-card-title class="text-h5 d-flex align-center gap-2">
        <v-icon icon="mdi-login-variant" />
        {{ t('login.title') }}
      </v-card-title>
      <v-card-subtitle class="text-body-2 mb-2">{{ t('login.subtitle') }}</v-card-subtitle>
      <v-card-text>
        <v-form @submit.prevent="login">
          <v-text-field
            v-model="email"
            :label="t('login.email')"
            placeholder="test@example.com"
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
        </v-form>
      </v-card-text>
      <v-card-actions class="justify-end pa-4">
        <v-btn variant="text" :disabled="loading" @click="open = false">{{ t('actions.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" @click="login">{{ t('login.cta') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
