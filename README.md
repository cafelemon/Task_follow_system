# 公司任务跟踪系统

版本：`1.4.0`

公司任务跟踪系统是面向公司级任务推进、每周更新、风险协调和会议看板的独立 Web 系统。1.0.0 采用本地优先部署，飞书能力先做 open_id、通知记录和跳转链接预留，不接真实机器人发送。

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

## 1.0.0 范围

- 固定任务层级：战略目标、母任务、部门任务、子任务、周更新、历史事件。
- 每个子任务每周一条主更新，支持草稿和提交；提交后修改生成修订记录。
- 自动会议看板：高风险、未更新、协调事项、完成事项、下周重点自动汇总。
- 权限矩阵可配置，并叠加任务关系权限。
- 飞书通知记录模拟，不真实发送。
- 本地 Docker Compose 部署，附件默认写入本地挂载目录。
