<script setup lang="ts">
import { getSystemStatus } from '@/features/settings/api'
import type {
  SystemHealthComponentStatus,
  SystemRequestAggregate,
  SystemRequestEvent,
  SystemStatus,
} from '@/features/settings/types'
import PageHeader from '@/share/components/PageHeader.vue'
import { formatDateTime } from '@/share/utils/date'
import {
  CircleCheckFilled,
  CircleCloseFilled,
  Collection,
  Connection,
  Cpu,
  Monitor,
  RefreshRight,
  Timer,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface AlertItem {
  key: string
  title: string
  description: string
  type: 'warning' | 'error'
}

const CPU_ALERT_THRESHOLD = 85
const MEMORY_ALERT_THRESHOLD = 85
const DISK_ALERT_THRESHOLD = 90
const DETAIL_PREVIEW_LENGTH = 160

function createDefaultSystemStatus(): SystemStatus {
  return {
    onlineRobots: 0,
    totalRobots: 0,
    timestamp: '',
    cpuPercent: 0,
    memoryTotalGb: 0,
    memoryUsedGb: 0,
    memoryPercent: 0,
    diskTotalGb: 0,
    diskUsedGb: 0,
    diskPercent: 0,
    uptimeSeconds: 0,
    health: {
      status: 'unknown',
      checkedAt: '',
      components: [],
    },
    runtime: {
      recentWindowMinutes: 30,
      slowRequestThresholdMs: 1000,
      errorCount: 0,
      slowRequestCount: 0,
      topErrorRoutes: [],
      topSlowRoutes: [],
      recentErrors: [],
      recentSlowRequests: [],
    },
  }
}

const loading = ref(true)
const refreshing = ref(false)
const autoRefresh = ref(true)
const samplingSeconds = ref(10)
const errorMessage = ref('')
const requestDurationMs = ref<number | null>(null)
const lastRefreshAt = ref<Date | null>(null)
const pageHidden = ref(document.hidden)
const expandedDetailMap = ref<Record<string, boolean>>({})
const sys = ref<SystemStatus>(createDefaultSystemStatus())

let refreshTimer: number | undefined

const dependencies = computed(() => sys.value.health.components)
const runtimeWindowLabel = computed(() => `最近 ${sys.value.runtime.recentWindowMinutes} 分钟`)

const alertItems = computed<AlertItem[]>(() => {
  if (loading.value && !lastRefreshAt.value) {
    return []
  }

  const items: AlertItem[] = []

  for (const dependency of dependencies.value) {
    if (dependency.status === 'unhealthy') {
      items.push({
        key: `dependency-${dependency.key}`,
        title: `${dependency.label} 异常`,
        description: dependency.detail || `${dependency.label} 当前不可用`,
        type: 'error',
      })
      continue
    }

    if (dependency.status === 'degraded') {
      items.push({
        key: `dependency-${dependency.key}`,
        title: `${dependency.label} 需要关注`,
        description: dependency.detail || `${dependency.label} 当前状态已降级`,
        type: 'warning',
      })
    }
  }

  if (sys.value.runtime.errorCount > 0) {
    items.push({
      key: 'recent-errors',
      title: '最近存在接口错误',
      description: `${runtimeWindowLabel.value} 内记录到 ${sys.value.runtime.errorCount} 次 5xx 错误，请优先查看错误摘要。`,
      type: 'error',
    })
  }

  if (sys.value.runtime.slowRequestCount > 0) {
    items.push({
      key: 'recent-slow-requests',
      title: '最近存在慢请求',
      description: `${runtimeWindowLabel.value} 内记录到 ${sys.value.runtime.slowRequestCount} 次慢请求，当前阈值 ${formatDuration(sys.value.runtime.slowRequestThresholdMs)}。`,
      type: 'warning',
    })
  }

  if (sys.value.cpuPercent >= CPU_ALERT_THRESHOLD) {
    items.push({
      key: 'cpu-high',
      title: 'CPU 使用率偏高',
      description: `当前 ${formatPercent(sys.value.cpuPercent)}，建议检查是否存在异常任务或瞬时高负载。`,
      type: 'warning',
    })
  }

  if (sys.value.memoryPercent >= MEMORY_ALERT_THRESHOLD) {
    items.push({
      key: 'memory-high',
      title: '内存使用率偏高',
      description: `当前 ${formatPercent(sys.value.memoryPercent)}，建议观察缓存堆积或内存泄漏。`,
      type: 'warning',
    })
  }

  if (sys.value.diskPercent >= DISK_ALERT_THRESHOLD) {
    items.push({
      key: 'disk-high',
      title: '磁盘空间偏紧',
      description: `当前 ${formatPercent(sys.value.diskPercent)}，建议清理日志、备份或历史包文件。`,
      type: 'warning',
    })
  }

  return items
})

const overallStatus = computed(() => {
  if (loading.value && !lastRefreshAt.value) {
    return {
      label: '正在检查',
      description: '正在拉取服务资源、机器人连接和运行摘要。',
      tagType: 'info' as const,
      icon: Monitor,
    }
  }

  if (sys.value.health.status === 'unhealthy') {
    return {
      label: '依赖异常',
      description: '核心依赖存在不可用项，建议优先检查数据库或连接链路。',
      tagType: 'danger' as const,
      icon: CircleCloseFilled,
    }
  }

  if (sys.value.runtime.errorCount > 0) {
    return {
      label: '最近有错误',
      description: '最近出现过 5xx 错误，建议结合错误摘要和后端日志排查。',
      tagType: 'danger' as const,
      icon: CircleCloseFilled,
    }
  }

  if (sys.value.health.status === 'degraded' || alertItems.value.length > 0) {
    return {
      label: '需要关注',
      description: '服务总体可用，但最近出现了降级状态、慢请求或资源告警。',
      tagType: 'warning' as const,
      icon: WarningFilled,
    }
  }

  return {
    label: '运行正常',
    description: '系统资源稳定，服务依赖检查通过。',
    tagType: 'success' as const,
    icon: CircleCheckFilled,
  }
})

function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function formatDuration(value: number): string {
  return `${Number(value.toFixed(1))} ms`
}

function formatUptime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const days = Math.floor(safeSeconds / 86400)
  const hours = Math.floor((safeSeconds % 86400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${days}天 ${hours}小时 ${minutes}分`
}

function formatAggregateSubtitle(item: SystemRequestAggregate): string {
  return `共 ${item.count} 次，峰值 ${formatDuration(item.maxDurationMs)}，均值 ${formatDuration(item.avgDurationMs)}`
}

function buildAggregateDetailKey(kind: string, item: SystemRequestAggregate): string {
  return `${kind}-${item.method}-${item.path}-${item.lastHappenedAt}`
}

function buildEventDetailKey(kind: string, item: SystemRequestEvent): string {
  return `${kind}-${item.method}-${item.path}-${item.happenedAt}-${item.statusCode}-${item.durationMs}`
}

function shouldCollapseDetail(detail: string | null): boolean {
  if (!detail) return false
  return detail.length > DETAIL_PREVIEW_LENGTH || detail.includes('\n')
}

function isDetailExpanded(key: string): boolean {
  return expandedDetailMap.value[key] === true
}

function toggleDetail(key: string): void {
  expandedDetailMap.value[key] = !expandedDetailMap.value[key]
}

function getDetailPreview(detail: string | null): string {
  if (!detail) return ''
  if (!shouldCollapseDetail(detail)) return detail
  return `${detail.slice(0, DETAIL_PREVIEW_LENGTH).trimEnd()}...`
}

function statusColor(percent: number): string {
  if (percent < 60) return '#18a058'
  if (percent < 85) return '#f0a020'
  return '#d03050'
}

function healthStatusType(status: SystemHealthComponentStatus['status']): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'healthy') return 'success'
  if (status === 'degraded') return 'warning'
  if (status === 'unhealthy') return 'danger'
  return 'info'
}

function healthStatusLabel(status: SystemHealthComponentStatus['status']): string {
  if (status === 'healthy') return '正常'
  if (status === 'degraded') return '降级'
  if (status === 'unhealthy') return '异常'
  return '未知'
}

function dependencyDescription(component: SystemHealthComponentStatus): string {
  if (component.status === 'healthy') return component.detail || '最近一次检查通过'
  if (component.status === 'degraded') return component.detail || '最近一次检查已降级'
  if (component.status === 'unhealthy') return component.detail || '最近一次检查失败'
  return component.detail || '当前暂无更多信息'
}

async function loadSystemStatus(options: { silent?: boolean } = {}) {
  if (refreshing.value) {
    return
  }

  const startAt = window.performance.now()
  refreshing.value = true

  try {
    const res = await getSystemStatus()
    sys.value = res.data ?? createDefaultSystemStatus()
    requestDurationMs.value = Math.round(window.performance.now() - startAt)
    lastRefreshAt.value = new Date()
    errorMessage.value = ''
  } catch (error: any) {
    errorMessage.value = error?.message || '系统状态加载失败'
    if (!options.silent) {
      ElMessage.error(errorMessage.value)
    }
  } finally {
    refreshing.value = false
    loading.value = false
  }
}

function stopTimer() {
  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

function startTimer() {
  stopTimer()
  if (!autoRefresh.value || pageHidden.value) return
  refreshTimer = window.setInterval(() => {
    void loadSystemStatus({ silent: true })
  }, samplingSeconds.value * 1000)
}

function handleVisibilityChange() {
  pageHidden.value = document.hidden
  if (pageHidden.value) {
    stopTimer()
    return
  }
  void loadSystemStatus({ silent: true })
  startTimer()
}

async function refreshNow() {
  await loadSystemStatus()
}

watch(samplingSeconds, (value) => {
  const normalized = Math.min(10, Math.max(2, value))
  if (normalized !== value) {
    samplingSeconds.value = normalized
    return
  }
  startTimer()
})

watch(autoRefresh, () => {
  startTimer()
})

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  await loadSystemStatus({ silent: true })
  startTimer()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  stopTimer()
})
</script>

<template>
  <div class="page">
    <PageHeader
      title="系统状态"
      :icon="Monitor"
    >
      <template #extra>
        <div class="header-actions">
          <label class="header-action-item">
            <span>自动刷新</span>
            <el-switch v-model="autoRefresh" />
          </label>
          <label class="header-action-item">
            <span>间隔</span>
            <el-input-number
              v-model="samplingSeconds"
              :min="2"
              :max="10"
              :step="1"
              size="small"
              :controls="true"
              style="width: 84px"
            />
            <span>秒</span>
          </label>
          <el-button
            type="primary"
            :loading="refreshing"
            @click="refreshNow"
          >
            <el-icon><RefreshRight /></el-icon>
            <span>立即刷新</span>
          </el-button>
        </div>
      </template>
    </PageHeader>

    <div class="content">
      <div class="alert-list">
        <el-alert
          v-if="errorMessage"
          title="刷新失败"
          :description="errorMessage"
          type="error"
          show-icon
          :closable="false"
        />
        <el-alert
          v-for="alert in alertItems"
          :key="alert.key"
          :title="alert.title"
          :description="alert.description"
          :type="alert.type"
          show-icon
          :closable="false"
        />
      </div>

      <el-skeleton
        :loading="loading"
        animated
      >
        <el-card
          class="summary-card"
          shadow="hover"
        >
          <div class="summary-layout">
            <div class="summary-main">
              <div class="summary-caption">
                系统总览
              </div>
              <div class="summary-status">
                <el-icon class="summary-status-icon">
                  <component :is="overallStatus.icon" />
                </el-icon>
                <div>
                  <div class="summary-status-title">
                    {{ overallStatus.label }}
                  </div>
                  <p class="summary-status-description">
                    {{ overallStatus.description }}
                  </p>
                </div>
              </div>
              <div class="summary-tags">
                <el-tag
                  type="info"
                  plain
                >
                  机器人 {{ sys.onlineRobots }} / {{ sys.totalRobots }}
                </el-tag>
                <el-tag
                  v-if="alertItems.length"
                  type="warning"
                  plain
                >
                  {{ alertItems.length }} 条待处理提醒
                </el-tag>
                <el-tag
                  v-else
                  type="success"
                  plain
                >
                  当前没有待处理告警
                </el-tag>
                <el-tag
                  v-if="sys.runtime.errorCount"
                  type="danger"
                  plain
                >
                  最近错误 {{ sys.runtime.errorCount }}
                </el-tag>
                <el-tag
                  v-if="sys.runtime.slowRequestCount"
                  type="warning"
                  plain
                >
                  慢请求 {{ sys.runtime.slowRequestCount }}
                </el-tag>
              </div>
            </div>

            <el-descriptions
              :column="2"
              border
              class="summary-details"
            >
              <el-descriptions-item label="最近刷新">
                {{ lastRefreshAt ? formatDateTime(lastRefreshAt) : '未刷新' }}
              </el-descriptions-item>
              <el-descriptions-item label="健康检查时间">
                {{ sys.health.checkedAt ? formatDateTime(sys.health.checkedAt) : '未记录' }}
              </el-descriptions-item>
              <el-descriptions-item label="请求耗时">
                {{ requestDurationMs === null ? '未记录' : `${requestDurationMs} ms` }}
              </el-descriptions-item>
              <el-descriptions-item label="自动刷新">
                {{ autoRefresh ? (pageHidden ? `已暂停 / 页面隐藏 / ${samplingSeconds} 秒` : `开启 / ${samplingSeconds} 秒`) : '已关闭' }}
              </el-descriptions-item>
              <el-descriptions-item label="状态时间">
                {{ sys.timestamp ? formatDateTime(sys.timestamp) : '未记录' }}
              </el-descriptions-item>
              <el-descriptions-item label="运行窗口">
                {{ runtimeWindowLabel }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>

        <el-row
          :gutter="16"
          class="metric-row"
        >
          <el-col
            :xs="24"
            :sm="12"
            :lg="8"
            :xl="4"
          >
            <el-card
              class="metric-card"
              shadow="hover"
            >
              <template #header>
                <span class="card-header">
                  <el-icon><Cpu /></el-icon>
                  <span>CPU</span>
                </span>
              </template>
              <div class="system-metric">
                <el-progress
                  type="circle"
                  :percentage="Number(sys.cpuPercent.toFixed(1))"
                  :color="statusColor(sys.cpuPercent)"
                />
                <p class="system-metric-text">
                  {{ formatPercent(sys.cpuPercent) }}
                </p>
                <p class="metric-hint">
                  告警阈值：{{ CPU_ALERT_THRESHOLD }}%
                </p>
              </div>
            </el-card>
          </el-col>

          <el-col
            :xs="24"
            :sm="12"
            :lg="8"
            :xl="4"
          >
            <el-card
              class="metric-card"
              shadow="hover"
            >
              <template #header>
                <span class="card-header">
                  <el-icon><Collection /></el-icon>
                  <span>内存</span>
                </span>
              </template>
              <div class="system-metric">
                <el-progress
                  type="circle"
                  :percentage="Number(sys.memoryPercent.toFixed(1))"
                  :color="statusColor(sys.memoryPercent)"
                />
                <p class="system-metric-text">
                  {{ formatNumber(sys.memoryUsedGb) }} / {{ formatNumber(sys.memoryTotalGb) }} GB
                </p>
                <p class="metric-hint">
                  告警阈值：{{ MEMORY_ALERT_THRESHOLD }}%
                </p>
              </div>
            </el-card>
          </el-col>

          <el-col
            :xs="24"
            :sm="12"
            :lg="8"
            :xl="4"
          >
            <el-card
              class="metric-card"
              shadow="hover"
            >
              <template #header>
                <span class="card-header">
                  <el-icon><Monitor /></el-icon>
                  <span>磁盘</span>
                </span>
              </template>
              <div class="system-metric">
                <el-progress
                  type="circle"
                  :percentage="Number(sys.diskPercent.toFixed(1))"
                  :color="statusColor(sys.diskPercent)"
                />
                <p class="system-metric-text">
                  {{ formatNumber(sys.diskUsedGb) }} / {{ formatNumber(sys.diskTotalGb) }} GB
                </p>
                <p class="metric-hint">
                  告警阈值：{{ DISK_ALERT_THRESHOLD }}%
                </p>
              </div>
            </el-card>
          </el-col>

          <el-col
            :xs="24"
            :sm="12"
            :lg="8"
            :xl="4"
          >
            <el-card
              class="metric-card"
              shadow="hover"
            >
              <template #header>
                <span class="card-header">
                  <el-icon><Connection /></el-icon>
                  <span>机器人</span>
                </span>
              </template>
              <div class="uptime-metric">
                <el-icon class="robot-metric-icon">
                  <Bot />
                </el-icon>
                <div class="uptime-value">
                  {{ sys.onlineRobots }} / {{ sys.totalRobots }}
                </div>
                <p class="metric-hint">
                  当前在线 / 已注册机器人数量
                </p>
              </div>
            </el-card>
          </el-col>

          <el-col
            :xs="24"
            :sm="12"
            :lg="8"
            :xl="4"
          >
            <el-card
              class="metric-card"
              shadow="hover"
            >
              <template #header>
                <span class="card-header">
                  <el-icon><Timer /></el-icon>
                  <span>运行时间</span>
                </span>
              </template>
              <div class="uptime-metric">
                <div class="uptime-value">
                  {{ formatUptime(sys.uptimeSeconds) }}
                </div>
                <p class="metric-hint">
                  宿主机启动后已连续运行
                </p>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="section-header">
          <span>依赖服务状态</span>
          <span class="section-header-subtitle">按当前项目真实依赖自动生成</span>
        </div>
        <el-row
          :gutter="16"
          class="service-row"
        >
          <el-col
            v-for="dependency in dependencies"
            :key="dependency.key"
            :xs="24"
            :md="8"
          >
            <el-card
              class="service-card"
              shadow="hover"
            >
              <div class="service-card-header">
                <div>
                  <div class="service-card-title">
                    {{ dependency.label }}
                  </div>
                  <div class="service-card-description">
                    {{ dependencyDescription(dependency) }}
                  </div>
                </div>
                <el-tag
                  :type="healthStatusType(dependency.status)"
                  effect="dark"
                >
                  {{ healthStatusLabel(dependency.status) }}
                </el-tag>
              </div>
              <div class="service-card-meta">
                检查时间：{{ sys.health.checkedAt ? formatDateTime(sys.health.checkedAt) : '未记录' }}
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="section-header">
          <span>运行摘要</span>
          <span class="section-header-subtitle">{{ runtimeWindowLabel }}</span>
        </div>
        <el-row
          :gutter="16"
          class="runtime-row"
        >
          <el-col
            :xs="24"
            :xl="12"
          >
            <el-card
              class="runtime-card"
              shadow="hover"
            >
              <div class="runtime-card-header">
                <div>
                  <div class="service-card-title">
                    最近错误
                  </div>
                  <div class="service-card-description">
                    展示最近出现的 5xx 错误，便于快速定位异常接口。
                  </div>
                </div>
                <el-tag
                  type="danger"
                  effect="dark"
                >
                  {{ sys.runtime.errorCount }} 条
                </el-tag>
              </div>

              <div class="aggregate-panel">
                <div class="aggregate-title">
                  错误接口 Top{{ sys.runtime.topErrorRoutes.length || 0 }}
                </div>
                <div
                  v-if="sys.runtime.topErrorRoutes.length"
                  class="aggregate-list"
                >
                  <div
                    v-for="item in sys.runtime.topErrorRoutes"
                    :key="`error-top-${item.method}-${item.path}`"
                    class="aggregate-item is-error"
                  >
                    <div class="aggregate-main">
                      <div class="event-title">
                        <el-tag
                          size="small"
                          effect="plain"
                        >
                          {{ item.method }}
                        </el-tag>
                        <span class="event-path">{{ item.path }}</span>
                      </div>
                      <el-tag
                        type="danger"
                        size="small"
                      >
                        {{ item.count }} 次
                      </el-tag>
                    </div>
                    <div class="event-meta">
                      <span>{{ formatAggregateSubtitle(item) }}</span>
                      <span>最近状态 {{ item.lastStatusCode }}</span>
                      <span>{{ formatDateTime(item.lastHappenedAt) }}</span>
                    </div>
                    <div
                      v-if="item.detail"
                      class="detail-block"
                    >
                      <div class="event-detail">
                        {{ isDetailExpanded(buildAggregateDetailKey('error-top', item)) ? item.detail : getDetailPreview(item.detail) }}
                      </div>
                      <el-button
                        v-if="shouldCollapseDetail(item.detail)"
                        link
                        type="primary"
                        size="small"
                        class="detail-toggle"
                        @click="toggleDetail(buildAggregateDetailKey('error-top', item))"
                      >
                        {{ isDetailExpanded(buildAggregateDetailKey('error-top', item)) ? '收起详情' : '展开详情' }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <el-empty
                  v-else
                  description="最近没有异常接口聚合"
                  :image-size="56"
                />
              </div>

              <div v-if="sys.runtime.recentErrors.length">
                <div class="aggregate-title">
                  最近明细
                </div>
                <div class="event-list">
                  <div
                    v-for="item in sys.runtime.recentErrors"
                    :key="`${item.happenedAt}-${item.path}-${item.statusCode}`"
                    class="event-item is-error"
                  >
                    <div class="event-top">
                      <div class="event-title">
                        <el-tag
                          size="small"
                          effect="plain"
                        >
                          {{ item.method }}
                        </el-tag>
                        <span class="event-path">{{ item.path }}</span>
                      </div>
                      <el-tag
                        type="danger"
                        size="small"
                      >
                        {{ item.statusCode }}
                      </el-tag>
                    </div>
                    <div class="event-meta">
                      <span>{{ formatDuration(item.durationMs) }}</span>
                      <span>{{ formatDateTime(item.happenedAt) }}</span>
                    </div>
                    <div
                      v-if="item.detail"
                      class="detail-block"
                    >
                      <div class="event-detail">
                        {{ isDetailExpanded(buildEventDetailKey('error-detail', item)) ? item.detail : getDetailPreview(item.detail) }}
                      </div>
                      <el-button
                        v-if="shouldCollapseDetail(item.detail)"
                        link
                        type="primary"
                        size="small"
                        class="detail-toggle"
                        @click="toggleDetail(buildEventDetailKey('error-detail', item))"
                      >
                        {{ isDetailExpanded(buildEventDetailKey('error-detail', item)) ? '收起详情' : '展开详情' }}
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                description="最近没有 5xx 错误"
                :image-size="72"
              />
            </el-card>
          </el-col>
          <el-col
            :xs="24"
            :xl="12"
          >
            <el-card
              class="runtime-card"
              shadow="hover"
            >
              <div class="runtime-card-header">
                <div>
                  <div class="service-card-title">
                    慢请求摘要
                  </div>
                  <div class="service-card-description">
                    阈值 {{ formatDuration(sys.runtime.slowRequestThresholdMs) }}，用于观察接口抖动或性能退化。
                  </div>
                </div>
                <el-tag
                  type="warning"
                  effect="dark"
                >
                  {{ sys.runtime.slowRequestCount }} 条
                </el-tag>
              </div>

              <div class="aggregate-panel">
                <div class="aggregate-title">
                  慢请求接口 Top{{ sys.runtime.topSlowRoutes.length || 0 }}
                </div>
                <div
                  v-if="sys.runtime.topSlowRoutes.length"
                  class="aggregate-list"
                >
                  <div
                    v-for="item in sys.runtime.topSlowRoutes"
                    :key="`slow-top-${item.method}-${item.path}`"
                    class="aggregate-item is-warning"
                  >
                    <div class="aggregate-main">
                      <div class="event-title">
                        <el-tag
                          size="small"
                          effect="plain"
                        >
                          {{ item.method }}
                        </el-tag>
                        <span class="event-path">{{ item.path }}</span>
                      </div>
                      <el-tag
                        type="warning"
                        size="small"
                      >
                        {{ item.count }} 次
                      </el-tag>
                    </div>
                    <div class="event-meta">
                      <span>{{ formatAggregateSubtitle(item) }}</span>
                      <span>最近状态 {{ item.lastStatusCode }}</span>
                      <span>{{ formatDateTime(item.lastHappenedAt) }}</span>
                    </div>
                    <div
                      v-if="item.detail"
                      class="detail-block"
                    >
                      <div class="event-detail">
                        {{ isDetailExpanded(buildAggregateDetailKey('slow-top', item)) ? item.detail : getDetailPreview(item.detail) }}
                      </div>
                      <el-button
                        v-if="shouldCollapseDetail(item.detail)"
                        link
                        type="primary"
                        size="small"
                        class="detail-toggle"
                        @click="toggleDetail(buildAggregateDetailKey('slow-top', item))"
                      >
                        {{ isDetailExpanded(buildAggregateDetailKey('slow-top', item)) ? '收起详情' : '展开详情' }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <el-empty
                  v-else
                  description="最近没有慢请求聚合"
                  :image-size="56"
                />
              </div>

              <div v-if="sys.runtime.recentSlowRequests.length">
                <div class="aggregate-title">
                  最近明细
                </div>
                <div class="event-list">
                  <div
                    v-for="item in sys.runtime.recentSlowRequests"
                    :key="`${item.happenedAt}-${item.path}-${item.durationMs}`"
                    class="event-item is-warning"
                  >
                    <div class="event-top">
                      <div class="event-title">
                        <el-tag
                          size="small"
                          effect="plain"
                        >
                          {{ item.method }}
                        </el-tag>
                        <span class="event-path">{{ item.path }}</span>
                      </div>
                      <el-tag
                        :type="item.statusCode >= 500 ? 'danger' : 'warning'"
                        size="small"
                      >
                        {{ item.statusCode }}
                      </el-tag>
                    </div>
                    <div class="event-meta">
                      <span>{{ formatDuration(item.durationMs) }}</span>
                      <span>{{ formatDateTime(item.happenedAt) }}</span>
                    </div>
                    <div
                      v-if="item.detail"
                      class="detail-block"
                    >
                      <div class="event-detail">
                        {{ isDetailExpanded(buildEventDetailKey('slow-detail', item)) ? item.detail : getDetailPreview(item.detail) }}
                      </div>
                      <el-button
                        v-if="shouldCollapseDetail(item.detail)"
                        link
                        type="primary"
                        size="small"
                        class="detail-toggle"
                        @click="toggleDetail(buildEventDetailKey('slow-detail', item))"
                      >
                        {{ isDetailExpanded(buildEventDetailKey('slow-detail', item)) ? '收起详情' : '展开详情' }}
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                description="最近没有慢请求"
                :image-size="72"
              />
            </el-card>
          </el-col>
        </el-row>
      </el-skeleton>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
  overflow: auto;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.header-action-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-card {
  overflow: hidden;
}

.summary-card :deep(.el-card__body) {
  background:
    radial-gradient(circle at top right, rgba(64, 158, 255, 0.08), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98));
}

.summary-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1.2fr) minmax(320px, 1fr);
  gap: 20px;
  align-items: center;
}

.summary-main {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-caption {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-status {
  display: flex;
  align-items: center;
  gap: 14px;
}

.summary-status-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  background: linear-gradient(135deg, #409eff, #337ecc);
  box-shadow: 0 12px 28px rgba(64, 158, 255, 0.22);
}

.summary-status-title {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
}

.summary-status-description {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-details {
  align-self: stretch;
}

.metric-row,
.service-row,
.runtime-row {
  row-gap: 16px;
}

.metric-card,
.service-card,
.runtime-card {
  height: 100%;
}

.card-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.system-metric,
.uptime-metric {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.system-metric-text {
  margin: 12px 0 6px;
  font-size: 16px;
  font-weight: 600;
}

.metric-hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.robot-metric-icon {
  margin-bottom: 10px;
  font-size: 34px;
  color: var(--el-color-primary);
}

.uptime-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 10px;
}

.section-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
}

.section-header-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 400;
}

.service-card-header,
.runtime-card-header,
.aggregate-main,
.event-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.runtime-card-header {
  margin-bottom: 18px;
}

.service-card-title {
  font-size: 18px;
  font-weight: 600;
}

.service-card-description {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.service-card-meta {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.aggregate-panel {
  margin-bottom: 18px;
}

.aggregate-title {
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.aggregate-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.aggregate-item,
.event-item {
  border-radius: 14px;
  border: 1px solid var(--el-border-color-light);
}

.aggregate-item {
  padding: 12px 14px;
}

.event-item {
  padding: 14px 16px;
  background-color: rgba(248, 250, 252, 0.92);
}

.aggregate-item.is-error,
.event-item.is-error {
  background-color: rgba(254, 242, 242, 0.92);
  border-color: rgba(239, 68, 68, 0.18);
}

.aggregate-item.is-warning,
.event-item.is-warning {
  background-color: rgba(255, 251, 235, 0.92);
  border-color: rgba(245, 158, 11, 0.18);
}

.event-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.event-path {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 13px;
  word-break: break-all;
}

.event-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-block {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.event-detail {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-toggle {
  padding: 0;
  min-height: auto;
}

@media (max-width: 1100px) {
  .summary-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page {
    padding: 16px;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .summary-status-title {
    font-size: 24px;
  }

  .summary-status {
    align-items: flex-start;
  }

  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .system-metric,
  .uptime-metric {
    min-height: 200px;
  }
}
</style>
