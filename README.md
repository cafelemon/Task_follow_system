# 公司任务跟踪系统

版本：`2.0.2`

公司任务跟踪系统是面向公司级任务推进、每周更新、风险协调和会议看板的独立 Web 系统。2.0.2 聚焦飞书多人测试：使用企业自建应用出站消息，管理员手动绑定 open_id 后，飞书卡片通过服务端签名链接免密码进入系统。

## 技术栈

- 前端：React + TypeScript + Vite + Ant Design，预留 ProComponents
- 后端：FastAPI + SQLAlchemy 2.x + Pydantic + Alembic
- 数据库：PostgreSQL
- 部署：Docker Compose + Nginx
- 附件：本地挂载目录，后续可通过配置切换 NAS

## 本地启动

```bash
docker compose -f deploy/docker-compose.yml up --build
```

启动后访问：

- 前端：http://localhost:8080
- 后端健康检查：http://localhost:8080/api/health

首次初始化全新数据库时，需要通过本地环境变量提供系统管理员初始密码，仓库不保存明文密码或密码哈希。可参考 `.env.example`，在本机创建不提交的 `.env`，或在启动前导出 `TASK_FOLLOW_ADMIN_PASSWORD` / `TASK_FOLLOW_ADMIN_PASSWORD_HASH`。

## 飞书 2.0.2 接入配置

2.0.2 使用飞书企业自建应用接口获取 `tenant_access_token`，再通过 `im/v1/messages` 按用户 `open_id` 发送互动卡片。默认不发送真实消息，需要显式启用：

```bash
TASK_FOLLOW_LARK_ENABLED=true
TASK_FOLLOW_LARK_APP_ID=cli_xxx
TASK_FOLLOW_LARK_APP_SECRET=xxx
TASK_FOLLOW_WEB_BASE_URL=http://10.10.11.229:8080
TASK_FOLLOW_LINK_SECRET=
```

启用后，先在“人员”页手动录入测试人员 open_id，再到“通知记录”页点击“飞书诊断”。诊断通过后可先发“测试卡片”，再点“发送飞书提醒”。飞书卡片按钮会先进入服务端签名登录入口，验证通过后自动创建 session 并跳转业务页面；未绑定 open_id 或配置缺失的记录会标记为 `blocked`，接口异常会标记为 `failed`。

## 开发启动

后端：

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 当前范围

- 固定任务层级：战略目标、母任务、部门任务、子任务、周更新、历史事件。
- 每个子任务每周一条主更新，支持草稿和提交；提交后修改生成修订记录。
- 自动会议看板：高风险、未更新、协调事项、完成事项、下周重点自动汇总。
- 权限矩阵可配置，并叠加任务关系权限。
- 飞书 2.0.2 支持真实周更新提醒卡片、测试卡片、手动 open_id 绑定、签名免密码卡片入口、诊断接口和通知记录状态追踪。
- 本地 Docker Compose 部署，附件默认写入本地挂载目录。
