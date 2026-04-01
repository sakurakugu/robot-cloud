export type 系统健康状态 = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface 系统健康组件状态 {
  key: string;
  label: string;
  status: 系统健康状态;
  detail: string | null;
}

export interface 系统健康快照 {
  status: 系统健康状态;
  checkedAt: string;
  components: 系统健康组件状态[];
}

export interface 系统请求事件 {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  happenedAt: string;
  detail: string | null;
}

export interface 系统请求聚合项 {
  method: string;
  path: string;
  count: number;
  lastStatusCode: number;
  lastHappenedAt: string;
  maxDurationMs: number;
  avgDurationMs: number;
  detail: string | null;
}

export interface 系统运行时快照 {
  recentWindowMinutes: number;
  slowRequestThresholdMs: number;
  errorCount: number;
  slowRequestCount: number;
  topErrorRoutes: 系统请求聚合项[];
  topSlowRoutes: 系统请求聚合项[];
  recentErrors: 系统请求事件[];
  recentSlowRequests: 系统请求事件[];
}

export interface 系统状态详情 {
  onlineRobots: number;
  totalRobots: number;
  timestamp: string;
  cpuPercent: number;
  memoryTotalGb: number;
  memoryUsedGb: number;
  memoryPercent: number;
  diskTotalGb: number;
  diskUsedGb: number;
  diskPercent: number;
  uptimeSeconds: number;
  health: 系统健康快照;
  runtime: 系统运行时快照;
}
