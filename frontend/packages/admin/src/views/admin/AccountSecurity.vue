<script setup>
import { onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { ShieldFilled } from '@vicons/material'
import useClipboard from 'vue-clipboard3'

import { api } from '../../api'
import { hashPassword } from '../../utils'

const { t } = useScopedI18n('views.admin.AccountSecurity')
const message = useMessage()
const { toClipboard } = useClipboard()

const status = ref({ enabled: false, username: '', last_login_at: null, last_login_ip: null })
const loading = ref(false)
const setupSecret = ref('')
const setupOtpauth = ref('')
const confirmCode = ref('')
const disableCode = ref('')
const showSetupModal = ref(false)
const showDisableModal = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const refreshStatus = async () => {
  try {
    status.value = await api.fetch('/admin/2fa/status')
  } catch (error) {
    message.error(error.message || 'error')
  }
}

const setup = async () => {
  loading.value = true
  try {
    const res = await api.fetch('/admin/2fa/setup', { method: 'POST', body: '{}' })
    setupSecret.value = res.secret
    setupOtpauth.value = res.otpauth
    confirmCode.value = ''
    showSetupModal.value = true
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const confirm = async () => {
  if (!confirmCode.value || confirmCode.value.length !== 6) {
    message.error(t('codeFormat'))
    return
  }
  loading.value = true
  try {
    await api.fetch('/admin/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ secret: setupSecret.value, code: confirmCode.value }),
    })
    message.success(t('twofaEnabled'))
    showSetupModal.value = false
    setupSecret.value = ''
    setupOtpauth.value = ''
    await refreshStatus()
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const disable = async () => {
  if (!disableCode.value || disableCode.value.length !== 6) {
    message.error(t('codeFormat'))
    return
  }
  loading.value = true
  try {
    await api.fetch('/admin/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code: disableCode.value }),
    })
    message.success(t('twofaDisabled'))
    showDisableModal.value = false
    disableCode.value = ''
    await refreshStatus()
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const submitPasswordChange = async () => {
  if (!currentPassword.value || !newPassword.value) {
    message.error(t('passwordRequired'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    message.error(t('passwordMismatch'))
    return
  }
  loading.value = true
  try {
    await api.fetch('/admin/account/change_password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: await hashPassword(currentPassword.value),
        new_password: await hashPassword(newPassword.value),
      }),
    })
    message.success(t('passwordChanged'))
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (error) {
    message.error(error.message || 'error')
  } finally {
    loading.value = false
  }
}

const copy = async (value) => {
  try {
    await toClipboard(value)
    message.success(t('copied'))
  } catch (error) {
    message.error(error.message || 'error')
  }
}

onMounted(refreshStatus)
</script>

<template>
  <div style="display: flex; justify-content: center; padding: 20px;">
    <n-space vertical style="width: 720px; max-width: 100%;">
      <!-- Status card -->
      <n-card :title="t('title')" :bordered="false">
        <template #header-extra>
          <n-icon size="22" :component="ShieldFilled" />
        </template>
        <n-descriptions label-placement="left" :column="1" bordered size="small">
          <n-descriptions-item :label="t('username')">{{ status.username || '—' }}</n-descriptions-item>
          <n-descriptions-item :label="t('twofaStatus')">
            <n-tag :type="status.enabled ? 'success' : 'default'">
              {{ status.enabled ? t('twofaOn') : t('twofaOff') }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('lastLoginAt')">{{ status.last_login_at || '—' }}</n-descriptions-item>
          <n-descriptions-item :label="t('lastLoginIp')">{{ status.last_login_ip || '—' }}</n-descriptions-item>
        </n-descriptions>
        <n-space style="margin-top: 16px;">
          <n-button v-if="!status.enabled" @click="setup" :loading="loading" type="primary" secondary>
            {{ t('enable2fa') }}
          </n-button>
          <n-button v-else @click="showDisableModal = true" type="warning" secondary>
            {{ t('disable2fa') }}
          </n-button>
        </n-space>
      </n-card>

      <!-- Change password -->
      <n-card :title="t('changePasswordTitle')" :bordered="false">
        <n-form>
          <n-form-item-row :label="t('currentPassword')" required>
            <n-input v-model:value="currentPassword" type="password" show-password-on="click" />
          </n-form-item-row>
          <n-form-item-row :label="t('newPassword')" required>
            <n-input v-model:value="newPassword" type="password" show-password-on="click" />
          </n-form-item-row>
          <n-form-item-row :label="t('confirmPassword')" required>
            <n-input v-model:value="confirmPassword" type="password" show-password-on="click"
              @keyup.enter="submitPasswordChange" />
          </n-form-item-row>
        </n-form>
        <n-button @click="submitPasswordChange" type="primary" :loading="loading" block secondary>
          {{ t('changePasswordCta') }}
        </n-button>
      </n-card>
    </n-space>

    <!-- Setup modal -->
    <n-modal v-model:show="showSetupModal" :closable="!loading" :mask-closable="false" preset="card"
      :title="t('setupTitle')" style="max-width: 560px;">
      <n-space vertical>
        <n-alert type="info" :show-icon="false">{{ t('setupHint') }}</n-alert>
        <n-form-item :label="t('otpauthLabel')">
          <n-input :value="setupOtpauth" readonly />
          <n-button @click="copy(setupOtpauth)" tertiary style="margin-left: 8px;">{{ t('copy') }}</n-button>
        </n-form-item>
        <n-form-item :label="t('secretLabel')">
          <n-input :value="setupSecret" readonly />
          <n-button @click="copy(setupSecret)" tertiary style="margin-left: 8px;">{{ t('copy') }}</n-button>
        </n-form-item>
        <n-form-item :label="t('confirmCodeLabel')" required>
          <n-input v-model:value="confirmCode" :placeholder="t('codePlaceholder')" :maxlength="6"
            @keyup.enter="confirm" />
        </n-form-item>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSetupModal = false" :disabled="loading">{{ t('cancel') }}</n-button>
          <n-button @click="confirm" type="primary" :loading="loading">{{ t('confirmCta') }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Disable modal -->
    <n-modal v-model:show="showDisableModal" :closable="!loading" preset="card"
      :title="t('disableTitle')" style="max-width: 460px;">
      <n-form-item :label="t('confirmCodeLabel')" required>
        <n-input v-model:value="disableCode" :placeholder="t('codePlaceholder')" :maxlength="6"
          @keyup.enter="disable" />
      </n-form-item>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showDisableModal = false" :disabled="loading">{{ t('cancel') }}</n-button>
          <n-button @click="disable" type="warning" :loading="loading">{{ t('disable2fa') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
