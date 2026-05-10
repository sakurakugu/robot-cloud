/**
 * 统一类型定义
 * 所有模块共用的类型在此定义，确保前后端一致性
 */

// ============ 基础类型 ============

export type 对话类型 = 'audio' | 'text';
export type ActionStatus = 'success' | 'failed' | 'rejected';

// ============ 数据库实体 ============

/**
 * 对话记录
 */
export interface ConversationRecord {
  uuid: number;
  robot_id: string;
  conversation_id: string | null;
  timestamp: string;
  type: 对话类型;
  user_input: string;
  ai_response: string;
  actions: string | null; // JSON 字符串
  processing_time: number | null;
  metadata: string | null; // JSON 字符串
}

/**
 * 动作日志记录
 */
export interface ActionLogRecord {
  uuid: number;
  robot_id: string;
  conversation_id: string | null;
  action_name: string;
  parameters: string | null; // JSON 字符串
  status: ActionStatus;
  result_detail: string | null;
  executed_at: string;
}

/**
 * 系统设置记录
 */
export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
}

// ============ API 响应类型 ============

/**
 * 标准 API 响应
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============ DTO 类型 ============

// ============ WebSocket 类型 ============

export type WsChannel = 'control' | 'business' | 'audio_upload' | 'audio_download';

export interface WebSocket连接句柄 {
  send(data: string): void;
  close(code?: number, data?: string): void;
  on?(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
  off?(event: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

/**
 * WebSocket 连接信息
 */
export interface RobotConnection {
  robotId: string;
  websocket: WebSocket连接句柄;
  connectedAt: Date;
  lastActiveAt: Date;
  channel?: WsChannel;
  metadata: {
    name?: string;
    model?: string;
    version?: string;
    motion_control_version?: string;
    robot_server_version?: string;
  };
}

// ============ 消息类型 ============

export interface AudioChunk {
  format: 'opus' | 'pcm' | 'mp3';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  sessionId?: string;
  seq?: number;
  frameDurationMs?: number;
  buffer: string; // base64 编码
}

export interface AudioStart {
  format: 'opus' | 'pcm';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  frameDurationMs: number;
  sessionId: string;
}

export interface AudioEnd {
  sessionId: string;
  reason?: 'silence' | 'max_length' | 'manual' | 'error';
}

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  stream?: boolean;
}

// 客户端消息基础类型
interface BaseClientMessage {
  robotId: string;
  timestamp: number;
}

export interface TextInputMessage extends BaseClientMessage {
  type: 'text_input';
  data: {
    text: string;
    context?: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface AudioStartMessage extends BaseClientMessage {
  type: 'audio_start';
  data: AudioStart;
}

export interface AudioChunkMessage extends BaseClientMessage {
  type: 'audio_chunk';
  data: AudioChunk;
}

export interface AudioEndMessage extends BaseClientMessage {
  type: 'audio_end';
  data: AudioEnd;
}

export interface HeartbeatMessage extends BaseClientMessage {
  type: 'heartbeat';
  data?: Record<string, unknown>;
}

export interface StatusMessage extends BaseClientMessage {
  type: 'status';
  data: Record<string, unknown> & {
    battery?: number | string;
    level?: number | string;
    temperature?: number | string;
    position?: string;
  };
}

export interface RobotRegisterMessage extends BaseClientMessage {
  type: 'robot_register';
  data: {
    name?: string;
    model?: string;
    version?: string;
    metadata?: {
      version?: string; // robot-agent 版本
      agent_version?: string;
      motion_control_version?: string;
      robot_server_version?: string;
      [key: string]: unknown;
    };
  };
}

export interface TTSInputMessage extends BaseClientMessage {
  type: 'tts_input';
  data: {
    text: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface VideoSubscribeMessage extends BaseClientMessage {
  type: 'video_subscribe';
}

export interface VideoUnsubscribeMessage extends BaseClientMessage {
  type: 'video_unsubscribe';
}

export interface VideoFrameMessage extends BaseClientMessage {
  type: 'video_frame';
  data: {
    frame: string;
    format?: 'jpeg';
    width?: number;
    height?: number;
    capturedAt?: number;
  };
}

export interface AudioControlMessage extends BaseClientMessage {
  type: 'audio_control';
  data: {
    enabled: boolean;
    source?: 'ui' | 'system';
  };
}

export interface RuntimeCommandGoal {
  x?: number | string;
  y?: number | string;
  yaw?: number | string;
  frame_id?: string;
  frameId?: string;
  map_name?: string;
  mapName?: string;
  goal_id?: string;
  goalId?: string;
  [key: string]: unknown;
}

export interface RuntimeCommandData extends Record<string, unknown> {
  requestId?: string;
  command?: string;
  action?: string;
  operation?: string;
  op?: string;
  goal?: RuntimeCommandGoal;
}

export interface NavigationCommandMessage extends BaseClientMessage {
  type: 'navigation_command';
  data: RuntimeCommandData;
}

export interface MapCommandMessage extends BaseClientMessage {
  type: 'map_command';
  data: RuntimeCommandData;
}

export interface PatrolCommandMessage extends BaseClientMessage {
  type: 'patrol_command';
  data: RuntimeCommandData;
}

export interface ManualCommandMessage extends BaseClientMessage {
  type: 'manual_command';
  data: RuntimeCommandData & {
    command: 'start_session' | 'update_velocity' | 'stop' | 'emergency_stop';
    mode?: 'move' | 'pose' | 'two_leg';
    vx?: number | string;
    vy?: number | string;
    wz?: number | string;
    source?: string;
    session_id?: string;
    sessionId?: string;
    enabled?: boolean;
  };
}

export interface ActionCommandMessage extends BaseClientMessage {
  type: 'action_command';
  data: RuntimeCommandData & {
    action_name?: string;
    source?: string;
    action_id?: string;
    actionId?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface RuntimeCommandResponseData extends Record<string, unknown> {
  requestId?: string;
  success?: boolean;
  data?: Record<string, unknown> | null;
  error?: string;
  errorCode?: string;
}

export interface NavigationResponseMessage extends BaseClientMessage {
  type: 'navigation_response';
  data: RuntimeCommandResponseData;
}

export interface MapResponseMessage extends BaseClientMessage {
  type: 'map_response';
  data: RuntimeCommandResponseData;
}

export interface PatrolResponseMessage extends BaseClientMessage {
  type: 'patrol_response';
  data: RuntimeCommandResponseData;
}

export interface RuntimeHealthData extends Record<string, unknown> {
  online?: boolean;
  battery?: number | string | null;
  sdk_mode?: boolean;
  control_mode?: string;
  motion_mode?: string;
}

export interface RuntimeLidarData extends Record<string, unknown> {
  enabled?: boolean;
  connected?: boolean;
  transport?: string;
  frame_id?: string;
  scan_ok?: boolean;
}

export interface RuntimeMapData extends Record<string, unknown> {
  state?: string;
  current_map?: string;
  last_map?: string | null;
  save_dir?: string;
  auto_save?: boolean;
}

export interface RuntimeLocalizationData extends Record<string, unknown> {
  state?: string;
  map_name?: string;
  confidence?: number | string | null;
}

export interface RuntimeNavigationData extends Record<string, unknown> {
  state?: string;
  current_goal?: Record<string, unknown> | null;
  remaining_distance?: number | string | null;
  failure_reason?: string | null;
}

export interface RuntimeDogBridgeVelocityData extends Record<string, unknown> {
  vx?: number | string | null;
  vy?: number | string | null;
  wz?: number | string | null;
}

export interface RuntimeDogBridgeData extends Record<string, unknown> {
  online?: boolean;
  motion_control_enabled?: boolean;
  sdk_ready?: boolean;
  telemetry_online?: boolean;
  motion_ready?: boolean;
  emergency_stop?: boolean;
  arbitration_reason?: string;
  command_age_sec?: number | string | null;
  telemetry_age_sec?: number | string | null;
  target_velocity?: RuntimeDogBridgeVelocityData;
  output_velocity?: RuntimeDogBridgeVelocityData;
}

export interface RuntimeTaskData extends Record<string, unknown> {
  state?: string;
  task_type?: string | null;
  task_id?: string | null;
}

export interface RobotSummaryData extends Record<string, unknown> {
  health?: RuntimeHealthData;
  dog_bridge?: RuntimeDogBridgeData;
  lidar?: RuntimeLidarData;
  mapping?: RuntimeMapData;
  localization?: RuntimeLocalizationData;
  navigation?: RuntimeNavigationData;
  task?: RuntimeTaskData;
}

export interface RobotSummaryMessage extends BaseClientMessage {
  type: 'robot_summary';
  data: RobotSummaryData;
}

export interface NavigationStateMessage extends BaseClientMessage {
  type: 'navigation_state';
  data: RuntimeNavigationData;
}

export interface MapStateMessage extends BaseClientMessage {
  type: 'map_state';
  data: RuntimeMapData;
}

export interface TaskStateMessage extends BaseClientMessage {
  type: 'task_state';
  data: RuntimeTaskData;
}

export interface SensorStateMessage extends BaseClientMessage {
  type: 'sensor_state';
  data: Record<string, unknown>;
}

export type ClientMessage =
  | TextInputMessage
  | AudioStartMessage
  | AudioChunkMessage
  | AudioEndMessage
  | HeartbeatMessage
  | StatusMessage
  | RobotRegisterMessage
  | TTSInputMessage
  | VideoSubscribeMessage
  | VideoUnsubscribeMessage
  | VideoFrameMessage
  | AudioControlMessage
  | NavigationCommandMessage
  | MapCommandMessage
  | PatrolCommandMessage
  | ManualCommandMessage
  | ActionCommandMessage
  | SdkModeSetMessage
  | SdkModeGetMessage
  | SdkModeResponseMessage
  | NavigationResponseMessage
  | MapResponseMessage
  | PatrolResponseMessage
  | RobotSummaryMessage
  | NavigationStateMessage
  | MapStateMessage
  | TaskStateMessage
  | SensorStateMessage;

export interface SdkModeSetMessage extends BaseClientMessage {
  type: 'sdk_mode_set';
  data: {
    sdkMode?: boolean;
    mode?: number;
    requestId?: string;
  };
}

export interface SdkModeGetMessage extends BaseClientMessage {
  type: 'sdk_mode_get';
  data?: Record<string, unknown>;
}

export interface SdkModeResponseMessage extends BaseClientMessage {
  type: 'sdk_mode_response';
  data: Record<string, unknown> & {
    sdkMode?: boolean;
    mode?: number;
    result?: 'success' | 'failure';
    requestId?: string;
  };
}

// 服务端消息
export interface ServerMessage {
  type: string;
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data?: unknown;
  error?: string;
}

/**
 * 音频响应
 */
export interface AudioResponse {
  buffer: string;  // base64 编码
  format: string;
  duration?: number;
  sampleRate?: number;
}


/**
 * LLM 调用选项
 */
export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}
