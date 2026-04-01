import { statfs } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { 可查询数据库 } from '../../infra/db/client';
import { 获取系统运行时快照 } from './monitor';
import type {
  系统健康快照,
  系统健康组件状态,
  系统健康状态,
  系统状态详情,
} from './types';

const 状态缓存毫秒 = 2000;

interface CPU采样点 {
  idle: number;
  total: number;
}

export interface 系统状态服务依赖 {
  数据库: 可查询数据库;
  获取在线机器人数量(): number;
  获取机器人总数(): Promise<number>;
}

let 最近CPU采样点: CPU采样点 = 读取CPU采样点();
let 缓存状态详情: 系统状态详情 | null = null;
let 缓存时间戳 = 0;

function 读取CPU采样点(): CPU采样点 {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  return { idle, total };
}

function 读取CPU占用率(): number {
  const current = 读取CPU采样点();
  const totalDiff = current.total - 最近CPU采样点.total;
  const idleDiff = current.idle - 最近CPU采样点.idle;
  最近CPU采样点 = current;

  if (totalDiff <= 0) {
    return 0;
  }

  const usage = (1 - idleDiff / totalDiff) * 100;
  return Number(Math.max(0, Math.min(100, usage)).toFixed(1));
}

function 汇总健康状态(components: 系统健康组件状态[]): 系统健康状态 {
  if (components.some((item) => item.status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (components.some((item) => item.status === 'degraded')) {
    return 'degraded';
  }
  if (components.some((item) => item.status === 'healthy')) {
    return 'healthy';
  }
  return 'unknown';
}

async function 获取磁盘占用(): Promise<{
  totalGb: number;
  usedGb: number;
  percent: number;
}> {
  try {
    const rootPath = path.parse(process.cwd()).root || process.cwd();
    const result = await statfs(rootPath);
    const blockSize = Number(result.bsize || 0);
    const totalBytes = blockSize * Number(result.blocks || 0);
    const freeBytes = blockSize * Number(result.bfree || 0);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const percent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      totalGb: Number((totalBytes / (1024 ** 3)).toFixed(2)),
      usedGb: Number((usedBytes / (1024 ** 3)).toFixed(2)),
      percent: Number(percent.toFixed(1)),
    };
  } catch {
    return {
      totalGb: 0,
      usedGb: 0,
      percent: 0,
    };
  }
}

async function 检查数据库健康状态(database: 可查询数据库): Promise<系统健康组件状态> {
  try {
    await database.query('SELECT 1');
    return {
      key: 'database',
      label: '数据库',
      status: 'healthy',
      detail: '数据库连接正常',
    };
  } catch (error: any) {
    return {
      key: 'database',
      label: '数据库',
      status: 'unhealthy',
      detail: error?.message || '数据库连接失败',
    };
  }
}

function 检查WebSocket健康状态(onlineRobots: number, error?: unknown): 系统健康组件状态 {
  if (error) {
    return {
      key: 'websocket',
      label: 'WebSocket 服务',
      status: 'unhealthy',
      detail: error instanceof Error ? error.message : 'WebSocket 服务状态获取失败',
    };
  }

  return {
    key: 'websocket',
    label: 'WebSocket 服务',
    status: 'healthy',
    detail: `连接管理正常，当前在线机器人 ${onlineRobots} 台`,
  };
}

function 检查机器人连接状态(
  totalRobots: number,
  onlineRobots: number,
  error?: unknown,
): 系统健康组件状态 {
  if (error) {
    return {
      key: 'robots',
      label: '机器人连接',
      status: 'unhealthy',
      detail: error instanceof Error ? error.message : '机器人统计获取失败',
    };
  }

  if (totalRobots <= 0) {
    return {
      key: 'robots',
      label: '机器人连接',
      status: 'unknown',
      detail: '当前还没有已注册的机器人',
    };
  }

  if (onlineRobots <= 0) {
    return {
      key: 'robots',
      label: '机器人连接',
      status: 'degraded',
      detail: `共 ${totalRobots} 台机器人，当前暂无在线连接`,
    };
  }

  if (onlineRobots < totalRobots) {
    return {
      key: 'robots',
      label: '机器人连接',
      status: 'degraded',
      detail: `共 ${totalRobots} 台机器人，当前在线 ${onlineRobots} 台`,
    };
  }

  return {
    key: 'robots',
    label: '机器人连接',
    status: 'healthy',
    detail: `全部 ${totalRobots} 台机器人均在线`,
  };
}

async function 构建健康快照(input: {
  database: 可查询数据库;
  totalRobots: number;
  totalRobotsError?: unknown;
  onlineRobots: number;
  onlineRobotsError?: unknown;
}): Promise<系统健康快照> {
  const components = [
    await 检查数据库健康状态(input.database),
    检查WebSocket健康状态(input.onlineRobots, input.onlineRobotsError),
    检查机器人连接状态(input.totalRobots, input.onlineRobots, input.totalRobotsError),
  ];

  return {
    status: 汇总健康状态(components),
    checkedAt: new Date().toISOString(),
    components,
  };
}

export function 清空系统状态缓存(): void {
  缓存状态详情 = null;
  缓存时间戳 = 0;
}

export async function 获取系统状态详情(
  依赖: 系统状态服务依赖,
): Promise<系统状态详情> {
  const now = Date.now();
  if (缓存状态详情 && now - 缓存时间戳 < 状态缓存毫秒) {
    return 缓存状态详情;
  }

  let onlineRobots = 0;
  let onlineRobotsError: unknown;
  try {
    onlineRobots = 依赖.获取在线机器人数量();
  } catch (error) {
    onlineRobotsError = error;
  }

  let totalRobots = 0;
  let totalRobotsError: unknown;
  try {
    totalRobots = await 依赖.获取机器人总数();
  } catch (error) {
    totalRobotsError = error;
  }

  const memoryTotalGb = Number((os.totalmem() / (1024 ** 3)).toFixed(2));
  const memoryUsedGb = Number(((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2));
  const memoryPercent = memoryTotalGb > 0
    ? Number(((memoryUsedGb / memoryTotalGb) * 100).toFixed(1))
    : 0;
  const disk = await 获取磁盘占用();
  const health = await 构建健康快照({
    database: 依赖.数据库,
    totalRobots,
    totalRobotsError,
    onlineRobots,
    onlineRobotsError,
  });

  const snapshot: 系统状态详情 = {
    onlineRobots,
    totalRobots,
    timestamp: new Date().toISOString(),
    cpuPercent: 读取CPU占用率(),
    memoryTotalGb,
    memoryUsedGb,
    memoryPercent,
    diskTotalGb: disk.totalGb,
    diskUsedGb: disk.usedGb,
    diskPercent: disk.percent,
    uptimeSeconds: Number(os.uptime().toFixed(1)),
    health,
    runtime: 获取系统运行时快照(),
  };

  缓存状态详情 = snapshot;
  缓存时间戳 = now;
  return snapshot;
}

export async function 获取系统健康快照(
  依赖: 系统状态服务依赖,
): Promise<系统健康快照> {
  const status = await 获取系统状态详情(依赖);
  return status.health;
}
