<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { NButton, NTag } from 'naive-ui'

import { api } from '../../api'

const { t } = useScopedI18n('views.admin.SystemSettings')
const message = useMessage()

const CATEGORIES = ['general', 'domains', 'tempmail', 'email', 'telegram', 'oauth', 'ai', 'webhook', 'security']

const selectedCategory = ref('tempmail')
const settings = ref([])
const loading = ref(false)
const showEditor = ref(false)
const editor = ref({
  key: '',
  value: '',
  category: 'tempmail',
  encrypted: false,
  isNew: true,
})

const formatValue = (row) => {
  if (row.has_encrypted_value) return '***'
  if (row.value === null || row.value === undefined) return '—'
  if (typeof row.value === 'string') return row.value
  try { return JSON.stringify(row.value) } catch { return String(row.value) }
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const res = await api.fetch(`/admin/system/settings?category=${selectedCategory.value}`)
    settings.value = res.settings || []
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editor.value = {
    key: '',
    value: '',
    category: selectedCategory.value,
    encrypted: false,
    isNew: true,
  }
  showEditor.value = true
}

const openEdit = (row) => {
  editor.value = {
    key: row.key,
    value: row.has_encrypted_value
      ? ''
      : (typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2) ?? ''),
    category: row.category || selectedCategory.value,
    encrypted: !!row.has_encrypted_value,
    isNew: false,
  }
  showEditor.value = true
}

const save = async () => {
  const trimmedKey = editor.value.key.trim()
  if (!trimmedKey) {
    message.error(t('keyRequired'))
    return
  }
  let parsedValue = editor.value.value
  // try to JSON-parse so users can store arrays/objects naturally; falls back to raw string
  if (typeof parsedValue === 'string' && parsedValue.length > 0) {
    const trimmed = parsedValue.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        trimmed === 'true' || trimmed === 'false' ||
        /^-?\d+(\.\d+)?$/.test(trimmed)) {
      try { parsedValue = JSON.parse(trimmed) } catch { /* keep string */ }
    }
  }
  loading.value = true
  try {
    await api.fetch('/admin/system/settings', {
      method: 'POST',
      body: JSON.stringify({
        key: trimmedKey,
        value: parsedValue,
        category: editor.value.category,
        encrypted: editor.value.encrypted,
      }),
    })
    message.success(t('saved'))
    showEditor.value = false
    await fetchSettings()
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const remove = async (row) => {
  loading.value = true
  try {
    await api.fetch(`/admin/system/settings/${encodeURIComponent(row.key)}`, { method: 'DELETE' })
    message.success(t('deleted'))
    await fetchSettings()
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const test = async (kind) => {
  if (kind === 'telegram') {
    const token = prompt(t('promptTgToken'))
    if (!token) return
    try {
      const res = await api.fetch('/admin/system/test', {
        method: 'POST',
        body: JSON.stringify({ type: 'telegram', payload: { token } }),
      })
      message.success(res.success ? t('tgOk', { bot: res.bot ?? '' }) : (res.error || 'error'))
    } catch (error) {
      message.error(error.message || 'error')
    }
  } else if (kind === 'webhook') {
    const url = prompt(t('promptWebhookUrl'))
    if (!url) return
    try {
      const res = await api.fetch('/admin/system/test', {
        method: 'POST',
        body: JSON.stringify({ type: 'webhook', payload: { url } }),
      })
      message.success(res.success ? `OK ${res.status}` : `${res.error || 'error'} ${res.status ?? ''}`)
    } catch (error) {
      message.error(error.message || 'error')
    }
  }
}

const columns = computed(() => [
  { title: t('keyCol'), key: 'key', width: 320 },
  {
    title: t('valueCol'), key: 'value', render: (row) => formatValue(row),
  },
  {
    title: t('encrypted'), key: 'encrypted', width: 110,
    render: (row) => h(NTag, { type: row.has_encrypted_value ? 'warning' : 'default', bordered: false, size: 'small' },
      () => row.has_encrypted_value ? t('yes') : t('no')),
  },
  { title: t('updatedAt'), key: 'updated_at', width: 180 },
  {
    title: t('actions'), key: 'actions', width: 160,
    render: (row) => h('div', { style: 'display: flex; gap: 6px;' }, [
      h(NButton, { tertiary: true, size: 'small', onClick: () => openEdit(row) }, () => t('edit')),
      h(NButton, { tertiary: true, type: 'error', size: 'small', onClick: () => remove(row) }, () => t('delete')),
    ]),
  },
])

onMounted(fetchSettings)
</script>

<template>
  <div>
    <n-space align="center" style="margin-bottom: 12px;">
      <n-select v-model:value="selectedCategory" :options="CATEGORIES.map(c => ({ label: c, value: c }))"
        style="width: 200px;" @update-value="fetchSettings" />
      <n-button @click="fetchSettings" type="primary" tertiary :loading="loading">{{ t('refresh') }}</n-button>
      <n-button @click="openCreate" type="primary">{{ t('add') }}</n-button>
      <n-divider vertical />
      <n-button @click="test('telegram')" tertiary>{{ t('testTelegram') }}</n-button>
      <n-button @click="test('webhook')" tertiary>{{ t('testWebhook') }}</n-button>
    </n-space>

    <n-alert :show-icon="false" :bordered="false" type="info" style="margin-bottom: 12px;">
      {{ t('hint') }}
    </n-alert>

    <n-data-table
      :columns="columns"
      :data="settings"
      :loading="loading"
      :scroll-x="900"
      size="small"
      :bordered="false"
    />

    <n-modal v-model:show="showEditor" preset="card" style="max-width: 640px;"
      :title="editor.isNew ? t('addTitle') : t('editTitle')" :closable="!loading" :mask-closable="!loading">
      <n-form>
        <n-form-item :label="t('keyCol')" required>
          <n-input v-model:value="editor.key" :placeholder="t('keyPlaceholder')" :disabled="!editor.isNew" />
        </n-form-item>
        <n-form-item :label="t('valueCol')">
          <n-input v-model:value="editor.value" type="textarea" :rows="4"
            :placeholder="editor.encrypted ? t('encryptedValuePlaceholder') : t('valuePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('categoryCol')">
          <n-select v-model:value="editor.category"
            :options="CATEGORIES.map(c => ({ label: c, value: c }))" />
        </n-form-item>
        <n-form-item :label="t('encrypted')">
          <n-switch v-model:value="editor.encrypted" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditor = false" :disabled="loading">{{ t('cancel') }}</n-button>
          <n-button @click="save" type="primary" :loading="loading">{{ t('save') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
