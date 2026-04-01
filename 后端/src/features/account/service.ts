import { v7 as uuidv7 } from 'uuid';
import { logger } from '../../infra/logger';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './password';
import type { AccountRepository } from './repository';
import type {
  AccountRole,
  AuthContext,
  ClientType,
  CreateManagedUserInput,
  LoginSessionView,
  SafeUser,
  UpdateManagedUserInput,
  UserListQuery,
  UserListView,
  UserRecord,
  UserSessionRecord,
} from './types';

const SESSION_EXPIRE_DAYS = 30;

type PostgresError = Error & {
  code?: string;
};

type RegisterInput = {
  username: string;
  password: string;
};

type LoginInput = RegisterInput;

type LoginMeta = {
  clientType: ClientType;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
};

const 邮箱正则 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const 列表默认页码 = 1;
const 列表默认每页数量 = 10;
const 列表最大每页数量 = 100;

export class AccountService {
  constructor(private repository: AccountRepository) {}

  private toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      isActive: user.is_active,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  }

  private 规范化可空文本(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private 规范化邮箱(email: string): string {
    return email.trim().toLowerCase();
  }

  private 生成默认邮箱(username: string): string {
    return `${username}@local.invalid`;
  }

  private 断言邮箱合法(email: string): void {
    if (!邮箱正则.test(email)) {
      throw new Error('邮箱格式无效');
    }
  }

  private 断言角色合法(role: string): asserts role is AccountRole {
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      throw new Error('角色无效');
    }
  }

  private validateCredentials(username: string, password: string): void {
    if (!username || username.trim().length < 3) {
      throw new Error('用户名至少 3 位');
    }
    if (!password || password.length < 6) {
      throw new Error('密码至少 6 位');
    }
  }

  private 验证用户名(username: string): void {
    if (!username || username.trim().length < 3) {
      throw new Error('用户名至少 3 位');
    }
  }

  private 验证管理密码(password: string): void {
    if (!password || password.length < 6) {
      throw new Error('密码至少 6 位');
    }
  }

  private 规范化分页参数(query: UserListQuery): { page: number; pageSize: number } {
    const page = Math.max(列表默认页码, Number.parseInt(String(query.page || 列表默认页码), 10) || 列表默认页码);
    const pageSize = Math.min(
      列表最大每页数量,
      Math.max(1, Number.parseInt(String(query.page_size || 列表默认每页数量), 10) || 列表默认每页数量),
    );
    return { page, pageSize };
  }

  private 解析启用状态筛选(value: UserListQuery['is_active']): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
    return null;
  }

  private async 断言用户名可用(
    repository: AccountRepository,
    username: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await repository.getUserByUsername(username);
    if (existing && existing.id !== excludeUserId) {
      throw new Error('用户名已存在');
    }
  }

  private async 断言邮箱可用(
    repository: AccountRepository,
    email: string,
    excludeUserId?: string,
  ): Promise<void> {
    const existing = await repository.getUserByEmail(email);
    if (existing && existing.id !== excludeUserId) {
      throw new Error('邮箱已存在');
    }
  }

  private buildSessionView(session: UserSessionRecord, currentSessionId: string | null): LoginSessionView {
    return {
      id: session.id,
      clientType: session.client_type,
      deviceName: session.device_name || '未知设备',
      ipAddress: session.ip_address || '-',
      userAgent: session.user_agent || '-',
      createdAt: session.created_at,
      lastSeenAt: session.last_seen_at,
      expiresAt: session.expires_at,
      current: !!currentSessionId && currentSessionId === session.id,
    };
  }

  private async createUserSession(
    repository: AccountRepository,
    userId: string,
    meta: LoginMeta,
  ): Promise<{ token: string; session: UserSessionRecord }> {
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const sessionId = uuidv7();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await repository.createUserSession({
      id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      client_type: meta.clientType,
      device_name: meta.deviceName || null,
      ip_address: meta.ipAddress || null,
      user_agent: meta.userAgent || null,
      expires_at: expiresAt,
    });

    const session = await repository.getUserSessionById(sessionId);
    if (!session) {
      throw new Error('创建会话失败');
    }

    return { token, session };
  }

  async register(input: RegisterInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    try {
      return await this.repository.withTransaction(async (repository) => {
        await repository.lockUsersTable();

        const existing = await repository.getUserByUsername(username);
        if (existing) {
          throw new Error('用户名已存在');
        }

        const isFirstUser = (await repository.countUsers()) === 0;
        const role: AccountRole = isFirstUser ? 'super_admin' : 'user';
        const userId = uuidv7();
        const passwordHash = hashPassword(input.password);

        await repository.createUser({
          id: userId,
          username,
          password_hash: passwordHash,
          nickname: null,
          email: this.生成默认邮箱(username),
          avatar_url: null,
          bio: null,
          is_active: true,
          role,
        });

        const createdUser = await repository.getUserById(userId);
        if (!createdUser) {
          throw new Error('创建用户失败');
        }

        const { token, session } = await this.createUserSession(repository, userId, meta);
        await repository.touchUserLogin(userId);

        logger.info('用户注册成功', { username, role, userId });

        return {
          token,
          user: this.toSafeUser(createdUser),
          session: this.buildSessionView(session, session.id),
        };
      });
    } catch (error) {
      if ((error as PostgresError).code === '23505') {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  }

  async login(input: LoginInput, meta: LoginMeta) {
    const username = input.username.trim();
    this.validateCredentials(username, input.password);

    const user = await this.repository.getUserByUsername(username);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw new Error('用户名或密码错误');
    }
    if (!user.is_active) {
      throw new Error('账号已禁用');
    }

    const { token, session } = await this.createUserSession(this.repository, user.id, meta);
    await this.repository.touchUserLogin(user.id);

    logger.info('用户登录成功', { username: user.username, userId: user.id });

    return {
      token,
      user: this.toSafeUser({ ...user, last_login_at: new Date().toISOString() }),
      session: this.buildSessionView(session, session.id),
    };
  }

  async authenticateByToken(token: string): Promise<{ user: SafeUser; sessionId: string } | null> {
    const normalized = token.trim();
    if (!normalized) {
      return null;
    }

    const tokenHash = hashSessionToken(normalized);
    const session = await this.repository.getUserSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    const now = new Date();
    if (session.revoked_at || new Date(session.expires_at) <= now) {
      return null;
    }

    const user = await this.repository.getUserById(session.user_id);
    if (!user || !user.is_active) {
      return null;
    }

    await this.repository.touchUserSession(session.id);
    return {
      user: this.toSafeUser(user),
      sessionId: session.id,
    };
  }

  buildGuestContext(): AuthContext {
    return {
      mode: 'guest',
      user: null,
      sessionId: null,
    };
  }

  async buildUserContext(token: string | null | undefined): Promise<AuthContext> {
    if (!token) {
      return this.buildGuestContext();
    }

    const auth = await this.authenticateByToken(token);
    if (!auth) {
      return this.buildGuestContext();
    }

    return {
      mode: 'authenticated',
      user: auth.user,
      sessionId: auth.sessionId,
    };
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    return this.toSafeUser(user);
  }

  async listMySessions(userId: string, currentSessionId: string | null): Promise<LoginSessionView[]> {
    const sessions = await this.repository.listUserSessions(userId);
    return sessions.map((session) => this.buildSessionView(session, currentSessionId));
  }

  async revokeMySession(userId: string, sessionId: string): Promise<void> {
    const session = await this.repository.getUserSessionById(sessionId);
    if (!session || session.user_id !== userId) {
      throw new Error('会话不存在');
    }
    await this.repository.revokeUserSession(sessionId);
  }

  async logoutCurrent(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }
    await this.repository.revokeUserSession(sessionId);
  }

  async listUsers(): Promise<SafeUser[]> {
    return (await this.repository.listUsers()).map((user) => this.toSafeUser(user));
  }

  async listManagedUsers(query: UserListQuery): Promise<UserListView> {
    const { page, pageSize } = this.规范化分页参数(query);
    const keyword = String(query.keyword || '').trim().toLowerCase();
    const role = String(query.role || '').trim();
    const isActive = this.解析启用状态筛选(query.is_active);

    const filteredUsers = (await this.repository.listUsers())
      .filter((user) => {
        if (role && user.role !== role) {
          return false;
        }
        if (isActive !== null && user.is_active !== isActive) {
          return false;
        }
        if (!keyword) {
          return true;
        }

        return [
          user.username,
          user.nickname || '',
          user.email,
          user.bio || '',
        ].some((value) => value.toLowerCase().includes(keyword));
      })
      .sort((a, b) => {
        if (a.created_at === b.created_at) {
          return a.username.localeCompare(b.username);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    const total = filteredUsers.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * pageSize;
    const items = filteredUsers.slice(start, start + pageSize).map((user) => this.toSafeUser(user));

    return {
      items,
      total,
      page: safePage,
      page_size: pageSize,
      pages,
    };
  }

  async createManagedUser(operatorRole: AccountRole, input: CreateManagedUserInput): Promise<SafeUser> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可创建用户');
    }

    const username = input.username.trim();
    const email = this.规范化邮箱(input.email);
    this.断言角色合法(String(input.role || ''));
    this.验证用户名(username);
    this.验证管理密码(input.password);
    this.断言邮箱合法(email);

    return this.repository.withTransaction(async (repository) => {
      await repository.lockUsersTable();
      await this.断言用户名可用(repository, username);
      await this.断言邮箱可用(repository, email);

      const userId = uuidv7();
      await repository.createUser({
        id: userId,
        username,
        password_hash: hashPassword(input.password),
        nickname: this.规范化可空文本(input.nickname),
        email,
        avatar_url: this.规范化可空文本(input.avatar_url),
        bio: this.规范化可空文本(input.bio),
        is_active: input.is_active !== false,
        role: input.role,
      });

      const created = await repository.getUserById(userId);
      if (!created) {
        throw new Error('创建用户失败');
      }

      logger.info('管理员创建用户成功', {
        userId,
        username,
        role: input.role,
      });

      return this.toSafeUser(created);
    });
  }

  async updateManagedUser(
    operatorUserId: string,
    operatorRole: AccountRole,
    userId: string,
    input: UpdateManagedUserInput,
  ): Promise<SafeUser> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可编辑用户');
    }

    const username = input.username.trim();
    const email = this.规范化邮箱(input.email);
    this.断言角色合法(String(input.role || ''));
    this.验证用户名(username);
    this.断言邮箱合法(email);

    return this.repository.withTransaction(async (repository) => {
      await repository.lockUsersTable();

      const user = await repository.getUserById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.id === operatorUserId && user.role !== input.role) {
        throw new Error('当前账号不能在此修改自己的角色');
      }

      if (user.id === operatorUserId && input.is_active === false) {
        throw new Error('当前账号不能禁用自己');
      }

      if (user.role === 'super_admin' && input.role !== 'super_admin') {
        const superAdminCount = await repository.countUsersByRole('super_admin');
        if (superAdminCount <= 1) {
          throw new Error('至少保留一个主管理员');
        }
      }

      if (user.role === 'super_admin' && input.is_active === false) {
        const superAdminCount = await repository.countUsersByRole('super_admin');
        if (superAdminCount <= 1) {
          throw new Error('至少保留一个主管理员');
        }
      }

      await this.断言用户名可用(repository, username, userId);
      await this.断言邮箱可用(repository, email, userId);

      await repository.updateUser(userId, {
        username,
        nickname: this.规范化可空文本(input.nickname),
        email,
        role: input.role,
        is_active: input.is_active,
        bio: this.规范化可空文本(input.bio),
        avatar_url: this.规范化可空文本(input.avatar_url),
      });

      if (input.is_active === false) {
        await repository.revokeUserSessionsByUserId(userId);
      }

      const updated = await repository.getUserById(userId);
      if (!updated) {
        throw new Error('更新失败');
      }
      return this.toSafeUser(updated);
    });
  }

  async resetUserPassword(
    operatorRole: AccountRole,
    userId: string,
    password: string,
  ): Promise<void> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可重置密码');
    }

    this.验证管理密码(password);
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    await this.repository.updateUserPassword(userId, hashPassword(password));
    await this.repository.revokeUserSessionsByUserId(userId);
  }

  async deleteManagedUser(
    operatorUserId: string,
    operatorRole: AccountRole,
    userId: string,
  ): Promise<void> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可删除用户');
    }

    if (operatorUserId === userId) {
      throw new Error('不能删除当前登录账号');
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.lockUsersTable();

      const user = await repository.getUserById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.role === 'super_admin') {
        const superAdminCount = await repository.countUsersByRole('super_admin');
        if (superAdminCount <= 1) {
          throw new Error('至少保留一个主管理员');
        }
      }

      await repository.deleteUser(userId);
    });
  }

  async updateUserRole(operatorRole: AccountRole, userId: string, role: AccountRole): Promise<SafeUser> {
    if (operatorRole !== 'super_admin') {
      throw new Error('仅主管理员可修改用户权限');
    }

    return this.repository.withTransaction(async (repository) => {
      await repository.lockUsersTable();

      const user = await repository.getUserById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      if (user.role === 'super_admin' && role !== 'super_admin') {
        const superAdminCount = await repository.countUsersByRole('super_admin');
        if (superAdminCount <= 1) {
          throw new Error('至少保留一个主管理员');
        }
      }

      await repository.updateUserRole(userId, role);
      const updated = await repository.getUserById(userId);
      if (!updated) {
        throw new Error('更新失败');
      }
      return this.toSafeUser(updated);
    });
  }
}
