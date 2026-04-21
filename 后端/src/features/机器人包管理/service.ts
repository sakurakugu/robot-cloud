import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../infra/logger';
import type { RobotPackageRepository } from './repository';
import type {
  PackageFileInfo,
  PackageType,
  ReleaseChannel,
  RobotPackageInfo,
  RobotPackageRecord,
} from './types';

/** 机器人包存储根目录 */
const PKG_DIR = path.resolve(process.cwd(), 'data', 'apps', 'robot-packages');
const 异步文件系统 = fs.promises;

async function 文件存在(filePath: string): Promise<boolean> {
  try {
    await 异步文件系统.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** 版本码转显示字符串（1002003 → "1.2.3"） */
export function versionCodeToDisplay(versionCode: number): string {
  const safe = Math.max(0, Math.floor(versionCode));
  const major = Math.floor(safe / 1_000_000);
  const minor = Math.floor((safe % 1_000_000) / 1_000);
  const patch = safe % 1_000;
  return `${major}.${minor}.${patch}`;
}

/** 语义化版本转版本码（"1.2.3" → 1002003） */
export function semverToVersionCode(version: string): number {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error('版本格式必须为 x.y.z（如 1.2.3）');
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (minor > 999 || patch > 999) {
    throw new Error('版本号的次版本和补丁号必须小于等于 999');
  }
  return major * 1_000_000 + minor * 1_000 + patch;
}

function toPackageInfo(record: RobotPackageRecord): RobotPackageInfo {
  const full: PackageFileInfo | null =
    record.full_file_name !== null && record.full_file_size !== null && record.full_file_hash !== null
      ? { fileName: record.full_file_name, fileSize: record.full_file_size, fileHash: record.full_file_hash }
      : null;

  return {
    id: record.id,
    versionCode: record.version_code,
    channel: record.channel,
    changelog: record.changelog,
    isActive: record.is_active === 1,
    uploadedAt: record.uploaded_at,
    full,
  };
}

/** 验证文件哈希，返回计算出的哈希值 */
function verifyHash(buffer: Buffer, expectedHash: string): string {
  const normalized = expectedHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('fileHash 必须是 64 位 SHA-256 十六进制字符串');
  }
  const actual = crypto.createHash('sha256').update(new Uint8Array(buffer)).digest('hex').toLowerCase();
  if (normalized !== actual) {
    throw new Error('SHA-256 校验失败：上传文件与前端摘要不一致');
  }
  return actual;
}

export interface PackageUploadItem {
  buffer: Buffer;
  size: number;
  type: PackageType;
  hash: string;
}

export class 机器人包服务 {
  private readonly 初始化目录任务: Promise<void>;

  constructor(private repository: RobotPackageRepository) {
    this.初始化目录任务 = 异步文件系统.mkdir(path.join(PKG_DIR, 'full'), { recursive: true }).then(() => undefined);
  }

  private async 确保存储目录(): Promise<void> {
    await this.初始化目录任务;
  }

  /* ------------------------------------------------------------------ */
  /*  上传包                                                             */
  /* ------------------------------------------------------------------ */

  async uploadPackages(
    items: PackageUploadItem[],
    versionCode: number,
    channel: ReleaseChannel,
    changelog?: string
  ): Promise<RobotPackageInfo> {
    await this.确保存储目录();

    if (items.length === 0) {
      throw new Error('至少需要上传一个包文件');
    }

    if (items.length !== 1 || items[0]?.type !== 'full') {
      throw new Error('当前仅支持上传单个 full 整包');
    }
    const item = items[0];
    const hash = verifyHash(item.buffer, item.hash);
    const fileName = `${channel}_${versionCode}_full_${hash.slice(0, 8)}.tar.gz`;
    const filePath = path.join(PKG_DIR, item.type, fileName);
    await 异步文件系统.writeFile(filePath, new Uint8Array(item.buffer));
    logger.info(`机器人整包已保存: ${fileName} (${item.size} bytes)`);

    const record = await this.repository.withTransaction(async (repository) => {
      await repository.deactivateChannel(channel);
      return repository.createVersion({
        version_code: versionCode,
        channel,
        changelog: changelog || null,
        is_active: 1,
        full_file_name: fileName,
        full_file_size: item.size,
        full_file_hash: hash,
      });
    });

    return toPackageInfo(record);
  }

  /* ------------------------------------------------------------------ */
  /*  版本列表                                                           */
  /* ------------------------------------------------------------------ */

  async listVersions(channel?: ReleaseChannel): Promise<RobotPackageInfo[]> {
    const records = await this.repository.listVersions(channel);
    return records.map(toPackageInfo);
  }

  /* ------------------------------------------------------------------ */
  /*  回滚                                                              */
  /* ------------------------------------------------------------------ */

  async rollback(id: number): Promise<RobotPackageInfo> {
    const record = await this.repository.getVersionById(id);

    if (!record) {
      throw new Error('版本不存在');
    }

    const updated = await this.repository.withTransaction(async (repository) => {
      await repository.deactivateChannel(record.channel);
      await repository.activateVersion(id);
      return repository.getVersionById(id);
    });

    if (!updated) {
      throw new Error('版本不存在');
    }

    return toPackageInfo(updated);
  }

  /* ------------------------------------------------------------------ */
  /*  删除版本                                                           */
  /* ------------------------------------------------------------------ */

  async deleteVersion(id: number): Promise<void> {
    await this.确保存储目录();

    const record = await this.repository.getVersionById(id);

    if (!record) {
      throw new Error('版本不存在');
    }

    // 删除物理文件
    const fileEntries: Array<{ type: PackageType; fileName: string | null }> = [
      { type: 'full', fileName: record.full_file_name },
    ];

    for (const entry of fileEntries) {
      if (!entry.fileName) continue;
      const filePath = path.join(PKG_DIR, entry.type, entry.fileName);
      if (await 文件存在(filePath)) {
        await 异步文件系统.unlink(filePath);
        logger.info(`已删除机器人包文件: ${filePath}`);
      }
    }

    await this.repository.deleteVersion(id);
    logger.info(`已删除机器人包版本记录 id=${id}`);
  }

  /* ------------------------------------------------------------------ */
  /*  获取活跃版本                                                       */
  /* ------------------------------------------------------------------ */

  async getActive(channel: ReleaseChannel = 'stable'): Promise<RobotPackageInfo | null> {
    const record = await this.repository.getActiveVersion(channel);
    return record ? toPackageInfo(record) : null;
  }

  async getPackageFilePath(
    type: PackageType,
    channel: ReleaseChannel = 'stable',
  ): Promise<string | null> {
    await this.确保存储目录();

    const info = await this.getActive(channel);
    if (!info) return null;
    const fileInfo = info[type];
    if (!fileInfo) return null;
    return path.join(PKG_DIR, type, fileInfo.fileName);
  }
}
