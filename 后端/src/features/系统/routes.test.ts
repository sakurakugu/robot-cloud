import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createSystemRoutes } from './routes';
import type { 系统健康快照, 系统状态详情 } from './types';

describe('系统路由', () => {
  function 创建应用(protectedRead?: RequestHandler) {
    const health: 系统健康快照 = {
      status: 'healthy',
      checkedAt: '2026-04-01T00:00:00.000Z',
      components: [
        {
          key: 'database',
          label: '数据库',
          status: 'healthy',
          detail: '数据库连接正常',
        },
      ],
    };
    const status: 系统状态详情 = {
      onlineRobots: 1,
      totalRobots: 2,
      timestamp: '2026-04-01T00:00:00.000Z',
      cpuPercent: 12.3,
      memoryTotalGb: 32,
      memoryUsedGb: 10,
      memoryPercent: 31.3,
      diskTotalGb: 100,
      diskUsedGb: 40,
      diskPercent: 40,
      uptimeSeconds: 3600,
      health,
      runtime: {
        recentWindowMinutes: 30,
        slowRequestThresholdMs: 1000,
        errorCount: 0,
        slowRequestCount: 0,
        topErrorRoutes: [],
        topSlowRoutes: [],
        recentErrors: [],
        recentSlowRequests: [],
      },
    };
    const 依赖 = {
      获取系统状态: jest.fn(async () => status),
      获取健康状态: jest.fn(async () => health),
    };

    const app = express();
    app.use(createSystemRoutes(依赖, { protectedRead }));
    return app;
  }

  it('health 接口应返回 healthy', async () => {
    const app = 创建应用();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(typeof response.body.data.timestamp).toBe('string');
    expect(response.body.data.components).toHaveLength(1);
  });

  it('status 接口应返回完整系统状态', async () => {
    const app = 创建应用();

    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.onlineRobots).toBe(1);
    expect(response.body.data.totalRobots).toBe(2);
    expect(response.body.data.health.status).toBe('healthy');
    expect(response.body.data.runtime.errorCount).toBe(0);
  });

  it('带保护中间件时应先经过鉴权', async () => {
    const protectedRead: RequestHandler = (req, res, next) => {
      if (req.headers.authorization === 'Bearer ok') {
        next();
        return;
      }
      res.status(401).json({ success: false, error: '未授权' });
    };

    const app = 创建应用(protectedRead);

    const unauthorized = await request(app).get('/status');
    const authorized = await request(app)
      .get('/status')
      .set('Authorization', 'Bearer ok');

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(authorized.body.data.totalRobots).toBe(2);
  });
});
