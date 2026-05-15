/**
 * 编舞系统路由
 */

import type { RequestHandler } from 'express';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import path from 'path';
import type { ChoreoController } from './controller';

// 配置 multer 用于音频上传（内存存储）
const audioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传音频文件'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 大小
  },
});

// 配置 multer 用于项目导入
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'robot-system-imports');
    void fs.promises.mkdir(tempDir, { recursive: true })
      .then(() => cb(null, tempDir))
      .catch((error) => cb(error as Error, tempDir));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `import_${timestamp}${ext}`;
    cb(null, filename);
  },
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      ext === '.zip' ||
      ext === '.hhzip'
    ) {
      cb(null, true);
    } else {
      cb(new Error('只能上传 ZIP 或 HHZIP 压缩文件'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB 大小
  },
});

export function createChoreoRoutes(
  controller: ChoreoController,
  guards?: { read?: RequestHandler; manage?: RequestHandler }
): Router {
  const router = Router();

  // ==================== 项目管理 ====================

  // 获取所有项目
  if (guards?.read) {
    router.get('/projects', guards.read, controller.getAllProjects);
  } else {
    router.get('/projects', controller.getAllProjects);
  }

  // 导入项目
  if (guards?.manage) {
    router.post('/projects/import', guards.manage, importUpload.single('project'), controller.importProject);
  } else {
    router.post('/projects/import', importUpload.single('project'), controller.importProject);
  }

  // 获取单个项目
  if (guards?.read) {
    router.get('/projects/:uuid', guards.read, controller.getProject);
  } else {
    router.get('/projects/:uuid', controller.getProject);
  }

  // 创建项目
  if (guards?.manage) {
    router.post('/projects', guards.manage, controller.createProject);
  } else {
    router.post('/projects', controller.createProject);
  }

  // 更新项目
  if (guards?.manage) {
    router.put('/projects/:uuid', guards.manage, controller.updateProject);
  } else {
    router.put('/projects/:uuid', controller.updateProject);
  }

  // 删除项目
  if (guards?.manage) {
    router.delete('/projects/:uuid', guards.manage, controller.deleteProject);
  } else {
    router.delete('/projects/:uuid', controller.deleteProject);
  }

  // 打开项目
  if (guards?.read) {
    router.post('/projects/:uuid/open', guards.read, controller.openProject);
  } else {
    router.post('/projects/:uuid/open', controller.openProject);
  }

  // 保存项目
  if (guards?.manage) {
    router.post('/projects/:uuid/save', guards.manage, controller.saveProject);
  } else {
    router.post('/projects/:uuid/save', controller.saveProject);
  }

  // 导出项目
  if (guards?.read) {
    router.get('/projects/:uuid/export', guards.read, controller.exportProject);
  } else {
    router.get('/projects/:uuid/export', controller.exportProject);
  }

  // ==================== 项目机器人管理 ====================

  // 获取项目机器人列表（关联主表）
  if (guards?.read) {
    router.get('/projects/:uuid/robots', guards.read, controller.getProjectRobots);
  } else {
    router.get('/projects/:uuid/robots', controller.getProjectRobots);
  }

  // 添加机器人到项目（关联主表）
  if (guards?.manage) {
    router.post('/projects/:uuid/robots', guards.manage, controller.addRobotToProject);
  } else {
    router.post('/projects/:uuid/robots', controller.addRobotToProject);
  }

  // 从项目移除机器人
  if (guards?.manage) {
    router.delete('/projects/:uuid/robots/:robotUuid', guards.manage, controller.removeRobotFromProject);
  } else {
    router.delete('/projects/:uuid/robots/:robotUuid', controller.removeRobotFromProject);
  }

  // ==================== 项目机器人配置管理（直接存储） ====================

  // 获取项目机器人配置列表
  if (guards?.read) {
    router.get('/projects/:uuid/robots-config', guards.read, controller.getProjectRobotsConfig);
  } else {
    router.get('/projects/:uuid/robots-config', controller.getProjectRobotsConfig);
  }

  // 直接添加机器人配置
  if (guards?.manage) {
    router.post('/projects/:uuid/robots-config', guards.manage, controller.addRobotToProjectDirect);
  } else {
    router.post('/projects/:uuid/robots-config', controller.addRobotToProjectDirect);
  }

  // 更新机器人配置
  if (guards?.manage) {
    router.put('/projects/:uuid/robots-config/:robotUuid', guards.manage, controller.updateProjectRobot);
  } else {
    router.put('/projects/:uuid/robots-config/:robotUuid', controller.updateProjectRobot);
  }

  // 删除机器人配置
  if (guards?.manage) {
    router.delete('/projects/:uuid/robots-config/:robotUuid', guards.manage, controller.deleteProjectRobot);
  } else {
    router.delete('/projects/:uuid/robots-config/:robotUuid', controller.deleteProjectRobot);
  }

  // ==================== 时间轴管理 ====================

  // 获取时间轴数据
  if (guards?.read) {
    router.get('/projects/:uuid/timeline', guards.read, controller.getTimeline);
  } else {
    router.get('/projects/:uuid/timeline', controller.getTimeline);
  }

  // 保存时间轴数据
  if (guards?.manage) {
    router.post('/projects/:uuid/timeline', guards.manage, controller.saveTimeline);
  } else {
    router.post('/projects/:uuid/timeline', controller.saveTimeline);
  }

  // ==================== 自定义动作管理 ====================

  // 获取自定义动作列表
  if (guards?.read) {
    router.get('/projects/:uuid/custom-actions', guards.read, controller.getCustomActions);
  } else {
    router.get('/projects/:uuid/custom-actions', controller.getCustomActions);
  }

  // 保存自定义动作
  if (guards?.manage) {
    router.post('/projects/:uuid/custom-actions', guards.manage, controller.saveCustomAction);
  } else {
    router.post('/projects/:uuid/custom-actions', controller.saveCustomAction);
  }

  // ==================== 音频管理 ====================

  // 列出音频文件
  if (guards?.read) {
    router.get('/projects/:uuid/audio', guards.read, controller.listAudioFiles);
  } else {
    router.get('/projects/:uuid/audio', controller.listAudioFiles);
  }

  // 获取音频文件
  if (guards?.read) {
    router.get('/projects/:uuid/audio/:filename', guards.read, controller.getAudio);
  } else {
    router.get('/projects/:uuid/audio/:filename', controller.getAudio);
  }

  // 上传音频文件
  if (guards?.manage) {
    router.post('/projects/:uuid/audio', guards.manage, audioUpload.single('audio'), controller.uploadAudio);
  } else {
    router.post('/projects/:uuid/audio', audioUpload.single('audio'), controller.uploadAudio);
  }

  // 删除音频文件
  if (guards?.manage) {
    router.delete('/projects/:uuid/audio/:filename', guards.manage, controller.deleteAudioFile);
  } else {
    router.delete('/projects/:uuid/audio/:filename', controller.deleteAudioFile);
  }

  // ==================== 编舞执行 ====================

  // 执行编舞（编译时间轴 + 启动调度）
  if (guards?.manage) {
    router.post('/projects/:uuid/execute', guards.manage, controller.executeChoreo);
  } else {
    router.post('/projects/:uuid/execute', controller.executeChoreo);
  }

  // 暂停执行
  if (guards?.manage) {
    router.post('/executions/:executionId/pause', guards.manage, controller.pauseExecution);
  } else {
    router.post('/executions/:executionId/pause', controller.pauseExecution);
  }

  // 恢复执行
  if (guards?.manage) {
    router.post('/executions/:executionId/resume', guards.manage, controller.resumeExecution);
  } else {
    router.post('/executions/:executionId/resume', controller.resumeExecution);
  }

  // 停止执行
  if (guards?.manage) {
    router.post('/executions/:executionId/stop', guards.manage, controller.stopExecution);
  } else {
    router.post('/executions/:executionId/stop', controller.stopExecution);
  }

  // 获取执行状态
  if (guards?.read) {
    router.get('/executions/:executionId', guards.read, controller.getExecutionStatus);
  } else {
    router.get('/executions/:executionId', controller.getExecutionStatus);
  }

  // 获取正在运行的执行列表
  if (guards?.read) {
    router.get('/executions', guards.read, controller.getRunningExecutions);
  } else {
    router.get('/executions', controller.getRunningExecutions);
  }

  // ==================== 文件管理 ====================

  // 获取项目文件列表
  if (guards?.read) {
    router.get('/projects/:uuid/files', guards.read, controller.getProjectFiles);
  } else {
    router.get('/projects/:uuid/files', controller.getProjectFiles);
  }

  // 读取文件内容
  if (guards?.read) {
    router.get('/projects/:uuid/files/content', guards.read, controller.getFileContent);
  } else {
    router.get('/projects/:uuid/files/content', controller.getFileContent);
  }

  // 保存文件内容
  if (guards?.manage) {
    router.post('/projects/:uuid/files/content', guards.manage, controller.saveFileContent);
  } else {
    router.post('/projects/:uuid/files/content', controller.saveFileContent);
  }

  // 删除文件
  if (guards?.manage) {
    router.delete('/projects/:uuid/files', guards.manage, controller.deleteFile);
  } else {
    router.delete('/projects/:uuid/files', controller.deleteFile);
  }

  return router;
}

export default createChoreoRoutes;
