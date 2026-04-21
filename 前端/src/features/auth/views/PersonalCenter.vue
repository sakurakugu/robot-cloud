<template>
  <div class="page">
    <PageHeader
      title="个人中心"
      :icon="User"
      @back="goHome"
    >
      <template #extra>
        <el-text
          v-if="!loading && sessions.length > 0"
          type="info"
          size="small"
        >
          共 {{ sessions.length }} 台设备在线
        </el-text>
        <el-button
          :icon="Refresh"
          :loading="loading"
          @click="loadSessions"
        >
          刷新设备
        </el-button>
        <el-button
          type="primary"
          :icon="HomeFilled"
          @click="goHome"
        >
          首页
        </el-button>
      </template>
    </PageHeader>

    <el-row :gutter="20">
      <el-col
        :span="8"
        :xs="24"
      >
        <el-card
          shadow="hover"
          class="profile-card"
        >
          <div class="avatar-container">
            <el-avatar
              :size="100"
              class="user-avatar"
            >
              {{ userInfo?.username?.charAt(0)?.toUpperCase() }}
            </el-avatar>
            <h2 class="username">
              {{ userInfo?.username }}
            </h2>
            <el-tag
              :type="roleType"
              effect="dark"
              round
            >
              {{ roleName }}
            </el-tag>
          </div>
          <div class="user-stats">
            <div class="stat-item">
              <span class="label">注册时间</span>
              <span class="value">{{ userInfo?.createdAt ? formatDate(userInfo.createdAt) : '-' }}</span>
            </div>
            <div class="stat-item">
              <span class="label">最后更新</span>
              <span class="value">{{ userInfo?.updatedAt ? formatDate(userInfo.updatedAt) : '-' }}</span>
            </div>
          </div>
          <div class="profile-actions">
            <el-button
              type="primary"
              plain
              @click="openFeedbackDialog"
            >
              提交反馈
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col
        :span="16"
        :xs="24"
      >
        <el-card
          shadow="hover"
          header="基本信息"
          class="info-card"
        >
          <el-descriptions
            :column="1"
            border
          >
            <el-descriptions-item label="用户ID">
              {{ userInfo?.id }}
            </el-descriptions-item>
            <el-descriptions-item label="用户名">
              {{ userInfo?.username }}
            </el-descriptions-item>
            <el-descriptions-item label="昵称">
              {{ userInfo?.nickname || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="邮箱">
              {{ userInfo?.email || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="角色权限">
              <el-tag
                :type="roleType"
                size="small"
              >
                {{ roleName }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="最近登录">
              {{ userInfo?.lastLoginAt ? formatDateTime(userInfo.lastLoginAt) : '从未登录' }}
            </el-descriptions-item>
            <el-descriptions-item label="个人简介">
              {{ userInfo?.bio || '暂未填写' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>

    <el-card
      shadow="hover"
      class="sessions-card"
    >
      <template #header>
        <div class="card-header">
          <div>
            <span class="card-title">登录设备</span>
            <el-text
              class="card-subtitle"
              type="info"
            >
              可查看当前账号的活跃设备，并手动下线非当前设备
            </el-text>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="sessions"
        border
        :empty-text="'暂无登录记录'"
      >
        <el-table-column
          prop="deviceName"
          label="设备"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="clientType"
          label="类型"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.clientType === 'mobile' ? 'warning' : 'primary'"
              effect="light"
            >
              {{ row.clientType === 'mobile' ? '手机端' : row.clientType === 'web' ? 'Web' : row.clientType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="ipAddress"
          label="IP地址"
          width="140"
        />
        <el-table-column
          label="最近活跃"
          min-width="180"
        >
          <template #default="{ row }">
            {{ formatDateTime(row.lastSeenAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="140"
        >
          <template #default="{ row }">
            <el-tag
              v-if="row.current"
              type="success"
              effect="dark"
              size="small"
            >
              当前设备
            </el-tag>
            <el-button
              v-else
              type="danger"
              plain
              size="small"
              @click="kick(row.id)"
            >
              下线
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="feedbackDialogVisible"
      title="提交反馈"
      width="520px"
      destroy-on-close
    >
      <el-input
        v-model="feedbackContent"
        type="textarea"
        :rows="6"
        maxlength="1000"
        show-word-limit
        placeholder="请输入反馈内容"
      />
      <template #footer>
        <el-button @click="feedbackDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="feedbackSubmitting"
          :disabled="!feedbackContent.trim()"
          @click="handleSubmitFeedback"
        >
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { submitFeedback } from '@/features/settings/api'
import { getMySessions, revokeSession } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import type { LoginSession } from '@/features/auth/types'
import PageHeader from '@/share/components/PageHeader.vue'
import { formatDate, formatDateTime } from '@/share/utils/date'
import { HomeFilled, Refresh, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const authStore = useAuthStore()
const userInfo = computed(() => authStore.user)
const loading = ref(false)
const sessions = ref<LoginSession[]>([])
const feedbackDialogVisible = ref(false)
const feedbackContent = ref('')
const feedbackSubmitting = ref(false)

const roleName = computed(() => {
  const role = userInfo.value?.role
  switch (role) {
    case 'super_admin':
      return '超级管理员'
    case 'admin':
      return '管理员'
    case 'user':
      return '普通用户'
    default:
      return role
  }
})

const roleType = computed(() => {
  const role = userInfo.value?.role
  switch (role) {
    case 'super_admin':
      return 'danger'
    case 'admin':
      return 'warning'
    case 'user':
      return 'primary'
    default:
      return 'info'
  }
})

const goHome = () => {
  router.push('/home')
}

const loadSessions = async () => {
  try {
    loading.value = true
    const res = await getMySessions()
    sessions.value = res.data
  } finally {
    loading.value = false
  }
}

const kick = async (id: string) => {
  await revokeSession(id)
  ElMessage.success('设备已下线')
  await loadSessions()
}

const openFeedbackDialog = () => {
  feedbackContent.value = ''
  feedbackDialogVisible.value = true
}

const handleSubmitFeedback = async () => {
  const content = feedbackContent.value.trim()
  if (!content || feedbackSubmitting.value) {
    return
  }
  feedbackSubmitting.value = true
  try {
    await submitFeedback({ content })
    ElMessage.success('反馈提交成功')
    feedbackDialogVisible.value = false
    feedbackContent.value = ''
  } catch (error: any) {
    ElMessage.error(error?.message || '反馈提交失败')
  } finally {
    feedbackSubmitting.value = false
  }
}

onMounted(loadSessions)
</script>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.profile-card {
  text-align: center;
  margin-bottom: 20px;
}

.info-card {
  margin-bottom: 20px;
}

.sessions-card {
  margin-bottom: 20px;
}

.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.user-avatar {
  font-size: 32px;
  background-color: var(--el-color-primary);
}

.username {
  margin: 16px 0 8px;
  font-size: 24px;
  color: var(--el-text-color-primary);
}

.user-stats {
  margin-top: 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 24px;
}

.profile-actions {
  margin-top: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-item .label {
  color: var(--el-text-color-secondary);
}

.stat-item .value {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-subtitle {
  display: block;
  margin-top: 4px;
}
</style>
