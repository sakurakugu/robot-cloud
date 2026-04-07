<template>
  <div class="cloud-frame-player">
    <img
      v-if="frameSrc"
      :src="frameSrc"
      alt="机器人云端视频"
      class="cloud-frame-player__image"
    >

    <div
      v-if="!frameSrc"
      class="cloud-frame-player__overlay"
    >
      <p class="cloud-frame-player__title">
        {{ overlayTitle }}
      </p>
      <p class="cloud-frame-player__hint">
        {{ overlayHint }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWebSocket } from '@/share/websocket/useWebSocket'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  robotId: string
}>()

const { isConnected, sendMessage, onMessage } = useWebSocket()

const frameSrc = ref('')

const overlayTitle = computed(() => {
  if (!isConnected.value) return '业务通道未连接'
  return '正在等待云端视频帧...'
})

const overlayHint = computed(() => {
  if (!props.robotId) return '未选择机器人'
  if (!isConnected.value) return '请先确认页面已连接到云端后端'
  return '当前通过云端业务 WebSocket 转发 JPEG 帧流'
})

function 发送订阅(targetRobotId: string) {
  if (!targetRobotId || !isConnected.value) return
  sendMessage({
    type: 'video_subscribe',
    robotId: targetRobotId,
    timestamp: Date.now(),
    data: {},
  })
}

function 发送退订(targetRobotId: string) {
  if (!targetRobotId || !isConnected.value) return
  sendMessage({
    type: 'video_unsubscribe',
    robotId: targetRobotId,
    timestamp: Date.now(),
    data: {},
  })
}

const removeMessageHandler = onMessage((message: any) => {
  if (message?.type !== 'video_frame') return
  if (message?.robotId !== props.robotId) return

  const frame = message?.data?.frame
  if (typeof frame !== 'string' || !frame) return

  const format = message?.data?.format === 'jpeg' ? 'jpeg' : 'jpeg'
  frameSrc.value = `data:image/${format};base64,${frame}`
})

watch(
  () => [props.robotId, isConnected.value] as const,
  ([robotId, connected], previous) => {
    const previousRobotId = previous?.[0] || ''
    const previousConnected = previous?.[1] || false

    if (previousRobotId && previousRobotId !== robotId && previousConnected) {
      发送退订(previousRobotId)
    }

    frameSrc.value = ''

    if (robotId && connected) {
      发送订阅(robotId)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  removeMessageHandler()
  发送退订(props.robotId)
})
</script>

<style scoped>
.cloud-frame-player {
  position: absolute;
  inset: 0;
  background: #000;
}

.cloud-frame-player__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.cloud-frame-player__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.58);
  text-align: center;
}

.cloud-frame-player__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.cloud-frame-player__hint {
  margin: 0;
  max-width: 80%;
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.72);
}
</style>
