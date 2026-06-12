# 公司任务跟踪系统

版本：`4.0.0`

公司任务跟踪系统是面向公司级任务推进、每周更新、风险协调和会议看板的独立 Web 系统。3.0.0 是生产第一版；当前 4.0.0 已完成生产通知收口、手机端适配闭环、预检分级和周更新附件下载闭环。

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

局域网飞书联调时，优先使用自动同步当前 LAN IP 的启动脚本：

```bash
bash scripts/start_lan_dev.sh
```

脚本会更新本机 `.env` 中的 Web 地址和飞书 OAuth callback，并在启动后输出飞书开发者后台需要确认的重定向 URL。

生产环境由 IT 反代到内网服务端口时，设置 `TASK_FOLLOW_DOCKER_HTTP_PORT=28081`。`28081` 仅作为内网反代目标，不直接暴露到公网。

生产机使用离线包部署时，先加载镜像，再显式指定 `env_of` 启动：

```bash
docker load -i docker-images/task-follow-system-4.0.0-images.tar
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build
```

首次初始化全新数据库时，需要通过本地环境变量提供系统管理员初始密码，仓库不保存明文密码或密码哈希。可参考 `.env.example`，在本机创建不提交的 `.env`，或在启动前导出 `TASK_FOLLOW_ADMIN_PASSWORD` / `TASK_FOLLOW_ADMIN_PASSWORD_HASH`。

## 飞书生产配置

3.x 使用飞书企业自建应用接口获取 `tenant_access_token`、`app_access_token`，支持按邮箱解析 `open_id`、发送互动卡片和网页免登录。生产环境使用本机实配文件 `env_of`，仓库内 `.env.production.example` 仅作为无密钥模板参考：

```bash
TASK_FOLLOW_LARK_ENABLED=true
TASK_FOLLOW_LARK_APP_ID=cli_xxx
TASK_FOLLOW_LARK_APP_SECRET=xxx
TASK_FOLLOW_WEB_BASE_URL=https://task.citronmicrobot.com:4442
TASK_FOLLOW_LINK_SECRET=
TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI=https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE=configured
TASK_FOLLOW_LARK_OAUTH_STATE_SECRET=
TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE=all
TASK_FOLLOW_COOKIE_SECURE=true
TASK_FOLLOW_CORS_ORIGINS=https://task.citronmicrobot.com:4442
```

飞书开放平台需要人工确认并发布正式重定向 URL：

```text
https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
```

局域网联调仍可把 `TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE` 设为 `request_host`，并通过 `bash scripts/start_lan_dev.sh` 自动写入当前 LAN 地址；该口径不用于生产。

上线前运行预检：

```bash
python3 scripts/preflight_prod_check.py --env-file env_of --base-url https://task.citronmicrobot.com:4442
```

生产模式下，通知页隐藏测试卡片、四类验收卡片和模拟提醒，只保留飞书诊断、邮箱解析 open_id 和正式提醒手动触发。邮箱只用于管理员预绑定和免登辅助匹配，不作为单独登录凭证。

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
- 飞书 3.x 支持正式全员通知、邮箱解析 open_id、签名免密码卡片入口、飞书免登、诊断接口和通知记录状态追踪；3.2.0 已删除测试和验收卡片发送能力，4.0.0 预检只阻断真实通知目标缺 `open_id`。
- 全局布局已完成小屏适配，侧栏在中小屏自动收起，宽表优先收敛列宽并用省略提示保留完整信息。
- 核心业务页已统一任务卡片、人员/部门标签、业务表格和子任务分组视觉，保持高密度办公系统风格。
- 会议看板、历史时间线、通知记录和人员页已完成 UI 收尾，已进入生产第一版运行。
- 会议看板指标和图表支持点击查看数据详情；母任务详情和部门任务展开子任务行显示本周完成内容与遗留事项。
- 本地 Docker Compose 部署，附件默认写入本地挂载目录。
