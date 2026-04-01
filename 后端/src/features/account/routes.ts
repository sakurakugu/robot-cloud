import { Router } from 'express';
import type { AccountController } from './controller';
import { requireAuth, requireRole } from './middleware';

export function createAccountRoutes(controller: AccountController): Router {
  const router = Router();

  router.post('/register', controller.register);
  router.get('/register-config', controller.getRegisterConfig);
  router.post('/login', controller.login);
  router.post('/guest', controller.guest);
  router.get('/context', controller.resolveContext);
  router.put('/register-config', requireRole('super_admin'), controller.updateRegisterConfig);

  router.get('/me', requireAuth, controller.me);
  router.post('/logout', requireAuth, controller.logout);

  router.get('/sessions', requireAuth, controller.listSessions);
  router.delete('/sessions/:id', requireAuth, controller.revokeSession);

  router.get('/users', requireRole('admin', 'super_admin'), controller.listUsers);
  router.post('/users', requireRole('admin', 'super_admin'), controller.createUser);
  router.patch('/users/:id/approval', requireRole('admin', 'super_admin'), controller.reviewUserApproval);
  router.patch('/users/:id', requireRole('admin', 'super_admin'), controller.updateUser);
  router.patch('/users/:id/password', requireRole('admin', 'super_admin'), controller.resetUserPassword);
  router.delete('/users/:id', requireRole('admin', 'super_admin'), controller.deleteUser);
  router.put('/users/:id/role', requireRole('admin', 'super_admin'), controller.updateRole);

  return router;
}
