/** 发布渠道 */
export type ReleaseChannel = 'stable' | 'beta';

/** 包类型 */
export type PackageType = 'full';

/** 数据库中的版本记录 */
export interface RobotPackageRecord {
  id: number;
  version_code: number;
  channel: ReleaseChannel;
  changelog: string | null;
  is_active: number; // 0 | 1
  uploaded_at: string;
  // full 整包
  full_file_name: string | null;
  full_file_size: number | null;
  full_file_hash: string | null;
}

/** 单个包文件信息 */
export interface PackageFileInfo {
  fileName: string;
  fileSize: number;
  fileHash: string;
}

/** 前端展示用的版本信息 */
export interface RobotPackageInfo {
  id: number;
  versionCode: number;
  channel: ReleaseChannel;
  changelog: string | null;
  isActive: boolean;
  uploadedAt: string;
  full: PackageFileInfo | null;
}
