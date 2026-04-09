import type { RobotRecord } from '../../features/机器人管理/types';
import type { RobotConnection } from '../../shared/types';
import { WebSocket机器人运行网关 } from './robot-runtime-gateway';

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../shared/utils/helpers', () => ({
  uuidv7: jest.fn(() => 'generated-request-id'),
}));

function 创建机器人记录(partial: Partial<RobotRecord> = {}): RobotRecord {
  return {
    uuid: 'robot-1',
    name: '一号狗',
    model: 'spark-mini',
    version: '1.0.0',
    motion_control_version: '2.0.0',
    server_version: '3.0.0',
    ip: '192.168.1.10',
    group_name: '默认组',
    tags: null,
    sn: 'SN-001',
    role_uuid: null,
    audio_route_config: null,
    status: 'offline',
    last_connected_at: null,
    registered_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建业务连接(): RobotConnection {
  return {
    robotId: 'robot-1',
    websocket: {
      send: jest.fn(),
      close: jest.fn(),
    },
    connectedAt: new Date(),
    lastActiveAt: new Date(),
    channel: 'business',
    metadata: {},
  };
}

function 创建依赖() {
  return {
    获取机器人记录: jest.fn().mockResolvedValue(创建机器人记录()),
    更新机器人记录: jest.fn().mockResolvedValue(undefined),
    新增或更新机器人记录: jest.fn().mockResolvedValue(undefined),
    获取业务连接: jest.fn().mockReturnValue(undefined),
    发送到机器人: jest.fn().mockReturnValue(true),
    发送到UI: jest.fn(),
    发送错误: jest.fn(),
  };
}

describe('WebSocket机器人运行网关', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('同步机器人在线状态时应优先更新已有记录', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket机器人运行网关(依赖 as any);

    await 网关.同步机器人在线状态('robot-1');

    expect(依赖.更新机器人记录).toHaveBeenCalledWith('robot-1', { status: 'online' });
    expect(依赖.新增或更新机器人记录).not.toHaveBeenCalled();
  });

  it('处理状态更新时应向控制通道广播电量与完整状态', () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket机器人运行网关(依赖 as any);

    网关.handleStatus('robot-1', {
      robotId: 'robot-1',
      data: {
        battery: '87.6',
        pose: 'stand',
      },
    });

    expect(依赖.发送到UI).toHaveBeenNthCalledWith(1, 'robot-1', expect.objectContaining({
      type: 'battery_status',
      data: {
        level: 88,
      },
    }), 'business');
    expect(依赖.发送到UI).toHaveBeenNthCalledWith(2, 'robot-1', expect.objectContaining({
      type: 'status_update',
      data: {
        battery: '87.6',
        pose: 'stand',
      },
    }), 'business');
  });

  it('处理运行时摘要时应广播 robot_summary 并同步电量', () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket机器人运行网关(依赖 as any);

    网关.handleRobotSummary('robot-1', {
      health: {
        battery: 66,
        sdk_mode: true,
      },
      mapping: {
        state: 'idle',
      },
      dog_bridge: {
        arbitration_reason: 'normal',
        emergency_stop: false,
        output_velocity: {
          vx: 0.1,
          vy: 0,
          wz: 0,
        },
      },
    });

    expect(依赖.发送到UI).toHaveBeenNthCalledWith(1, 'robot-1', expect.objectContaining({
      type: 'battery_status',
      data: {
        level: 66,
      },
    }), 'business');
    expect(依赖.发送到UI).toHaveBeenNthCalledWith(2, 'robot-1', expect.objectContaining({
      type: 'robot_summary',
      data: expect.objectContaining({
        health: expect.objectContaining({
          battery: 66,
        }),
        dog_bridge: expect.objectContaining({
          arbitration_reason: 'normal',
          output_velocity: expect.objectContaining({
            vx: 0.1,
          }),
        }),
      }),
    }), 'business');
  });

  it('处理导航命令时应补 requestId 并转发到机器人', async () => {
    const 依赖 = 创建依赖();
    const 网关 = new WebSocket机器人运行网关(依赖 as any);

    await 网关.handleNavigationCommand('robot-1', {
      command: 'navigate_to',
      goal: {
        x: 1,
        y: 2,
        yaw: 0,
      },
    });

    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'navigation_command',
      data: expect.objectContaining({
        command: 'navigate_to',
        requestId: expect.any(String),
      }),
    }), 'business');
  });

  it('处理机器人注册时应写库并刷新业务连接元数据', async () => {
    const 依赖 = 创建依赖();
    const 业务连接 = 创建业务连接();
    依赖.获取业务连接.mockReturnValue(业务连接);
    const 网关 = new WebSocket机器人运行网关(依赖 as any);

    await 网关.handleRobotRegister('robot-1', {
      name: '新名字',
      metadata: {
        motion_control_version: '2.1.0',
        robot_server_version: '3.1.0',
      },
    });

    expect(依赖.新增或更新机器人记录).toHaveBeenCalledWith(expect.objectContaining({
      uuid: 'robot-1',
      name: '新名字',
      model: 'spark-mini',
      version: '1.0.0',
      motion_control_version: '2.1.0',
      server_version: '3.1.0',
      status: 'online',
    }));
    expect(业务连接.metadata).toEqual({
      name: '新名字',
      model: undefined,
      version: undefined,
      motion_control_version: '2.1.0',
      robot_server_version: '3.1.0',
    });
    expect(依赖.发送到机器人).toHaveBeenCalledWith('robot-1', expect.objectContaining({
      type: 'text_response',
      data: {
        text: '客户端注册成功！欢迎 新名字',
      },
    }), 'business');
  });
});
