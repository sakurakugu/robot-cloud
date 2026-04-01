import type { Request, RequestHandler, Response } from 'express';
import { Router } from 'express';
import os from 'os';
import { 发送Http错误 } from '../../shared/http/controller';
import type { 系统健康快照, 系统状态详情 } from './types';

export interface 系统路由依赖 {
  获取系统状态(): Promise<系统状态详情>;
  获取健康状态(): Promise<系统健康快照>;
}

export function createSystemRoutes(
  依赖: 系统路由依赖,
  guards?: { protectedRead?: RequestHandler }
): Router {
  const router = Router();

  /**
   * 获取系统状态
   */
  const 状态处理器 = async (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: await 依赖.获取系统状态(),
      });
    } catch (error: any) {
      发送Http错误(res, error);
    }
  };
  if (guards?.protectedRead) {
    router.get('/status', guards.protectedRead, 状态处理器);
  } else {
    router.get('/status', 状态处理器);
  }

  /**
   * 健康检查
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await 依赖.获取健康状态();
      res.json({
        success: true,
        data: {
          ...health,
          timestamp: health.checkedAt,
        },
      });
    } catch (error: any) {
      发送Http错误(res, error);
    }
  });

  /**
   * 获取本机IP
   */
  const 本机IP处理器 = (_req: Request, res: Response) => {
    try {
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];
      Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname]?.forEach((iface) => {
          if (iface.family !== 'IPv4' || iface.internal) return;
          addresses.push(iface.address);
        });
      });
      const ip = addresses[0] || '';
      res.json({ success: true, data: { ip, all: addresses } });
    } catch (error: any) {
      发送Http错误(res, error);
    }
  };
  if (guards?.protectedRead) {
    router.get('/network/local-ip', guards.protectedRead, 本机IP处理器);
  } else {
    router.get('/network/local-ip', 本机IP处理器);
  }

  return router;
}
