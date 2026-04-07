<template>
  <div class="robot-operation">
    <!-- Top Toolbar -->
    <div
      v-if="!props.embedded"
      class="top-bar"
    >
      <div class="left-tools">
        <el-button
          link
          @click="goBack"
        >
          <el-icon :size="20">
            <Back />
          </el-icon>
        </el-button>

        <el-divider direction="vertical" />

        <el-switch
          v-model="controlMode"
          active-text="姿态"
          inactive-text="移动"
          active-value="pose"
          inactive-value="move"
          inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #409eff"
        />

        <el-divider direction="vertical" />

        <el-switch
          v-model="sdkMode"
          active-text="SDK"
          inactive-text="遥控"
          inline-prompt
          :loading="sdkModeLoading"
          @change="handleSdkModeChange"
        />

        <el-divider direction="vertical" />

        <el-select
          v-model="selectedUuid"
          placeholder="选择机器人"
          style="width: 160px"
          size="small"
          filterable
        >
          <el-option
            v-for="r in robots"
            :key="r.uuid"
            :label="r.name || r.uuid"
            :value="r.uuid"
          />
        </el-select>

        <el-divider direction="vertical" />

        <el-popover
          placement="bottom"
          :width="200"
          trigger="click"
        >
          <template #reference>
            <el-button
              size="small"
              text
            >
              速度: {{ speed }}
            </el-button>
          </template>
          <div style="display: flex; align-items: center; gap: 10px; padding: 0 10px;">
            <span style="white-space: nowrap;">速度</span>
            <el-slider
              v-model="speed"
              :min="1"
              :max="30"
              size="small"
            />
          </div>
        </el-popover>

        <el-divider direction="vertical" />

        <el-switch
          v-model="showVideo"
          active-text="视频"
          inline-prompt
        />

        <el-divider direction="vertical" />

        <el-button
          size="small"
          :loading="isCapturing"
          :icon="Camera"
          @click="handleCapturePhoto"
        >
          拍照
        </el-button>

        <el-divider direction="vertical" />

        <el-button
          type="danger"
          size="small"
          class="estop-btn"
          :icon="SwitchButton"
          @click="emergencyStop"
        >
          急停
        </el-button>

        <el-divider direction="vertical" />

        <!-- 机器狗麦克风开关 -->
        <el-tooltip :content="micEnabled ? '关闭机器狗麦克风' : '开启机器狗麦克风'">
          <el-button
            size="small"
            :icon="micEnabled ? Mic : MicOff"
            :type="micEnabled ? '' : 'danger'"
            circle
            @click="toggleMic"
          />
        </el-tooltip>
      </div>

      <div class="right-info">
        <div class="info-item">
          <el-icon><Bot /></el-icon>
          <span>{{ robotBattery !== undefined ? robotBattery + '%' : '--' }}</span>
        </div>
        <div
          v-if="phoneBattery !== null"
          class="info-item"
        >
          <el-icon><Cellphone /></el-icon>
          <span>{{ phoneBattery !== null ? phoneBattery + '%' : '--' }}</span>
        </div>
        <div class="info-item time-display">
          <span>{{ currentTime }}</span>
        </div>
        <div
          class="info-item"
          style="position: relative;"
        >
          <el-button
            circle
            :icon="Setting"
            @click="openSettings"
          />
          <div
            v-if="hasUpdate"
            class="setting-dot"
          />
        </div>
      </div>
    </div>



    <!-- Middle Video Area -->
    <div class="video-area">
      <CloudFramePlayer
        v-if="activeCloudRobotId"
        :key="videoPlayerKey"
        :robot-id="activeCloudRobotId"
      />

      <div
        v-else
        class="video-placeholder"
      >
        <el-icon
          :size="60"
          color="#909399"
        >
          <VideoCamera />
        </el-icon>
        <p>{{ videoPlaceholderTitle }}</p>
        <p
          v-if="videoPlaceholderDetail"
          class="video-placeholder__detail"
        >
          {{ videoPlaceholderDetail }}
        </p>
        <el-button
          v-if="showVideo && selectedUuid"
          size="small"
          text
          @click="retryVideoSession"
        >
          重新请求视频
        </el-button>
      </div>

      <div
        v-if="showVideo && videoSession"
        class="video-badge"
      >
        {{ videoBadgeText }}
      </div>

      <!-- Floating Controls Layer -->
      <div
        ref="floatingLayerRef"
        class="floating-layer"
        :class="{ 'is-editing': layoutEditMode }"
      >
        <div
          class="floating-item"
          :style="getControlStyle('chatToggle')"
          @pointerdown="startDrag('chatToggle', $event)"
        >
          <el-button
            class="chat-toggle-btn"
            circle
            :icon="ChatLineSquare"
            @click="onChatClick"
          />
        </div>

        <div
          class="floating-item mic-toggle-btn"
          :style="getControlStyle('voiceRecord')"
          @pointerdown="startDrag('voiceRecord', $event)"
        >
          <VoiceRecordButton size="large" />
        </div>

        <div
          class="floating-item"
          :style="getControlStyle('leftJoystick')"
          @pointerdown="startDrag('leftJoystick', $event)"
        >
          <JoystickPad
            class="joystick-pad"
            :class="{ 'is-disabled': layoutEditMode || (controlMode === 'pose' && !twoLegStandActive) }"
            :strict-circle-hit="true"
            @change="onMoveJoystick"
            @end="onMoveJoystickEnd"
          />
        </div>

        <div
          v-for="btn in actionButtons"
          :key="btn.id"
          class="floating-item"
          :style="getControlStyle(btn.id)"
          @pointerdown="startDrag(btn.id, $event)"
        >
          <ActionButton
            :label="btn.label"
            :title="btn.title"
            :disabled="layoutEditMode"
            @click="sendAction(btn.action)"
          />
        </div>

        <div
          class="floating-item"
          :style="getControlStyle('rightJoystick')"
          @pointerdown="startDrag('rightJoystick', $event)"
        >
          <JoystickPad
            class="joystick-pad"
            :class="{ 'is-disabled': layoutEditMode || rightJoystickDisabled }"
            :strict-circle-hit="true"
            @change="onLookJoystick"
            @end="onLookJoystickEnd"
          />
        </div>
      </div>
    </div>

    <el-drawer
      v-model="showChatPanel"
      direction="rtl"
      size="50%"
      :with-header="false"
      :append-to-body="false"
      class="robot-agent-drawer"
    >
      <div class="chat-drawer">
        <div class="chat-drawer__header">
          <el-button
            link
            @click="closeChatPanel"
          >
            <el-icon :size="20">
              <Back />
            </el-icon>
          </el-button>
          <div class="chat-drawer__title">
            对话
          </div>
          <div class="chat-drawer__spacer" />
        </div>
        <div class="chat-drawer__body">
          <ChatView :robot-uuid="selectedUuid" />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import ChatView from '@/features/conversation/views/ChatView.vue'
import ActionButton from '@/features/robot/components/ActionButton.vue'
import CloudFramePlayer from '@/features/robot/components/CloudFramePlayer.vue'
import { useRobotOperationJoystick } from '@/features/robot/composables/useRobotOperationJoystick'
import {
  defaultRobotOperationControlLayout,
  useRobotOperationLayout,
} from '@/features/robot/composables/useRobotOperationLayout'
import JoystickPad from '@/share/components/JoystickPad.vue'
import VoiceRecordButton from '@/share/components/VoiceRecordButton.vue'
import { useWebSocket } from '@/share/websocket/useWebSocket'
import {
  Back,
  Camera,
  Cellphone,
  ChatLineSquare,
  Setting,
  SwitchButton,
  VideoCamera
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Bot, Mic, MicOff } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { capturePhoto, createRobotVideoSession } from '../api'
import type { RobotVideoSession } from '../types'
import { useRobotStore } from '../store'

const props = defineProps<{ embedded?: boolean; robotUuid?: string }>()
const router = useRouter()
const robotStore = useRobotStore()
const { robots } = storeToRefs(robotStore)

// WebSocket & Robot State
const {
  isConnected,
  robotId,
  connect: wsConnect,
  disconnect: wsDisconnect,
  sendMessage: wsSendMessage,
  onMessage,
} = useWebSocket()

// UI State
const selectedUuid = ref('')
const showVideo = ref(true)
const robotBattery = ref<number | undefined>(undefined) // Mock value
const phoneBattery = ref<number | null>(null) // Mock value, null to hide
const currentTime = ref('')
const hasUpdate = ref(true)
const showChatPanel = ref(false)
const floatingLayerRef = ref<HTMLDivElement | null>(null)
const micEnabled = ref(true)
const isCapturing = ref(false)
const videoLoading = ref(false)
const videoSession = ref<RobotVideoSession | null>(null)
const videoError = ref('')
const videoPlayerVersion = ref(0)
const sdkMode = ref(true) // SDK模式开关，默认开启
const sdkModeLoading = ref(false) // SDK模式切换加载状态
/** 切换前的开关状态，切换失败时回滚用 */
const sdkModePrevValue = ref(true)
/** 超时保护计时器，避免开关永久卡住 */
let sdkModeSwitchTimeout: ReturnType<typeof setTimeout> | null = null
let videoRequestToken = 0

const {
  layoutEditMode,
  getControlStyle,
  startDrag,
  startLayoutEdit,
  cancelLayoutEdit,
  saveLayout,
  loadLayout,
  setLayoutEditMode,
} = useRobotOperationLayout(defaultRobotOperationControlLayout, floatingLayerRef)

const {
  controlMode,
  speed,
  twoLegStandActive,
  rightJoystickDisabled,
  onMoveJoystick,
  onLookJoystick,
  onMoveJoystickEnd,
  onLookJoystickEnd,
} = useRobotOperationJoystick({
  isConnected,
  robotId,
  layoutEditMode,
  sendMessage: wsSendMessage,
})

const actionButtons = [
  { id: 'action_stand_up', action: 'stand_up', label: '起立', title: '起立' },
  { id: 'action_sit_down', action: 'sit_down', label: '趴下', title: '趴下' },
  { id: 'action_front_jump', action: 'front_jump', label: '向前跳', title: '向前跳' },
  { id: 'action_jump', action: 'jump', label: '向上跳', title: '向上跳' },
  { id: 'action_back_flip', action: 'back_flip', label: '后空翻', title: '后空翻' },
  { id: 'action_two_leg_stand', action: 'two_leg_stand', label: '双腿站立', title: '双腿站立' },
  { id: 'action_shake_hand', action: 'shake_hand', label: '打招呼', title: '打招呼' },
]

// Timer for clock
let timeInterval: any = null

const activeCloudRobotId = computed(() => {
  if (!showVideo.value || !videoSession.value?.available) return ''
  if (videoSession.value.preferredProtocol !== 'frame') return ''
  return selectedUuid.value || ''
})

const videoPlayerKey = computed(() => `${selectedUuid.value}-${videoPlayerVersion.value}`)

const videoPlaceholderTitle = computed(() => {
  if (!showVideo.value) return '视频已关闭'
  if (!selectedUuid.value) return '请先选择机器人'
  if (videoLoading.value) return '正在请求视频会话...'
  if (videoError.value) return '获取视频会话失败'
  if (!videoSession.value) return '等待视频会话...'
  if (!videoSession.value.available) return '当前暂无可用视频'
  if (!activeCloudRobotId.value) return '当前视频会话暂未提供可播放的视频地址'
  return '等待视频信号...'
})

const videoPlaceholderDetail = computed(() => {
  if (videoError.value) return videoError.value
  if (videoSession.value?.message) return videoSession.value.message
  return ''
})

const videoBadgeText = computed(() => {
  if (!videoSession.value) return ''
  if (videoSession.value.mode === 'cloud') {
    return '云端 JPEG 帧流'
  }
  return '无可用视频'
})

// Functions
const goBack = () => {
  router.back()
}

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const emergencyStop = () => {
  if (!isConnected.value) {
    ElMessage.warning('连接未建立')
    return
  }
  ElMessage.error('触发急停！')
  wsSendMessage({
    type: 'control_input',
    robotId: robotId.value,
    timestamp: Date.now(),
    data: { command: 'estop' },
  })
}

const openChatPanel = () => {
  showChatPanel.value = true
}

const closeChatPanel = () => {
  showChatPanel.value = false
}

const onChatClick = () => {
  if (layoutEditMode.value) return
  openChatPanel()
}

const toggleMic = () => {
  if (layoutEditMode.value) return
  if (!isConnected.value) {
    ElMessage.warning('未连接机器人')
    return
  }
  micEnabled.value = !micEnabled.value
  wsSendMessage({
    type: 'audio_control',
    robotId: robotId.value,
    timestamp: Date.now(),
    data: { enabled: micEnabled.value },
  })
}

const sendAction = (action: string) => {
  if (layoutEditMode.value) return
  if (!isConnected.value) {
    ElMessage.warning('未连接机器人')
    return
  }
  if (action === 'two_leg_stand') {
    const nextAction = twoLegStandActive.value ? 'cancel_two_leg_stand' : 'two_leg_stand'
    twoLegStandActive.value = !twoLegStandActive.value
    ElMessage.success(twoLegStandActive.value ? '进入双腿站立' : '退出双腿站立')
    wsSendMessage({
      type: 'action_input',
      robotId: robotId.value,
      timestamp: Date.now(),
      data: { action: nextAction },
    })
    return
  }
  ElMessage.success(`发送动作: ${action}`)
  wsSendMessage({
    type: 'action_input',
    robotId: robotId.value,
    timestamp: Date.now(),
    data: { action },
  })
}

const handleCapturePhoto = async () => {
  if (!selectedUuid.value) {
    ElMessage.warning('请先选择机器人')
    return
  }

  isCapturing.value = true
  try {
    ElMessage.info('正在拍照，请稍候...')
    const res = await capturePhoto(selectedUuid.value)

    if (res.success && res.data.image) {
      // 下载图片
      const link = document.createElement('a')
      link.href = `data:image/${res.data.format || 'jpeg'};base64,${res.data.image}`
      link.download = `robot-photo-${Date.now()}.${res.data.format || 'jpg'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      ElMessage.success('拍照成功，已开始下载')
    } else {
      ElMessage.error('拍照失败')
    }
  } catch (error: any) {
    console.error('拍照错误:', error)
    ElMessage.error(error.message || '拍照失败')
  } finally {
    isCapturing.value = false
  }
}

// 处理SDK模式切换
const handleSdkModeChange = (value: boolean) => {
  if (!selectedUuid.value) {
    ElMessage.warning('请先选择机器人')
    sdkMode.value = !value // 恢复原值
    return
  }

  if (!isConnected.value) {
    ElMessage.warning('未连接机器人')
    sdkMode.value = !value // 恢复原值
    return
  }

  // 保存切换前的值，备失败时回滚
  sdkModePrevValue.value = !value

  sdkModeLoading.value = true

  // 发送SDK模式切换消息到服务端
  wsSendMessage({
    type: 'sdk_mode_set',
    robotId: selectedUuid.value,
    timestamp: Date.now(),
    data: { sdkMode: value },
  })

  // 30 秒超时保护，避免开关永久卡住
  if (sdkModeSwitchTimeout !== null) clearTimeout(sdkModeSwitchTimeout)
  sdkModeSwitchTimeout = setTimeout(() => {
    if (sdkModeLoading.value) {
      sdkModeLoading.value = false
      sdkMode.value = sdkModePrevValue.value // 回滚
      ElMessage.error('SDK模式切换超时，请重试')
    }
  }, 30000)
}

const openSettings = () => {
  if (!selectedUuid.value) {
    ElMessage.warning('请先选择机器人')
    return
  }
  router.push({ path: '/operation/edit', query: { robotUuid: selectedUuid.value, tab: 'basic' } })
}

const clearVideoSession = () => {
  videoRequestToken += 1
  videoLoading.value = false
  videoSession.value = null
  videoError.value = ''
  videoPlayerVersion.value += 1
}

const loadVideoSession = async (uuid: string) => {
  const requestToken = ++videoRequestToken
  videoLoading.value = true
  videoSession.value = null
  videoError.value = ''

  try {
    const res = await createRobotVideoSession(uuid)
    if (requestToken !== videoRequestToken) return
    videoSession.value = res.data
    videoPlayerVersion.value += 1
  } catch (error: any) {
    if (requestToken !== videoRequestToken) return
    videoError.value = error?.message || '请求视频会话失败'
  } finally {
    if (requestToken === videoRequestToken) {
      videoLoading.value = false
    }
  }
}

const retryVideoSession = () => {
  if (!showVideo.value || !selectedUuid.value) return
  void loadVideoSession(selectedUuid.value)
}


// Fetch robots
const fetchRobots = async () => {
  try {
    if (robots.value.length === 0) {
      await robotStore.fetchRobots()
    }
    if (robots.value.length > 0 && !selectedUuid.value && !props.robotUuid) {
      selectedUuid.value = robots.value[0].uuid
    }
  } catch (error) {
    console.error('加载机器人列表失败:', error)
  }
}

const isRobotOnline = (uuid: string): boolean => {
  const robot = robots.value.find((item) => item.uuid === uuid)
  return robot?.status === 'online'
}

// WebSocket Message Handling
const removeMessageHandler = onMessage((data) => {
  if (data.type === 'battery_status') {
    robotBattery.value = data.data.level
  } else if (data.type === 'status_update') {
    const level = typeof data.data?.battery === 'number' ? data.data.battery : Number(data.data?.battery)
    if (!Number.isNaN(level)) {
      robotBattery.value = Math.round(level)
    }
  } else if (data.type === 'sdk_mode_response') {
    // 处理SDK模式响应
    if (sdkModeSwitchTimeout !== null) {
      clearTimeout(sdkModeSwitchTimeout)
      sdkModeSwitchTimeout = null
    }
    sdkModeLoading.value = false
    if (data.data?.success) {
      sdkMode.value = data.data.sdkMode ?? sdkMode.value
      ElMessage.success(sdkMode.value ? 'SDK模式已开启' : '遥控模式已开启')
    } else {
      ElMessage.error(data.data?.error || 'SDK模式切换失败')
      sdkMode.value = sdkModePrevValue.value // 回滚到切换前的值
    }
  } else if (data.type === 'error') {
    const msg = data.data?.message || '发生错误'
    if (data.data?.code === 'NO_ROBOT_IP') {
      ElMessage.warning(msg)
    } else {
      ElMessage.error(msg)
    }
  }
})

watch(selectedUuid, async (val) => {
  if (val) {
    twoLegStandActive.value = false
    if (isConnected.value) {
      wsDisconnect()
    }
    robotId.value = val
    try {
      await wsConnect()
      if (isRobotOnline(val)) {
        wsSendMessage({
          type: 'sdk_mode_get',
          robotId: val,
          timestamp: Date.now(),
          data: {},
        })
      }
    } catch {
      ElMessage.error('连接失败，请检查后端服务或网络')
    }
  }
})

watch([selectedUuid, showVideo], ([uuid, videoEnabled]) => {
  if (!uuid || !videoEnabled) {
    clearVideoSession()
    return
  }
  void loadVideoSession(uuid)
}, { immediate: true })

watch(
  () => props.robotUuid,
  (val) => {
    if (val && val !== selectedUuid.value) {
      selectedUuid.value = val
    }
  },
  { immediate: true }
)

// Lifecycle
onMounted(() => {
  updateTime()
  timeInterval = setInterval(updateTime, 1000)

  // Try to get phone battery if API available (Mock for now)
  if ('getBattery' in navigator) {
    (navigator as any).getBattery().then((battery: any) => {
      phoneBattery.value = Math.round(battery.level * 100)
    })
  }

  fetchRobots()
  loadLayout()
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
  removeMessageHandler()
  wsDisconnect()
})

defineExpose({
  startLayoutEdit,
  cancelLayoutEdit,
  saveLayout,
  setLayoutEditMode,
})
</script>

<style>
/* 全局禁止页面滚动 */
html, body, #app {
  overflow: hidden !important;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}
</style>

<style scoped>
.robot-operation {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  color: #fff;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #2c2c2c;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  height: 50px;
  z-index: 100;
  box-sizing: border-box;
  width: 100%;
  overflow: hidden;
}

.left-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.right-info {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
}

.video-area {
  flex: 1;
  min-height: 0;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  width: 100%;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 560px;
  padding: 24px;
  color: #909399;
  text-align: center;
}

.video-placeholder__detail {
  margin: 0;
  color: #c7d2e5;
  font-size: 13px;
  line-height: 1.5;
}

.video-placeholder__url {
  margin: 0;
  color: #6f809f;
  font-size: 11px;
  word-break: break-all;
}

.video-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 3;
  padding: 6px 10px;
  border: 1px solid rgba(143, 162, 199, 0.35);
  border-radius: 999px;
  background: rgba(7, 12, 22, 0.72);
  color: #dce7ff;
  font-size: 12px;
  letter-spacing: 0.02em;
}

.floating-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  box-sizing: border-box;
}

.floating-layer.is-editing {
  pointer-events: auto;
}

.floating-item {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.floating-layer.is-editing .floating-item {
  outline: 1px dashed rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  padding: 4px;
  cursor: move;
}

.chat-toggle-btn {
  width: 56px;
  height: 56px;
  font-size: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.mic-toggle-btn :deep(.voice-record-btn) {
  width: 56px;
  height: 56px;
  font-size: 24px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.joystick-pad {
  pointer-events: auto;
}

.joystick-pad.is-disabled {
  opacity: 0.7;
  pointer-events: none;
}

:deep(.el-overlay) {
  position: absolute !important;
  inset: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
}

:deep(.el-drawer) {
  position: absolute !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: auto !important;
  height: 100% !important;
  overflow: hidden !important;
}

:deep(.el-drawer .el-drawer__body) {
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden !important;
  display: flex;
  flex-direction: column;
}

.chat-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color);
}

.chat-drawer__header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}

.chat-drawer__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.chat-drawer__spacer {
  flex: 1;
}

.chat-drawer__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
