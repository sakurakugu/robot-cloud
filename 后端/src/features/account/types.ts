export type AccountRole = 'user' | 'admin' | 'super_admin';
export type RegistrationApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  nickname: string | null;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  role: AccountRole;
  approval_status: RegistrationApprovalStatus;
  approval_reviewed_at: string | null;
  approval_reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SafeUser {
  id: string;
  username: string;
  nickname: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  role: AccountRole;
  approvalStatus: RegistrationApprovalStatus;
  approvalReviewedAt: string | null;
  approvalReviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface UserListQuery {
  page?: number | string;
  page_size?: number | string;
  keyword?: string;
  role?: string;
  is_active?: string | boolean;
  approval_status?: string;
}

export interface UserListView {
  items: SafeUser[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CreateManagedUserInput {
  username: string;
  nickname?: string | null;
  email: string;
  password: string;
  role: AccountRole;
  is_active?: boolean;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface UpdateManagedUserInput {
  username: string;
  nickname?: string | null;
  email: string;
  role: AccountRole;
  is_active: boolean;
  bio?: string | null;
  avatar_url?: string | null;
}

export interface RegisterConfigView {
  registerEnabled: boolean;
  registerApprovalRequired: boolean;
}

export interface UpdateRegisterConfigInput {
  registerEnabled?: boolean;
  registerApprovalRequired?: boolean;
}

export type ClientType = 'web' | 'mobile' | 'unknown';

export interface UserSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  client_type: ClientType;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface LoginSessionView {
  id: string;
  clientType: ClientType;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface RegisterResult {
  token: string | null;
  user: SafeUser;
  session: LoginSessionView | null;
  requiresApproval: boolean;
  message: string;
}

export interface AuthContext {
  mode: 'guest' | 'authenticated';
  user: SafeUser | null;
  sessionId: string | null;
}
