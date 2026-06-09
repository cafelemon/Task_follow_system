# 公司工作任务跟踪系统进度记录

## 1. 文档用途

本文档用于记录项目阶段进展、已完成事项、待确认问题、验证结果和下一步计划。每次完成较大变更后应更新本文档。

## 2. 当前状态

当前状态：2.0.8 会议看板与全局 UI 收尾已进入实施，聚焦会议看板、历史时间线、通知记录和人员页的视觉基线与可读性统一。

记录日期：2026-06-09。

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
- 已基于本地 Excel 导出修正任务层级：战略目标 4 个、母任务 33 个、部门级任务 85 个、有效子任务 107 个。
- 已开始 1.2.0 页面修订：战略目标支持进入母任务列表，母任务详情展示部门级任务，部门任务页改为部门级任务树状总览。
- 已完成 1.3.0 页面修订：母任务支持新增、编辑和归档隐藏；每周更新合并进子任务执行；全站不再展示进度条。
- 已完成 1.4.0 页面修订：部门级任务支持新增、编辑和归档隐藏；部门任务总览支持拆解子任务；子任务更新页增加开启和完成状态流。
- 已完成 1.5.0 页面修订：取消工作台和风险与逾期独立入口；会议看板拆分为总览、母任务看板和部门看板；历史时间线改为树状周矩阵。
- 已完成 2.0.0 飞书出站消息第一版：新增企业应用配置、tenant_access_token 获取、飞书诊断接口、周更新提醒卡片发送入口和通知记录真实状态。
- 已完成 2.0.1 飞书局域网实测改造：支持手动 open_id 录入、指定人员测试卡片、本地 `.env` 保存 App ID/Secret 和局域网 Web 地址透传。
- 已完成 2.0.2 飞书多人测试改造：卡片按钮通过服务端签名链接自动创建 session，避免测试人员输入系统账号密码。
- 已完成 2.0.3 飞书免登录首版改造：人员档案支持手机号，通知页支持批量解析 open_id，登录页支持飞书免登入口。
- 已完成 2.0.4 生产迁移前整理：人员预绑定改为邮箱，负责人/执行人支持多人，多执行人各自提交周更新。
- 已进入 2.0.5 全局美化第二轮：修复任务人员关系刷新显示，会议看板风险与逾期汇总固定列宽和省略提示。
- 已进入 2.0.6 全局美化第三轮：中小屏侧栏自动收起，部门任务和子任务执行页表格收敛列宽，长文本悬停显示完整内容。
- 已进入 2.0.7 核心业务页精修：母任务卡片、部门任务表、母任务详情展开行和子任务执行分组统一视觉层级。
- 已进入 2.0.8 UI 收尾：会议看板、历史时间线、通知记录和人员页完成最终均衡美化后进入界面冻结阶段。

## 4. 待确认问题

- 服务器位置：部署在 GPU 服务器还是其他长期稳定服务器。
- NAS 附件路径、挂载方式、权限和备份策略。
- 反向代理域名、证书、访问控制方式。
- 飞书企业自建应用机器人发消息权限是否已审核通过。
- 测试人员 open_id，2.0.2 已加入刘星科，后续可继续扩展少量人员。
- 生产 Web 访问地址。
- 飞书卡片回调、事件长连接和按身份卡片的后续 2.x 边界。
- 现有 Base 数据字段、自动化和历史快照的迁移范围。
- lark-cli 宿主机命令卡住、backend 容器内未安装 lark-cli，需先修复后才能真实导入 2026任务跟踪表。
- 组织与人才发展中心观察角色的最终查看边界。
- 会议材料导出的正式格式。
- 会议看板指标口径、甘特图维度和历史矩阵附件接入方式。

## 5. 下一步

- 在飞书开放平台确认局域网 OAuth 回调地址已加入重定向 URL，并确认邮箱换 ID 和用户信息字段权限。
- 给更多测试人员录入邮箱，执行“解析 open_id”后再发送飞书提醒。
- 修复 lark-cli 运行环境后再恢复 Base 预览和一次性导入。

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

1.2.0 页面层级和权限修订后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动服务；首次构建遇到 npm 网络 `ECONNRESET`，提权重试后成功。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"1.2.0"}`。
- 前端入口 HTML 已加载 1.2.0 新构建资源。
- 容器内登录管理员接口返回 200，`GET /api/auth/me` 返回 `features.can_view_parent_tasks=true`。
- `GET /api/goals` 返回 4 个战略目标，`GET /api/parent-tasks` 返回 33 个母任务。
- 使用真实目标 ID 验证 `GET /api/goals/{goal_id}/parent-tasks` 可返回关联母任务。
- 使用真实母任务 ID 验证 `GET /api/parent-tasks/{parent_task_id}` 和 `GET /api/parent-tasks/{parent_task_id}/department-tasks` 可返回母任务详情和部门级任务。
- `GET /api/department-tasks/overview` 返回 85 个部门级任务，管理员 `can_switch_department=true`。

1.3.0 交互与周更新合并后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过。
- 静态检查未发现前端 `Progress` 组件、进度列或旧“每周更新”菜单。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动服务。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"1.3.0"}`。
- 容器内管理员登录接口返回 200，`/api/auth/me` 返回母任务新增、删除和管理能力字段为 true。
- 容器内接口验证：母任务列表 33、子任务 107。
- `GET /api/weekly-updates/current` 可返回空草稿结构；`POST /api/weekly-updates` 可保存草稿并提交为 submitted。
- `PUT /api/parent-tasks/{id}` 可编辑母任务基础字段。
- 使用临时母任务验证 `DELETE /api/parent-tasks/{id}` 归档隐藏：创建后列表从 33 变 34，归档后回到 33。

1.4.0 部门任务编辑与子任务状态修订后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动服务。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"1.4.0"}`。
- 容器服务接口验证：管理员登录成功，`/api/auth/me` 返回母任务管理和部门切换能力字段为 true。
- 使用临时部门级任务验证 `POST /api/department-tasks`、`PUT /api/department-tasks/{id}` 和 `DELETE /api/department-tasks/{id}` 可新增、编辑多负责部门并归档隐藏。
- 使用临时子任务验证 `POST /api/sub-tasks` 可按部门任务编号生成子任务编号；未开启时提交周更新返回 409；开启后可保存草稿；完成后再次提交周更新返回 409。
- 浏览器烟测通过：母任务详情显示部门级任务新增、删除和编辑入口；部门任务总览显示拆解入口；子任务执行页不再显示所属母任务列；子任务更新页不再空白并显示开启任务状态。

1.5.0 会议看板与历史时间线修订后的验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；因 ECharts 进入主包，仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动服务。
- 容器内 `GET /api/health` 返回 `{"status":"ok","version":"1.5.0"}`。
- 容器内管理员登录成功，`GET /api/meeting-board/overview`、`GET /api/meeting-board/parent`、`GET /api/meeting-board/department` 和 `GET /api/timeline/matrix` 均返回真实聚合数据。
- 数据库运行时检查确认 `sub_tasks.started_at` 字段存在。
- 浏览器烟测通过：会议看板总览、母任务看板、部门看板和历史时间线均正常显示；左侧菜单不再显示工作台、风险与逾期；旧 `/dashboard`、`/risks` 路由可兼容跳转；控制台无错误。

2.0.0 飞书真实接入第一版验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml config` 通过，backend 已透传飞书企业应用环境变量。
- 本地调用 `lark_client.health_check()` 在未启用飞书配置时返回 `ok=false` 和“飞书真实发送未启用”，符合默认阻塞预期。
- `python3 -m ruff check backend/app` 未执行成功：本机 Python 环境未安装 `ruff`。
- `docker compose -f deploy/docker-compose.yml up --build -d` 未完成：Docker 构建下载 Python/Node 依赖和镜像 metadata 时遇到 PyPI/Docker Hub SSL/EOF 网络错误；现有本地服务仍为旧 1.5.0 容器，未被失败构建替换。
- 本轮未完成浏览器烟测：当前可用工具未暴露 in-app browser 控制能力，且 2.0.0 Docker 服务未成功重建。

2.0.1 飞书局域网实测版验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml config --quiet` 通过。
- 本地 `.env` 已写入飞书企业应用配置和 `TASK_FOLLOW_WEB_BASE_URL=http://10.10.11.229:8080`，`.env` 已被 `.gitignore` 忽略。
- 本地和容器内 `lark_client.health_check()` 均返回 `ok=true`，确认可获取飞书 tenant_access_token。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已成功重建并启动 2.0.1 backend/frontend/nginx。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.0.1"}`。
- `curl --noproxy '*' http://127.0.0.1:8080/` 和 `curl --noproxy '*' http://10.10.11.229:8080/` 均返回 200。
- 容器内 nginx 可访问 backend health 和 frontend HTML。
- 已将本人 open_id 绑定到管理员用户 `贾飞`，并发送 2.0.1 飞书测试卡片成功；通知记录 `record_id=1`，状态为 `sent`。

2.0.2 飞书多人测试版验证结果：

- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml config --quiet` 通过。
- `.env` 已补充独立 `TASK_FOLLOW_LINK_SECRET` 和 7 天签名链接有效期配置，仍不进入 Git 跟踪。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已成功重建并启动 2.0.2 backend/frontend/nginx。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.0.2"}`。
- `curl --noproxy '*' http://10.10.11.229:8080/` 返回 200。
- 容器内 `lark_client.health_check()` 返回 `ok=true`，确认可获取飞书 tenant_access_token。
- 已将刘星科 open_id 绑定到人员 `刘星科`，并发送 2.0.2 飞书测试卡片成功；通知记录 `record_id=2`，状态为 `sent`。
- 通知记录 `record_id=2` 的 `web_url` 已确认为 `10.10.11.229` 局域网 `/api/auth/lark-link` 签名入口；容器内请求该完整入口返回 302，写入 session cookie，并跳转 `/meeting-board/overview`。
- 已完成 2.0.2 子任务执行入口权限补丁：`子任务执行` 改为个人更新入口，按“我执行 / 我负责 / 管理查看”分组；执行人和管理员可进入更新链路，负责人和总经理/观察者的管理查看项只读；部门级任务、会议看板和其他管理视角继续沿用原可见性。

2.0.3 飞书免登录首版代码级验证结果：

- `users.mobile`、手机号唯一校验、人员页手机号维护和脱敏显示已完成。
- 飞书客户端已新增手机号批量解析 open_id、OAuth code 换 user_access_token、获取登录用户信息能力。
- 后端已新增 `POST /api/lark/resolve-open-ids`、`GET /api/auth/lark-oauth/start` 和 `GET /api/auth/lark-oauth/callback`。
- 登录页已新增“飞书免登”入口，通知页已新增“解析 open_id”入口。
- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml config --quiet` 通过。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已成功重建并启动 2.0.3 backend/frontend/nginx。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.0.3"}`。
- 数据库运行时检查确认 `users.mobile` 字段存在。
- 容器内飞书诊断返回 `tenant_token`、`oauth_app_token`、`mobile_lookup` 均 `ok=true`。
- `GET /api/auth/lark-oauth/start` 返回飞书授权 302，redirect_uri 使用局域网 callback。
- 无效 OAuth state 会回登录页并展示飞书免登错误。
- 2.0.2 签名卡片入口仍可创建 session 并跳转目标页面。

2.0.4 生产迁移前版本实施内容：

- 人员手机号字段已改为邮箱字段，邮箱导入按姓名匹配人员。
- 飞书 open_id 批量解析已改为邮箱换 ID，诊断项改为 `email_lookup`。
- 母任务负责人、部门任务负责人、子任务负责人和子任务执行人已支持多人关系。
- 多执行人子任务按执行人分别生成周更新和飞书提醒，周更新增加 `assignee_id`。
- Docker Compose 支持通过环境变量把生产内网 HTTP 入口端口设为 `28081`，外网反代交由 IT 配置。
- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml config --quiet` 通过。
- `git diff --check` 通过。
- 额外 SQLAlchemy mapper 导入检查在本机 Python 环境导入 `sqlalchemy` 时卡住，已终止；本条不计为运行验证通过，运行级验证应在 Docker/后端虚拟环境中完成。

2.0.5 全局美化第二轮实施内容：

- 版本推进到 `2.0.5`。
- 母任务负责人、部门任务负责人、子任务负责人和子任务执行人保存后，后端返回前强制刷新多人关系，前端保存后等待重新拉取数据。
- 母任务卡片、母任务详情、子任务更新页等位置优先展示多人标签，减少旧 `owner/executor` 文本造成的显示误差。
- 会议看板指标卡、tab、母任务/部门汇总表和风险与逾期汇总表完成第一轮美化。
- 风险与逾期汇总表固定列宽，长文本省略显示并支持悬停查看完整内容。
- 本地默认 Docker 入口恢复为 `8080`，生产内网端口继续通过 `TASK_FOLLOW_DOCKER_HTTP_PORT=28081` 指定。

2.0.6 小屏适配与全局美化第三轮实施内容：

- 版本推进到 `2.0.6`。
- 中小屏下侧栏自动折叠为图标栏，主内容区获得更多空间。
- 页眉和内容区在小屏下降低间距，允许元信息紧凑排列。
- 部门任务、子任务执行、母任务详情展开表和会议看板汇总表列宽收敛，长文本继续省略并悬停查看完整内容。

2.0.7 核心业务页精修实施内容：

- 版本推进到 `2.0.7`。
- 母任务管理和战略目标下的母任务卡片统一展示编号、标题、负责人、牵头部门和任务统计。
- 母任务详情、部门任务总览和子任务执行入口统一业务表格、嵌套表和人员/部门标签视觉。
- 子任务执行的“我执行 / 我负责 / 管理查看”分组使用统一标题、数量和说明，管理查看区域降低视觉权重。

2.0.8 会议看板与全局 UI 收尾实施内容：

- 版本推进到 `2.0.8`。
- 会议看板三页统一指标卡、图表卡、tab、汇总表和风险逾期表视觉。
- 历史时间线保留矩阵结构，优化层级、表头、长文本省略和矩阵内部横向滚动。
- 通知记录和人员页统一为紧凑管理页样式，收敛工具栏、业务表格、绑定状态和结果文本展示。
