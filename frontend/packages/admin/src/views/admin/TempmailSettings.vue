<script setup>
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'

const { t } = useScopedI18n('views.admin.TempmailSettings')
const message = useMessage()

const loading = ref(false)
const model = ref({
  allowed_domains: [],
  account_ttl_hours: 24,
  max_messages_per_account: 50,
  rpm: 10,
  rps: 1,
  accounts_per_day_per_ip: 100,
  max_attachment_mb: 1,
  max_body_mb: 1,
  enable_public_preview: true,
  public_preview_count: 10,
  enable_autorefresh: true,
  autorefresh_interval_sec: 30,
})

const SETTING_KEYS = {
  allowed_domains: 'tempmail.allowed_domains',
  account_ttl_hours: 'tempmail.account_ttl_hours',
  max_messages_per_account: 'tempmail.max_messages_per_account',
  rpm: 'tempmail.rpm',
  rps: 'tempmail.rps',
  accounts_per_day_per_ip: 'tempmail.accounts_per_day_per_ip',
  max_attachment_mb: 'tempmail.max_attachment_mb',
  max_body_mb: 'tempmail.max_body_mb',
  enable_public_preview: 'tempmail.enable_public_preview',
  public_preview_count: 'tempmail.public_preview_count',
  enable_autorefresh: 'tempmail.enable_autorefresh',
  autorefresh_interval_sec: 'tempmail.autorefresh_interval_sec',
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const res = await api.fetch('/admin/system/settings?category=tempmail')
    const map = new Map((res.settings || []).map((row) => [row.key, row]))
    for (const [field, key] of Object.entries(SETTING_KEYS)) {
      const row = map.get(key)
      if (row && !row.has_encrypted_value && row.value !== null && row.value !== undefined) {
        model.value[field] = row.value
      }
    }
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  loading.value = true
  try {
    for (const [field, key] of Object.entries(SETTING_KEYS)) {
      await api.fetch('/admin/system/settings', {
        method: 'POST',
        body: JSON.stringify({
          key,
          value: model.value[field],
          category: 'tempmail',
          encrypted: false,
        }),
      })
    }
    message.success(t('saved'))
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div style="display: flex; justify-content: center; padding: 20px;">
    <n-card :title="t('title')" :bordered="false" style="width: 720px; max-width: 100%;">
      <n-alert :show-icon="false" :bordered="false" type="info" style="margin-bottom: 16px;">
        {{ t('hint') }}
      </n-alert>
      <n-form>
        <n-form-item :label="t('allowedDomains')">
          <n-dynamic-tags v-model:value="model.allowed_domains" />
        </n-form-item>
        <n-form-item :label="t('accountTtl')">
          <n-input-number v-model:value="model.account_ttl_hours" :min="1" :max="168"
            style="width: 100%;" />
        </n-form-item>
        <n-form-item :label="t('maxMessages')">
          <n-input-number v-model:value="model.max_messages_per_account" :min="1" :max="1000"
            style="width: 100%;" />
        </n-form-item>
        <n-grid :cols="2" :x-gap="12">
          <n-form-item-gi :label="t('rpm')">
            <n-input-number v-model:value="model.rpm" :min="1" :max="600" style="width: 100%;" />
          </n-form-item-gi>
          <n-form-item-gi :label="t('rps')">
            <n-input-number v-model:value="model.rps" :min="1" :max="60" style="width: 100%;" />
          </n-form-item-gi>
        </n-grid>
        <n-form-item :label="t('accountsPerDay')">
          <n-input-number v-model:value="model.accounts_per_day_per_ip" :min="1" :max="100000"
            style="width: 100%;" />
        </n-form-item>
        <n-grid :cols="2" :x-gap="12">
          <n-form-item-gi :label="t('maxAttachment')">
            <n-input-number v-model:value="model.max_attachment_mb" :min="1" :max="50" style="width: 100%;" />
          </n-form-item-gi>
          <n-form-item-gi :label="t('maxBody')">
            <n-input-number v-model:value="model.max_body_mb" :min="1" :max="50" style="width: 100%;" />
          </n-form-item-gi>
        </n-grid>
        <n-divider />
        <n-form-item :label="t('enablePublicPreview')">
          <n-switch v-model:value="model.enable_public_preview" />
        </n-form-item>
        <n-form-item :label="t('publicPreviewCount')">
          <n-input-number v-model:value="model.public_preview_count" :min="1" :max="50"
            :disabled="!model.enable_public_preview" style="width: 100%;" />
        </n-form-item>
        <n-form-item :label="t('enableAutorefresh')">
          <n-switch v-model:value="model.enable_autorefresh" />
        </n-form-item>
        <n-form-item :label="t('autorefreshInterval')">
          <n-input-number v-model:value="model.autorefresh_interval_sec" :min="5" :max="600"
            :disabled="!model.enable_autorefresh" style="width: 100%;" />
        </n-form-item>
      </n-form>
      <n-button @click="save" type="primary" :loading="loading" block secondary>{{ t('save') }}</n-button>
    </n-card>
  </div>
</template>
