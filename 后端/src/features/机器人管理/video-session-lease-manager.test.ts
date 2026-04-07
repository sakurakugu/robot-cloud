import { 视频会话租约管理器 } from './video-session-lease-manager';

describe('视频会话租约管理器', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('租约过期后应通知机器人停止推流', async () => {
    const 状态变化通知 = jest.fn();
    const 管理器 = new 视频会话租约管理器({
      租约毫秒: 1_000,
      续租间隔毫秒: 300,
      清理间隔毫秒: 100,
      状态变化通知,
    });

    const 结果 = 管理器.创建或续租('robot-1');

    expect(结果.sessionId).toBeTruthy();
    expect(状态变化通知).toHaveBeenNthCalledWith(1, 'robot-1', true);
    expect(管理器.获取活跃会话数('robot-1')).toBe(1);

    await jest.advanceTimersByTimeAsync(1_100);

    expect(管理器.获取活跃会话数('robot-1')).toBe(0);
    expect(状态变化通知).toHaveBeenNthCalledWith(2, 'robot-1', false);

    管理器.停止();
  });
});
