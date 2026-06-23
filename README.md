# 公司任务跟踪系统

版本：`5.1.0`

公司任务跟踪系统是面向公司级任务推进、每周更新、风险协调和会议看板的独立 Web 系统。3.0.0 是生产第一版；5.0.0 是 4.x 工作台、待归类事项、周报中心、观察者导出和历史周数据补齐后的生产同步包，离线包同时包含代码镜像和当前 PostgreSQL 数据库快照。当前 5.1.0 强化通知页手动周提醒：有待更新子任务的人收到周更新卡，无待更新任务的活跃人员收到周报补充入口卡，同一周同一人去重。生产系统级通知配置恢复开启，仍不做飞书原生汇报回写。

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

生产机使用离线包部署时，先加载镜像，再显式指定 `env_of` 启动。离线包名称按实际打包版本替换：

```bash
docker load -i docker-images/task-follow-system-<version>-images.tar
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build
```

5.0.0 生产离线包会额外包含当前数据库快照，位置形如 `database/task_follow_5_0_0_prod_data_YYYYMMDD.dump`。生产端需要同步本机补齐后的历史周更新数据时，按 `docs/09_production_deploy_runbook.md` 中的数据库恢复步骤执行。

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
TASK_FOLLOW_SCHEDULER_ENABLED=true
TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE=all
TASK_FOLLOW_NOTIFICATION_ALLOWLIST_EMAILS=
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
- 管理员可维护部门基础数据；部门删除仅允许无人员、无任务、无多部门关联和无子部门引用的错字或误建部门。
- 4.6.6 已完成工作台首屏布局修正：待归类事项成为第一张独立入口卡，子任务执行周更新和拆解入口并列展示；标题下方说明和当前人员大卡移除，卡片按实际可见数量自动填满行宽，部门负责人详情保留下方折叠面板。
- 4.7.0 已为观察者/人事提供月度周报 Excel 导出；系统不做飞书原生汇报回写，不向执行人提供导出文档入口。
- 4.7.1 已将使用指南从 `App.tsx` 拆分到 `features/guides`，并更新总经办/秘书指南：工作台是进入系统后的行动入口，会议看板是会议审阅主入口；所有角色引导版本提升到 2，下次进入系统会重新看到一次对应指南。
- 4.7.2 已更新部门负责人和任务负责人指南；应用版本升到 4.7.2，但引导版本继续保持 2，已完成 v2 的用户不会再次自动弹出。
- 4.7.3 已更新执行者和观察者指南；执行者指南补入工作台周更新入口、待归类事项、周报中心、附件和完成撤回边界，观察者指南补入月度周报 Excel 导出和只读审阅口径。应用版本升到 4.7.3，但引导版本继续保持 2。
- 4.7.4 已新增待归类事项“审批与通知设置”：部门负责人、任务负责人和管理员可按四类事项设置个人飞书通知和自动同意；跨部门协作仍保留双确认边界，自动同意可撤销并写入事件记录。
- 4.8.0 新增 `scripts/backfill_weekly_updates_from_excel.py`，用于从 `2026公司工作任务跟踪表 (1).xlsx` 的 `04_周更新进度` 中回填 `2026-W24` 周更新；脚本默认只生成报告，`--apply` 才真实写入。
- 4.8.2 已删除 4.8.1 临时历史周补录/编辑入口和接口；已补录数据保留，历史时间线只读展示并显式标注子任务执行人。
- 5.0.0 作为生产同步包，包含当前已补齐历史周更新的 PostgreSQL dump；生产系统级通知按 `env_of` 开启：调度启用、投递模式为 `all`、通知白名单为空。
- 5.0.2 修正部门任务权限：管理员和总经办管理角色可拆解任意部门任务；部门负责人、任务负责人可查看本部门部门任务汇总，但编辑/拆解仍按本人职责范围控制；部门任务页按“我负责 / 本部门任务汇总 / 全公司查看”分组展示。
- 5.0.3 补充执行者本部门只读查看口径：执行者也可在部门任务页了解本部门重点工作，但不获得编辑、拆解或代填权限；工作台保持三入口不变。
- 5.0.4 收紧工作台任务负责人卡：即使用户同时是管理员、总经理或观察者，拆解入口也只统计本人直接负责的部门任务。
- 5.1.0 强化通知页手动周提醒：一键向有待更新子任务人员发送周更新卡，并向无待更新任务的 active 用户发送独立周报补充入口卡；两类卡片按周和人员交叉去重，定时周五提醒保持原待更新子任务口径。
- 飞书 3.x 支持正式全员通知、邮箱解析 open_id、签名免密码卡片入口、飞书免登、诊断接口和通知记录状态追踪；3.2.0 已删除测试和验收卡片发送能力，4.0.0 预检只阻断真实通知目标缺 `open_id`。
- 全局布局已完成小屏适配，侧栏在中小屏自动收起，宽表优先收敛列宽并用省略提示保留完整信息。
- 核心业务页已统一任务卡片、人员/部门标签、业务表格和子任务分组视觉，保持高密度办公系统风格。
- 会议看板、历史时间线、通知记录和人员页已完成 UI 收尾，已进入生产第一版运行。
- 会议看板指标和图表支持点击查看数据详情；母任务详情和部门任务展开子任务行显示本周完成内容与遗留事项。
- 本地 Docker Compose 部署，附件默认写入本地挂载目录。

## 周更新快照回填

4.8.0 提供一次性安全回填脚本，用于补齐系统停用期间仍在 Base 中填写的 W24 周更新。执行前建议先备份数据库，并先 dry-run 查看报告：

```bash
python3 -m pip install openpyxl
backend/.venv/bin/python scripts/backfill_weekly_updates_from_excel.py --week-key 2026-W24 --output-json /tmp/w24-backfill-dry-run.json
```

如果当前 shell 没有正确的数据库连接配置，可增加 `--env-file` 或 `--database-url`，避免误连到其他本机 PostgreSQL：

```bash
backend/.venv/bin/python scripts/backfill_weekly_updates_from_excel.py --env-file .env --week-key 2026-W24 --output-json /tmp/w24-backfill-dry-run.json
```

确认报告无异常后再写入：

```bash
backend/.venv/bin/python scripts/backfill_weekly_updates_from_excel.py --week-key 2026-W24 --apply --output-json /tmp/w24-backfill-apply.json
```

4.8.1 曾针对自动回填不够完整或匹配错误的情况，临时在“历史时间线”开放手工补录。4.8.2 已删除该入口和接口，恢复历史时间线只读口径；已通过 4.8.1 写入的历史周更新、修订记录和任务事件继续保留。

脚本只读取 `04_周更新进度` 的“本周完成内容、下周工作计划、遗留事项”，并使用 `03_部门拆解任务` 辅助匹配原始子任务编号。已有系统周更新会跳过，匹配不到子任务或执行人的行只进入报告，不会写入；历史附件文件名不创建附件记录。
