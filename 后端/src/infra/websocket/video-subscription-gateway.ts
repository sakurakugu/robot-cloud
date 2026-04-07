import type { ServerMessage, WebSocket连接句柄 } from '../../shared/types';
import { logger } from '../logger';

type 可发送连接 = Pick<WebSocket连接句柄, 'send'> & object;
type Channel = 'control' | 'business' | 'audio_upload' | 'audio_download';

type 视频帧数据 = {
  frame?: string;
  format?: string;
  width?: number;
  height?: number;
  capturedAt?: number;
};

export interface 视频订阅网关依赖 {
  发送到机器人(robotId: string, message: ServerMessage, channel: Channel): boolean;
}

/**
 * 管理 UI 的视频订阅状态，并在首个订阅者出现时通知机器人开始推送。
 */
export class 视频订阅网关 {
  private readonly 订阅表 = new Map<string, Set<可发送连接>>();

  constructor(private readonly 依赖: 视频订阅网关依赖) {}

  handleSubscribe(robotId: string, ws: object | undefined, role: string | undefined): void {
    if (role !== 'ui' || !ws) {
      return;
    }

    const socket = ws as 可发送连接;
    const beforeCount = this.获取订阅数(robotId);
    const subscribers = this.获取或创建订阅集合(robotId);
    subscribers.add(socket);

    if (beforeCount === 0 && subscribers.size === 1) {
      this.通知机器人(robotId, 'video_subscribe');
    }
  }

  handleUnsubscribe(robotId: string, ws: object | undefined, role: string | undefined): void {
    if (role !== 'ui' || !ws) {
      return;
    }
    this.移除订阅(robotId, ws as 可发送连接);
  }

  handleSocketClosed(robotId: string, ws: object): void {
    this.移除订阅(robotId, ws as 可发送连接);
  }

  handleRobotConnected(robotId: string, channel: Channel): void {
    if (channel !== 'business') {
      return;
    }

    if (this.获取订阅数(robotId) > 0) {
      this.通知机器人(robotId, 'video_subscribe');
    }
  }

  handleVideoFrame(robotId: string, data: 视频帧数据): void {
    const subscribers = this.订阅表.get(robotId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const payload: ServerMessage = {
      type: 'video_frame',
      robotId,
      timestamp: Date.now(),
      data: {
        frame: data.frame || '',
        format: data.format || 'jpeg',
        width: data.width,
        height: data.height,
        capturedAt: data.capturedAt,
      },
    };

    const text = JSON.stringify(payload);
    const failedSockets: 可发送连接[] = [];

    for (const socket of subscribers) {
      try {
        socket.send(text);
      } catch (error) {
        failedSockets.push(socket);
        logger.error('发送视频帧到UI失败', error instanceof Error ? error : new Error(String(error)), { robotId });
      }
    }

    for (const socket of failedSockets) {
      this.移除订阅(robotId, socket);
    }
  }

  private 获取订阅数(robotId: string): number {
    return this.订阅表.get(robotId)?.size ?? 0;
  }

  private 获取或创建订阅集合(robotId: string): Set<可发送连接> {
    const existing = this.订阅表.get(robotId);
    if (existing) {
      return existing;
    }

    const created = new Set<可发送连接>();
    this.订阅表.set(robotId, created);
    return created;
  }

  private 移除订阅(robotId: string, socket: 可发送连接): void {
    const subscribers = this.订阅表.get(robotId);
    if (!subscribers) {
      return;
    }

    const removed = subscribers.delete(socket);
    if (!removed) {
      return;
    }

    if (subscribers.size === 0) {
      this.订阅表.delete(robotId);
      this.通知机器人(robotId, 'video_unsubscribe');
    }
  }

  private 通知机器人(robotId: string, type: 'video_subscribe' | 'video_unsubscribe'): void {
    const sent = this.依赖.发送到机器人(robotId, {
      type,
      robotId,
      timestamp: Date.now(),
      data: {},
    }, 'business');

    if (!sent) {
      logger.warn('通知机器人视频订阅状态失败', { robotId, type });
    }
  }
}
