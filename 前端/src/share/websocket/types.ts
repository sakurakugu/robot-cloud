// WebSocket 模块类型定义

export type WebSocketRole = 'robot' | 'ui'

export interface WebSocketMessage<TData = unknown> {
  type: string
  robotId?: string
  timestamp: number
  data?: TData
}

export interface RuntimeHealthData {
  online?: boolean
  battery?: number | string | null
  sdk_mode?: boolean
  control_mode?: string
  motion_mode?: string
  [key: string]: unknown
}

export interface RuntimeLidarData {
  enabled?: boolean
  connected?: boolean
  transport?: string
  frame_id?: string
  scan_ok?: boolean
  [key: string]: unknown
}

export interface RuntimeMapData {
  state?: string
  current_map?: string
  last_map?: string | null
  save_dir?: string
  auto_save?: boolean
  [key: string]: unknown
}

export interface RuntimeLocalizationData {
  state?: string
  map_name?: string
  confidence?: number | string | null
  [key: string]: unknown
}

export interface RuntimeNavigationData {
  state?: string
  current_goal?: Record<string, unknown> | null
  remaining_distance?: number | string | null
  failure_reason?: string | null
  [key: string]: unknown
}

export interface RuntimeDogBridgeVelocityData {
  vx?: number | string | null
  vy?: number | string | null
  wz?: number | string | null
  [key: string]: unknown
}

export interface RuntimeDogBridgeData {
  online?: boolean
  motion_control_enabled?: boolean
  sdk_ready?: boolean
  telemetry_online?: boolean
  motion_ready?: boolean
  emergency_stop?: boolean
  arbitration_reason?: string
  command_age_sec?: number | string | null
  telemetry_age_sec?: number | string | null
  target_velocity?: RuntimeDogBridgeVelocityData
  output_velocity?: RuntimeDogBridgeVelocityData
  [key: string]: unknown
}

export interface RuntimeTaskData {
  state?: string
  task_type?: string | null
  task_id?: string | null
  [key: string]: unknown
}

export interface RobotSummaryData {
  health?: RuntimeHealthData
  dog_bridge?: RuntimeDogBridgeData
  lidar?: RuntimeLidarData
  mapping?: RuntimeMapData
  localization?: RuntimeLocalizationData
  navigation?: RuntimeNavigationData
  task?: RuntimeTaskData
  [key: string]: unknown
}

export interface RuntimeCommandResponseData {
  requestId?: string
  success?: boolean
  data?: Record<string, unknown> | null
  error?: string
  errorCode?: string
  [key: string]: unknown
}

export interface RuntimeManualCommandData {
  command: 'start_session' | 'update_velocity' | 'stop' | 'emergency_stop'
  mode?: 'move' | 'pose' | 'two_leg'
  vx?: number
  vy?: number
  wz?: number
  source?: string
  session_id?: string
  enabled?: boolean
  [key: string]: unknown
}

export interface RuntimeActionCommandData {
  action_name?: string
  action_id?: string
  source?: string
  parameters?: Record<string, unknown>
  [key: string]: unknown
}

export type RuntimeStateData = Record<string, unknown>

export type ServerMessage =
  | WebSocketMessage<{
      text: string
      noTTS?: boolean
      ttsDone?: boolean
      actions?: string[]
    }>
  | WebSocketMessage<{
      buffer: string
      format: string
      duration?: number
      sampleRate?: number
    }>
  | WebSocketMessage<{
      level: number
    }>
  | WebSocketMessage<Record<string, unknown>>
  | WebSocketMessage<RobotSummaryData>
  | WebSocketMessage<RuntimeStateData>
  | WebSocketMessage<RuntimeCommandResponseData>

export type ClientMessage =
  | WebSocketMessage<{
      text: string
      context?: string
    }>
  | WebSocketMessage<{
      command: string
      [key: string]: unknown
    }>

export interface WebSocketConnectionOptions {
  robotId: string
  role: WebSocketRole
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'
