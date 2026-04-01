import type { AccountRepository } from './repository';
import { AccountService } from './service';
import type { AccountRole, UserRecord, UserSessionRecord } from './types';

jest.mock('uuid', () => ({
  v7: jest.fn(() => 'user-1'),
}));

jest.mock('./password', () => ({
  createSessionToken: jest.fn(() => 'session-token'),
  hashPassword: jest.fn((password: string) => `hash:${password}`),
  hashSessionToken: jest.fn((token: string) => `token-hash:${token}`),
  verifyPassword: jest.fn((password: string, hash: string) => hash === `hash:${password}`),
}));

function 创建用户(role: AccountRole = 'user'): UserRecord {
  return {
    id: 'user-1',
    username: 'tester',
    password_hash: 'hash:secret123',
    nickname: '测试用户',
    email: 'tester@local.invalid',
    avatar_url: null,
    bio: null,
    is_active: true,
    role,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_login_at: null,
  };
}

function 创建会话(): UserSessionRecord {
  return {
    id: 'session-1',
    user_id: 'user-1',
    token_hash: 'token-hash:session-token',
    client_type: 'web',
    device_name: 'Chrome',
    ip_address: '127.0.0.1',
    user_agent: 'jest',
    created_at: '2026-01-01T00:00:00.000Z',
    last_seen_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
  };
}

function 创建仓库Mock(): jest.Mocked<AccountRepository> {
  const repository: jest.Mocked<AccountRepository> = {
    withTransaction: jest.fn(),
    lockUsersTable: jest.fn(),
    countUsers: jest.fn(),
    countUsersByRole: jest.fn(),
    createUser: jest.fn(),
    getUserById: jest.fn(),
    getUserByUsername: jest.fn(),
    getUserByEmail: jest.fn(),
    listUsers: jest.fn(),
    touchUserLogin: jest.fn(),
    updateUserRole: jest.fn(),
    updateUser: jest.fn(),
    updateUserPassword: jest.fn(),
    deleteUser: jest.fn(),
    createUserSession: jest.fn(),
    getUserSessionById: jest.fn(),
    getUserSessionByTokenHash: jest.fn(),
    listUserSessions: jest.fn(),
    touchUserSession: jest.fn(),
    revokeUserSession: jest.fn(),
    revokeUserSessionsByUserId: jest.fn(),
  };

  repository.withTransaction.mockImplementation(async (callback) => callback(repository));

  return repository;
}

describe('AccountService', () => {
  it('首个注册用户应成为主管理员', async () => {
    const repository = 创建仓库Mock();
    const user = 创建用户('super_admin');
    const session = 创建会话();

    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.countUsers.mockResolvedValue(0);
    repository.getUserById.mockResolvedValue(user);
    repository.getUserSessionById.mockResolvedValue(session);

    const service = new AccountService(repository);
    const result = await service.register(
      { username: 'tester', password: 'secret123' },
      { clientType: 'web', deviceName: 'Chrome', ipAddress: '127.0.0.1', userAgent: 'jest' },
    );

    expect(repository.lockUsersTable).toHaveBeenCalled();
    expect(repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'tester',
        role: 'super_admin',
        password_hash: 'hash:secret123',
        email: 'tester@local.invalid',
      }),
    );
    expect(result.token).toBe('session-token');
    expect(result.user.role).toBe('super_admin');
    expect(result.session.id).toBe('session-1');
  });

  it('密码错误时登录应失败', async () => {
    const repository = 创建仓库Mock();
    repository.getUserByUsername.mockResolvedValue({
      ...创建用户(),
      password_hash: 'hash:other-password',
    });

    const service = new AccountService(repository);

    await expect(
      service.login(
        { username: 'tester', password: 'secret123' },
        { clientType: 'web' },
      ),
    ).rejects.toThrow('用户名或密码错误');
  });

  it('有效 token 应返回认证上下文并刷新会话活跃时间', async () => {
    const repository = 创建仓库Mock();
    repository.getUserSessionByTokenHash.mockResolvedValue(创建会话());
    repository.getUserById.mockResolvedValue(创建用户());

    const service = new AccountService(repository);
    const context = await service.buildUserContext('session-token');

    expect(context.mode).toBe('authenticated');
    expect(context.user?.id).toBe('user-1');
    expect(repository.touchUserSession).toHaveBeenCalledWith('session-1');
  });

  it('不能把最后一个主管理员降权', async () => {
    const repository = 创建仓库Mock();
    repository.getUserById.mockResolvedValue(创建用户('super_admin'));
    repository.countUsersByRole.mockResolvedValue(1);

    const service = new AccountService(repository);

    await expect(
      service.updateUserRole('super_admin', 'user-1', 'admin'),
    ).rejects.toThrow('至少保留一个主管理员');
  });

  it('主管理员应可创建管理用户', async () => {
    const repository = 创建仓库Mock();
    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.getUserByEmail.mockResolvedValue(undefined);
    repository.getUserById.mockResolvedValue({
      ...创建用户('admin'),
      id: 'user-2',
      username: 'manager',
      email: 'manager@example.com',
    });

    const service = new AccountService(repository);
    const result = await service.createManagedUser('super_admin', {
      username: 'manager',
      email: 'manager@example.com',
      password: 'secret123',
      role: 'admin',
      is_active: true,
    });

    expect(repository.createUser).toHaveBeenCalledWith(expect.objectContaining({
      username: 'manager',
      email: 'manager@example.com',
      role: 'admin',
      is_active: true,
    }));
    expect(result.email).toBe('manager@example.com');
  });

  it('禁用用户时应撤销其会话', async () => {
    const repository = 创建仓库Mock();
    repository.getUserById.mockResolvedValue(创建用户('user'));
    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.getUserByEmail.mockResolvedValue(undefined);
    repository.countUsersByRole.mockResolvedValue(2);
    repository.getUserById.mockResolvedValueOnce(创建用户('user'));
    repository.getUserById.mockResolvedValueOnce({
      ...创建用户('user'),
      is_active: false,
    });

    const service = new AccountService(repository);
    await service.updateManagedUser('super-1', 'super_admin', 'user-1', {
      username: 'tester',
      nickname: '测试用户',
      email: 'tester@local.invalid',
      role: 'user',
      is_active: false,
      bio: null,
      avatar_url: null,
    });

    expect(repository.revokeUserSessionsByUserId).toHaveBeenCalledWith('user-1');
  });

  it('不能删除当前登录账号', async () => {
    const repository = 创建仓库Mock();
    const service = new AccountService(repository);

    await expect(
      service.deleteManagedUser('user-1', 'super_admin', 'user-1'),
    ).rejects.toThrow('不能删除当前登录账号');
  });
});
