import { randomUUID } from 'crypto';
import { logger } from '../../infra/logger';

const 默认租约毫秒 = 30_000;
const 默认续租间隔毫秒 = 10_000;
const 默认清理间隔毫秒 = 5_000;

export interface 视频会话租约结果 {
  sessionId: string;
  expiresAt: string;
  leaseTtlMs: number;
  renewIntervalMs: number;
  activeSessionCount: number;
}

export interface 视频会话租约管理器依赖 {
  租约毫秒?: number;
  续租间隔毫秒?: number;
  清理间隔毫秒?: number;
  获取当前时间?(): number;
  状态变化通知?(robotId: string, 有活跃租约: boolean): void | Promise<void>;
}

/**
 * 管理机器人视频观看租约。
 * 使用短租约 + 定时清理，避免前端异常退出后推流长期不释放。
 */
export class 视频会话租约管理器 {
  private readonly 租约毫秒: number;
  private readonly 续租间隔毫秒: number;
  private readonly 获取当前时间: () => number;
  private readonly 状态变化通知?: (robotId: string, 有活跃租约: boolean) => void | Promise<void>;
  private readonly 租约表 = new Map<string, Map<string, number>>();
  private readonly 清理定时器: NodeJS.Timeout;

  constructor(依赖: 视频会话租约管理器依赖 = {}) {
    this.租约毫秒 = this.规范化毫秒(依赖.租约毫秒, 默认租约毫秒);
    this.续租间隔毫秒 = this.规范化毫秒(
      依赖.续租间隔毫秒,
      Math.min(默认续租间隔毫秒, Math.max(5_000, Math.floor(this.租约毫秒 / 3))),
    );
    this.获取当前时间 = 依赖.获取当前时间 ?? (() => Date.now());
    this.状态变化通知 = 依赖.状态变化通知;

    const 清理间隔毫秒 = this.规范化毫秒(
      依赖.清理间隔毫秒,
      Math.min(默认清理间隔毫秒, this.续租间隔毫秒),
    );

    this.清理定时器 = setInterval(() => {
      this.清理全部过期租约();
    }, 清理间隔毫秒);
    this.清理定时器.unref?.();
  }

  创建或续租(robotId: string, sessionId?: string | null): 视频会话租约结果 {
    const 当前时间 = this.获取当前时间();
    const 租约集合 = this.获取或创建租约集合(robotId);
    this.移除已过期租约(robotId, 租约集合, 当前时间, false);

    const 之前有活跃租约 = 租约集合.size > 0;
    const 最终会话ID = sessionId && 租约集合.has(sessionId) ? sessionId : randomUUID();
    const 到期时间戳 = 当前时间 + this.租约毫秒;
    租约集合.set(最终会话ID, 到期时间戳);
    this.租约表.set(robotId, 租约集合);

    if (!之前有活跃租约) {
      this.触发状态变化(robotId, true);
    }

    return {
      sessionId: 最终会话ID,
      expiresAt: new Date(到期时间戳).toISOString(),
      leaseTtlMs: this.租约毫秒,
      renewIntervalMs: this.续租间隔毫秒,
      activeSessionCount: 租约集合.size,
    };
  }

  释放(robotId: string, sessionId: string): boolean {
    const 当前时间 = this.获取当前时间();
    const 租约集合 = this.租约表.get(robotId);
    if (!租约集合) {
      return false;
    }

    this.移除已过期租约(robotId, 租约集合, 当前时间);
    const 之前有活跃租约 = 租约集合.size > 0;
    const 已删除 = 租约集合.delete(sessionId);
    this.处理空租约集合(robotId, 租约集合);

    if (之前有活跃租约 && 租约集合.size === 0) {
      this.触发状态变化(robotId, false);
    }

    return 已删除;
  }

  获取活跃会话数(robotId: string): number {
    const 当前时间 = this.获取当前时间();
    const 租约集合 = this.租约表.get(robotId);
    if (!租约集合) {
      return 0;
    }

    this.移除已过期租约(robotId, 租约集合, 当前时间);
    this.处理空租约集合(robotId, 租约集合);
    return 租约集合.size;
  }

  停止(): void {
    clearInterval(this.清理定时器);
  }

  private 清理全部过期租约(): void {
    const 当前时间 = this.获取当前时间();
    for (const [robotId, 租约集合] of this.租约表.entries()) {
      const 之前有活跃租约 = 租约集合.size > 0;
      this.移除已过期租约(robotId, 租约集合, 当前时间);
      this.处理空租约集合(robotId, 租约集合);
      if (之前有活跃租约 && 租约集合.size === 0) {
        this.触发状态变化(robotId, false);
      }
    }
  }

  private 获取或创建租约集合(robotId: string): Map<string, number> {
    const 现有集合 = this.租约表.get(robotId);
    if (现有集合) {
      return 现有集合;
    }

    const 新集合 = new Map<string, number>();
    this.租约表.set(robotId, 新集合);
    return 新集合;
  }

  private 移除已过期租约(
    robotId: string,
    租约集合: Map<string, number>,
    当前时间: number,
    删除空集合: boolean = true,
  ): void {
    for (const [sessionId, 到期时间戳] of 租约集合.entries()) {
      if (到期时间戳 <= 当前时间) {
        租约集合.delete(sessionId);
      }
    }

    if (删除空集合) {
      this.处理空租约集合(robotId, 租约集合);
    }
  }

  private 处理空租约集合(robotId: string, 租约集合: Map<string, number>): void {
    if (租约集合.size === 0) {
      this.租约表.delete(robotId);
    }
  }

  private 触发状态变化(robotId: string, 有活跃租约: boolean): void {
    if (!this.状态变化通知) {
      return;
    }

    Promise.resolve(this.状态变化通知(robotId, 有活跃租约)).catch((error) => {
      logger.error(
        '处理视频会话租约状态变化失败',
        error instanceof Error ? error : new Error(String(error)),
        { robotId, 有活跃租约 },
      );
    });
  }

  private 规范化毫秒(value: number | undefined, 默认值: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return 默认值;
    }
    return Math.floor(value);
  }
}
