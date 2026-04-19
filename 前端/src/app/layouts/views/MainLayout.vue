<template>
  <el-container class="layout-container">
    <el-header class="layout-header">
      <div class="header-content">
        <el-icon
          class="logo-icon"
          :size="24"
        >
          <Bot />
        </el-icon>
        <h1>机器狗管理云端</h1>
        <el-button
          text
          class="home-btn"
          @click="goHome"
        >
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-button>
      </div>
      <div class="header-actions">
        <el-dropdown
          trigger="click"
          @command="handleCommand"
        >
          <div class="avatar-wrapper">
            <el-avatar
              :size="32"
              class="header-avatar"
            >
              {{ displayName }}
            </el-avatar>
            <span class="username-text">{{ userName }}</span>
            <el-icon class="dropdown-icon">
              <ArrowDown />
            </el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="controlPanel">
                <el-icon><User /></el-icon>
                <span>控制面板</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-if="!authStore.isAuthenticated"
                command="login"
              >
                <el-icon><Key /></el-icon>
                <span>登录 / 注册</span>
              </el-dropdown-item>
              <el-dropdown-item
                v-if="authStore.isAuthenticated"
                command="logout"
                divided
              >
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="main-container">
      <el-aside
        class="layout-aside"
        :class="{
          'is-compact': isCompact,
          'is-hidden': isHidden,
        }"
        :width="`${currentAsideWidth}px`"
      >
        <div class="aside-inner">
          <div class="aside-title">
            <el-icon class="aside-title-icon">
              <Bot />
            </el-icon>
            <span class="aside-title-text">控制台</span>
          </div>

          <el-menu
            :collapse="isCompact"
            :collapse-transition="false"
            :default-active="activeMenu"
            class="layout-menu"
            router
          >
            <el-menu-item
              v-for="item in menuItems"
              :key="item.key"
              :index="item.key"
              :class="{
                'menu-item--group-start': item.groupStart,
              }"
            >
              <el-icon class="menu-icon">
                <component :is="item.icon" />
              </el-icon>
              <template #title>
                {{ item.label }}
              </template>
            </el-menu-item>
          </el-menu>

          <div class="aside-footer">
            <el-button
              text
              class="aside-trigger"
              @click="toggleAside"
            >
              <el-icon class="trigger-icon">
                <component :is="triggerIcon" />
              </el-icon>
              <span class="aside-trigger-text">{{ triggerText }}</span>
            </el-button>
          </div>
        </div>
      </el-aside>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/features/auth/store'
import { ArrowDown, ChatDotRound, Collection, Expand, Film, Fold, HomeFilled, Key, List, Monitor, Setting, SwitchButton, Tools, UploadFilled, User, UserFilled, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type AsideMode = 'expanded' | 'compact' | 'hidden'

type MenuEntry = {
  key: string
  label: string
  icon: Component
  groupStart?: boolean
}

type MenuGroup = {
  key: 'normal' | 'admin' | 'super-admin'
  title: string
  items: MenuEntry[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const asideMode = ref<AsideMode>('expanded')
const autoCompact = ref(false)
const asideWidth = 200
const asideCompactWidth = 64
const asideHiddenWidth = 0
const collapseRatio = 0.22
const expandRatio = 0.2

const isCompact = computed(() => asideMode.value === 'compact')
const isHidden = computed(() => asideMode.value === 'hidden')
const currentAsideWidth = computed(() => {
  if (asideMode.value === 'hidden') {
    return asideHiddenWidth
  }
  if (asideMode.value === 'compact') {
    return asideCompactWidth
  }
  return asideWidth
})

const triggerIcon = computed(() => (isHidden.value ? Expand : Fold))
const triggerText = computed(() => {
  if (isHidden.value) {
    return '展开侧栏'
  }
  if (isCompact.value) {
    return '继续收起'
  }
  return '收起侧栏'
})

const userName = computed(() => authStore.user?.username || '游客')
const displayName = computed(() => {
  if (authStore.user?.username) {
    return authStore.user.username.charAt(0).toUpperCase()
  }
  return '客'
})

const menuGroups = computed<MenuGroup[]>(() => {
  const groups: MenuGroup[] = [
    {
      key: 'normal',
      title: '普通用户',
      items: [
        { key: '/robots', label: '机器人管理', icon: List },
        { key: '/roles', label: '角色管理', icon: UserFilled },
        { key: '/operation', label: '机器人操作', icon: VideoPlay },
        { key: '/choreo', label: '编舞系统', icon: Film },
        { key: '/personal', label: '个人资料', icon: User },
        { key: '/sessions', label: '登录设备', icon: Monitor },
        { key: '/settings', label: '应用设置', icon: Tools },
      ],
    },
  ]

  if (authStore.isAdmin) {
    groups.push({
      key: 'admin',
      title: '管理员',
      items: [
        { key: '/system-status', label: '系统状态', icon: Monitor },
        { key: '/params', label: '参数管理', icon: Setting },
        { key: '/update-manage', label: '更新管理', icon: UploadFilled },
        { key: '/kb', label: '知识库', icon: Collection },
        { key: '/feedback-manage', label: '反馈管理', icon: ChatDotRound },
        { key: '/users', label: '用户管理', icon: UserFilled },
      ],
    })
  }

  if (authStore.isSuperAdmin) {
    groups.push({
      key: 'super-admin',
      title: '主管理员',
      items: [
        { key: '/system-settings', label: '系统设置', icon: Key },
      ],
    })
  }

  return groups
})

const menuItems = computed(() =>
  menuGroups.value.flatMap((group, groupIndex) =>
    group.items.map((item, itemIndex) => ({
      ...item,
      groupStart: groupIndex > 0 && itemIndex === 0,
    }))
  )
)

const activeMenu = computed(() => {
  const path = route.path
  const matched = [...menuItems.value]
    .sort((a, b) => b.key.length - a.key.length)
    .find(item => path === item.key || path.startsWith(`${item.key}/`))

  return matched?.key || path
})

function toggleAside() {
  if (isHidden.value) {
    asideMode.value = window.innerWidth && asideWidth / window.innerWidth >= collapseRatio ? 'compact' : 'expanded'
    autoCompact.value = false
    return
  }

  if (isCompact.value) {
    asideMode.value = 'hidden'
    autoCompact.value = false
    return
  }

  asideMode.value = 'compact'
  autoCompact.value = false
}

function applyAutoCollapse() {
  const width = window.innerWidth
  if (!width) {
    return
  }

  const ratio = asideWidth / width

  if (ratio >= collapseRatio) {
    if (asideMode.value === 'expanded') {
      asideMode.value = 'compact'
      autoCompact.value = true
    }
    return
  }

  if (autoCompact.value && ratio <= expandRatio && asideMode.value === 'compact') {
    asideMode.value = 'expanded'
    autoCompact.value = false
  }
}

function handleResize() {
  applyAutoCollapse()
}

function goHome() {
  router.push('/home')
}

async function handleCommand(command: string) {
  switch (command) {
    case 'controlPanel':
      router.push('/personal')
      break
    case 'login':
      router.push('/auth')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        })
        await authStore.logout()
        ElMessage.success('已退出登录')
        router.push('/auth')
      } catch {
        // 用户取消退出
      }
      break
  }
}

onMounted(() => {
  applyAutoCollapse()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100%;
}

.layout-header {
  height: 60px !important;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.logo-icon {
  font-size: 24px;
}

.layout-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-btn {
  color: rgba(255, 255, 255, 0.9) !important;
  display: flex;
  align-items: center;
  gap: 4px;
}

.home-btn:hover {
  color: white !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

.avatar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background-color 0.3s;
}

.avatar-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.header-avatar {
  background-color: white;
  color: #667eea;
  font-weight: 600;
  font-size: 14px;
}

.username-text {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.dropdown-icon {
  color: white;
  font-size: 12px;
}

.main-container {
  height: calc(100vh - 60px);
  min-height: 0;
}

.layout-aside {
  align-self: stretch;
  overflow: hidden;
  transition: width 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  border-right: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  will-change: width;
  position: relative;
}

.aside-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  overflow: hidden;
}

.aside-inner :deep(.el-menu) {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-right: none;
  background: transparent;
}

.aside-inner :deep(.el-menu::-webkit-scrollbar) {
  display: none;
}

.aside-title {
  padding: 8px 16px 16px 24px;
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  color: var(--el-text-color-primary);
}

.aside-title-icon {
  color: var(--el-color-primary);
}

.aside-title-text,
.aside-trigger-text {
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity 0.16s ease,
    transform 0.2s ease;
}

.aside-footer {
  margin-top: auto;
  padding: 12px 8px 8px;
  overflow: hidden;
}

.aside-trigger {
  width: 100%;
  justify-content: flex-start;
  overflow: hidden;
  white-space: nowrap;
}

.aside-trigger:hover {
  color: var(--el-color-primary);
}

.aside-trigger :deep(.el-button) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  overflow: visible;
  white-space: nowrap;
  padding-left: 20px;
  width: 100%;
}

.menu-icon {
  font-size: 18px;
  line-height: 1;
  position: relative;
  top: -1px;
}

.trigger-icon {
  font-size: 16px;
}

.layout-main {
  background: var(--el-bg-color-page);
  padding: 0;
  overflow: auto;
  min-width: 0;
}

.layout-aside.is-compact .aside-title {
  padding-left: 24px;
}

.layout-aside.is-compact .aside-title-text,
.layout-aside.is-compact .aside-trigger-text {
  opacity: 0;
  transform: translateX(-8px);
  pointer-events: none;
}

.layout-aside.is-compact .aside-trigger :deep(.el-button) {
  gap: 0;
  justify-content: center;
  padding-left: 0;
}

.aside-inner :deep(.el-menu-item.menu-item--group-start) {
  position: relative;
  margin-top: 18px;
}

.aside-inner :deep(.el-menu-item.menu-item--group-start::before) {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  top: -10px;
  height: 1px;
  background-color: var(--el-border-color);
  opacity: 0.9;
}

.layout-aside.is-compact .aside-inner :deep(.el-menu-item.menu-item--group-start) {
  margin-top: 14px;
}

.layout-aside.is-compact .aside-inner :deep(.el-menu-item.menu-item--group-start::before) {
  left: 12px;
  right: 12px;
  top: -8px;
}

.layout-aside.is-hidden {
  width: 0 !important;
  min-width: 0 !important;
  border-right: none;
  overflow: visible;
}

.layout-aside.is-hidden .aside-inner {
  padding: 0;
  overflow: visible;
}

.layout-aside.is-hidden .aside-title,
.layout-aside.is-hidden .aside-inner :deep(.el-menu) {
  opacity: 0;
  pointer-events: none;
}

.layout-aside.is-hidden .aside-footer {
  position: fixed;
  left: 0;
  bottom: 20px;
  padding: 0;
  overflow: visible;
  display: flex;
  justify-content: flex-start;
  z-index: 1000;
}

.layout-aside.is-hidden .aside-trigger {
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  height: 36px;
  border-radius: 0 16px 16px 0;
  background-color: var(--el-bg-color-overlay);
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  border: 1px solid var(--el-border-color-light);
  border-left: none;
}

.layout-aside.is-hidden :deep(.el-button.aside-trigger) {
  width: 60px;
  min-width: 60px;
  max-width: 60px;
}

.layout-aside.is-hidden :deep(.el-button.aside-trigger .el-button__text) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.layout-aside.is-hidden .aside-trigger :deep(.el-button) {
  width: 100%;
  height: 100%;
  padding: 0;
  gap: 0;
  justify-content: center;
}

.layout-aside.is-hidden .aside-trigger-text {
  display: none;
}

.layout-aside.is-hidden .trigger-icon {
  font-size: 18px;
}
</style>
