# 公司工作任务跟踪系统进度记录

## 1. 文档用途

本文档用于记录项目阶段进展、已完成事项、待确认问题、验证结果和下一步计划。每次完成较大变更后应更新本文档。

## 2. 当前状态

当前状态：1.0.0 可运行初版已完成登录、人员、角色权限、清样例数据和 Base 同步入口实现；真实 Base 导入暂被 lark-cli 环境阻塞。

记录日期：2026-06-05。

项目已从 V0 文档和原型阶段进入 V1 MVP 初版实施。1.0.0 目标是基于样板和 overview 建立独立 Web 系统，完成任务层级、周更新历史、自动会议看板、风险逾期、通知记录、权限矩阵和本地 Docker 部署。

## 3. 已完成

- 已明确系统定位：公司级长期任务管理系统，不是多维表格增强工具。
- 已明确 Base 定位：过渡、导出、展示和历史迁移来源，不作为主业务系统。
- 已明确核心闭环：任务创建、任务拆分、每周更新、时间线、管理看板、飞书提醒、权限控制。
- 已明确部署方向：服务器部署、反向代理访问、HTTPS、飞书接入、NAS 附件存储。
- 已整理初版文档结构：
  - `00_overview.md`
  - `01_prd.md`
  - `02_roadmap.md`
  - `03_architecture.md`
  - `04_acceptance_checklist.md`
  - `05_ai_coding_agent_guide.md`
  - `06_progress.md`
  - `07_decisions.md`
- 已把原有界面设计内容合并进产品需求和架构文档，不单独保留大写设计文档。
- 已建立 `backend/`、`frontend/`、`deploy/`、`README.md`、`VERSION`。
- 已确定版本号为 `1.0.0`。
- 已采用 React + TypeScript + Vite + Ant Design 作为前端栈，预留后续引入 ProComponents。
- 已采用 FastAPI + SQLAlchemy 2.x + Pydantic + Alembic + PostgreSQL 作为后端栈。
- 已确定 1.0.0 飞书只做 open_id、模拟通知和跳转预留。
- 已确定 1.0.0 部署本地优先，附件本地目录优先，预留 NAS 配置。
- 已确定权限为“矩阵可配 + 任务关系权限”。
- 已完成后端 FastAPI、数据库模型、seed 数据、权限矩阵、周更新、会议看板、通知记录等核心 API 初版。
- 已完成前端 React 企业后台布局和 12 个核心页面初版。
- 已完成 Docker Compose 本地部署配置，统一入口为 `http://localhost:8080`。
- 已移除固定 `X-User-Id` mock 登录，改为管理员账号密码登录、HttpOnly cookie session 和 `/api/auth/me`。
- 已新增 open_id 登录预留接口：先按 open_id 匹配，未匹配则按预设姓名绑定，仍未匹配则创建 pending 人员。
- 已新增管理员可见“人员”模块，可维护预设人员、部门、岗位、角色、状态和 open_id 绑定状态。
- 已将人员管理和角色权限拆分为两个管理员模块，其中角色权限仅系统管理员可见。
- 已清空当前 seed 业务样例数据，保留管理员、部门、角色和权限基础数据。
- 已新增 Base 同步预览和导入入口；接口执行 lark-cli 时带超时，不猜字段、不手工造任务。

## 4. 待确认问题

- 服务器位置：部署在 GPU 服务器还是其他长期稳定服务器。
- NAS 附件路径、挂载方式、权限和备份策略。
- 反向代理域名、证书、访问控制方式。
- 飞书企业自建应用权限、回调地址和机器人能力边界。
- 现有 Base 数据字段、自动化和历史快照的迁移范围。
- lark-cli 宿主机命令卡住、backend 容器内未安装 lark-cli，需先修复后才能真实导入 2026任务跟踪表。
- 组织与人才发展中心观察角色的最终查看边界。
- 会议材料导出的正式格式。

## 5. 下一步

- 修复 lark-cli 运行环境：宿主机 `lark-cli --version` 需可返回，或将 lark-cli 安装进 backend 容器并配置可用认证。
- 在 Base CLI 可用后执行 `POST /api/sync/base-2026/preview`，确认表、字段和记录数量。
- 确认字段映射后执行一次性导入，让任务列表和会议看板使用真实数据。
- 继续补登录、人员、角色权限、Base 同步的后端自动化测试和前端交互测试。

## 6. 最近验证

1.0.0 初版完成后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过。
- `docker compose -f deploy/docker-compose.yml config` 通过。
- `docker compose -f deploy/docker-compose.yml up --build -d` 启动成功。
- `GET http://localhost:8080/api/health` 返回 `{"status":"ok","version":"1.0.0"}`。
- `GET /api/dashboard`、`GET /api/meeting-board`、`GET /api/parent-tasks`、`GET /api/permissions`、`GET /api/notifications` 返回正常。
- `POST /api/weekly-updates` 可提交周更新。
- `POST /api/notifications/mock-reminders` 可生成模拟通知记录。
- `curl -sI http://localhost:8080/` 返回 200。
- `npm audit --audit-level=high` 通过；仍存在 Vite/esbuild 开发服务器中危告警，强制修复需要升级到 Vite 8，当前 React 插件 peer 范围不兼容，暂不强制升级。
- 本轮未完成真实浏览器截图视觉验证：当前会话没有可调用的 in-app browser/browser 工具。

1.0.0 登录与人员模块更新后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过。
- `docker compose -f deploy/docker-compose.yml up --build -d` 启动成功。
- `GET http://localhost:8080/api/health` 返回 `{"status":"ok","version":"1.0.0"}`。
- 未登录访问 `GET /api/auth/me` 返回 401。
- 管理员可通过 `POST /api/auth/login` 登录，并通过 cookie 访问 `GET /api/auth/me`、`GET /api/people` 和 `GET /api/permissions`。
- `GET /api/timeline` 返回空数组，旧样例历史已清空。
- `GET /api/notifications` 返回空数组，旧样例通知已清空。
- `GET /api/meeting-board` 返回空看板结构，等待真实 Base 任务导入。
- `POST /api/sync/base-2026/preview` 在 Docker backend 内返回 `{"ok":false,"stage":"version","message":"lark-cli not found"}`。
- 宿主机执行 `lark-cli --version` 超过 6 秒未返回，已终止挂起进程；真实 Base 导入暂不执行。
