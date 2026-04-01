import type { Request } from 'express';
import {
  处理控制器,
  返回数据,
} from '../../shared/http/controller';
import {
  Http错误工厂,
  type Http错误映射规则,
} from '../../shared/http/errors';
import type { AccountService } from './service';
import type { AccountRole, ClientType } from './types';

const 账号权限错误映射: Http错误映射规则[] = [
  { 匹配: '不存在', 状态码: 404 },
  { 匹配: [/权限/, /禁止/, /无权/, /更高的用户/, /更高的角色/, /管理员可管理用户/], 状态码: 403 },
];

const 注册错误映射: Http错误映射规则[] = [
  { 匹配: '用户名已存在', 状态码: 409 },
  { 匹配: '注册已关闭', 状态码: 403 },
];

const 登录错误映射: Http错误映射规则[] = [
  { 匹配: '用户名或密码错误', 状态码: 401 },
  { 匹配: [/待审核/, /已拒绝/, /已禁用/], 状态码: 403 },
];

function resolveClientType(req: Request): ClientType {
  const value = String(req.headers['x-client-type'] || '').toLowerCase();
  if (value === 'web' || value === 'mobile') {
    return value;
  }
  return 'unknown';
}

function resolveDeviceName(req: Request): string {
  const value = String(req.headers['x-device-name'] || '').trim();
  return value || 'Unknown Device';
}

function resolveUserAgent(req: Request): string {
  const header = req.headers['user-agent'];
  if (Array.isArray(header)) {
    return header[0] || '';
  }
  return header || '';
}

function resolveToken(req: Request): string | null {
  const authHeader = String(req.headers.authorization || '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function resolveParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function resolveQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export class AccountController {
  constructor(private accountService: AccountService) {}

  private 获取当前用户(req: Request) {
    if (!req.authContext || req.authContext.mode !== 'authenticated' || !req.authContext.user) {
      throw Http错误工厂.未授权('未登录');
    }
    return req.authContext.user;
  }

  register = 处理控制器(async (req: Request) => 返回数据(
    await this.accountService.register(req.body || {}, {
      clientType: resolveClientType(req),
      deviceName: resolveDeviceName(req),
      ipAddress: req.ip,
      userAgent: resolveUserAgent(req),
    }),
    { 状态码: 201 },
  ), {
    默认错误状态码: 400,
    错误映射: 注册错误映射,
  });

  login = 处理控制器(async (req: Request) => 返回数据(
    await this.accountService.login(req.body || {}, {
      clientType: resolveClientType(req),
      deviceName: resolveDeviceName(req),
      ipAddress: req.ip,
      userAgent: resolveUserAgent(req),
    }),
  ), {
    默认错误状态码: 400,
    错误映射: 登录错误映射,
  });

  getRegisterConfig = 处理控制器(async () => 返回数据(
    await this.accountService.getRegisterConfig(),
  ));

  guest = 处理控制器(async () => 返回数据({
    mode: 'guest',
    message: '已进入游客模式',
  }));

  me = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.getProfile(user.id));
  });

  listSessions = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const sessions = await this.accountService.listMySessions(user.id, req.authContext?.sessionId ?? null);
    return 返回数据(sessions);
  });

  revokeSession = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    await this.accountService.revokeMySession(user.id, resolveParam(req.params.id));
  }, {
    错误映射: [{ 匹配: '不存在', 状态码: 404 }],
  });

  logout = 处理控制器(async (req: Request) => {
    await this.accountService.logoutCurrent(req.authContext?.sessionId || null);
  });

  listUsers = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.listManagedUsers(user.role, {
      page: resolveQueryValue(req.query.page),
      page_size: resolveQueryValue(req.query.page_size),
      keyword: resolveQueryValue(req.query.keyword),
      role: resolveQueryValue(req.query.role),
      is_active: resolveQueryValue(req.query.is_active),
      approval_status: resolveQueryValue(req.query.approval_status),
    }));
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  createUser = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.createManagedUser(user.id, user.role, req.body || {}), {
      状态码: 201,
    });
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  updateRegisterConfig = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.updateRegisterConfig(user.role, req.body || {}));
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  updateUser = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    return 返回数据(await this.accountService.updateManagedUser(
      user.id,
      user.role,
      resolveParam(req.params.id),
      req.body || {},
    ));
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  resetUserPassword = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const password = String(req.body?.password || '');
    await this.accountService.resetUserPassword(user.role, resolveParam(req.params.id), password);
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  deleteUser = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    await this.accountService.deleteManagedUser(user.id, user.role, resolveParam(req.params.id));
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  reviewUserApproval = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const approvalStatus = String(req.body?.approval_status || '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(approvalStatus)) {
      throw Http错误工厂.参数错误('审核状态无效');
    }

    return 返回数据(await this.accountService.reviewUserRegistration(
      user.id,
      user.role,
      resolveParam(req.params.id),
      approvalStatus as 'approved' | 'rejected',
    ));
  }, {
    默认错误状态码: 400,
    错误映射: 账号权限错误映射,
  });

  updateRole = 处理控制器(async (req: Request) => {
    const user = this.获取当前用户(req);
    const role = String(req.body?.role || '') as AccountRole;
    if (!['user', 'admin', 'super_admin'].includes(role)) {
      throw Http错误工厂.参数错误('角色无效');
    }
    const data = await this.accountService.updateUserRole(
      user.role,
      resolveParam(req.params.id),
      role
    );
    return 返回数据(data);
  }, {
    默认错误状态码: 403,
    错误映射: 账号权限错误映射,
  });

  // 允许前端通过 token 预检
  resolveContext = 处理控制器(async (req: Request) => {
    const token = resolveToken(req);
    const context = await this.accountService.buildUserContext(token);
    return 返回数据(context);
  });
}
