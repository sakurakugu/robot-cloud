<template>
  <div class="choreo-detail-page">
    <div
      v-if="loading"
      class="state-card state-card--loading"
    >
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>正在加载项目详情...</span>
    </div>

    <div
      v-else-if="!project"
      class="state-card"
    >
      <el-empty description="项目不存在或已被删除" />
    </div>

    <template v-else>
      <PageHeader
        title="编舞项目详情"
        @back="goBack"
      >
        <template #extra>
          <div class="header-actions">
            <el-button @click="goToPcEditor">
              前往电脑端编辑
            </el-button>
            <el-button
              type="primary"
              :loading="exporting"
              @click="exportProject"
            >
              导出工程
            </el-button>
          </div>
        </template>
      </PageHeader>

      <el-alert
        class="page-alert"
        title="云端侧当前仅保留项目管理与只读预览，复杂编舞编辑请在电脑端完成。"
        type="info"
        :closable="false"
      />

      <div class="overview-grid">
        <el-card shadow="never">
          <template #header>
            <div class="card-title">
              项目概览
            </div>
          </template>
          <div class="overview-panel">
            <div class="overview-main">
              <h2>{{ project.name }}</h2>
              <p>{{ project.description || '暂无项目描述' }}</p>
            </div>
            <div class="overview-stats">
              <div class="stat-item">
                <span class="stat-label">轨道数</span>
                <span class="stat-value">{{ tracks.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">机器人</span>
                <span class="stat-value">{{ projectRobots.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总时长</span>
                <span class="stat-value">{{ formatDuration(timelineDuration) }}</span>
              </div>
            </div>
            <div class="meta-list">
              <div class="meta-row">
                <span class="meta-label">创建时间</span>
                <span class="meta-value">{{ formatDate(project.created_at) }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">更新时间</span>
                <span class="meta-value">{{ formatDate(project.updated_at) }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">最后打开</span>
                <span class="meta-value">{{ project.last_opened ? formatDate(project.last_opened) : '暂无' }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">项目目录</span>
                <span class="meta-value meta-value--path">{{ project.folder_path }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="card-title">
              机器人列表
            </div>
          </template>
          <div
            v-if="projectRobots.length > 0"
            class="robot-list"
          >
            <div
              v-for="robot in projectRobots"
              :key="robot.uuid"
              class="robot-item"
            >
              <span
                class="robot-color"
                :style="{ background: robot.color || '#409eff' }"
              />
              <div class="robot-info">
                <strong>{{ robot.name }}</strong>
                <span>绑定机器人：{{ robot.robot_id }}</span>
              </div>
              <span class="robot-track">轨道 {{ robot.track_index }}</span>
            </div>
          </div>
          <el-empty
            v-else
            description="项目未配置机器人"
          />
        </el-card>
      </div>

      <div class="content-grid">
        <el-card
          shadow="never"
          class="timeline-card"
        >
          <template #header>
            <div class="card-title">
              时间轴只读预览
            </div>
          </template>
          <div
            v-if="tracks.length > 0"
            class="timeline-list"
          >
            <div
              v-for="track in tracks"
              :key="track.id"
              class="timeline-track"
            >
              <div class="timeline-track__head">
                <div class="timeline-track__title">
                  <strong>{{ track.name }}</strong>
                  <el-tag
                    size="small"
                    :type="track.type === 'audio' ? 'success' : 'primary'"
                  >
                    {{ track.type === 'audio' ? '音频轨道' : '动作轨道' }}
                  </el-tag>
                </div>
                <span class="timeline-track__meta">
                  {{ getTrackSummary(track) }}
                </span>
              </div>
              <div
                v-if="getTrackBlocks(track).length > 0"
                class="track-blocks"
              >
                <div
                  v-for="block in getTrackBlocks(track)"
                  :key="block.id"
                  class="track-block"
                >
                  <div class="track-block__title">
                    <span>{{ block.name }}</span>
                    <span>{{ formatDuration(block.startTime) }} - {{ formatDuration(block.startTime + block.duration) }}</span>
                  </div>
                  <div class="track-block__meta">
                    <span>时长 {{ formatDuration(block.duration) }}</span>
                    <span v-if="block.actionType">动作 {{ block.actionType }}</span>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                :image-size="56"
                description="该轨道暂无内容"
              />
            </div>
          </div>
          <el-empty
            v-else
            description="项目暂无时间轴数据"
          />
        </el-card>

        <el-card
          shadow="never"
          class="preview-card"
        >
          <template #header>
            <div class="card-title">
              3D 只读预览
            </div>
          </template>
          <RobotPreview
            :current-time="previewTime"
            :is-playing="previewPlaying"
            :tracks="previewTracks"
          />
          <div class="preview-controls">
            <el-slider
              v-model="previewTime"
              :min="0"
              :max="sliderMax"
              :step="0.1"
            />
            <div class="preview-controls__actions">
              <span>{{ formatDuration(previewTime) }} / {{ formatDuration(sliderMax) }}</span>
              <div class="preview-buttons">
                <el-button
                  size="small"
                  @click="togglePreview"
                >
                  {{ previewPlaying ? '暂停预览' : '播放预览' }}
                </el-button>
                <el-button
                  size="small"
                  @click="resetPreview"
                >
                  重置
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import PageHeader from '@/share/components/PageHeader.vue'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { choreoApi } from '../api'
import RobotPreview from '../components/RobotPreview.vue'
import type { ActionBlock, ChoreoProject, ChoreoRobot, TimelineTrack, Track } from '../types'

const route = useRoute()
const router = useRouter()
const projectUuid = String(route.params.uuid)

const loading = ref(false)
const exporting = ref(false)
const project = ref<ChoreoProject | null>(null)
const projectRobots = ref<ChoreoRobot[]>([])
const tracks = ref<TimelineTrack[]>([])
const previewTime = ref(0)
const previewPlaying = ref(false)
let previewTimer: number | null = null

const previewTracks = computed<Track[]>(() => tracks.value.map(track => ({
  id: track.id,
  name: track.name,
  type: track.type === 'audio' ? 'audio' : 'action',
  robotId: track.robotId,
  locked: Boolean(track.locked),
  visible: track.visible !== false,
  height: track.height || 64,
  blocks: track.blocks,
  audioUrl: track.audioUrl,
} as Track)))

const timelineDuration = computed(() => {
  return tracks.value.reduce((maxValue, track) => {
    const blocks = getTrackBlocks(track)
    const trackEnd = blocks.reduce((trackMax, block) => Math.max(trackMax, block.startTime + block.duration), 0)
    return Math.max(maxValue, trackEnd)
  }, 0)
})

const sliderMax = computed(() => Math.max(1, timelineDuration.value))

function getTrackBlocks(track: TimelineTrack): ActionBlock[] {
  if (track.blocks && track.blocks.length > 0) {
    return track.blocks
  }
  if (track.clips && track.clips.length > 0) {
    return track.clips.map(clip => ({
      id: clip.id,
      name: clip.action?.action || clip.audioFile || '片段',
      startTime: clip.startTime,
      duration: clip.duration,
      actionType: clip.action?.action,
    }))
  }
  return []
}

function getTrackSummary(track: TimelineTrack): string {
  if (track.type === 'audio') {
    return track.audioUrl ? '已关联音频' : '未关联音频'
  }
  const blocks = getTrackBlocks(track)
  const boundRobot = track.robotId || '未绑定机器人'
  return `${boundRobot} / ${blocks.length} 个片段`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, seconds)
  const minutes = Math.floor(total / 60)
  const remainSeconds = Math.floor(total % 60)
  const ms = Math.floor((total % 1) * 10)
  return `${String(minutes).padStart(2, '0')}:${String(remainSeconds).padStart(2, '0')}.${ms}`
}

function goBack(): void {
  router.push('/choreo')
}

function goToPcEditor(): void {
  ElMessage.info('请在电脑端工作站打开对应工程进行完整编舞编辑')
}

async function exportProject(): Promise<void> {
  if (!project.value) {
    return
  }

  exporting.value = true
  try {
    const blob = await choreoApi.exportProject(project.value.uuid)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.value.name}.hhzip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('工程导出成功')
  } catch (error) {
    console.error('导出工程失败:', error)
    ElMessage.error('导出工程失败')
  } finally {
    exporting.value = false
  }
}

function stopPreviewTimer(): void {
  if (previewTimer !== null) {
    window.clearInterval(previewTimer)
    previewTimer = null
  }
}

function resetPreview(): void {
  previewTime.value = 0
  previewPlaying.value = false
  stopPreviewTimer()
}

function togglePreview(): void {
  if (previewPlaying.value) {
    previewPlaying.value = false
    stopPreviewTimer()
    return
  }

  previewPlaying.value = true
  stopPreviewTimer()
  previewTimer = window.setInterval(() => {
    const nextValue = previewTime.value + 0.1
    if (nextValue >= sliderMax.value) {
      previewTime.value = sliderMax.value
      previewPlaying.value = false
      stopPreviewTimer()
      return
    }
    previewTime.value = nextValue
  }, 100)
}

async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [projectRes, robotsRes, timelineRes] = await Promise.all([
      choreoApi.getProject(projectUuid),
      choreoApi.getProjectRobots(projectUuid),
      choreoApi.getTimeline(projectUuid),
    ])

    if (projectRes.success) {
      project.value = projectRes.data
    }
    if (robotsRes.success) {
      projectRobots.value = robotsRes.data
    }
    if (timelineRes.success && timelineRes.data) {
      tracks.value = timelineRes.data.tracks || []
    }
  } catch (error) {
    console.error('加载编舞详情失败:', error)
    ElMessage.error('加载编舞详情失败')
  } finally {
    loading.value = false
  }
}

watch(sliderMax, (value) => {
  if (previewTime.value > value) {
    previewTime.value = value
  }
})

onMounted(() => {
  loadData()
})

onBeforeUnmount(() => {
  stopPreviewTimer()
})
</script>

<style scoped>
.choreo-detail-page {
  min-height: 100%;
  padding: 20px;
  background: var(--el-bg-color-page);
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
}

.state-card--loading {
  flex-direction: column;
  gap: 12px;
  color: var(--el-color-primary);
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.page-alert {
  margin-bottom: 20px;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(340px, 1fr);
  gap: 20px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.overview-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.overview-main h2 {
  margin: 0 0 8px;
  font-size: 24px;
}

.overview-main p {
  margin: 0;
  color: var(--el-text-color-secondary);
  line-height: 1.7;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--el-fill-color-light);
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meta-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
}

.meta-label {
  color: var(--el-text-color-secondary);
}

.meta-value {
  color: var(--el-text-color-primary);
}

.meta-value--path {
  word-break: break-all;
}

.robot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.robot-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--el-fill-color-light);
}

.robot-color {
  width: 10px;
  height: 40px;
  border-radius: 999px;
  flex-shrink: 0;
}

.robot-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.robot-info span {
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.robot-track {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.timeline-card,
.preview-card {
  min-height: 100%;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timeline-track {
  padding: 16px;
  border-radius: 16px;
  background: var(--el-fill-color-lighter);
}

.timeline-track__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.timeline-track__title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.timeline-track__meta {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.track-blocks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.track-block {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.track-block__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.track-block__meta {
  color: var(--el-text-color-secondary);
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.preview-controls {
  margin-top: 16px;
}

.preview-controls__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.preview-buttons {
  display: flex;
  gap: 8px;
}

@media (max-width: 1200px) {
  .overview-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .choreo-detail-page {
    padding: 16px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .overview-stats {
    grid-template-columns: 1fr;
  }

  .timeline-track__head,
  .track-block__title,
  .preview-controls__actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .robot-item {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .robot-track {
    margin-left: 0;
  }
}
</style>
