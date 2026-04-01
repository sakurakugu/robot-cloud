import type { RequestHandler, Response } from 'express';
import { performance } from 'node:perf_hooks';
import type { 系统请求事件, 系统请求聚合项, 系统运行时快照 } from './types';

const 最近观察窗口分钟数 = 30;
const 慢请求阈值毫秒 = 1000;
const 最大监控事件数 = 100;
const 聚合榜单上限 = 3;

type 内部请求事件 = Omit<系统请求事件, 'happenedAt'> & {
  happenedAtMs: number;
};

const 最近错误事件: 内部请求事件[] = [];
const 最近慢请求事件: 内部请求事件[] = [];

const UUID片段正则 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const 整数片段正则 = /^\d+$/;

function 归一化时间戳(value?: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function 修剪过期事件(nowMs: number): void {
  const cutoff = nowMs - 最近观察窗口分钟数 * 60 * 1000;

  while (最近错误事件.length > 0 && 最近错误事件[0].happenedAtMs < cutoff) {
    最近错误事件.shift();
  }

  while (最近慢请求事件.length > 0 && 最近慢请求事件[0].happenedAtMs < cutoff) {
    最近慢请求事件.shift();
  }
}

function 限制队列长度(target: 内部请求事件[]): void {
  while (target.length > 最大监控事件数) {
    target.shift();
  }
}

function 转换请求事件(item: 内部请求事件): 系统请求事件 {
  return {
    method: item.method,
    path: item.path,
    statusCode: item.statusCode,
    durationMs: item.durationMs,
    happenedAt: new Date(item.happenedAtMs).toISOString(),
    detail: item.detail,
  };
}

function 构建聚合项(items: 内部请求事件[]): 系统请求聚合项 {
  const 最新事件 = [...items].sort((a, b) => b.happenedAtMs - a.happenedAtMs)[0];
  const 最大耗时 = Math.max(...items.map((item) => item.durationMs));
  const 平均耗时 = items.reduce((sum, item) => sum + item.durationMs, 0) / items.length;

  return {
    method: 最新事件.method,
    path: 归一化请求路径(最新事件.path),
    count: items.length,
    lastStatusCode: 最新事件.statusCode,
    lastHappenedAt: new Date(最新事件.happenedAtMs).toISOString(),
    maxDurationMs: Number(最大耗时.toFixed(1)),
    avgDurationMs: Number(平均耗时.toFixed(1)),
    detail: 最新事件.detail,
  };
}

function 聚合事件(events: 内部请求事件[], limit: number): 系统请求聚合项[] {
  const groups = new Map<string, 内部请求事件[]>();

  for (const event of events) {
    const normalizedPath = 归一化请求路径(event.path);
    const key = `${event.method} ${normalizedPath}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(event);
      continue;
    }
    groups.set(key, [event]);
  }

  return [...groups.values()]
    .map((items) => 构建聚合项(items))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      if (a.maxDurationMs !== b.maxDurationMs) {
        return b.maxDurationMs - a.maxDurationMs;
      }
      return new Date(b.lastHappenedAt).getTime() - new Date(a.lastHappenedAt).getTime();
    })
    .slice(0, Math.max(1, limit));
}

function 截断详情(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 240) {
    return normalized;
  }
  return `${normalized.slice(0, 240)}...`;
}

function 提取响应详情(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const rawDetail = [record.error, record.message]
    .find((item) => typeof item === 'string' && item.trim().length > 0);

  if (typeof rawDetail === 'string') {
    return 截断详情(rawDetail);
  }

  if (record.details !== undefined) {
    try {
      return 截断详情(JSON.stringify(record.details));
    } catch {
      return '响应中包含不可序列化错误详情';
    }
  }

  return null;
}

export function 清空系统监控事件(): void {
  最近错误事件.length = 0;
  最近慢请求事件.length = 0;
}

export function 归一化请求路径(path: string): string {
  if (!path || path === '/') {
    return path || '/';
  }

  const normalizedSegments: string[] = [];

  for (const segment of path.split('/')) {
    if (!segment) {
      continue;
    }
    if (整数片段正则.test(segment) || UUID片段正则.test(segment)) {
      normalizedSegments.push(':id');
      continue;
    }
    normalizedSegments.push(segment);
  }

  return `/${normalizedSegments.join('/')}`;
}

export function 记录系统请求事件(input: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  happenedAt?: string | number | Date;
  detail?: string | null;
}): void {
  const happenedAtMs = 归一化时间戳(input.happenedAt);
  修剪过期事件(happenedAtMs);

  const event: 内部请求事件 = {
    method: input.method.toUpperCase(),
    path: input.path,
    statusCode: input.statusCode,
    durationMs: Number(input.durationMs.toFixed(1)),
    happenedAtMs,
    detail: input.detail ?? null,
  };

  if (event.statusCode >= 500) {
    最近错误事件.push(event);
    限制队列长度(最近错误事件);
  }

  if (event.durationMs >= 慢请求阈值毫秒) {
    最近慢请求事件.push(event);
    限制队列长度(最近慢请求事件);
  }
}

export function 获取系统运行时快照(limit: number = 5): 系统运行时快照 {
  const nowMs = Date.now();
  const normalizedLimit = Math.max(1, limit);
  修剪过期事件(nowMs);

  return {
    recentWindowMinutes: 最近观察窗口分钟数,
    slowRequestThresholdMs: 慢请求阈值毫秒,
    errorCount: 最近错误事件.length,
    slowRequestCount: 最近慢请求事件.length,
    topErrorRoutes: 聚合事件(最近错误事件, 聚合榜单上限),
    topSlowRoutes: 聚合事件(最近慢请求事件, 聚合榜单上限),
    recentErrors: [...最近错误事件]
      .slice(-normalizedLimit)
      .reverse()
      .map((item) => 转换请求事件(item)),
    recentSlowRequests: [...最近慢请求事件]
      .slice(-normalizedLimit)
      .reverse()
      .map((item) => 转换请求事件(item)),
  };
}

export function 创建系统监控中间件(): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();
    let responseDetail: string | null = null;

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const detail = 提取响应详情(body);
      if (detail) {
        responseDetail = detail;
      }
      return originalJson(body as any);
    }) as unknown as Response['json'];

    res.on('finish', () => {
      记录系统请求事件({
        method: req.method,
        path: (req.originalUrl || req.url || req.path || '/').split('?')[0] || '/',
        statusCode: res.statusCode,
        durationMs: performance.now() - startedAt,
        detail: res.statusCode >= 500 ? responseDetail : null,
      });
    });

    next();
  };
}
