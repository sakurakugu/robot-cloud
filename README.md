# robot-cloud

机器狗云端管理平台，提供前端页面、后端 API、WebSocket 和媒体协商能力。

服务器地址：ssh ubuntu@106.53.174.61

## 当前职责

- 账号、登录、会话、反馈
- 机器人资产管理
- 远程接入
- AI 对话与音频链路
- 云端视频会话协商

## 目录结构

```text
robot-cloud/
├── 前端/                    # Vue 3 + Vite
├── 后端/                    # Node.js + Express + WebSocket
├── nginx/                   # 生产反向代理
├── coturn/                  # TURN 配置
├── tools/                   # 开发 / 生产启动脚本
├── docs/                    # 云端专项文档
├── docker-compose.yml       # postgres / mediamtx / coturn / 应用编排
├── start.sh                 # 生产便捷入口
└── README.md
```

## 环境要求

- Node.js `24.x`
- Docker
- Docker Compose

## 推荐启动方式

统一使用脚本：

```bash
python tools/1.启动服务端.py
```

默认行为是 `restart`。

开发模式常用命令：

```bash
python tools/1.启动服务端.py --start
python tools/1.启动服务端.py --stop
python tools/1.启动服务端.py --restart
python tools/1.启动服务端.py --status
python tools/1.启动服务端.py --db-upgrade
```

当前开发脚本会负责：

- 启动 Docker 依赖：`postgres`、`mediamtx`、`coturn`
- 启动后端热更新
- 启动前端热更新

如果根目录缺少 `.env`，脚本会尝试用 `.env.example` 自动补一份。

## 默认端口

- 前端：`5174`
- 后端：`9000`
- 媒体代理：`http://localhost:5174/media/`
- 本地 WHEP 默认端口：`8889`

后端健康检查：

```text
http://localhost:9000/api/v1/health
```

## 前后端分开启动

前端：

```bash
cd 前端
npm install
npm run dev
```

后端：

```bash
cd 后端
npm install
npm run dev
```

数据库迁移：

```bash
cd 后端
npm run migration:up
npm run migration:down
npm run migration:redo
```

## 校验

前端：

```bash
cd 前端
npm run lint
npm run typecheck
```

后端：

```bash
cd 后端
npm run lint
npm run typecheck
```

## 生产部署

当前仓库保留了两种入口：

```bash
python tools/1.启动服务端.py --prod --start
python tools/1.启动服务端.py --prod --status
python tools/1.启动服务端.py --prod --db-upgrade
```

以及：

```bash
bash ./start.sh
```

生产环境通常包含：

- `frontend`
- `backend`
- `postgres`
- `mediamtx`
- `coturn`
- `nginx`

## WebSocket 角色

当前默认路径分三类：

- 机器人：`/api/v1/robot/*`
- 手机端：`/api/v1/phone/*`
- Web 前端：`/api/v1/web/*`

其中业务通道常见为：

- 机器人业务：`/api/v1/robot/business`
- Web 业务：`/api/v1/web/business`

## 说明

云端负责远程和账号体系，不替代本体本地建图、定位、导航链路；低时延控制和本地视频在很多场景下仍然更适合局域网直连。
