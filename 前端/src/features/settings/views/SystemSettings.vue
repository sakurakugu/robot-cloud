<template>
  <div class="page">
    <PageHeader
      title="系统设置"
      :icon="Key"
    />

    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3>安全</h3>
          <p>控制主管理员可调整的系统级安全行为。</p>
        </div>
      </div>

      <div class="settings-list">
        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              允许密钥剪贴板读取
            </div>
            <div class="setting-description">
              开启后，参数管理页可从系统剪贴板读取并填充大模型与 ASR 密钥。默认关闭。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ allowSecretClipboardPaste ? '已开启' : '已关闭' }}</span>
            <el-switch
              :model-value="allowSecretClipboardPaste"
              :loading="systemConfigSaving"
              :disabled="!canManageSystemSettings || systemConfigLoading"
              @update:model-value="handleSecretClipboardChange"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3>注册</h3>
          <p>统一管理用户注册入口和审核策略。</p>
        </div>
      </div>

      <div class="settings-list">
        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              允许新用户注册
            </div>
            <div class="setting-description">
              关闭后登录页和手机端将隐藏注册入口，后端也会拒绝注册请求。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ registerEnabled ? '已开启' : '已关闭' }}</span>
            <el-switch
              :model-value="registerEnabled"
              :loading="registerConfigSaving"
              :disabled="!canManageSystemSettings || registerConfigLoading"
              @update:model-value="handleRegisterEnabledChange"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              注册后需要审核
            </div>
            <div class="setting-description">
              开启后，新注册账号会进入待审核状态，主管理员通过后才能登录。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ registerApprovalRequired ? '已开启' : '已关闭' }}</span>
            <el-switch
              :model-value="registerApprovalRequired"
              :loading="registerConfigSaving"
              :disabled="!canManageSystemSettings || registerConfigLoading"
              @update:model-value="handleRegisterApprovalChange"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { getRegisterConfig, updateRegisterConfig } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import { getSystemConfig, updateSystemConfig } from '@/features/settings/api'
import PageHeader from '@/share/components/PageHeader.vue'
import { Key } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

defineOptions({
  name: 'SystemSettingsAdminPage',
})

const allowSecretClipboardPaste = ref(false)
const registerEnabled = ref(true)
const registerApprovalRequired = ref(false)
const systemConfigLoading = ref(false)
const systemConfigSaving = ref(false)
const registerConfigLoading = ref(false)
const registerConfigSaving = ref(false)
const authStore = useAuthStore()
const canManageSystemSettings = computed(() => authStore.isSuperAdmin)

async function loadSystemSettings() {
  systemConfigLoading.value = true
  try {
    const response = await getSystemConfig()
    allowSecretClipboardPaste.value = !!response.data?.allowSecretClipboardPaste
  } catch (error) {
    console.error('加载系统设置失败:', error)
    allowSecretClipboardPaste.value = false
  } finally {
    systemConfigLoading.value = false
  }
}

async function loadRegisterSettings() {
  registerConfigLoading.value = true
  try {
    const response = await getRegisterConfig()
    registerEnabled.value = response.data.registerEnabled
    registerApprovalRequired.value = response.data.registerApprovalRequired
  } catch (error) {
    console.error('加载注册设置失败:', error)
  } finally {
    registerConfigLoading.value = false
  }
}

async function handleSecretClipboardChange(value: boolean) {
  if (!canManageSystemSettings.value) {
    ElMessage.error('仅主管理员可修改系统设置')
    return
  }

  const previousValue = allowSecretClipboardPaste.value
  allowSecretClipboardPaste.value = value
  systemConfigSaving.value = true
  try {
    await updateSystemConfig({
      allowSecretClipboardPaste: value,
    })
    ElMessage.success('系统设置已更新')
  } catch (error: any) {
    allowSecretClipboardPaste.value = previousValue
    ElMessage.error(error?.message || '系统设置保存失败')
  } finally {
    systemConfigSaving.value = false
  }
}

async function handleRegisterEnabledChange(value: boolean) {
  if (!canManageSystemSettings.value) {
    ElMessage.error('仅主管理员可修改系统设置')
    return
  }

  const previousValue = registerEnabled.value
  registerEnabled.value = value
  registerConfigSaving.value = true
  try {
    const response = await updateRegisterConfig({
      registerEnabled: value,
    })
    registerEnabled.value = response.data.registerEnabled
    registerApprovalRequired.value = response.data.registerApprovalRequired
    ElMessage.success('注册配置已更新')
  } catch (error: any) {
    registerEnabled.value = previousValue
    ElMessage.error(error?.response?.data?.error || error?.message || '注册配置更新失败')
  } finally {
    registerConfigSaving.value = false
  }
}

async function handleRegisterApprovalChange(value: boolean) {
  if (!canManageSystemSettings.value) {
    ElMessage.error('仅主管理员可修改系统设置')
    return
  }

  const previousValue = registerApprovalRequired.value
  registerApprovalRequired.value = value
  registerConfigSaving.value = true
  try {
    const response = await updateRegisterConfig({
      registerApprovalRequired: value,
    })
    registerEnabled.value = response.data.registerEnabled
    registerApprovalRequired.value = response.data.registerApprovalRequired
    ElMessage.success('注册配置已更新')
  } catch (error: any) {
    registerApprovalRequired.value = previousValue
    ElMessage.error(error?.response?.data?.error || error?.message || '注册配置更新失败')
  } finally {
    registerConfigSaving.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadSystemSettings(),
    loadRegisterSettings(),
  ])
})
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.settings-section {
  max-width: 820px;
}

.settings-section + .settings-section {
  margin-top: 28px;
}

.section-header {
  margin-bottom: 14px;
}

.section-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.section-header p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

.settings-list {
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 18px;
  background: var(--el-bg-color);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px;
}

.settings-row + .settings-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.setting-main {
  min-width: 0;
}

.setting-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.setting-description {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.setting-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  flex-shrink: 0;
}

.setting-value {
  min-width: 52px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

@media (max-width: 900px) {
  .settings-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-side {
    width: 100%;
    justify-content: space-between;
  }

  .setting-value {
    text-align: left;
  }
}
</style>
