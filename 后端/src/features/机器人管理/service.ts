import net from 'net';
import { v7 as uuidv7 } from 'uuid';
import 配置 from '../../infra/config';
import { logger } from '../../infra/logger';
import type {
  机器人命令服务接口,
  机器人安装包下载路径,
  机器人安装包哈希,
} from '../../infra/websocket/robot-command-gateway';
import { formatTimestamp } from '../../shared/utils/datetime';
import type { 机器人包服务 } from '../机器人包管理/service';
import type { RobotRepository } from './repository';
import type {
  CreateRobotDto,
  RobotRecord,
  RobotResponse,
  UpdateRobotDto,
  机器人视频会话,
  音频路由配置,
} from './types';
import { 视频会话租约管理器 } from './video-session-lease-manager';

const 默认音频路由配置: 音频路由配置 = {
  mode: 'robot',
  targetPhoneDeviceId: null,
  fallback: 'robot',
  updatedAt: '',
};

export interface 机器人服务依赖 {
  机器人命令服务?: 机器人命令服务接口;
  机器人包服务?: 机器人包查询服务;
}

type 机器人包查询服务 = Pick<机器人包服务, 'getActive'>;

/**
 * 机器人服务
 */
export class 机器人服务 {
  private 机器人命令服务?: 机器人命令服务接口;
  private packageService?: 机器人包查询服务;
  private readonly 视频会话租约管理器: 视频会话租约管理器;

  constructor(private repository: RobotRepository, 依赖: 机器人服务依赖 = {}) {
    this.机器人命令服务 = 依赖.机器人命令服务;
    this.packageService = 依赖.机器人包服务;
    this.视频会话租约管理器 = new 视频会话租约管理器();
  }

  /**
   * 转换数据库记录为 API 响应格式
   */
  private async 转换响应(record: RobotRecord | undefined): Promise<RobotResponse | undefined> {
    if (!record) return undefined;

    // 解析 tags JSON
    let tags: string[] = [];
    if (record.tags) {
      try {
        const parsed = JSON.parse(record.tags);
        tags = Array.isArray(parsed) ? parsed : [];
      } catch {
        tags = [];
      }
    }

    // 获取关联的角色
    let role = null;
    if (record.role_uuid) {
      role = await this.repository.getRoleById(record.role_uuid) || null;
    }

    return {
      ...record,
      tags,
      role,
    };
  }

  private 获取机器人记录(uuid: string): Promise<RobotRecord | undefined> {
    return this.repository.getRobot(uuid);
  }

  private 获取必需机器人命令服务(): 机器人命令服务接口 {
    if (!this.机器人命令服务) {
      throw new Error('机器人命令服务未初始化');
    }
    return this.机器人命令服务;
  }

  private 同步云端视频推流(robotId: string, enabled: boolean, leaseTtlMs?: number): void {
    if (!this.机器人命令服务) {
      return;
    }

    const 已发送 = this.机器人命令服务.设置云端视频推流(robotId, enabled, leaseTtlMs);
    if (!已发送) {
      logger.warn('同步云端视频推流状态失败', { robotId, enabled, leaseTtlMs });
    }
  }

  private 构建云端WHEP地址(uuid: string): string {
    const 基础地址 = (配置.media.whepBaseUrl || '/media').trim() || '/media';
    const 流路径前缀 = (配置.media.streamPathPrefix || 'robots')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
    const 标准化基础地址 = 基础地址.endsWith('/') ? 基础地址.slice(0, -1) : 基础地址;
    const 编码机器人ID = encodeURIComponent(uuid);

    return `${标准化基础地址}/${流路径前缀}/${编码机器人ID}/whep`;
  }

  /**
   * 获取所有机器人
   */
  async 获取所有机器人(): Promise<RobotResponse[]> {
    const robots = await this.repository.listRobots();
    const result = await Promise.all(robots.map((robot) => this.转换响应(robot)));
    return result.filter((robot): robot is RobotResponse => robot !== undefined);
  }

  /**
   * 获取机器人详情
   */
  async 获取机器人(uuid: string): Promise<RobotResponse | undefined> {
    return this.转换响应(await this.获取机器人记录(uuid));
  }

  /**
   * 获取所有分组
   */
  获取分组(): Promise<string[]> {
    return this.repository.listGroups();
  }

  /**
   * 创建机器人
   */
  async 创建机器人(data: CreateRobotDto): Promise<RobotResponse> {
    const ip = data.ip || null;
    const finalUuid = uuidv7();
    await this.repository.upsertRobot({
      uuid: finalUuid,
      name: data.name || null,
      model: data.model || null,
      ip: ip,
      group_name: data.group_name || null,
      sn: data.sn || null,
      tags: data.tags ? JSON.stringify(data.tags) : null, // SQLite 不支持JSON数组，存为 JSON 字符串
      status: 'offline',
      registered_at: formatTimestamp(),
    });

    const result = await this.获取机器人(finalUuid);
    if (!result) {
      throw new Error('创建机器人失败');
    }
    return result;
  }

  /**
   * 更新机器人
   */
  async 更新机器人(uuid: string, data: UpdateRobotDto): Promise<RobotResponse> {
    const existing = await this.获取机器人记录(uuid);
    if (!existing) {
      throw new Error('机器人不存在');
    }

    const 角色UUID = data.role_uuid !== undefined ? data.role_uuid : data.role_id;

    await this.repository.updateRobot(uuid, {
      name: data.name,
      model: data.model,
      ip: data.ip,
      group_name: data.group_name,
      sn: data.sn,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
      role_uuid: 角色UUID,
    });

    const result = await this.获取机器人(uuid);
    if (!result) {
      throw new Error('更新机器人失败');
    }
    return result;
  }

  /**
   * 删除机器人
   */
  删除机器人(uuid: string): Promise<void> {
    return this.repository.deleteRobot(uuid);
  }

  /**
   * 测试连接
   */
  async 测试连接(uuid: string): Promise<{ connected: boolean; message: string }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.ip) {
      throw new Error('缺少机器人IP');
    }

    const portReachable = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: robot.ip!, port: 8080 });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(false);
      });
    });

    if (portReachable) {
      return { connected: true, message: `配置端口可达: ${robot.ip}:8080` };
    }

    return { connected: false, message: `配置端口不可达: ${robot.ip}:8080` };
  }

  /**
   * 连接机器人
   */
  async 连接机器人(uuid: string): Promise<RobotResponse> {
    void uuid;
    throw new Error('云端已移除连接机器人能力，请改用电脑端处理');
  }

  /**
   * 获取机器人视频会话
   */
  async 获取视频会话(uuid: string, sessionId?: string | null): Promise<机器人视频会话> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    if (robot.status === 'online') {
      const 机器人命令服务 = this.获取必需机器人命令服务();
      const 租约 = this.视频会话租约管理器.创建或续租(uuid, sessionId);
      const 已发送 = 机器人命令服务.设置云端视频推流(uuid, true, 租约.leaseTtlMs);

      if (!已发送) {
        this.视频会话租约管理器.释放(uuid, 租约.sessionId);
        throw new Error('机器人未连接');
      }

      return {
        available: true,
        mode: 'cloud',
        source: 'cloud',
        preferredProtocol: 'whep',
        robotIp: robot.ip,
        whepUrl: this.构建云端WHEP地址(robot.uuid),
        sessionId: 租约.sessionId,
        leaseTtlMs: 租约.leaseTtlMs,
        renewIntervalMs: 租约.renewIntervalMs,
        message: '当前通过云端 MediaMTX / WHEP 按需拉流，前端会自动续租观看会话',
        expiresAt: 租约.expiresAt,
      };
    }

    return {
      available: false,
      mode: 'unavailable',
      source: 'none',
      preferredProtocol: 'none',
      robotIp: robot.ip,
      whepUrl: null,
      sessionId: null,
      leaseTtlMs: 0,
      renewIntervalMs: 0,
      message: '机器人当前离线，请等待机器人重新上线后再观看云端视频',
      expiresAt,
    };
  }

  async 释放视频会话(uuid: string, sessionId: string): Promise<void> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!sessionId.trim()) {
      throw new Error('缺少视频会话ID');
    }

    const 释放前活跃数 = this.视频会话租约管理器.获取活跃会话数(uuid);
    const 已释放 = this.视频会话租约管理器.释放(uuid, sessionId.trim());
    if (已释放 && 释放前活跃数 > 0 && this.视频会话租约管理器.获取活跃会话数(uuid) === 0) {
      this.同步云端视频推流(uuid, false);
    }
  }

  /**
   * 推送安装包到机器人：通过 WebSocket 通道告知机器人从云端 HTTP 下载安装包
   */
  async 更新固件(uuid: string, channel: string = 'stable'): Promise<{ downloaded: string[] }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!this.packageService) {
      throw new Error('机器人包服务未初始化');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    const releaseChannel = channel as 'stable' | 'beta';
    const pkgInfo = await this.packageService.getActive(releaseChannel);
    if (!pkgInfo || !pkgInfo.full) {
      throw new Error(`没有可用的安装包（channel: ${channel}），请先在包管理页面上传安装包`);
    }

    // 构建各包的下载路径和哈希（机器人收到后自行拼接HTTP基础URL）
    const downloadPaths: 机器人安装包下载路径 = {};
    const hashes: 机器人安装包哈希 = {};

    if (pkgInfo.full) {
      downloadPaths.full = `/api/v1/robot-packages/download/full?channel=${channel}`;
      hashes.full = pkgInfo.full.fileHash;
    }

    logger.info(`开始推送安装包到机器人 ${uuid}，包含: ${Object.keys(downloadPaths).join(', ')}`);

    const result = await 机器人命令服务.请求推送安装包(uuid, downloadPaths, hashes);
    if (!result.success) {
      throw new Error(result.error || '推送安装包失败');
    }

    logger.info(`安装包推送成功，已下载: ${(result.downloaded || []).join(', ')}`);
    return { downloaded: result.downloaded || [] };
  }

  async 写入日志标记(uuid: string, message: string): Promise<{ marker?: string }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      const result = await 机器人命令服务.请求日志标记(uuid, message);
      if (!result.success) {
        throw new Error(result.error || '写入日志标记失败');
      }
      return { marker: result.marker };
    } catch (error: any) {
      throw new Error(`写入日志标记失败: ${error.message}`);
    }
  }

  /**
   * 获取机器人音量（通过WebSocket）
   */
  async 获取音量(uuid: string): Promise<{ volume: number; muted: boolean }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送获取音量命令并等待响应
      const result = await 机器人命令服务.请求获取机器人音量(uuid);

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取音量失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`获取音量失败: ${error.message}`);
    }
  }

  /**
   * 设置机器人音量（通过WebSocket）
   */
  async 设置音量(uuid: string, volume: number): Promise<void> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (volume < 0 || volume > 100) {
      throw new Error('音量值必须在 0-100 之间');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送设置音量命令并等待响应
      const result = await 机器人命令服务.请求设置机器人音量(uuid, volume);

      if (!result.success) {
        throw new Error(result.error || '设置音量失败');
      }
    } catch (error: any) {
      throw new Error(`设置音量失败: ${error.message}`);
    }
  }

  /**
   * 设置机器人静音（通过WebSocket）
   */
  async 设置静音(uuid: string, mute: boolean): Promise<void> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送设置静音命令并等待响应
      const result = await 机器人命令服务.请求设置机器人静音(uuid, mute);

      if (!result.success) {
        throw new Error(result.error || '设置静音失败');
      }
    } catch (error: any) {
      throw new Error(`设置静音失败: ${error.message}`);
    }
  }

  /**
   * 拍照并获取base64图片（通过WebSocket）
   */
  async 拍照(uuid: string): Promise<{ image: string; format: string }> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送拍照命令并等待响应
      const result = await 机器人命令服务.请求机器人拍照(uuid);

      if (!result.success || !result.image) {
        throw new Error(result.error || '拍照失败');
      }

      return {
        image: result.image,
        format: result.format || 'jpeg',
      };
    } catch (error: any) {
      throw new Error(`拍照失败: ${error.message}`);
    }
  }

  /**
   * 获取机器人配置（通过WebSocket）
   */
  async 获取配置(uuid: string): Promise<any> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送获取配置命令并等待响应
      const result = await 机器人命令服务.请求获取机器人配置(uuid);

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取配置失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`获取配置失败: ${error.message}`);
    }
  }

  /**
   * 更新机器人配置（通过WebSocket）
   */
  async 更新配置(uuid: string, config: any): Promise<any> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const 机器人命令服务 = this.获取必需机器人命令服务();
    try {
      // 通过机器人命令服务发送更新配置命令并等待响应
      const result = await 机器人命令服务.请求更新机器人配置(uuid, config);

      if (!result.success) {
        throw new Error(result.error || '更新配置失败');
      }

      return result.data;
    } catch (error: any) {
      throw new Error(`更新配置失败: ${error.message}`);
    }
  }

  /**
   * 获取音频路由配置（数据库持久化）
   */
  async 获取音频路由配置(uuid: string): Promise<音频路由配置> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    if (!robot.audio_route_config) {
      return { ...默认音频路由配置, updatedAt: robot.updated_at };
    }

    try {
      const parsed = JSON.parse(robot.audio_route_config) as Partial<音频路由配置>;
      return {
        mode: parsed.mode === 'phone' || parsed.mode === 'mute' ? parsed.mode : 'robot',
        targetPhoneDeviceId: typeof parsed.targetPhoneDeviceId === 'string' && parsed.targetPhoneDeviceId.trim()
          ? parsed.targetPhoneDeviceId.trim()
          : null,
        fallback: parsed.fallback === 'drop' ? 'drop' : 'robot',
        updatedAt: parsed.updatedAt || robot.updated_at,
      };
    } catch {
      return { ...默认音频路由配置, updatedAt: robot.updated_at };
    }
  }

  /**
   * 更新音频路由配置（数据库持久化）
   */
  async 更新音频路由配置(uuid: string, input: Partial<音频路由配置>): Promise<音频路由配置> {
    const robot = await this.获取机器人记录(uuid);
    if (!robot) {
      throw new Error('机器人不存在');
    }

    const current = await this.获取音频路由配置(uuid);
    const next: 音频路由配置 = {
      mode: input.mode === 'phone' || input.mode === 'mute' || input.mode === 'robot' ? input.mode : current.mode,
      targetPhoneDeviceId: input.targetPhoneDeviceId === null
        ? null
        : (typeof input.targetPhoneDeviceId === 'string' && input.targetPhoneDeviceId.trim()
          ? input.targetPhoneDeviceId.trim()
          : current.targetPhoneDeviceId),
      fallback: input.fallback === 'drop' || input.fallback === 'robot' ? input.fallback : current.fallback,
      updatedAt: new Date().toISOString(),
    };

    if (next.mode === 'phone' && !next.targetPhoneDeviceId) {
      throw new Error('phone 模式下必须指定 targetPhoneDeviceId');
    }

    await this.repository.updateRobot(uuid, {
      audio_route_config: JSON.stringify(next),
    });

    return next;
  }
}


