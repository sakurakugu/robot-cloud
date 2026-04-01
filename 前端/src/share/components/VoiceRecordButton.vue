<template>
  <el-tooltip
    :content="isRecording ? props.recordingText : props.idleText"
    :disabled="props.variant !== 'icon'"
    placement="top"
  >
    <el-button
      :class="[
        'voice-record-btn',
        `voice-record-btn--${props.variant}`,
        { recording: isRecording },
      ]"
      :circle="props.variant === 'icon' ? props.circle : false"
      :round="props.variant === 'press'"
      :size="props.size"
      @pointerdown.prevent="onPointerDown"
      @pointerup.prevent="onPointerUp"
      @pointerleave="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu.prevent
    >
      <el-icon v-if="props.variant === 'icon'">
        <Microphone />
      </el-icon>
      <span
        v-else
        class="voice-record-btn__label"
      >
        {{ isRecording ? props.recordingText : props.idleText }}
      </span>
    </el-button>
  </el-tooltip>
</template>

<script setup lang="ts">
import { useAudioRecorder } from '@/features/conversation/composables/useAudioRecorder';
import { useWebSocket } from '@/share/websocket/useWebSocket';
import { Microphone } from '@element-plus/icons-vue';

const props = withDefaults(defineProps<{
  /** 按钮大小 */
  size?: 'small' | 'default' | 'large'
  /** 是否圆形按钮 */
  circle?: boolean
  /** 展示模式 */
  variant?: 'icon' | 'press'
  /** 默认提示文案 */
  idleText?: string
  /** 录音中提示文案 */
  recordingText?: string
}>(), {
  size: 'default',
  circle: true,
  variant: 'icon',
  idleText: '按住说话',
  recordingText: '松开发送',
})

const { robotId, isAudioUploadConnected, sendMessage } = useWebSocket()

const { isRecording, startRecording, stopRecording } = useAudioRecorder(
  () => robotId.value,
  sendMessage,
  () => isAudioUploadConnected.value,
)

const onPointerDown = () => {
  startRecording()
}

const onPointerUp = () => {
  if (isRecording.value) {
    stopRecording()
  }
}
</script>

<style scoped>
.voice-record-btn {
  transition: all 0.2s ease;
  user-select: none;
  touch-action: none;
}

.voice-record-btn--press {
  width: 100%;
  min-height: 52px;
}

.voice-record-btn__label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.voice-record-btn.recording {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #fff !important;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}
</style>
