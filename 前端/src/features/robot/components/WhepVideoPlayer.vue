<template>
  <div class="whep-player">
    <video
      ref="videoRef"
      class="whep-player__video"
      autoplay
      playsinline
      muted
    />

    <div
      v-if="state !== 'playing'"
      class="whep-player__overlay"
    >
      <p class="whep-player__title">
        {{ state === 'connecting' ? '正在建立 WebRTC 连接...' : 'WebRTC 连接失败' }}
      </p>
      <p
        v-if="errorMsg"
        class="whep-player__error"
      >
        {{ errorMsg }}
      </p>
      <p class="whep-player__url">
        {{ whepUrl }}
      </p>
      <button
        v-if="state === 'error'"
        type="button"
        class="whep-player__retry"
        @click="retry"
      >
        重新连接
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

type PlayerState = 'connecting' | 'playing' | 'error'

const props = defineProps<{
  whepUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const state = ref<PlayerState>('connecting')
const errorMsg = ref('')
const retryKey = ref(0)

let peerConnection: RTCPeerConnection | null = null
let remoteStream: MediaStream | null = null
let connectVersion = 0

function cleanupConnection() {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.srcObject = null
  }
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop())
    remoteStream = null
  }
}

async function connect() {
  const currentVersion = ++connectVersion
  cleanupConnection()
  state.value = 'connecting'
  errorMsg.value = ''

  try {
    const parsedUrl = new URL(props.whepUrl)
    if (window.location.protocol === 'https:' && parsedUrl.protocol !== 'https:') {
      throw new Error('当前页面为 HTTPS，浏览器会阻止加载 HTTP 的本地 WHEP 地址')
    }

    const pc = new RTCPeerConnection({
      iceServers: [],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    })
    peerConnection = pc

    pc.addEventListener('track', (event) => {
      if (currentVersion !== connectVersion) return
      const nextStream = event.streams?.[0]
      if (!nextStream) return
      remoteStream = nextStream
      if (videoRef.value) {
        videoRef.value.srcObject = nextStream
        void videoRef.value.play().catch(() => {})
      }
      state.value = 'playing'
    })

    pc.addEventListener('iceconnectionstatechange', () => {
      if (currentVersion !== connectVersion) return
      const currentState = pc.iceConnectionState
      if (currentState === 'failed' || currentState === 'disconnected' || currentState === 'closed') {
        state.value = 'error'
        errorMsg.value = `ICE 连接断开（${currentState}）`
      }
    })

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    const offer = await pc.createOffer({})
    if (currentVersion !== connectVersion) return
    await pc.setLocalDescription(offer)
    await waitForIceGathering(pc, 5000)
    if (currentVersion !== connectVersion) return

    const localSdp = pc.localDescription?.sdp
    if (!localSdp) {
      throw new Error('无法获取本地 SDP')
    }

    const response = await fetch(props.whepUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: localSdp,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`WHEP 握手失败: HTTP ${response.status}${body ? ` - ${body}` : ''}`)
    }

    const answerSdp = await response.text()
    if (currentVersion !== connectVersion) return

    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    })
  } catch (error: unknown) {
    if (currentVersion !== connectVersion) return
    state.value = 'error'
    errorMsg.value = error instanceof Error ? error.message : String(error)
  }
}

function retry() {
  retryKey.value += 1
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve()
      return
    }

    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onStateChange)
      resolve()
    }, timeoutMs)

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer)
        pc.removeEventListener('icegatheringstatechange', onStateChange)
        resolve()
      }
    }

    pc.addEventListener('icegatheringstatechange', onStateChange)
  })
}

watch(
  () => [props.whepUrl, retryKey.value],
  () => {
    void connect()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  connectVersion += 1
  cleanupConnection()
})
</script>

<style scoped>
.whep-player {
  position: absolute;
  inset: 0;
  background: #000;
}

.whep-player__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.whep-player__overlay {
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

.whep-player__title {
  margin: 0;
  color: #dce7ff;
  font-size: 15px;
  font-weight: 600;
}

.whep-player__error {
  margin: 0;
  color: #ff8a8a;
  font-size: 12px;
}

.whep-player__url {
  margin: 0;
  color: #8fa2c7;
  font-size: 11px;
  word-break: break-all;
}

.whep-player__retry {
  margin-top: 8px;
  padding: 8px 16px;
  border: 1px solid rgba(143, 162, 199, 0.6);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  color: #dce7ff;
  cursor: pointer;
}
</style>
