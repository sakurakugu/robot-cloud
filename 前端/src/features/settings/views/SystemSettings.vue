<template>
  <div class="page">
    <PageHeader
      title="系统设置"
      :icon="Key"
    />

    <div class="content">
      <el-card shadow="hover">
        <el-form
          :model="formData"
          label-width="180px"
          label-position="left"
        >
          <div class="card-title">
            安全设置
          </div>
          <el-form-item label="允许密钥剪贴板读取">
            <el-switch
              v-model="allowSecretClipboardPaste"
              :disabled="!canManageSystemSettings || loading"
            />
            <el-text
              class="setting-help"
              type="info"
            >
              开启后，参数管理页可从系统剪贴板读取并填充大模型与 ASR 密钥。默认关闭。
            </el-text>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :icon="Select"
              :loading="loading"
              :disabled="!canManageSystemSettings"
              @click="save"
            >
              保存系统设置
            </el-button>
            <el-text
              v-if="saved"
              type="success"
              style="margin-left: 12px"
            >
              已保存
            </el-text>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/features/auth/store'
import { getSystemConfig, updateSystemConfig } from '@/features/settings/api'
import PageHeader from '@/share/components/PageHeader.vue'
import { Key, Select } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

defineOptions({
  name: 'SystemSettingsAdminPage',
})

const formData = ref({})
const allowSecretClipboardPaste = ref(false)
const loading = ref(false)
const saved = ref(false)
const authStore = useAuthStore()
const canManageSystemSettings = computed(() => authStore.isSuperAdmin)

const loadSystemSettings = async () => {
  loading.value = true
  try {
    const response = await getSystemConfig()
    allowSecretClipboardPaste.value = !!response.data?.allowSecretClipboardPaste
  } catch (error) {
    console.error('加载系统设置失败:', error)
    allowSecretClipboardPaste.value = false
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadSystemSettings()
})

const save = async () => {
  if (!authStore.isSuperAdmin) {
    ElMessage.error('仅主管理员可修改系统设置')
    return
  }

  loading.value = true
  try {
    await updateSystemConfig({
      allowSecretClipboardPaste: allowSecretClipboardPaste.value,
    })
    saved.value = true
    setTimeout(() => (saved.value = false), 1200)
  } catch (error: any) {
    ElMessage.error(error?.message || '系统设置保存失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.content {
  max-width: 800px;
}

:deep(.el-card__body) {
  padding: 30px;
}

.card-title {
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.setting-help {
  margin-left: 12px;
  line-height: 1.6;
}
</style>
