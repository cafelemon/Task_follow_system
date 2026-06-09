# 公司任务跟踪系统

版本：`2.0.9`

公司任务跟踪系统是面向公司级任务推进、每周更新、风险协调和会议看板的独立 Web 系统。2.0.9 在 UI 收尾版基础上补强看板关联性：会议看板指标、柱图、饼图和母任务截止日期管理支持点击查看数据详情，母任务详情和部门任务展开行补充本周完成内容与遗留事项。

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

本地启动后访问：

- 前端：http://localhost:8080
- 后端健康检查：http://localhost:8080/api/health

生产环境由 IT 反代到内网服务端口时，可设置 `TASK_FOLLOW_DOCKER_HTTP_PORT=28081`。

首次初始化全新数据库时，需要通过本地环境变量提供系统管理员初始密码，仓库不保存明文密码或密码哈希。可参考 `.env.example`，在本机创建不提交的 `.env`，或在启动前导出 `TASK_FOLLOW_ADMIN_PASSWORD` / `TASK_FOLLOW_ADMIN_PASSWORD_HASH`。

## 飞书 2.0.9 接入配置

2.0.9 使用飞书企业自建应用接口获取 `tenant_access_token`、`app_access_token`，支持按邮箱解析 `open_id`、发送互动卡片和网页免登录。默认不发送真实消息，需要显式启用：

```bash
TASK_FOLLOW_LARK_ENABLED=true
TASK_FOLLOW_LARK_APP_ID=cli_xxx
TASK_FOLLOW_LARK_APP_SECRET=xxx
TASK_FOLLOW_WEB_BASE_URL=http://localhost:8080
TASK_FOLLOW_LINK_SECRET=
TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI=http://localhost:8080/api/auth/lark-oauth/callback
TASK_FOLLOW_LARK_OAUTH_STATE_SECRET=
```

启用后，先在“通知记录”页上传包含 `姓名`、`邮箱` 的导出文件，再点击“飞书诊断”和“邮箱解析 open_id”。解析完成后可先发“测试卡片”，再点“发送飞书提醒”。飞书卡片按钮继续优先使用服务端签名入口；登录页提供“飞书免登”兜底入口。邮箱只用于管理员预绑定和免登辅助匹配，不作为单独登录凭证。

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
- 多执行人子任务按执行人分别提交周更新，支持草稿和提交；提交后修改生成修订记录。
- 自动会议看板：高风险、未更新、协调事项、完成事项、下周重点自动汇总。
- 权限矩阵可配置，并叠加任务关系权限。
- 飞书 2.0.9 支持真实周更新提醒卡片、测试卡片、邮箱解析 open_id、签名免密码卡片入口、飞书免登、诊断接口和通知记录状态追踪。
- 全局布局已完成小屏适配，侧栏在中小屏自动收起，宽表优先收敛列宽并用省略提示保留完整信息。
- 核心业务页已统一任务卡片、人员/部门标签、业务表格和子任务分组视觉，保持高密度办公系统风格。
- 会议看板、历史时间线、通知记录和人员页已完成 UI 收尾，进入生产迁移前的界面冻结阶段。
- 会议看板指标和图表支持点击查看数据详情；母任务详情和部门任务展开子任务行显示本周完成内容与遗留事项。
- 本地 Docker Compose 部署，附件默认写入本地挂载目录。
