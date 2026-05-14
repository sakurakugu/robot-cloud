import type { AIConfig, LLMConfig, LLMProviderKey, UpdateAIConfigDTO, UpdateLLMConfigDTO } from './types'

export const llmProviderKeys = ['openai', 'bigmodel', 'anthropic', 'deepseek', 'aliyun'] as const

export type ProviderSecretConfig = {
  apiKey: string
  showKey: boolean
  readonly: boolean
  hasKey: boolean
  keyLength: number
}

export type XunfeiFieldKey = 'appId' | 'apiKey' | 'apiSecret'

export type AliyunTtsFieldKey = 'apiKey' | 'model' | 'voice' | 'instructions'

export type XunfeiAsrSecretConfig = {
  appId: string
  apiKey: string
  apiSecret: string
  showAppId: boolean
  showApiKey: boolean
  showApiSecret: boolean
  readonlyAppId: boolean
  readonlyApiKey: boolean
  readonlyApiSecret: boolean
  hasAppId: boolean
  hasApiKey: boolean
  hasApiSecret: boolean
  appIdLength: number
  apiKeyLength: number
  apiSecretLength: number
}

export type AliyunTtsSecretConfig = {
  apiKey: string
  model: string
  voice: string
  responseFormat: 'pcm' | 'wav' | 'mp3' | 'opus'
  sampleRate: 8000 | 16000 | 24000 | 48000
  instructions: string
  optimizeInstructions: boolean
  showApiKey: boolean
  readonlyApiKey: boolean
  hasApiKey: boolean
  apiKeyLength: number
}

export function getMaskedText(len: number): string {
  return len > 0 ? Array(len).fill('•').join('') : ''
}

export function createProviderSecretConfig(): ProviderSecretConfig {
  return {
    apiKey: '',
    showKey: false,
    readonly: false,
    hasKey: false,
    keyLength: 0,
  }
}

export function createXunfeiAsrSecretConfig(): XunfeiAsrSecretConfig {
  return {
    appId: '',
    apiKey: '',
    apiSecret: '',
    showAppId: false,
    showApiKey: false,
    showApiSecret: false,
    readonlyAppId: false,
    readonlyApiKey: false,
    readonlyApiSecret: false,
    hasAppId: false,
    hasApiKey: false,
    hasApiSecret: false,
    appIdLength: 0,
    apiKeyLength: 0,
    apiSecretLength: 0,
  }
}

export function createAliyunTtsSecretConfig(): AliyunTtsSecretConfig {
  return {
    apiKey: '',
    model: 'qwen3-tts-instruct-flash-realtime',
    voice: 'Cherry',
    responseFormat: 'mp3',
    sampleRate: 24000,
    instructions: '',
    optimizeInstructions: false,
    showApiKey: false,
    readonlyApiKey: false,
    hasApiKey: false,
    apiKeyLength: 0,
  }
}

export function applyProviderSecretConfig(
  target: ProviderSecretConfig,
  source?: LLMConfig['providers'][LLMProviderKey],
) {
  if (!source) {
    return
  }

  target.hasKey = !!source.hasApiKey
  target.keyLength = source.apiKeyLength || 0
  target.readonly = target.hasKey
  target.showKey = false
  target.apiKey = target.hasKey ? getMaskedText(target.keyLength) : ''
}

export function toggleProviderVisibility(target: ProviderSecretConfig) {
  target.showKey = !target.showKey
}

export function setProviderSecretValue(target: ProviderSecretConfig, value: string) {
  target.apiKey = value
}

export function enableProviderEdit(target: ProviderSecretConfig) {
  target.readonly = false
  target.apiKey = ''
  target.showKey = true
}

export function applyXunfeiAsrSecretConfig(
  target: XunfeiAsrSecretConfig,
  source?: AIConfig['xunfeiAsr'],
) {
  if (!source) {
    return
  }

  target.hasAppId = !!source.hasAppId
  target.hasApiKey = !!source.hasApiKey
  target.hasApiSecret = !!source.hasApiSecret
  target.appIdLength = source.appIdLength || 0
  target.apiKeyLength = source.apiKeyLength || 0
  target.apiSecretLength = source.apiSecretLength || 0
  target.readonlyAppId = target.hasAppId
  target.readonlyApiKey = target.hasApiKey
  target.readonlyApiSecret = target.hasApiSecret
  target.showAppId = false
  target.showApiKey = false
  target.showApiSecret = false
  target.appId = target.hasAppId ? getMaskedText(target.appIdLength) : ''
  target.apiKey = target.hasApiKey ? getMaskedText(target.apiKeyLength) : ''
  target.apiSecret = target.hasApiSecret ? getMaskedText(target.apiSecretLength) : ''
}

export function applyAliyunTtsSecretConfig(
  target: AliyunTtsSecretConfig,
  source?: AIConfig['aliyunTts'],
) {
  if (!source) {
    return
  }

  target.hasApiKey = !!source.hasApiKey
  target.apiKeyLength = source.apiKeyLength || 0
  target.readonlyApiKey = target.hasApiKey
  target.showApiKey = false
  target.apiKey = target.hasApiKey ? getMaskedText(target.apiKeyLength) : ''
  target.model = source.model || target.model
  target.voice = source.voice || target.voice
  target.responseFormat = source.responseFormat || target.responseFormat
  target.sampleRate = source.sampleRate || target.sampleRate
  target.instructions = source.instructions || ''
  target.optimizeInstructions = !!source.optimizeInstructions
}

export function toggleAliyunTtsFieldVisibility(target: AliyunTtsSecretConfig, field: AliyunTtsFieldKey) {
  if (field === 'apiKey') {
    target.showApiKey = !target.showApiKey
  }
}

export function setAliyunTtsFieldValue(target: AliyunTtsSecretConfig, field: AliyunTtsFieldKey, value: string) {
  if (field === 'apiKey') {
    target.apiKey = value
  } else if (field === 'model') {
    target.model = value
  } else if (field === 'voice') {
    target.voice = value
  } else {
    target.instructions = value
  }
}

export function enableAliyunTtsFieldEdit(target: AliyunTtsSecretConfig, field: AliyunTtsFieldKey) {
  if (field === 'apiKey') {
    target.readonlyApiKey = false
    target.apiKey = ''
    target.showApiKey = true
  }
}

export function toggleXunfeiFieldVisibility(target: XunfeiAsrSecretConfig, field: XunfeiFieldKey) {
  if (field === 'appId') {
    target.showAppId = !target.showAppId
  } else if (field === 'apiKey') {
    target.showApiKey = !target.showApiKey
  } else {
    target.showApiSecret = !target.showApiSecret
  }
}

export function setXunfeiFieldValue(target: XunfeiAsrSecretConfig, field: XunfeiFieldKey, value: string) {
  if (field === 'appId') {
    target.appId = value
  } else if (field === 'apiKey') {
    target.apiKey = value
  } else {
    target.apiSecret = value
  }
}

export function enableXunfeiFieldEdit(target: XunfeiAsrSecretConfig, field: XunfeiFieldKey) {
  if (field === 'appId') {
    target.readonlyAppId = false
    target.appId = ''
    target.showAppId = true
  } else if (field === 'apiKey') {
    target.readonlyApiKey = false
    target.apiKey = ''
    target.showApiKey = true
  } else {
    target.readonlyApiSecret = false
    target.apiSecret = ''
    target.showApiSecret = true
  }
}

export function buildLLMUpdatePayload(
  configs: Record<LLMProviderKey, ProviderSecretConfig>,
): UpdateLLMConfigDTO {
  const payload: UpdateLLMConfigDTO = {}

  for (const provider of llmProviderKeys) {
    const config = configs[provider]
    const apiKey = config.apiKey.trim()
    if (apiKey.length > 0 && apiKey !== getMaskedText(config.keyLength)) {
      payload[provider] = { apiKey }
    }
  }

  return payload
}

export function buildXunfeiUpdatePayload(
  config: XunfeiAsrSecretConfig,
): NonNullable<UpdateAIConfigDTO['xunfeiAsr']> {
  const payload: NonNullable<UpdateAIConfigDTO['xunfeiAsr']> = {}

  if (config.appId.trim().length > 0 && config.appId !== getMaskedText(config.appIdLength)) {
    payload.appId = config.appId.trim()
  }
  if (config.apiKey.trim().length > 0 && config.apiKey !== getMaskedText(config.apiKeyLength)) {
    payload.apiKey = config.apiKey.trim()
  }
  if (config.apiSecret.trim().length > 0 && config.apiSecret !== getMaskedText(config.apiSecretLength)) {
    payload.apiSecret = config.apiSecret.trim()
  }

  return payload
}

export function buildAliyunTtsUpdatePayload(
  config: AliyunTtsSecretConfig,
): NonNullable<UpdateAIConfigDTO['aliyunTts']> {
  const payload: NonNullable<UpdateAIConfigDTO['aliyunTts']> = {}

  if (config.apiKey.trim().length > 0 && config.apiKey !== getMaskedText(config.apiKeyLength)) {
    payload.apiKey = config.apiKey.trim()
  }
  if (config.model.trim().length > 0) {
    payload.model = config.model.trim()
  }
  if (config.voice.trim().length > 0) {
    payload.voice = config.voice.trim()
  }
  if (config.responseFormat) {
    payload.responseFormat = config.responseFormat
  }
  if (config.sampleRate) {
    payload.sampleRate = config.sampleRate
  }
  if (config.instructions.trim().length > 0) {
    payload.instructions = config.instructions.trim()
  }
  payload.optimizeInstructions = !!config.optimizeInstructions

  return payload
}
