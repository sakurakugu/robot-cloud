<template>
  <div class="page">
    <PageHeader
      title="应用设置"
      :icon="Tools"
    />

    <section class="settings-section">
      <div class="section-header">
        <div>
          <h3>外观</h3>
          <p>管理云端工作台当前设备上的主题显示方式。</p>
        </div>
      </div>

      <div class="settings-list">
        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              夜间模式
            </div>
            <div class="setting-description">
              关闭时使用浅色模式。启用“跟随系统”后此项仅展示当前状态。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ isDarkMode ? '深色' : '浅色' }}</span>
            <el-switch
              :model-value="isDarkMode"
              :disabled="themeStore.followSystem"
              @update:model-value="handleDarkModeChange"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="setting-main">
            <div class="setting-title">
              跟随系统
            </div>
            <div class="setting-description">
              开启后自动根据系统当前的明暗主题切换显示模式。
            </div>
          </div>
          <div class="setting-side">
            <span class="setting-value">{{ themeStore.followSystem ? '已开启' : '已关闭' }}</span>
            <el-switch
              :model-value="themeStore.followSystem"
              @update:model-value="handleFollowSystemChange"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/app/theme/store'
import PageHeader from '@/share/components/PageHeader.vue'
import { Tools } from '@element-plus/icons-vue'
import { computed } from 'vue'

defineOptions({
  name: 'AppSettingsPage',
})

const themeStore = useThemeStore()
const isDarkMode = computed(() => themeStore.getEffectiveTheme() === 'dark')

function handleDarkModeChange(value: boolean): void {
  themeStore.setTheme(value ? 'dark' : 'light')
}

function handleFollowSystemChange(value: boolean): void {
  themeStore.setFollowSystem(value)
}
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
