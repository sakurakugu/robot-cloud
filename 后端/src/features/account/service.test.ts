import type { AccountRepository } from './repository';
import { AccountService } from './service';
import type { AccountRole, UserRecord, UserSessionRecord } from './types';
import type { SettingsRepository } from '../设置/repository';

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
    approval_status: 'approved',
    approval_reviewed_at: '2026-01-01T00:00:00.000Z',
    approval_reviewed_by: 'super-1',
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
    updateUserApproval: jest.fn(),
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

function 创建设置仓库Mock(): jest.Mocked<SettingsRepository> {
  return {
    getSetting: jest.fn(),
    getSettings: jest.fn().mockResolvedValue({}),
    getAllSettings: jest.fn(),
    setSetting: jest.fn(),
    deleteSetting: jest.fn(),
  };
}

describe('AccountService', () => {
  it('首个注册用户应成为主管理员', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    const user = 创建用户('super_admin');
    const session = 创建会话();

    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.countUsers.mockResolvedValue(0);
    repository.getUserById.mockResolvedValue(user);
    repository.getUserSessionById.mockResolvedValue(session);

    const service = new AccountService(repository, settingsRepository);
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
    expect(result.session?.id).toBe('session-1');
    expect(result.requiresApproval).toBe(false);
  });

  it('密码错误时登录应失败', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserByUsername.mockResolvedValue({
      ...创建用户(),
      password_hash: 'hash:other-password',
    });

    const service = new AccountService(repository, settingsRepository);

    await expect(
      service.login(
        { username: 'tester', password: 'secret123' },
        { clientType: 'web' },
      ),
    ).rejects.toThrow('用户名或密码错误');
  });

  it('有效 token 应返回认证上下文并刷新会话活跃时间', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserSessionByTokenHash.mockResolvedValue(创建会话());
    repository.getUserById.mockResolvedValue(创建用户());

    const service = new AccountService(repository, settingsRepository);
    const context = await service.buildUserContext('session-token');

    expect(context.mode).toBe('authenticated');
    expect(context.user?.id).toBe('user-1');
    expect(repository.touchUserSession).toHaveBeenCalledWith('session-1');
  });

  it('不能把最后一个主管理员降权', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserById.mockResolvedValue(创建用户('super_admin'));
    repository.countUsersByRole.mockResolvedValue(1);

    const service = new AccountService(repository, settingsRepository);

    await expect(
      service.updateUserRole('super_admin', 'user-1', 'admin'),
    ).rejects.toThrow('至少保留一个主管理员');
  });

  it('主管理员应可创建管理用户', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.getUserByEmail.mockResolvedValue(undefined);
    repository.getUserById.mockResolvedValue({
      ...创建用户('admin'),
      id: 'user-2',
      username: 'manager',
      email: 'manager@example.com',
    });

    const service = new AccountService(repository, settingsRepository);
    const result = await service.createManagedUser('super-1', 'super_admin', {
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
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserById.mockResolvedValue(创建用户('user'));
    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.getUserByEmail.mockResolvedValue(undefined);
    repository.countUsersByRole.mockResolvedValue(2);
    repository.getUserById.mockResolvedValueOnce(创建用户('user'));
    repository.getUserById.mockResolvedValueOnce({
      ...创建用户('user'),
      is_active: false,
    });

    const service = new AccountService(repository, settingsRepository);
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
    const settingsRepository = 创建设置仓库Mock();
    const service = new AccountService(repository, settingsRepository);

    await expect(
      service.deleteManagedUser('user-1', 'super_admin', 'user-1'),
    ).rejects.toThrow('不能删除当前登录账号');
  });

  it('开启注册审核时应创建待审核账号且不签发会话', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserByUsername.mockResolvedValue(undefined);
    repository.countUsers.mockResolvedValue(2);
    repository.getUserById.mockResolvedValue({
      ...创建用户(),
      approval_status: 'pending',
      approval_reviewed_at: null,
      approval_reviewed_by: null,
    });
    settingsRepository.getSettings.mockResolvedValue({
      'auth.register.enabled': 'true',
      'auth.register.approval_required': 'true',
    });

    const service = new AccountService(repository, settingsRepository);
    const result = await service.register(
      { username: 'tester', password: 'secret123' },
      { clientType: 'web' },
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.token).toBeNull();
    expect(result.session).toBeNull();
    expect(repository.createUserSession).not.toHaveBeenCalled();
  });

  it('待审核账号登录应失败', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserByUsername.mockResolvedValue({
      ...创建用户(),
      approval_status: 'pending',
      approval_reviewed_at: null,
      approval_reviewed_by: null,
    });

    const service = new AccountService(repository, settingsRepository);

    await expect(
      service.login(
        { username: 'tester', password: 'secret123' },
        { clientType: 'web' },
      ),
    ).rejects.toThrow('账号待审核');
  });

  it('主管理员应可更新注册配置', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    settingsRepository.getSettings.mockResolvedValue({
      'auth.register.enabled': 'false',
      'auth.register.approval_required': 'true',
    });

    const service = new AccountService(repository, settingsRepository);
    const result = await service.updateRegisterConfig('super_admin', {
      registerEnabled: false,
      registerApprovalRequired: true,
    });

    expect(settingsRepository.setSetting).toHaveBeenCalledWith('auth.register.enabled', 'false');
    expect(settingsRepository.setSetting).toHaveBeenCalledWith('auth.register.approval_required', 'true');
    expect(result).toEqual({
      registerEnabled: false,
      registerApprovalRequired: true,
    });
  });

  it('主管理员应可审核通过待审核用户', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.getUserById.mockResolvedValueOnce({
      ...创建用户(),
      approval_status: 'pending',
      approval_reviewed_at: null,
      approval_reviewed_by: null,
    });
    repository.getUserById.mockResolvedValueOnce({
      ...创建用户(),
      approval_status: 'approved',
    });

    const service = new AccountService(repository, settingsRepository);
    const result = await service.reviewUserRegistration('super-1', 'super_admin', 'user-1', 'approved');

    expect(repository.updateUserApproval).toHaveBeenCalledWith('user-1', expect.objectContaining({
      approval_status: 'approved',
      approval_reviewed_by: 'super-1',
    }));
    expect(result.approvalStatus).toBe('approved');
  });

  it('管理员查询用户列表时不应看到主管理员', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    repository.listUsers.mockResolvedValue([
      {
        ...创建用户('super_admin'),
        id: 'super-1',
        username: 'root',
      },
      {
        ...创建用户('admin'),
        id: 'admin-1',
        username: 'manager',
      },
      {
        ...创建用户('user'),
        id: 'user-2',
        username: 'member',
      },
    ]);

    const service = new AccountService(repository, settingsRepository);
    const result = await service.listManagedUsers('admin', {
      page: 1,
      page_size: 10,
    });

    expect(result.items.map((item) => item.username)).toEqual(['manager', 'member']);
  });

  it('管理员不能创建主管理员', async () => {
    const repository = 创建仓库Mock();
    const settingsRepository = 创建设置仓库Mock();
    const service = new AccountService(repository, settingsRepository);

    await expect(
      service.createManagedUser('admin-1', 'admin', {
        username: 'root2',
        email: 'root2@example.com',
        password: 'secret123',
        role: 'super_admin',
        is_active: true,
      }),
    ).rejects.toThrow('不能创建比自己权限更高的用户');
  });
});
