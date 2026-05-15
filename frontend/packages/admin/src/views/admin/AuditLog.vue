<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { NTag } from 'naive-ui'

import { api } from '../../api'

const { t } = useScopedI18n('views.admin.AuditLog')
const message = useMessage()

const filters = ref({ action: '', username: '' })
const page = ref(1)
const pageSize = 50
const total = ref(0)
const rows = ref([])
const loading = ref(false)
const cleanupDays = ref(90)

const offset = computed(() => (page.value - 1) * pageSize)

const formatDetails = (details) => {
  if (!details) return ''
  if (typeof details === 'string') return details
  try { return JSON.stringify(details) } catch { return String(details) }
}

const fetchRows = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.value.action) params.set('action', filters.value.action)
    if (filters.value.username) params.set('username', filters.value.username)
    params.set('limit', String(pageSize))
    params.set('offset', String(offset.value))
    const res = await api.fetch(`/admin/audit_log?${params.toString()}`)
    rows.value = res.results || []
    total.value = res.total || 0
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const cleanup = async () => {
  if (!cleanupDays.value || cleanupDays.value < 1) {
    message.error(t('invalidDays'))
    return
  }
  loading.value = true
  try {
    const res = await api.fetch(`/admin/audit_log?days=${cleanupDays.value}`, { method: 'DELETE' })
    message.success(t('cleanupSuccess', { count: res.deleted ?? 0 }))
    page.value = 1
    await fetchRows()
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const columns = computed(() => [
  { title: 'ID', key: 'id', width: 70 },
  { title: t('createdAt'), key: 'created_at', width: 180 },
  { title: t('username'), key: 'username', width: 140 },
  {
    title: t('action'), key: 'action', width: 200,
    render: (row) => h(NTag, {
      type: row.success ? 'success' : 'error',
      bordered: false,
      size: 'small',
    }, () => row.action),
  },
  { title: t('target'), key: 'target', width: 180 },
  { title: 'IP', key: 'ip', width: 130 },
  { title: t('details'), key: 'details', render: (row) => formatDetails(row.details) },
])

onMounted(fetchRows)
</script>

<template>
  <div>
    <n-space align="center" style="margin-bottom: 12px;">
      <n-input v-model:value="filters.action" :placeholder="t('actionFilter')" clearable
        style="width: 220px;" />
      <n-input v-model:value="filters.username" :placeholder="t('usernameFilter')" clearable
        style="width: 220px;" />
      <n-button @click="() => { page = 1; fetchRows(); }" type="primary" tertiary :loading="loading">
        {{ t('refresh') }}
      </n-button>
      <n-divider vertical />
      <n-input-number v-model:value="cleanupDays" :min="1" :max="3650" :placeholder="t('cleanupDaysPlaceholder')"
        style="width: 140px;" />
      <n-popconfirm @positive-click="cleanup" :positive-text="t('confirm')" :negative-text="t('cancel')">
        <template #trigger>
          <n-button type="warning" tertiary :loading="loading">{{ t('cleanupCta') }}</n-button>
        </template>
        {{ t('cleanupConfirm', { days: cleanupDays }) }}
      </n-popconfirm>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="rows"
      :loading="loading"
      :scroll-x="1200"
      size="small"
      :bordered="false"
    />
    <n-pagination v-if="total > pageSize" v-model:page="page" :page-count="Math.ceil(total / pageSize)"
      :page-size="pageSize" @update-page="fetchRows" style="margin-top: 12px; justify-content: center;" />
  </div>
</template>
