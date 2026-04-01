<script setup lang="ts">
import {
  createUser,
  deleteUser,
  getRegisterConfig,
  getUsers,
  resetUserPassword,
  updateRegisterConfig,
  updateUserApproval,
  updateUser,
} from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import type {
  AccountRole,
  AuthUser,
  RegistrationApprovalStatus,
  UserCreatePayload,
  UserListQuery,
  UserUpdatePayload,
} from '@/features/auth/types'
import PageHeader from '@/share/components/PageHeader.vue'
import { formatDateTime } from '@/share/utils/date'
import { isValidEmail } from '@/share/utils/validator'
import { Plus, Refresh, UserFilled } from '@element-plus/icons-vue'
import type { InputInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onMounted, ref } from 'vue'

const auth = useAuthStore()
const loading = ref(false)
const users = ref<AuthUser[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const keyword = ref('')
const roleFilter = ref('all')
const activeFilter = ref('all')
const approvalFilter = ref<'all' | RegistrationApprovalStatus>('all')
const registerEnabled = ref(true)
const registerApprovalRequired = ref(false)
const registerConfigLoading = ref(false)
const registerConfigSaving = ref(false)

const showCreate = ref(false)
const creating = ref(false)
const createUsernameInputRef = ref<InputInstance | null>(null)
const createForm = ref<UserCreatePayload>({
  username: '',
  nickname: null,
  email: '',
  password: '',
  role: 'user',
  is_active: true,
  bio: null,
  avatar_url: null,
})

const showEdit = ref(false)
const editing = ref(false)
const editingUserId = ref('')
const editingUserRole = ref<AccountRole>('user')
const editForm = ref<UserUpdatePayload>({
  username: '',
  nickname: null,
  email: '',
  role: 'user',
  is_active: true,
  bio: null,
  avatar_url: null,
})

const showPassword = ref(false)
const resettingPassword = ref(false)
const passwordUserId = ref('')
const passwordForm = ref({ password: '', confirmPassword: '' })

const allRoleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
  { label: '超级管理员', value: 'super_admin' },
]

const canManageSuperAdmin = computed(() => auth.isSuperAdmin)
const roleOptions = computed(() =>
  canManageSuperAdmin.value
    ? allRoleOptions
    : allRoleOptions.filter((item) => item.value !== 'super_admin'),
)

const roleFilterOptions = computed(() => [{ label: '全部角色', value: 'all' }, ...roleOptions.value])
const activeFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'active' },
  { label: '禁用', value: 'inactive' },
]
const approvalFilterOptions = [
  { label: '全部审核', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]

const roleTagType: Record<AccountRole, 'info' | 'warning' | 'danger'> = {
  user: 'info',
  admin: 'warning',
  super_admin: 'danger',
}

const approvalTagType: Record<RegistrationApprovalStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const roleLabel: Record<AccountRole, string> = {
  user: '普通用户',
  admin: '管理员',
  super_admin: '超级管理员',
}

const approvalLabel: Record<RegistrationApprovalStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

const currentUserId = computed(() => auth.user?.id ?? '')
const editingIsSelf = computed(() => editingUserId.value === currentUserId.value)
const editingIsOtherSuperAdmin = computed(
  () => editingUserRole.value === 'super_admin' && !editingIsSelf.value,
)

function resetCreateForm() {
  createForm.value = {
    username: '',
    nickname: null,
    email: '',
    password: '',
    role: 'user',
    is_active: true,
    bio: null,
    avatar_url: null,
  }
}

function focusCreateUsernameInput() {
  void nextTick(() => {
    createUsernameInputRef.value?.focus()
  })
}

function isOtherSuperAdmin(user: AuthUser) {
  return user.role === 'super_admin' && user.id !== currentUserId.value
}

function isDeleteDisabled(user: AuthUser) {
  return user.id === currentUserId.value || user.role === 'super_admin'
}

function canApprove(user: AuthUser) {
  return user.approvalStatus !== 'approved'
}

function canReject(user: AuthUser) {
  return user.approvalStatus === 'pending'
}

function validateUserForm(input: {
  username: string
  email: string
  password?: string
}) {
  if (!input.username.trim()) {
    ElMessage.error('请填写用户名')
    return false
  }
  if (input.username.trim().length < 3) {
    ElMessage.error('用户名至少 3 位')
    return false
  }
  if (!input.email.trim()) {
    ElMessage.error('请填写邮箱')
    return false
  }
  if (!isValidEmail(input.email.trim())) {
    ElMessage.error('邮箱格式无效')
    return false
  }
  if (input.password !== undefined && input.password.length < 6) {
    ElMessage.error('密码至少 6 位')
    return false
  }
  return true
}

async function fetchUsers(resetPage = false) {
  if (resetPage) page.value = 1
  if (!canManageSuperAdmin.value && roleFilter.value === 'super_admin') {
    roleFilter.value = 'all'
  }

  loading.value = true
  try {
    const params: UserListQuery = {
      page: page.value,
      page_size: pageSize.value,
    }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (roleFilter.value !== 'all') params.role = roleFilter.value
    if (activeFilter.value === 'active') params.is_active = true
    if (activeFilter.value === 'inactive') params.is_active = false
    if (approvalFilter.value !== 'all') params.approval_status = approvalFilter.value

    const res = await getUsers(params)
    users.value = res.data.items
    total.value = res.data.total
    page.value = res.data.page
    pageSize.value = res.data.page_size
  } finally {
    loading.value = false
  }
}

async function fetchRegisterPolicy() {
  registerConfigLoading.value = true
  try {
    const res = await getRegisterConfig()
    registerEnabled.value = res.data.registerEnabled
    registerApprovalRequired.value = res.data.registerApprovalRequired
  } finally {
    registerConfigLoading.value = false
  }
}

async function saveRegisterPolicy(payload: {
  registerEnabled?: boolean
  registerApprovalRequired?: boolean
}) {
  registerConfigSaving.value = true
  try {
    const res = await updateRegisterConfig(payload)
    registerEnabled.value = res.data.registerEnabled
    registerApprovalRequired.value = res.data.registerApprovalRequired
    ElMessage.success('注册配置已更新')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error?.message || '注册配置更新失败')
  } finally {
    registerConfigSaving.value = false
  }
}

async function handleApproval(user: AuthUser, approvalStatus: RegistrationApprovalStatus) {
  try {
    await updateUserApproval(user.id, approvalStatus)
    ElMessage.success(
      approvalStatus === 'approved'
        ? '已通过该用户的注册申请'
        : '已拒绝该用户的注册申请',
    )
    await fetchUsers()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error?.message || '审核失败')
  }
}

async function handleCreate() {
  if (!validateUserForm({
    username: createForm.value.username,
    email: createForm.value.email,
    password: createForm.value.password,
  })) {
    return
  }

  creating.value = true
  try {
    await createUser({
      username: createForm.value.username.trim(),
      nickname: createForm.value.nickname?.trim() || null,
      email: createForm.value.email.trim(),
      password: createForm.value.password,
      role: createForm.value.role,
      is_active: createForm.value.is_active,
      bio: createForm.value.bio?.trim() || null,
      avatar_url: createForm.value.avatar_url?.trim() || null,
    })
    ElMessage.success('用户已创建')
    showCreate.value = false
    resetCreateForm()
    await fetchUsers(true)
  } catch (error: any) {
    ElMessage.error(error?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

function openEdit(user: AuthUser) {
  editingUserId.value = user.id
  editingUserRole.value = user.role
  editForm.value = {
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    is_active: user.isActive,
    bio: user.bio,
    avatar_url: user.avatarUrl,
  }
  showEdit.value = true
}

async function handleEdit() {
  if (!validateUserForm({
    username: editForm.value.username,
    email: editForm.value.email,
  })) {
    return
  }

  editing.value = true
  try {
    await updateUser(editingUserId.value, {
      username: editForm.value.username.trim(),
      nickname: editForm.value.nickname?.trim() || null,
      email: editForm.value.email.trim(),
      role: editForm.value.role,
      is_active: editForm.value.is_active,
      bio: editForm.value.bio?.trim() || null,
      avatar_url: editForm.value.avatar_url?.trim() || null,
    })
    ElMessage.success('用户信息已更新')
    showEdit.value = false
    await fetchUsers()
  } catch (error: any) {
    ElMessage.error(error?.message || '更新失败')
  } finally {
    editing.value = false
  }
}

function openPassword(user: AuthUser) {
  passwordUserId.value = user.id
  passwordForm.value.password = ''
  passwordForm.value.confirmPassword = ''
  showPassword.value = true
}

async function handlePassword() {
  if (!passwordForm.value.password) {
    ElMessage.error('请输入新密码')
    return
  }
  if (passwordForm.value.password.length < 6) {
    ElMessage.error('密码至少 6 位')
    return
  }
  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致')
    return
  }

  resettingPassword.value = true
  try {
    await resetUserPassword(passwordUserId.value, passwordForm.value.password)
    ElMessage.success('密码已重置')
    showPassword.value = false
  } catch (error: any) {
    ElMessage.error(error?.message || '重置失败')
  } finally {
    resettingPassword.value = false
  }
}

async function handleDelete(userId: string) {
  try {
    await deleteUser(userId)
    ElMessage.success('用户已删除')
    if (users.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await fetchUsers()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除失败')
  }
}

function formatUserDate(value: string | null) {
  if (!value) {
    return '从未登录'
  }
  return formatDateTime(value)
}

function handlePageChange(nextPage: number) {
  page.value = nextPage
  fetchUsers()
}

function handlePageSizeChange(nextPageSize: number) {
  pageSize.value = nextPageSize
  fetchUsers(true)
}

onMounted(() => {
  fetchRegisterPolicy()
  fetchUsers()
})
</script>

<template>
  <div class="users-page">
    <div class="users-head">
      <PageHeader
        title="用户管理"
        :icon="UserFilled"
      />
      <el-button
        type="primary"
        :icon="Plus"
        @click="showCreate = true"
      >
        新增用户
      </el-button>
    </div>

    <el-card
      class="policy-card"
      shadow="hover"
    >
      <div class="policy-grid">
        <div class="policy-item">
          <div class="policy-main">
            <div class="policy-title-row">
              <span class="policy-title">允许新用户注册</span>
              <el-tag :type="registerEnabled ? 'success' : 'danger'">
                {{ registerEnabled ? '已开启' : '已关闭' }}
              </el-tag>
            </div>
            <div class="policy-desc">
              关闭后登录页和手机端将隐藏注册入口，后端也会拒绝注册请求
            </div>
          </div>
          <el-switch
            :model-value="registerEnabled"
            :loading="registerConfigLoading || registerConfigSaving"
            @update:model-value="saveRegisterPolicy({ registerEnabled: Boolean($event) })"
          />
        </div>

        <div class="policy-item">
          <div class="policy-main">
            <div class="policy-title-row">
              <span class="policy-title">注册后需要审核</span>
              <el-tag :type="registerApprovalRequired ? 'warning' : 'info'">
                {{ registerApprovalRequired ? '已开启' : '已关闭' }}
              </el-tag>
            </div>
            <div class="policy-desc">
              开启后，新注册账号会进入待审核状态，主管理员通过后才能登录
            </div>
          </div>
          <el-switch
            :model-value="registerApprovalRequired"
            :loading="registerConfigLoading || registerConfigSaving"
            @update:model-value="saveRegisterPolicy({ registerApprovalRequired: Boolean($event) })"
          />
        </div>
      </div>
    </el-card>

    <el-card
      class="filter-card"
      shadow="hover"
    >
      <div class="filter-toolbar">
        <el-input
          v-model="keyword"
          placeholder="昵称 / 用户名 / 邮箱搜索"
          clearable
          style="width: 220px"
          @keydown.enter="fetchUsers(true)"
        />
        <el-select
          v-model="roleFilter"
          style="width: 140px"
        >
          <el-option
            v-for="item in roleFilterOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="activeFilter"
          style="width: 120px"
        >
          <el-option
            v-for="item in activeFilterOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="approvalFilter"
          style="width: 120px"
        >
          <el-option
            v-for="item in approvalFilterOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button @click="fetchUsers(true)">
          查询
        </el-button>
        <el-button
          :icon="Refresh"
          circle
          @click="fetchUsers()"
        />
      </div>
    </el-card>

    <el-skeleton
      :loading="loading"
      animated
    >
      <div class="user-list">
        <div
          v-for="item in users"
          :key="item.id"
          class="user-item"
          :class="{
            'is-active': item.isActive,
            'is-inactive': !item.isActive,
            'is-pending': item.approvalStatus === 'pending',
            'is-rejected': item.approvalStatus === 'rejected',
          }"
        >
          <div class="user-row">
            <div class="user-main">
              <div class="user-line">
                <strong>{{ item.nickname || item.username }}</strong>
                <el-tag :type="roleTagType[item.role]">
                  {{ roleLabel[item.role] }}
                </el-tag>
                <el-tag
                  v-if="item.id === currentUserId"
                  type="primary"
                >
                  当前账号
                </el-tag>
                <el-tag
                  :type="item.isActive ? 'success' : 'info'"
                  plain
                >
                  {{ item.isActive ? '启用' : '禁用' }}
                </el-tag>
                <el-tag :type="approvalTagType[item.approvalStatus]">
                  {{ approvalLabel[item.approvalStatus] }}
                </el-tag>
              </div>
              <div class="user-meta">
                {{ item.email }}
              </div>
              <div class="user-meta">
                用户名：{{ item.username }}
              </div>
              <div
                v-if="item.bio"
                class="user-meta"
              >
                简介：{{ item.bio }}
              </div>
              <div class="user-meta">
                创建时间：{{ formatDateTime(item.createdAt) }}
              </div>
              <div class="user-meta">
                最近登录：{{ formatUserDate(item.lastLoginAt) }}
              </div>
              <div class="user-meta">
                审核时间：{{ item.approvalReviewedAt ? formatDateTime(item.approvalReviewedAt) : '未审核' }}
              </div>
            </div>

            <div class="user-actions">
              <el-button
                v-if="canApprove(item)"
                size="small"
                type="primary"
                plain
                @click="handleApproval(item, 'approved')"
              >
                {{ item.approvalStatus === 'rejected' ? '改为通过' : '通过' }}
              </el-button>
              <el-button
                v-if="canReject(item)"
                size="small"
                type="danger"
                plain
                @click="handleApproval(item, 'rejected')"
              >
                拒绝
              </el-button>
              <el-button
                size="small"
                :disabled="isOtherSuperAdmin(item)"
                @click="openEdit(item)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                :disabled="isOtherSuperAdmin(item)"
                @click="openPassword(item)"
              >
                重置密码
              </el-button>
              <el-popconfirm
                title="确认删除该用户？"
                confirm-button-text="确定"
                cancel-button-text="取消"
                width="180"
                @confirm="handleDelete(item.id)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    type="danger"
                    text
                    :disabled="isDeleteDisabled(item)"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </div>
      </div>
    </el-skeleton>

    <div class="pager">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @update:current-page="handlePageChange"
        @update:page-size="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="showCreate"
      title="新增用户"
      width="520px"
      style="max-width: 96vw"
      @opened="focusCreateUsernameInput"
    >
      <el-form
        label-width="80px"
        @submit.prevent="handleCreate"
      >
        <el-form-item label="用户名">
          <el-input
            ref="createUsernameInputRef"
            v-model="createForm.username"
          />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="createForm.role"
            style="width: 100%"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="createForm.is_active" />
        </el-form-item>
        <el-form-item label="头像链接">
          <el-input v-model="createForm.avatar_url" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="createForm.bio"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="creating"
          @click="handleCreate"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEdit"
      title="编辑用户"
      width="520px"
      style="max-width: 96vw"
    >
      <el-form
        label-width="80px"
        @submit.prevent="handleEdit"
      >
        <el-form-item label="用户名">
          <el-input v-model="editForm.username" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select
            v-model="editForm.role"
            style="width: 100%"
            :disabled="editingIsSelf || editingIsOtherSuperAdmin"
          >
            <el-option
              v-for="item in roleOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch
            v-model="editForm.is_active"
            :disabled="editingIsSelf || editingIsOtherSuperAdmin"
          />
        </el-form-item>
        <el-form-item label="头像链接">
          <el-input v-model="editForm.avatar_url" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input
            v-model="editForm.bio"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="editing"
          @click="handleEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showPassword"
      title="重置密码"
      width="420px"
      style="max-width: 96vw"
    >
      <el-form
        label-width="100px"
        @submit.prevent="handlePassword"
      >
        <el-form-item label="新密码">
          <el-input
            v-model="passwordForm.password"
            type="password"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPassword = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="resettingPassword"
          @click="handlePassword"
        >
          确认重置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  box-sizing: border-box;
}

.users-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.filter-card {
  margin-bottom: 12px;
}

.policy-card {
  margin-bottom: 12px;
}

.policy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.policy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.policy-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.policy-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.policy-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.policy-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.filter-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border-left: 3px solid #909399;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s ease;
}

.user-item.is-active {
  border-left-color: #18a058;
}

.user-item.is-pending {
  border-left-color: #e6a23c;
}

.user-item.is-rejected {
  border-left-color: #f56c6c;
}

.user-item.is-inactive {
  border-left-color: #909399;
  opacity: 0.92;
}

.user-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.user-main {
  min-width: 260px;
  flex: 1;
}

.user-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-meta {
  color: #888;
  font-size: 13px;
  margin-top: 4px;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  padding: 6px 14px 8px;
}

@media (max-width: 768px) {
  .users-page {
    padding: 16px;
  }

  .users-head {
    flex-direction: column;
  }

  .filter-toolbar {
    align-items: stretch;
  }

  .policy-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
