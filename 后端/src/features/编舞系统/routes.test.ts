import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createChoreoRoutes } from './routes';

describe('编舞系统路由', () => {
  function 创建控制器() {
    return {
      getAllProjects: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      importProject: jest.fn((_req, res) => res.json({ success: true, data: { uuid: 'project-1' } })),
      getProject: jest.fn((_req, res) => res.json({ success: true, data: { uuid: 'project-1' } })),
      createProject: jest.fn((_req, res) => res.json({ success: true, data: { uuid: 'project-1' } })),
      updateProject: jest.fn((_req, res) => res.json({ success: true, data: { uuid: 'project-1' } })),
      deleteProject: jest.fn((_req, res) => res.json({ success: true })),
      openProject: jest.fn((_req, res) => res.json({ success: true })),
      saveProject: jest.fn((_req, res) => res.json({ success: true })),
      exportProject: jest.fn((_req, res) => res.json({ success: true })),
      getProjectRobots: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      addRobotToProject: jest.fn((_req, res) => res.json({ success: true })),
      removeRobotFromProject: jest.fn((_req, res) => res.json({ success: true })),
      getProjectRobotsConfig: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      addRobotToProjectDirect: jest.fn((_req, res) => res.json({ success: true })),
      updateProjectRobot: jest.fn((_req, res) => res.json({ success: true })),
      deleteProjectRobot: jest.fn((_req, res) => res.json({ success: true })),
      getTimeline: jest.fn((_req, res) => res.json({ success: true, data: { tracks: [], config: {} } })),
      saveTimeline: jest.fn((_req, res) => res.json({ success: true })),
      getCustomActions: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      saveCustomAction: jest.fn((_req, res) => res.json({ success: true })),
      listAudioFiles: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      getAudio: jest.fn((_req, res) => res.json({ success: true })),
      uploadAudio: jest.fn((_req, res) => res.json({ success: true })),
      deleteAudioFile: jest.fn((_req, res) => res.json({ success: true })),
      executeChoreo: jest.fn((_req, res) => res.json({ success: true })),
      pauseExecution: jest.fn((_req, res) => res.json({ success: true })),
      resumeExecution: jest.fn((_req, res) => res.json({ success: true })),
      stopExecution: jest.fn((_req, res) => res.json({ success: true })),
      getExecutionStatus: jest.fn((_req, res) => res.json({ success: true, data: {} })),
      getRunningExecutions: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      getProjectFiles: jest.fn((_req, res) => res.json({ success: true, data: [] })),
      getFileContent: jest.fn((_req, res) => res.json({ success: true, data: '' })),
      saveFileContent: jest.fn((_req, res) => res.json({ success: true })),
      deleteFile: jest.fn((_req, res) => res.json({ success: true })),
    };
  }

  function 创建应用(guards?: { read?: RequestHandler; manage?: RequestHandler }) {
    const app = express();
    app.use(express.json());
    app.use(createChoreoRoutes(创建控制器() as any, guards));
    return app;
  }

  it('读取接口应应用 read 守卫', async () => {
    const read: RequestHandler = (req, res, next) => {
      if (req.headers.authorization === 'Bearer read-ok') {
        next();
        return;
      }
      res.status(401).json({ success: false, error: '未授权' });
    };

    const app = 创建应用({ read });

    const unauthorized = await request(app).get('/projects');
    const authorized = await request(app)
      .get('/projects')
      .set('Authorization', 'Bearer read-ok');

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
  });

  it('管理接口应应用 manage 守卫', async () => {
    const manage: RequestHandler = (req, res, next) => {
      if (req.headers.authorization === 'Bearer manage-ok') {
        next();
        return;
      }
      res.status(403).json({ success: false, error: '权限不足' });
    };

    const app = 创建应用({ manage });

    const forbidden = await request(app)
      .post('/projects/project-1/timeline')
      .send({ tracks: [], config: {} });
    const allowed = await request(app)
      .post('/projects/project-1/timeline')
      .set('Authorization', 'Bearer manage-ok')
      .send({ tracks: [], config: {} });

    expect(forbidden.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it('导出接口应允许已登录读取守卫访问', async () => {
    const read: RequestHandler = (req, res, next) => {
      if (req.headers.authorization === 'Bearer read-ok') {
        next();
        return;
      }
      res.status(401).json({ success: false, error: '未授权' });
    };

    const app = 创建应用({ read });
    const response = await request(app)
      .get('/projects/project-1/export')
      .set('Authorization', 'Bearer read-ok');

    expect(response.status).toBe(200);
  });
});
