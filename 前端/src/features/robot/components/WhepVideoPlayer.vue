<template>
  <div class="whep-player">
    <video
      ref="videoRef"
      class="whep-player__video"
      autoplay
      muted
      playsinline
    />

    <div
      v-if="state !== 'playing'"
      class="whep-player__overlay"
    >
      <p class="whep-player__title">
        {{ state === 'connecting' ? '正在建立云端 WebRTC 连接...' : '云端视频连接失败' }}
      </p>
      <p
        v-if="errorMsg"
        class="whep-player__detail whep-player__detail--error"
      >
        {{ errorMsg }}
      </p>
      <p class="whep-player__detail">
        {{ resolvedWhepUrl }}
      </p>
      <el-button
        v-if="state === 'error'"
        size="small"
        text
        @click="retry"
      >
        重新连接
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type PlayerState = 'connecting' | 'playing' | 'error'

const props = defineProps<{
  whepUrl: string
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const state = ref<PlayerState>('connecting')
const errorMsg = ref('')
const retryKey = ref(0)
const autoRetryCount = ref(0)

const MAX_AUTO_RETRY = 12
const AUTO_RETRY_DELAY_MS = 1000

const resolvedWhepUrl = computed(() => {
  const pageUrl = new URL(window.location.href)
  const isLocalDevPage = pageUrl.port === '5174' && ['localhost', '127.0.0.1'].includes(pageUrl.hostname)
  const isMediaProxyPath = props.whepUrl.startsWith('/media/')

  if (isLocalDevPage && isMediaProxyPath) {
    return new URL(props.whepUrl.replace(/^\/media/, ''), 'http://127.0.0.1:8889').toString()
  }

  return new URL(props.whepUrl, window.location.origin).toString()
})

let peerConnection: RTCPeerConnection | null = null
let remoteStream: MediaStream | null = null
let sessionUrl: string | null = null
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null

const clearAutoRetry = () => {
  if (autoRetryTimer !== null) {
    clearTimeout(autoRetryTimer)
    autoRetryTimer = null
  }
}

const scheduleAutoRetry = () => {
  if (autoRetryTimer !== null || autoRetryCount.value >= MAX_AUTO_RETRY) {
    return
  }

  autoRetryTimer = setTimeout(() => {
    autoRetryTimer = null
    autoRetryCount.value += 1
    retryKey.value += 1
  }, AUTO_RETRY_DELAY_MS)
}

const setPlayerError = (message: string) => {
  state.value = 'error'
  errorMsg.value = message
  scheduleAutoRetry()
}

const cleanupSession = async () => {
  const currentSessionUrl = sessionUrl
  sessionUrl = null

  if (peerConnection) {
    peerConnection.ontrack = null
    peerConnection.oniceconnectionstatechange = null
    peerConnection.onconnectionstatechange = null
    peerConnection.close()
    peerConnection = null
  }

  remoteStream = null
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }

  if (currentSessionUrl) {
    try {
      await fetch(currentSessionUrl, {
        method: 'DELETE',
      })
    } catch {
      // 会话释放失败时无需阻断 UI
    }
  }
}

const connect = async () => {
  await cleanupSession()
  clearAutoRetry()
  state.value = 'connecting'
  errorMsg.value = ''

  try {
    const iceServers = await loadIceServers(resolvedWhepUrl.value)
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
    })

    peerConnection = pc
    remoteStream = new MediaStream()

    pc.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream()
      }

      for (const track of event.streams[0]?.getTracks() || [event.track]) {
        if (!remoteStream.getTracks().some((item) => item.id === track.id)) {
          remoteStream.addTrack(track)
        }
      }

      if (videoRef.value) {
        videoRef.value.srcObject = remoteStream
        void videoRef.value.play().catch(() => undefined)
      }
      autoRetryCount.value = 0
      clearAutoRetry()
      state.value = 'playing'
    }

    pc.oniceconnectionstatechange = () => {
      const currentState = pc.iceConnectionState
      if (currentState === 'failed' || currentState === 'disconnected' || currentState === 'closed') {
        setPlayerError(`ICE 连接已断开（${currentState}）`)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setPlayerError('WebRTC 连接建立失败')
      }
    }

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGathering(pc, 5000)

    const localSdp = pc.localDescription?.sdp
    if (!localSdp) {
      throw new Error('无法获取本地 SDP')
    }

    const response = await fetch(resolvedWhepUrl.value, {
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

    const locationHeader = response.headers.get('Location')
    if (locationHeader) {
      sessionUrl = resolveSessionUrl(locationHeader, resolvedWhepUrl.value)
    }

    const answerSdp = await response.text()
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
      })
  } catch (error: any) {
    setPlayerError(error?.message || '未知错误')
    await cleanupSession()
  }
}

const retry = () => {
  clearAutoRetry()
  autoRetryCount.value = 0
  retryKey.value += 1
}

watch(
  () => [resolvedWhepUrl.value, retryKey.value],
  () => {
    clearAutoRetry()
    void connect()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearAutoRetry()
  void cleanupSession()
})

async function loadIceServers(whepUrl: string): Promise<RTCIceServer[]> {
  try {
    const response = await fetch(whepUrl, {
      method: 'OPTIONS',
    })
    const linkHeader = response.headers.get('Link') || ''
    return parseIceServers(linkHeader)
  } catch {
    return []
  }
}

function parseIceServers(linkHeader: string): RTCIceServer[] {
  if (!linkHeader.trim()) {
    return []
  }

  return linkHeader
    .split(/,(?=\s*<)/)
    .map((item) => item.trim())
    .map((item) => {
      const urlMatch = item.match(/<([^>]+)>/)
      const relMatch = item.match(/;\s*rel="?([^";]+)"?/)
      if (!urlMatch || relMatch?.[1] !== 'ice-server') {
        return null
      }

      const usernameMatch = item.match(/;\s*username="([^"]+)"/)
      const credentialMatch = item.match(/;\s*credential="([^"]+)"/)
      const iceServer: RTCIceServer = {
        urls: urlMatch[1],
      }

      if (usernameMatch?.[1]) {
        iceServer.username = usernameMatch[1]
      }
      if (credentialMatch?.[1]) {
        iceServer.credential = credentialMatch[1]
      }

      return iceServer
    })
    .filter((item): item is RTCIceServer => item !== null)
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve()
      return
    }

    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', handleStateChange)
      resolve()
    }, timeoutMs)

    const handleStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer)
        pc.removeEventListener('icegatheringstatechange', handleStateChange)
        resolve()
      }
    }

    pc.addEventListener('icegatheringstatechange', handleStateChange)
  })
}

function resolveSessionUrl(locationHeader: string, whepUrl: string): string {
  const resolvedUrl = new URL(locationHeader, whepUrl)
  const whepBaseUrl = new URL(whepUrl)

  if (
    whepBaseUrl.origin === resolvedUrl.origin &&
    whepBaseUrl.pathname.startsWith('/media/') &&
    !resolvedUrl.pathname.startsWith('/media/')
  ) {
    resolvedUrl.pathname = `/media${resolvedUrl.pathname}`
  }

  return resolvedUrl.toString()
}
</script>

<style scoped>
.whep-player {
  position: relative;
  width: 100%;
  height: 100%;
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
  text-align: center;
  color: #dce7ff;
  background: rgba(0, 0, 0, 0.38);
}

.whep-player__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.whep-player__detail {
  margin: 0;
  color: #8fa2c7;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
}

.whep-player__detail--error {
  color: #ff9c9c;
}
</style>
