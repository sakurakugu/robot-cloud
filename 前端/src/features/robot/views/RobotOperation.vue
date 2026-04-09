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
      <WhepVideoPlayer
        v-if="activeWhepUrl"
        :key="videoPlayerKey"
        :whep-url="activeWhepUrl"
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

      <div
        v-if="selectedUuid"
        class="runtime-panel"
      >
        <div class="runtime-panel__header">
          <div>
            <div class="runtime-panel__title">
              导航运行时
            </div>
            <div class="runtime-panel__subtitle">
              建图、定位、导航、巡逻
            </div>
          </div>
          <el-tag
            size="small"
            :type="runtimeControlsDisabled ? 'warning' : 'success'"
          >
            {{ runtimeControlsDisabled ? '云端未连' : '云端已连' }}
          </el-tag>
        </div>

        <div class="runtime-panel__overview">
          <div
            v-for="item in runtimeOverviewItems"
            :key="item.label"
            class="runtime-chip"
          >
            <span class="runtime-chip__label">{{ item.label }}</span>
            <el-tag
              size="small"
              :type="item.type"
            >
              {{ item.value }}
            </el-tag>
          </div>
        </div>

        <div class="runtime-panel__section">
          <div class="runtime-panel__section-title">
            地图与定位
          </div>
          <div class="runtime-panel__details">
            <div
              v-for="item in runtimeMapDetails"
              :key="item.label"
              class="runtime-detail"
            >
              <span class="runtime-detail__label">{{ item.label }}</span>
              <span class="runtime-detail__value">{{ item.value }}</span>
            </div>
          </div>
          <div class="runtime-panel__form">
            <el-input
              v-model="mapNameInput"
              size="small"
              placeholder="地图名称"
            />
            <div class="runtime-panel__actions">
              <el-button
                size="small"
                type="primary"
                :disabled="runtimeControlsDisabled"
                @click="handleStartMapping"
              >
                开始建图
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleStopMapping"
              >
                停止并保存
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleLoadMap"
              >
                加载地图
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleStartLocalization"
              >
                开始定位
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleStopLocalization"
              >
                停止定位
              </el-button>
            </div>
          </div>
        </div>

        <div class="runtime-panel__section">
          <div class="runtime-panel__section-title">
            定点导航
          </div>
          <div class="runtime-panel__details">
            <div
              v-for="item in runtimeNavigationDetails"
              :key="item.label"
              class="runtime-detail"
            >
              <span class="runtime-detail__label">{{ item.label }}</span>
              <span class="runtime-detail__value">{{ item.value }}</span>
            </div>
          </div>
          <div class="runtime-panel__goal-grid">
            <el-input-number
              v-model="navGoalX"
              size="small"
              :step="0.1"
              controls-position="right"
              placeholder="X"
            />
            <el-input-number
              v-model="navGoalY"
              size="small"
              :step="0.1"
              controls-position="right"
              placeholder="Y"
            />
            <el-input-number
              v-model="navGoalYaw"
              size="small"
              :step="0.1"
              controls-position="right"
              placeholder="Yaw"
            />
            <el-input
              v-model="navGoalFrameId"
              size="small"
              placeholder="frame_id"
            />
            <el-input
              v-model="navGoalMapName"
              size="small"
              placeholder="目标地图，可留空"
            />
          </div>
          <div class="runtime-panel__actions">
            <el-button
              size="small"
              type="primary"
              :disabled="runtimeControlsDisabled"
              @click="handleNavigateToGoal"
            >
              导航到点
            </el-button>
            <el-button
              size="small"
              :disabled="runtimeControlsDisabled"
              @click="handleCancelNavigation"
            >
              取消导航
            </el-button>
          </div>
        </div>

        <div class="runtime-panel__section">
          <div class="runtime-panel__section-title">
            任务与巡逻
          </div>
          <div class="runtime-panel__details">
            <div
              v-for="item in runtimeTaskDetails"
              :key="item.label"
              class="runtime-detail"
            >
              <span class="runtime-detail__label">{{ item.label }}</span>
              <span class="runtime-detail__value">{{ item.value }}</span>
            </div>
          </div>
          <div class="runtime-panel__form">
            <el-input
              v-model="patrolTaskName"
              size="small"
              placeholder="巡逻任务名，可留空"
            />
            <el-input
              v-model="patrolWaypointFile"
              size="small"
              placeholder="巡逻点位文件"
            />
            <div class="runtime-panel__actions">
              <el-button
                size="small"
                type="primary"
                :disabled="runtimeControlsDisabled"
                @click="handleStartPatrol"
              >
                开始巡逻
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleTaskControl('pause')"
              >
                暂停任务
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleTaskControl('resume')"
              >
                恢复任务
              </el-button>
              <el-button
                size="small"
                :disabled="runtimeControlsDisabled"
                @click="handleTaskControl('terminate')"
              >
                终止任务
              </el-button>
            </div>
          </div>
        </div>

        <div class="runtime-panel__section">
          <div class="runtime-panel__section-title">
            运控桥
          </div>
          <div class="runtime-panel__details">
            <div
              v-for="item in runtimeDogBridgeDetails"
              :key="item.label"
              class="runtime-detail"
            >
              <span class="runtime-detail__label">{{ item.label }}</span>
              <span class="runtime-detail__value">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <div class="runtime-panel__section">
          <div class="runtime-panel__section-title">
            雷达
          </div>
          <div class="runtime-panel__details">
            <div
              v-for="item in runtimeSensorDetails"
              :key="item.label"
              class="runtime-detail"
            >
              <span class="runtime-detail__label">{{ item.label }}</span>
              <span class="runtime-detail__value">{{ item.value }}</span>
            </div>
          </div>
        </div>
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
import WhepVideoPlayer from '@/features/robot/components/WhepVideoPlayer.vue'
import { useRobotOperationJoystick } from '@/features/robot/composables/useRobotOperationJoystick'
import {
  defaultRobotOperationControlLayout,
  useRobotOperationLayout,
} from '@/features/robot/composables/useRobotOperationLayout'
import JoystickPad from '@/share/components/JoystickPad.vue'
import VoiceRecordButton from '@/share/components/VoiceRecordButton.vue'
import type {
  RobotSummaryData,
  RuntimeCommandResponseData,
  RuntimeDogBridgeData,
  RuntimeStateData,
  WebSocketMessage,
} from '@/share/websocket/types'
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
import { capturePhoto, createRobotVideoSession, releaseRobotVideoSession } from '../api'
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
const showVideo = ref(false)
const robotBattery = ref<number | undefined>(undefined)
const phoneBattery = ref<number | null>(null)
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
type RuntimeCommandType = 'navigation_command' | 'map_command' | 'patrol_command'
const robotSummary = ref<RobotSummaryData | null>(null)
const navigationState = ref<RuntimeStateData | null>(null)
const mapState = ref<RuntimeStateData | null>(null)
const taskState = ref<RuntimeStateData | null>(null)
const sensorState = ref<RuntimeStateData | null>(null)
const mapNameInput = ref('')
const navGoalX = ref(0)
const navGoalY = ref(0)
const navGoalYaw = ref(0)
const navGoalFrameId = ref('map')
const navGoalMapName = ref('')
const patrolTaskName = ref('')
const patrolWaypointFile = ref('')
/** 超时保护计时器，避免开关永久卡住 */
let sdkModeSwitchTimeout: ReturnType<typeof setTimeout> | null = null
let videoLeaseRenewTimer: ReturnType<typeof setTimeout> | null = null
let videoRequestToken = 0
let currentVideoSessionRobotUuid = ''

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

const activeWhepUrl = computed(() => {
  if (!showVideo.value || !videoSession.value?.available) return ''
  if (videoSession.value.preferredProtocol !== 'whep') return ''
  return videoSession.value.whepUrl || ''
})

const videoPlayerKey = computed(() => `${selectedUuid.value}-${videoPlayerVersion.value}`)

const videoPlaceholderTitle = computed(() => {
  if (!showVideo.value) return '视频已关闭'
  if (!selectedUuid.value) return '请先选择机器人'
  if (videoLoading.value) return '正在请求视频会话...'
  if (videoError.value) return '获取视频会话失败'
  if (!videoSession.value) return '等待视频会话...'
  if (!videoSession.value.available) return '当前暂无可用视频'
  if (!activeWhepUrl.value) return '当前视频会话暂未提供可播放的视频地址'
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
    return '云端 WHEP / WebRTC'
  }
  return '无可用视频'
})

const runtimeControlsDisabled = computed(() => !selectedUuid.value || !isConnected.value)

const lidarRuntimeState = computed(() => {
  const lidar = sensorState.value?.lidar
  if (lidar && typeof lidar === 'object' && !Array.isArray(lidar)) {
    return lidar as Record<string, unknown>
  }
  return robotSummary.value?.lidar || null
})

const dogBridgeRuntimeState = computed<RuntimeDogBridgeData | null>(() => {
  const dogBridge = robotSummary.value?.dog_bridge
  if (dogBridge && typeof dogBridge === 'object' && !Array.isArray(dogBridge)) {
    return dogBridge
  }
  return null
})

const currentTaskType = computed(() => {
  const taskType = taskState.value?.task_type ?? robotSummary.value?.task?.task_type
  return typeof taskType === 'string' ? taskType.trim().toLowerCase() : ''
})

const runtimeOverviewItems = computed(() => [
  {
    label: '建图',
    value: formatRuntimeValue(mapState.value?.state ?? robotSummary.value?.mapping?.state),
    type: getStateTagType(mapState.value?.state ?? robotSummary.value?.mapping?.state),
  },
  {
    label: '定位',
    value: formatRuntimeValue(robotSummary.value?.localization?.state),
    type: getStateTagType(robotSummary.value?.localization?.state),
  },
  {
    label: '导航',
    value: formatRuntimeValue(navigationState.value?.state ?? robotSummary.value?.navigation?.state),
    type: getStateTagType(navigationState.value?.state ?? robotSummary.value?.navigation?.state),
  },
  {
    label: '任务',
    value: formatRuntimeValue(taskState.value?.state ?? robotSummary.value?.task?.state),
    type: getStateTagType(taskState.value?.state ?? robotSummary.value?.task?.state),
  },
  {
    label: '雷达',
    value: getLidarStatusText(lidarRuntimeState.value),
    type: getLidarTagType(lidarRuntimeState.value),
  },
  {
    label: '运控桥',
    value: getDogBridgeStatusText(dogBridgeRuntimeState.value),
    type: getDogBridgeTagType(dogBridgeRuntimeState.value),
  },
])

const runtimeMapDetails = computed(() => [
  {
    label: '当前地图',
    value: formatRuntimeValue(mapState.value?.current_map ?? robotSummary.value?.mapping?.current_map),
  },
  {
    label: '最近地图',
    value: formatRuntimeValue(mapState.value?.last_map ?? robotSummary.value?.mapping?.last_map),
  },
  {
    label: '保存目录',
    value: formatRuntimeValue(mapState.value?.save_dir ?? robotSummary.value?.mapping?.save_dir),
  },
  {
    label: '定位地图',
    value: formatRuntimeValue(robotSummary.value?.localization?.map_name),
  },
  {
    label: '定位置信度',
    value: formatConfidence(robotSummary.value?.localization?.confidence),
  },
])

const runtimeNavigationDetails = computed(() => [
  {
    label: '当前目标',
    value: formatGoal(navigationState.value?.current_goal ?? robotSummary.value?.navigation?.current_goal),
  },
  {
    label: '剩余距离',
    value: formatDistance(navigationState.value?.remaining_distance ?? robotSummary.value?.navigation?.remaining_distance),
  },
  {
    label: '失败原因',
    value: formatRuntimeValue(navigationState.value?.failure_reason ?? robotSummary.value?.navigation?.failure_reason),
  },
  {
    label: '控制模式',
    value: formatRuntimeValue(robotSummary.value?.health?.control_mode),
  },
])

const runtimeTaskDetails = computed(() => [
  {
    label: '任务类型',
    value: formatRuntimeValue(taskState.value?.task_type ?? robotSummary.value?.task?.task_type),
  },
  {
    label: '任务 ID',
    value: formatRuntimeValue(taskState.value?.task_id ?? robotSummary.value?.task?.task_id),
  },
  {
    label: '运动模式',
    value: formatRuntimeValue(robotSummary.value?.health?.motion_mode),
  },
  {
    label: 'SDK 模式',
    value: formatBoolean(robotSummary.value?.health?.sdk_mode),
  },
])

const runtimeDogBridgeDetails = computed(() => [
  {
    label: '桥接在线',
    value: formatBoolean(dogBridgeRuntimeState.value?.online, '在线', '离线'),
  },
  {
    label: '运动控制',
    value: formatBoolean(dogBridgeRuntimeState.value?.motion_control_enabled, '启用', '禁用'),
  },
  {
    label: 'SDK 就绪',
    value: formatBoolean(dogBridgeRuntimeState.value?.sdk_ready, '就绪', '未就绪'),
  },
  {
    label: '允许运动',
    value: formatBoolean(dogBridgeRuntimeState.value?.motion_ready, '允许', '暂停'),
  },
  {
    label: '急停状态',
    value: formatBoolean(dogBridgeRuntimeState.value?.emergency_stop, '已触发', '未触发'),
  },
  {
    label: '裁决原因',
    value: formatDogBridgeReason(dogBridgeRuntimeState.value?.arbitration_reason),
  },
  {
    label: '指令延迟',
    value: formatLatency(dogBridgeRuntimeState.value?.command_age_sec),
  },
  {
    label: '遥测延迟',
    value: formatLatency(dogBridgeRuntimeState.value?.telemetry_age_sec),
  },
  {
    label: '目标速度',
    value: formatVelocityTuple(dogBridgeRuntimeState.value?.target_velocity),
  },
  {
    label: '输出速度',
    value: formatVelocityTuple(dogBridgeRuntimeState.value?.output_velocity),
  },
])

const runtimeSensorDetails = computed(() => [
  {
    label: '连接状态',
    value: formatBoolean(lidarRuntimeState.value?.connected),
  },
  {
    label: '传输方式',
    value: formatRuntimeValue(lidarRuntimeState.value?.transport),
  },
  {
    label: '坐标系',
    value: formatRuntimeValue(lidarRuntimeState.value?.frame_id),
  },
  {
    label: '扫描状态',
    value: formatBoolean(lidarRuntimeState.value?.scan_ok, '正常', '异常'),
  },
])

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

const clearVideoLeaseRenewTimer = () => {
  if (videoLeaseRenewTimer !== null) {
    clearTimeout(videoLeaseRenewTimer)
    videoLeaseRenewTimer = null
  }
}

const releaseVideoLease = async (uuid: string, sessionId: string) => {
  try {
    await releaseRobotVideoSession(uuid, sessionId)
  } catch {
    // 释放失败时交给后端租约超时兜底
  }
}

const releaseCurrentVideoSession = () => {
  const currentSessionId = videoSession.value?.sessionId
  const currentRobotUuid = currentVideoSessionRobotUuid
  currentVideoSessionRobotUuid = ''
  if (!currentRobotUuid || !currentSessionId) {
    return
  }
  void releaseVideoLease(currentRobotUuid, currentSessionId)
}

const scheduleVideoSessionRenew = (session: RobotVideoSession) => {
  clearVideoLeaseRenewTimer()
  if (!session.available || !session.sessionId || session.renewIntervalMs <= 0 || !currentVideoSessionRobotUuid) {
    return
  }

  videoLeaseRenewTimer = setTimeout(() => {
    void renewVideoSession()
  }, session.renewIntervalMs)
}

const applyVideoSession = (uuid: string, session: RobotVideoSession, restartPlayer: boolean) => {
  currentVideoSessionRobotUuid = session.sessionId ? uuid : ''
  videoSession.value = session
  if (session.available && session.sessionId) {
    scheduleVideoSessionRenew(session)
  } else {
    clearVideoLeaseRenewTimer()
  }
  if (restartPlayer) {
    videoPlayerVersion.value += 1
  }
}

const clearVideoSession = (options: { release?: boolean } = {}) => {
  videoRequestToken += 1
  clearVideoLeaseRenewTimer()
  if (options.release) {
    releaseCurrentVideoSession()
  } else {
    currentVideoSessionRobotUuid = ''
  }
  videoLoading.value = false
  videoSession.value = null
  videoError.value = ''
  videoPlayerVersion.value += 1
}

const loadVideoSession = async (uuid: string) => {
  const requestToken = ++videoRequestToken
  clearVideoLeaseRenewTimer()
  releaseCurrentVideoSession()
  videoLoading.value = true
  videoSession.value = null
  videoError.value = ''
  currentVideoSessionRobotUuid = ''

  try {
    const res = await createRobotVideoSession(uuid)
    if (requestToken !== videoRequestToken) {
      if (res.data.sessionId) {
        void releaseVideoLease(uuid, res.data.sessionId)
      }
      return
    }
    applyVideoSession(uuid, res.data, true)
  } catch (error: any) {
    if (requestToken !== videoRequestToken) return
    videoError.value = error?.message || '请求视频会话失败'
  } finally {
    if (requestToken === videoRequestToken) {
      videoLoading.value = false
    }
  }
}

const renewVideoSession = async () => {
  const uuid = currentVideoSessionRobotUuid
  const sessionId = videoSession.value?.sessionId
  if (!showVideo.value || !uuid || !sessionId) {
    clearVideoLeaseRenewTimer()
    return
  }

  const requestToken = videoRequestToken

  try {
    const res = await createRobotVideoSession(uuid, sessionId)
    if (requestToken !== videoRequestToken) {
      if (res.data.sessionId) {
        void releaseVideoLease(uuid, res.data.sessionId)
      }
      return
    }
    applyVideoSession(uuid, res.data, false)
  } catch {
    if (requestToken !== videoRequestToken) return
    videoLeaseRenewTimer = setTimeout(() => {
      void renewVideoSession()
    }, 3000)
  }
}

const retryVideoSession = () => {
  if (!showVideo.value || !selectedUuid.value) return
  void loadVideoSession(selectedUuid.value)
}

function toRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {}
  }
  return data as Record<string, unknown>
}

function parseNumericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function formatRuntimeValue(value: unknown, fallback = '未上报'): string {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback
  }
  if (typeof value === 'string') {
    return value.trim() || fallback
  }
  return JSON.stringify(value)
}

function formatBoolean(value: unknown, trueText = '开启', falseText = '关闭', fallback = '未上报'): string {
  if (typeof value === 'boolean') {
    return value ? trueText : falseText
  }
  return fallback
}

function formatDistance(value: unknown): string {
  const parsed = parseNumericValue(value)
  return parsed === undefined ? '未上报' : `${parsed.toFixed(2)} m`
}

function formatLatency(value: unknown): string {
  const parsed = parseNumericValue(value)
  return parsed === undefined ? '未上报' : `${parsed.toFixed(2)} s`
}

function formatConfidence(value: unknown): string {
  const parsed = parseNumericValue(value)
  if (parsed === undefined) {
    return '未上报'
  }
  if (parsed <= 1) {
    return `${Math.round(parsed * 100)}%`
  }
  return `${Math.round(parsed)}%`
}

function formatGoal(value: unknown): string {
  const goal = toRecord(value)
  const x = parseNumericValue(goal.x)
  const y = parseNumericValue(goal.y)
  const yaw = parseNumericValue(goal.yaw)
  if (x === undefined || y === undefined || yaw === undefined) {
    return formatRuntimeValue(value)
  }
  const frameId = typeof goal.frame_id === 'string'
    ? goal.frame_id
    : typeof goal.frameId === 'string'
      ? goal.frameId
      : 'map'
  return `x=${x.toFixed(2)}, y=${y.toFixed(2)}, yaw=${yaw.toFixed(2)}, frame=${frameId}`
}

function formatVelocityTuple(value: unknown): string {
  const velocity = toRecord(value)
  const vx = parseNumericValue(velocity.vx)
  const vy = parseNumericValue(velocity.vy)
  const wz = parseNumericValue(velocity.wz)
  if (vx === undefined || vy === undefined || wz === undefined) {
    return '未上报'
  }
  return `vx=${vx.toFixed(2)}, vy=${vy.toFixed(2)}, wz=${wz.toFixed(2)}`
}

function formatDogBridgeReason(value: unknown): string {
  const reason = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!reason) return '未上报'

  const mapping: Record<string, string> = {
    initializing: '初始化中',
    normal: '正常输出',
    command_timeout: '等待指令',
    telemetry_offline: '遥测离线',
    emergency_stop: '急停中',
    motion_control_disabled: '仅遥测模式',
    sdk_unavailable: 'SDK未就绪',
    control_error: '下发失败',
    telemetry_unavailable: '遥测接口异常',
    bridge_status_missing: '状态未上报',
    unknown: '未知',
  }
  return mapping[reason] || reason
}

function getStateTagType(value: unknown): '' | 'success' | 'warning' | 'info' | 'danger' {
  const state = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!state) return 'info'
  if (['running', 'active', 'connected', 'localizing', 'navigating', 'mapping'].includes(state)) return 'success'
  if (['paused', 'warning'].includes(state)) return 'warning'
  if (['error', 'failed', 'aborted', 'disconnected'].includes(state)) return 'danger'
  return 'info'
}

function getLidarStatusText(value: Record<string, unknown> | null): string {
  if (!value) return '未上报'
  if (value.connected === true && value.scan_ok === true) return '在线'
  if (value.enabled === false) return '未启用'
  if (value.connected === false) return '未连接'
  return '等待数据'
}

function getLidarTagType(value: Record<string, unknown> | null): '' | 'success' | 'warning' | 'info' | 'danger' {
  if (!value) return 'info'
  if (value.connected === true && value.scan_ok === true) return 'success'
  if (value.enabled === false) return 'info'
  if (value.connected === false || value.scan_ok === false) return 'warning'
  return 'info'
}

function getDogBridgeStatusText(value: RuntimeDogBridgeData | null): string {
  if (!value) return '未上报'
  if (value.emergency_stop === true) return '急停中'
  if (value.online !== true) return '未上报'
  if (value.sdk_ready !== true) return 'SDK未就绪'
  if (value.motion_control_enabled === false) return '仅遥测'
  if (value.motion_ready === true) return '就绪'
  return '在线'
}

function getDogBridgeTagType(value: RuntimeDogBridgeData | null): '' | 'success' | 'warning' | 'info' | 'danger' {
  if (!value) return 'info'
  if (value.emergency_stop === true) return 'danger'
  if (value.online !== true) return 'info'
  if (value.sdk_ready !== true || value.motion_control_enabled === false) return 'warning'
  if (value.motion_ready === true) return 'success'
  return 'warning'
}

function updateRobotBattery(value: unknown): void {
  const level = parseNumericValue(value)
  if (level !== undefined) {
    robotBattery.value = Math.round(level)
  }
}

const resetRuntimeState = () => {
  robotSummary.value = null
  navigationState.value = null
  mapState.value = null
  taskState.value = null
  sensorState.value = null
  robotBattery.value = undefined
}

const ensureRuntimeCommandReady = () => {
  if (!selectedUuid.value) {
    ElMessage.warning('请先选择机器人')
    return false
  }
  if (!isConnected.value) {
    ElMessage.warning('未连接机器人')
    return false
  }
  return true
}

const sendRuntimeCommand = (type: RuntimeCommandType, data: Record<string, unknown>) => {
  if (!ensureRuntimeCommandReady()) {
    return
  }
  wsSendMessage({
    type,
    robotId: selectedUuid.value,
    timestamp: Date.now(),
    data,
  })
}

const handleStartMapping = () => {
  const mapName = mapNameInput.value.trim()
  const data: Record<string, unknown> = { command: 'start_mapping' }
  if (mapName) {
    data.mapName = mapName
  }
  sendRuntimeCommand('map_command', data)
}

const handleStopMapping = () => {
  sendRuntimeCommand('map_command', { command: 'stop_mapping', saveMap: true })
}

const handleLoadMap = () => {
  const mapName = mapNameInput.value.trim()
  if (!mapName) {
    ElMessage.warning('请输入地图名称')
    return
  }
  sendRuntimeCommand('map_command', { command: 'load_map', mapName })
}

const handleStartLocalization = () => {
  const mapName = mapNameInput.value.trim()
  const data: Record<string, unknown> = { command: 'start_localization' }
  if (mapName) {
    data.mapName = mapName
  }
  sendRuntimeCommand('map_command', data)
}

const handleStopLocalization = () => {
  sendRuntimeCommand('map_command', { command: 'stop_localization' })
}

const handleNavigateToGoal = () => {
  const goal: Record<string, unknown> = {
    x: navGoalX.value,
    y: navGoalY.value,
    yaw: navGoalYaw.value,
    frameId: navGoalFrameId.value.trim() || 'map',
  }
  const mapName = navGoalMapName.value.trim() || mapNameInput.value.trim()
  if (mapName) {
    goal.mapName = mapName
  }
  sendRuntimeCommand('navigation_command', {
    command: 'navigate_to',
    goal,
  })
}

const handleCancelNavigation = () => {
  sendRuntimeCommand('navigation_command', { command: 'cancel' })
}

const handleStartPatrol = () => {
  const waypointFile = patrolWaypointFile.value.trim()
  if (!waypointFile) {
    ElMessage.warning('请输入巡逻点位文件')
    return
  }
  const taskName = patrolTaskName.value.trim() || waypointFile
  sendRuntimeCommand('patrol_command', {
    command: 'start',
    taskName,
    waypointFile,
  })
}

const handleTaskControl = (command: 'pause' | 'resume' | 'terminate') => {
  const type: RuntimeCommandType = currentTaskType.value === 'patrol' ? 'patrol_command' : 'navigation_command'
  sendRuntimeCommand(type, { command })
}

const handleRuntimeResponse = (type: string, data: unknown) => {
  const payload = data as RuntimeCommandResponseData | undefined
  const actionName = type === 'navigation_response'
    ? '导航'
    : type === 'map_response'
      ? '地图'
      : '巡逻'

  if (payload?.success) {
    ElMessage.success(`${actionName}命令已执行`)
    return
  }

  ElMessage.error(payload?.error || `${actionName}命令执行失败`)
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
const removeMessageHandler = onMessage((message: WebSocketMessage) => {
  const payload = toRecord(message.data)

  if (message.type === 'battery_status') {
    updateRobotBattery(payload.level)
  } else if (message.type === 'status_update') {
    updateRobotBattery(payload.battery)
  } else if (message.type === 'robot_summary') {
    robotSummary.value = payload as RobotSummaryData
    updateRobotBattery(robotSummary.value?.health?.battery)
  } else if (message.type === 'navigation_state') {
    navigationState.value = payload
  } else if (message.type === 'map_state') {
    mapState.value = payload
  } else if (message.type === 'task_state') {
    taskState.value = payload
  } else if (message.type === 'sensor_state') {
    sensorState.value = payload
  } else if (message.type === 'navigation_response' || message.type === 'map_response' || message.type === 'patrol_response') {
    handleRuntimeResponse(message.type, payload)
  } else if (message.type === 'sdk_mode_response') {
    if (sdkModeSwitchTimeout !== null) {
      clearTimeout(sdkModeSwitchTimeout)
      sdkModeSwitchTimeout = null
    }
    sdkModeLoading.value = false
    if (payload.success) {
      sdkMode.value = typeof payload.sdkMode === 'boolean' ? payload.sdkMode : sdkMode.value
      ElMessage.success(sdkMode.value ? 'SDK模式已开启' : '遥控模式已开启')
    } else {
      ElMessage.error(typeof payload.error === 'string' ? payload.error : 'SDK模式切换失败')
      sdkMode.value = sdkModePrevValue.value
    }
  } else if (message.type === 'error') {
    const msg = typeof payload.message === 'string' ? payload.message : '发生错误'
    if (payload.code === 'NO_ROBOT_IP') {
      ElMessage.warning(msg)
    } else {
      ElMessage.error(msg)
    }
  }
})

watch(selectedUuid, async (val) => {
  resetRuntimeState()
  if (!val) {
    wsDisconnect()
    return
  }

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
})

watch([selectedUuid, showVideo], ([uuid, videoEnabled]) => {
  if (!uuid || !videoEnabled) {
    clearVideoSession({ release: true })
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
  resetRuntimeState()
  clearVideoSession({ release: true })
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

.runtime-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 4;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100% - 32px);
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(143, 162, 199, 0.22);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(17, 24, 39, 0.92), rgba(9, 13, 24, 0.88));
  box-shadow:
    0 18px 48px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(14px);
}

.runtime-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.runtime-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: #f2f6ff;
}

.runtime-panel__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #92a1bf;
}

.runtime-panel__overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.runtime-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(143, 162, 199, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.runtime-chip__label {
  font-size: 12px;
  color: #aebad4;
}

.runtime-panel__section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(143, 162, 199, 0.14);
}

.runtime-panel__section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #edf2ff;
}

.runtime-panel__details {
  display: grid;
  gap: 6px;
}

.runtime-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  font-size: 12px;
}

.runtime-detail__label {
  color: #92a1bf;
}

.runtime-detail__value {
  flex: 1;
  min-width: 0;
  color: #edf2ff;
  text-align: right;
  word-break: break-all;
}

.runtime-panel__form {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.runtime-panel__goal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.runtime-panel__goal-grid :deep(.el-input-number) {
  width: 100%;
}

.runtime-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.runtime-panel :deep(.el-input__wrapper),
.runtime-panel :deep(.el-input-number__decrease),
.runtime-panel :deep(.el-input-number__increase) {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}

.runtime-panel :deep(.el-input__inner),
.runtime-panel :deep(.el-input-number .el-input__inner) {
  color: #edf2ff;
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

@media (max-width: 900px) {
  .runtime-panel {
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
    max-height: 52%;
  }

  .runtime-panel__overview,
  .runtime-panel__goal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
