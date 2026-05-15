<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { api, isLoggedIn, logout, mailAddress, type ParsedMail } from '../api/client'
import { hashPassword } from '../utils/hash'

const { t } = useI18n()
const router = useRouter()

type Tab = 'inbox' | 'change-password'

const tab = ref<Tab>('inbox')
const mails = ref<ParsedMail[]>([])
const total = ref(0)
const limit = ref(20)
const page = ref(1)
const selected = ref<ParsedMail | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const supportContact = ref<string | null>(null)

const offset = computed(() => (page.value - 1) * limit.value)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const formatTimestamp = (ts: string): string => {
  try { return new Date(ts).toLocaleString() } catch { return ts }
}

const fetchMails = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await api.listMails(limit.value, offset.value)
    mails.value = res.results
    total.value = res.count
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const openMail = async (m: ParsedMail) => {
  try {
    selected.value = await api.getMail(m.id)
  } catch (e) {
    error.value = (e as Error).message
  }
}

const deleteMail = async (m: ParsedMail) => {
  try {
    await api.deleteMail(m.id)
    if (selected.value?.id === m.id) selected.value = null
    await fetchMails()
  } catch (e) {
    error.value = (e as Error).message
  }
}

const handleLogout = () => {
  logout()
  router.replace('/')
}

// password change form state
const newPassword = ref('')
const confirmPassword = ref('')
const showNew = ref(false)
const changing = ref(false)
const changeError = ref<string | null>(null)
const changeOk = ref(false)

const submitPasswordChange = async () => {
  changeError.value = null
  changeOk.value = false
  if (!newPassword.value) {
    changeError.value = t('errors.required')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    changeError.value = t('changePassword.mismatch')
    return
  }
  changing.value = true
  try {
    const hash = await hashPassword(newPassword.value)
    await api.changePassword({ new_password: hash })
    changeOk.value = true
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    changeError.value = (e as Error).message
  } finally {
    changing.value = false
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.replace('/')
    return
  }
  fetchMails()
  try {
    const s = await api.openSettings()
    if (s.adminContact) supportContact.value = s.adminContact
  } catch { /* tolerate */ }
})
</script>

<template>
  <v-layout class="rounded-lg">
    <v-navigation-drawer permanent width="240" rail-width="80">
      <v-list-item class="pa-4">
        <template #prepend>
          <v-avatar size="32" color="primary">
            <v-icon icon="mdi-email-fast" size="20" />
          </v-avatar>
        </template>
        <v-list-item-title class="text-body-2 font-weight-medium text-truncate" :title="mailAddress">
          {{ mailAddress }}
        </v-list-item-title>
      </v-list-item>
      <v-divider />
      <v-list density="comfortable" nav>
        <v-list-item :active="tab === 'inbox'" prepend-icon="mdi-inbox" :title="t('nav.main')"
          @click="tab = 'inbox'" />
        <v-list-item :active="tab === 'change-password'" prepend-icon="mdi-key-change"
          :title="t('nav.changePassword')" @click="tab = 'change-password'" />
        <v-list-item v-if="supportContact" prepend-icon="mdi-lifebuoy" :title="t('nav.support')"
          :href="`mailto:${supportContact}`" target="_blank" />
      </v-list>
      <template #append>
        <v-divider />
        <v-list density="comfortable">
          <v-list-item prepend-icon="mdi-logout" :title="t('nav.logout')" @click="handleLogout" />
        </v-list>
      </template>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="pa-4">
        <!-- Inbox tab -->
        <div v-show="tab === 'inbox'">
          <v-row>
            <v-col cols="12" md="5">
              <v-card rounded="xl" variant="outlined">
                <v-toolbar density="compact" color="transparent" flat>
                  <v-toolbar-title class="text-subtitle-1">
                    {{ t('inbox.title') }}
                    <span class="text-caption text-medium-emphasis">({{ total }})</span>
                  </v-toolbar-title>
                  <v-btn icon="mdi-refresh" variant="text" :loading="loading" @click="fetchMails" />
                </v-toolbar>
                <v-divider />
                <v-list v-if="mails.length" lines="two" density="comfortable">
                  <v-list-item v-for="m in mails" :key="m.id" :title="m.subject || t('inbox.noSubject')"
                    :subtitle="`${m.sender || '?'} · ${formatTimestamp(m.created_at)}`"
                    :active="selected?.id === m.id" @click="openMail(m)">
                    <template #prepend><v-icon icon="mdi-email-outline" /></template>
                    <template #append>
                      <v-btn icon="mdi-delete" variant="text" size="small" @click.stop="deleteMail(m)" />
                    </template>
                  </v-list-item>
                </v-list>
                <v-empty-state v-else :title="t('inbox.empty')" :text="t('inbox.emptyHint')"
                  icon="mdi-email-open-outline" />
                <v-divider v-if="total > limit" />
                <v-card-actions v-if="total > limit" class="justify-center">
                  <v-pagination v-model="page" :length="pageCount" :total-visible="5"
                    @update:model-value="fetchMails" />
                </v-card-actions>
              </v-card>
              <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="mt-3">
                {{ error }}
              </v-alert>
            </v-col>
            <v-col cols="12" md="7">
              <v-card v-if="selected" rounded="xl" variant="outlined">
                <v-card-title class="text-h6">{{ selected.subject || t('inbox.noSubject') }}</v-card-title>
                <v-card-subtitle>
                  <strong>{{ t('inbox.from') }}:</strong> {{ selected.sender || '?' }}<br />
                  <strong>{{ t('inbox.date') }}:</strong> {{ formatTimestamp(selected.created_at) }}
                </v-card-subtitle>
                <v-divider />
                <v-card-text>
                  <div v-if="selected.html" v-html="selected.html" class="mail-html" />
                  <pre v-else-if="selected.text" class="text-body-2 mail-text">{{ selected.text }}</pre>
                  <v-alert v-else type="info" variant="tonal" density="comfortable">
                    {{ t('inbox.empty') }}
                  </v-alert>
                  <div v-if="selected.attachments.length" class="mt-4">
                    <h4 class="text-subtitle-2 mb-2">{{ t('inbox.attachments') }}</h4>
                    <v-chip v-for="a in selected.attachments" :key="a.filename" class="me-2 mb-2"
                      variant="tonal" prepend-icon="mdi-paperclip">
                      {{ a.filename }} ({{ Math.round(a.size / 1024) }} KB)
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
              <v-empty-state v-else :title="t('inbox.selectMessage')"
                icon="mdi-cursor-default-outline" />
            </v-col>
          </v-row>
        </div>

        <!-- Change password tab -->
        <div v-show="tab === 'change-password'">
          <v-row justify="center">
            <v-col cols="12" md="8" lg="6">
              <v-card rounded="xl" variant="outlined" class="pa-6">
                <v-card-title class="text-h6">{{ t('changePassword.title') }}</v-card-title>
                <v-card-text>
                  <v-form @submit.prevent="submitPasswordChange">
                    <v-text-field
                      v-model="newPassword"
                      :label="t('changePassword.newPassword')"
                      :type="showNew ? 'text' : 'password'"
                      :append-inner-icon="showNew ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showNew = !showNew"
                      prepend-inner-icon="mdi-key-plus"
                      autocomplete="new-password"
                      :disabled="changing"
                      class="mb-2"
                    />
                    <v-text-field
                      v-model="confirmPassword"
                      :label="t('changePassword.confirmPassword')"
                      :type="showNew ? 'text' : 'password'"
                      prepend-inner-icon="mdi-key-plus"
                      autocomplete="new-password"
                      :disabled="changing"
                    />
                    <v-alert v-if="changeError" type="error" variant="tonal" density="comfortable" class="mt-3">
                      {{ changeError }}
                    </v-alert>
                    <v-alert v-if="changeOk" type="success" variant="tonal" density="comfortable" class="mt-3">
                      {{ t('changePassword.success') }}
                    </v-alert>
                    <v-btn type="submit" color="primary" variant="flat" size="large" block class="mt-4"
                      :loading="changing">
                      {{ t('changePassword.cta') }}
                    </v-btn>
                  </v-form>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>
      </v-container>
    </v-main>
  </v-layout>
</template>

<style scoped>
.mail-html :deep(img) { max-width: 100%; height: auto; }
.mail-text { white-space: pre-wrap; word-break: break-word; }
</style>
