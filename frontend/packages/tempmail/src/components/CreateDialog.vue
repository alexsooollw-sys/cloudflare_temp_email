<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const domains = ref<string[]>([])
const selectedDomain = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const fetchDomains = async () => {
  try {
    const res = await api.domains()
    domains.value = res.domains.filter((d) => d.isActive).map((d) => d.domain)
    if (domains.value.length > 0 && !selectedDomain.value) {
      selectedDomain.value = domains.value[0]
    }
  } catch (e) {
    error.value = (e as Error).message
  }
}

watch(open, (v) => {
  if (v) {
    error.value = null
    fetchDomains()
  }
})

const create = async () => {
  if (!username.value || !password.value || !selectedDomain.value) {
    error.value = t('errors.required')
    return
  }
  loading.value = true
  error.value = null
  try {
    const hash = await hashPassword(password.value)
    const res = await api.create({
      address: `${username.value.trim().toLowerCase()}@${selectedDomain.value}`,
      password: hash,
    })
    tempmailToken.value = res.token
    tempmailAddress.value = res.address
    tempmailExpiresAt.value = res.expires_at
    open.value = false
    router.push('/inbox')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const generateRandom = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  username.value = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  password.value = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
</script>

<template>
  <v-dialog v-model="open" max-width="500" persistent>
    <v-card rounded="xl" class="pa-2">
      <v-card-title class="text-h5 d-flex align-center gap-2">
        <v-icon icon="mdi-account-plus" />
        {{ t('create.title') }}
      </v-card-title>
      <v-card-subtitle class="text-body-2 mb-2">{{ t('create.subtitle') }}</v-card-subtitle>
      <v-card-text>
        <v-form @submit.prevent="create">
          <v-text-field
            v-model="username"
            :label="t('create.username')"
            :placeholder="t('create.usernamePlaceholder')"
            prepend-inner-icon="mdi-account"
            autocomplete="username"
            :disabled="loading"
            class="mb-2"
          />
          <v-select
            v-model="selectedDomain"
            :items="domains"
            :label="t('create.domain')"
            prepend-inner-icon="mdi-at"
            :disabled="loading || domains.length === 0"
            :no-data-text="t('create.noDomains')"
            class="mb-2"
          />
          <v-text-field
            v-model="password"
            :label="t('create.password')"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            prepend-inner-icon="mdi-key"
            autocomplete="new-password"
            :disabled="loading"
          />
          <v-btn variant="text" size="small" prepend-icon="mdi-dice-multiple" @click="generateRandom">
            {{ t('create.random') }}
          </v-btn>
          <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="mt-3">
            {{ error }}
          </v-alert>
        </v-form>
      </v-card-text>
      <v-card-actions class="justify-end pa-4">
        <v-btn variant="text" :disabled="loading" @click="open = false">{{ t('actions.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="loading" @click="create">{{ t('create.cta') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
