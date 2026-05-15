<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  api,
  isLoggedIn,
  logout,
  tempmailAddress,
  tempmailExpiresAt,
  type ParsedMessage,
} from '../api/client'

const { t } = useI18n()
const router = useRouter()

const messages = ref<ParsedMessage[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loading = ref(false)
const selected = ref<ParsedMessage | null>(null)
const autoRefresh = ref(true)
const confirmDelete = ref(false)
const error = ref<string | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const expiresLabel = computed(() => {
  if (!tempmailExpiresAt.value) return ''
  try {
    return new Date(tempmailExpiresAt.value).toLocaleString()
  } catch {
    return tempmailExpiresAt.value
  }
})

const formatTimestamp = (ts: string): string => {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

const fetchMessages = async () => {
  if (loading.value) return
  loading.value = true
  error.value = null
  try {
    const res = await api.listMessages(page.value, limit.value)
    messages.value = res.messages
    total.value = res.total
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const openMessage = async (m: ParsedMessage) => {
  try {
    selected.value = await api.getMessage(m.id)
  } catch (e) {
    error.value = (e as Error).message
  }
}

const deleteMessage = async (m: ParsedMessage) => {
  try {
    await api.deleteMessage(m.id)
    if (selected.value?.id === m.id) selected.value = null
    await fetchMessages()
  } catch (e) {
    error.value = (e as Error).message
  }
}

const handleLogout = () => {
  logout()
  router.replace('/')
}

const deleteAccount = async () => {
  try {
    await api.deleteMe()
    logout()
    router.replace('/')
  } catch (e) {
    error.value = (e as Error).message
  }
}

onMounted(() => {
  if (!isLoggedIn.value) {
    router.replace('/')
    return
  }
  fetchMessages()
  refreshTimer = setInterval(() => {
    if (autoRefresh.value && !loading.value) fetchMessages()
  }, 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <v-app-bar density="comfortable" elevation="1">
    <template #prepend>
      <v-icon icon="mdi-email-fast" color="primary" />
    </template>
    <v-app-bar-title class="text-body-1">
      <span class="font-weight-medium">{{ tempmailAddress }}</span>
      <v-chip v-if="expiresLabel" size="x-small" variant="tonal" class="ms-2">
        {{ t('inbox.expiresAt', { time: expiresLabel }) }}
      </v-chip>
    </v-app-bar-title>
    <template #append>
      <v-tooltip :text="t('inbox.refresh')" location="bottom">
        <template #activator="{ props: tipProps }">
          <v-btn v-bind="tipProps" icon="mdi-refresh" :loading="loading" @click="fetchMessages" />
        </template>
      </v-tooltip>
      <v-tooltip :text="t('inbox.logout')" location="bottom">
        <template #activator="{ props: tipProps }">
          <v-btn v-bind="tipProps" icon="mdi-logout" @click="handleLogout" />
        </template>
      </v-tooltip>
    </template>
  </v-app-bar>

  <v-main>
    <v-container fluid class="pa-4">
      <v-row>
        <!-- List -->
        <v-col cols="12" md="5">
          <v-card rounded="xl" variant="outlined">
            <v-toolbar density="compact" color="transparent" flat>
              <v-toolbar-title class="text-subtitle-1">
                {{ t('inbox.title') }}
                <span class="text-caption text-medium-emphasis">({{ total }})</span>
              </v-toolbar-title>
              <v-switch v-model="autoRefresh" :label="t('inbox.autoRefresh')" density="compact" hide-details
                class="me-3" />
            </v-toolbar>
            <v-divider />
            <v-list v-if="messages.length" lines="two" density="comfortable" select-strategy="single-leaf">
              <v-list-item v-for="m in messages" :key="m.id" :title="m.subject || t('inbox.noSubject')"
                :subtitle="`${m.sender || '?'} · ${formatTimestamp(m.created_at)}`"
                :active="selected?.id === m.id" @click="openMessage(m)">
                <template #prepend>
                  <v-icon icon="mdi-email-outline" />
                </template>
                <template #append>
                  <v-btn icon="mdi-delete" variant="text" size="small" @click.stop="deleteMessage(m)" />
                </template>
              </v-list-item>
            </v-list>
            <v-empty-state v-else :title="t('inbox.empty')" :text="t('inbox.emptyHint')"
              icon="mdi-email-open-outline" />
            <v-divider v-if="messages.length" />
            <v-card-actions v-if="total > limit" class="justify-center">
              <v-pagination v-model="page" :length="Math.ceil(total / limit)" :total-visible="5"
                @update:model-value="fetchMessages" />
            </v-card-actions>
          </v-card>

          <v-alert v-if="error" type="error" variant="tonal" density="comfortable" class="mt-3">
            {{ error }}
          </v-alert>

          <v-card variant="text" class="mt-3">
            <v-card-actions>
              <v-btn variant="text" color="error" prepend-icon="mdi-account-remove"
                @click="confirmDelete = true">
                {{ t('inbox.deleteAccount') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <!-- Reader -->
        <v-col cols="12" md="7">
          <v-card v-if="selected" rounded="xl" variant="outlined">
            <v-card-title class="text-h6">{{ selected.subject || t('inbox.noSubject') }}</v-card-title>
            <v-card-subtitle>
              <strong>{{ t('inbox.from') }}:</strong> {{ selected.sender || '?' }}
              <br />
              <strong>{{ t('inbox.date') }}:</strong> {{ formatTimestamp(selected.created_at) }}
            </v-card-subtitle>
            <v-divider />
            <v-card-text>
              <div v-if="selected.html" v-html="selected.html" class="mail-html" />
              <pre v-else-if="selected.text" class="text-body-2 mail-text">{{ selected.text }}</pre>
              <v-alert v-else type="info" variant="tonal" density="comfortable">
                {{ t('inbox.empty') }}
              </v-alert>

              <v-divider v-if="selected.attachments.length" class="my-4" />
              <div v-if="selected.attachments.length">
                <h4 class="text-subtitle-2 mb-2">{{ t('inbox.attachments') }}</h4>
                <v-chip v-for="a in selected.attachments" :key="a.filename" class="me-2 mb-2"
                  variant="tonal" prepend-icon="mdi-paperclip">
                  {{ a.filename }} ({{ Math.round(a.size / 1024) }} KB)
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
          <v-empty-state v-else :title="t('inbox.selectMessage')" icon="mdi-cursor-default-outline" />
        </v-col>
      </v-row>
    </v-container>
  </v-main>

  <!-- Delete account confirmation -->
  <v-dialog v-model="confirmDelete" max-width="420" persistent>
    <v-card rounded="xl">
      <v-card-title class="text-h6">{{ t('inbox.deleteAccountTitle') }}</v-card-title>
      <v-card-text>{{ t('inbox.deleteAccountConfirm') }}</v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" @click="confirmDelete = false">{{ t('actions.cancel') }}</v-btn>
        <v-btn color="error" variant="flat" @click="deleteAccount">{{ t('inbox.deleteAccount') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.mail-html :deep(img) { max-width: 100%; height: auto; }
.mail-text { white-space: pre-wrap; word-break: break-word; }
</style>
