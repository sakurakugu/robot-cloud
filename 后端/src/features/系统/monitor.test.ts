import {
  清空系统监控事件,
  获取系统运行时快照,
  归一化请求路径,
  记录系统请求事件,
} from './monitor';

describe('系统监控服务', () => {
  beforeEach(() => {
    清空系统监控事件();
  });

  it('应将数字和 UUID 路径归一化为 :id', () => {
    expect(归一化请求路径('/api/v1/robots/123')).toBe('/api/v1/robots/:id');
    expect(归一化请求路径('/api/v1/robots/550e8400-e29b-41d4-a716-446655440000')).toBe('/api/v1/robots/:id');
  });

  it('应记录最近错误和慢请求摘要', () => {
    const baseTime = Date.now() - 3000;

    记录系统请求事件({
      method: 'get',
      path: '/api/v1/robots/123',
      statusCode: 502,
      durationMs: 1250,
      happenedAt: baseTime,
      detail: '数据库超时',
    });

    记录系统请求事件({
      method: 'get',
      path: '/api/v1/robots/456',
      statusCode: 503,
      durationMs: 1100,
      happenedAt: baseTime + 1000,
      detail: '服务不可用',
    });

    记录系统请求事件({
      method: 'post',
      path: '/api/v1/choreo/projects/99/connect',
      statusCode: 200,
      durationMs: 1400,
      happenedAt: baseTime + 2000,
      detail: null,
    });

    const snapshot = 获取系统运行时快照(5);

    expect(snapshot.errorCount).toBe(2);
    expect(snapshot.slowRequestCount).toBe(3);
    expect(snapshot.recentErrors[0].path).toBe('/api/v1/robots/456');
    expect(snapshot.topErrorRoutes[0].path).toBe('/api/v1/robots/:id');
    expect(snapshot.topErrorRoutes[0].count).toBe(2);
    expect(snapshot.topErrorRoutes[0].lastStatusCode).toBe(503);
    expect(snapshot.topSlowRoutes[0].count).toBe(2);
  });
});
