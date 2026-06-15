# 公司工作任务跟踪系统进度记录

## 1. 文档用途

本文档用于记录项目阶段进展、已完成事项、待确认问题、验证结果和下一步计划。每次完成较大变更后应更新本文档。

## 2. 当前状态

当前状态：4.3.6 已完成执行者侧工作台、待归类事项和周报中心收尾；下一版本进入 4.4.0 任务负责人/责任人处理线，生产通知保持暂停口径。

记录日期：2026-06-15。

生产运行备注：因本周部分部门暂不使用任务跟踪系统，生产环境已临时关闭通知。当前应视为主动暂停，而非通知系统故障；排查通知问题前先确认 `env_of` 中 `TASK_FOLLOW_SCHEDULER_ENABLED`、`TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE` 和 `TASK_FOLLOW_NOTIFICATION_ALLOWLIST_EMAILS` 是否仍处于暂停口径。

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
- 已进入 2.0.9 看板关联性补强：看板指标和图表可点击查看数据详情，展开子任务行显示本周更新摘要。
- 已进入 2.1.0 数据对齐收尾：新增 CSV 增量同步脚本，按 02 表更新部门任务负责人，按 03 表同步子任务负责人、执行人、状态和 W24 更新，并汇总 W23 上周任务进度。
- 已进入 2.2.0 风险管控与通知：遗留事项与风险剥离，新增独立风险项、量化定级、风险项看板统计和高风险/逾期通知。
- 已进入 2.3.0 人员通讯录与局域网飞书测试准备：按通讯录补齐邮箱和新增人员，清理旧部门，人员页隐藏岗位入口，继续使用局域网地址测试通知/卡片。
- 已进入 2.3.x 局域网 OAuth 修复：新增 LAN 环境同步与启动脚本，飞书免登 redirect 支持按当前局域网访问 Host 生成。

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

2.0.9 看板关联性与周更新展开补强实施内容：

- 版本推进到 `2.0.9`。
- 会议看板六个指标卡、本周更新柱图、风险占比饼图支持页内数据详情弹窗。
- 近期任务甘特改为母任务截止日期管理，按月显示母任务编号并悬停展示母任务名称。
- 母任务详情和部门任务页展开子任务表新增本周完成内容、遗留事项两列，多执行人内容按姓名合并。

2.1.0 任务数据对齐同步实施内容：

- 版本推进到 `2.1.0`。
- 新增 `csv_alignment_sync` 增量同步脚本，支持 dry-run 和 apply。
- 已按 02 表同步 85 条部门任务来源行中的部门任务负责人关系。
- 已按 03 表有效源行同步 117 条子任务，保留当前系统编号，新增 12 条缺失子任务，清理 1 条测试子任务。
- 已同步 W23 上周任务进度和 W24 本周进度/遗留事项/下一步计划，多执行人按 assignee 分别生成周更新。
- 已写入 `BaseSyncRun` 记录，保留 2 条不在本次有效源中的业务旧子任务作为异常报告，不自动删除。
- 已在同步前备份 Postgres 到 `/private/tmp/task_follow_2_1_0_pre_sync_20260609.dump`。
- `python3 -m compileall backend/app` 通过。
- `docker compose -f deploy/docker-compose.yml up --build -d backend` 已重建并启动 2.1.0 backend。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.1.0"}`。
- 二次 dry-run 验证幂等：117 条源子任务全部匹配，新增/更新/周更新写入均为 0。
- 数据库复查：部门任务 86、子任务 119、周更新 193；其中 `2026-W23` submitted 134 条，`2026-W24` submitted 58 条。

2.2.0 风险管控与通知实施内容：

- 版本推进到 `2.2.0`。
- 新增独立 `risk_items` 风险项模型，挂载在子任务下，支持来源周更新、责任人、状态、处理日期和关闭说明。
- 风险等级改为 `影响分 1-5 × 可能性分 1-5` 自动计算，阈值为 `1-7 low`、`8-14 medium`、`15-25 high`。
- 遗留事项继续保留为周更新文本，不再自动生成风险记录，也不再写入旧协调项。
- 旧 `RiskRecord` 和旧 `CoordinationItem` 在迁移/运行时清理，`sub_tasks.risk_level` 重置为 `none`，`weekly_updates.risk_level` 清空。
- 新增风险项列表、创建、更新状态/关闭 API；执行人可在自己执行的子任务下登记风险，负责人和管理员可管理可见风险。
- 会议看板的风险任务、风险占比、风险与逾期汇总改为统计开放/处理中风险项。
- 子任务执行页和周更新页新增“登记风险”入口，会议看板详情弹窗展示风险项分值、等级、状态、责任人和来源子任务。
- 通知记录页新增风险逾期提醒；新增高风险、升级为高风险和开放/处理中风险逾期会生成通知记录并尝试飞书发送。
- 已在同步前备份 Postgres 到 `/private/tmp/task_follow_2_2_0_pre_risk_migration_20260609.dump`。
- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动 2.2.0 backend/frontend/nginx。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.2.0"}`。
- 数据库复查：`risk_items` 0、`risk_records` 0、`coordination_items` 0；193 条周更新 `risk_level` 全部为空，119 条子任务 `risk_level` 全部为 `none`。
- 风险分级验证：`3 × 3` 返回 `medium`，`4 × 4` 返回 `high`。
- 风险项写入路径以 rollback 事务验证通过：可按子任务默认负责人生成 `open` 风险项，事务回滚后未留下测试数据。
- 会议看板聚合验证通过：当前开放风险项为 0，风险饼图三档均为 0，风险与逾期汇总仍保留 19 条逾期子任务。

2.3.0 人员通讯录、部门清理与局域网飞书测试准备实施内容：

- 版本推进到 `2.3.0`。
- 新增 `people_department_sync` 通讯录与部门清理脚本，支持 dry-run 和 apply。
- 通讯录来源为 `浙江势通机器人科技有限公司-通讯录-导出.xlsx`，识别 `姓名` 和 `企业邮箱`，跳过公司主体邮箱 1 条。
- dry-run 验证：源表 87 条非空联系人，实际有效个人联系人 86 条，预计邮箱补齐 48 人、新增 pending 人员 38 人、阻塞 0。
- apply 已完成：邮箱补齐 48 人，新增人员 38 人；新增人员部门为空、状态为 `pending`、仅有 `executor` 角色。
- 旧部门已清理：`研发部` 迁移到 `研发中心`，`数据部` 迁移到 `数字与信息中心`，`质量部` 无引用后删除；旧部门残留引用复查为 0。
- 已修正 seed 基础部门列表为 `研发中心`、`数字与信息中心`、`质量体系部`、`信息中心`，重启后旧部门数量复查为 0。
- 已写入 `BaseSyncRun` 记录，`record_count=86`。
- 二次 dry-run 验证幂等：邮箱更新 0、新增 0、86 人 unchanged，旧部门迁移项均无待处理引用。
- 飞书诊断通过：tenant token、app token、email_lookup 均可用；批量解析 open_id 执行后 `resolved=0`、`blocked=84`、`failed=0`，阻塞原因为飞书邮箱查询返回项缺少 `open_id/user_id` 字段。
- 人员页已隐藏岗位列和新增/编辑岗位输入，后端 `users.title` 字段保留。
- 本机当前局域网 IP 为 `10.10.11.147`，`.env` 已将 `TASK_FOLLOW_WEB_BASE_URL` 和 OAuth callback 从旧 `10.10.11.229` 更新为 `10.10.11.147`。
- 已在同步前备份 Postgres 到 `/private/tmp/task_follow_2_3_0_pre_people_department_sync_20260609.dump`。
- `python3 -m compileall backend/app` 通过。
- `npm run build` 通过；仍存在 Vite 大 chunk 提示，不影响构建结果。
- `docker compose -f deploy/docker-compose.yml up --build -d` 已重建并启动 2.3.0 backend/frontend/nginx。
- `GET http://127.0.0.1:8080/api/health` 返回 `{"status":"ok","version":"2.3.0"}`。
- `curl --noproxy '*' http://127.0.0.1:8080/` 和 `curl --noproxy '*' http://10.10.11.147:8080/` 均返回 200。

2.3.x 局域网 OAuth 重定向修复实施内容：

- 新增 `scripts/sync_lan_env.py`，支持 `--check` 和 `--apply`，默认读取 `en0` IPv4，只更新 `.env` 中的 `TASK_FOLLOW_WEB_BASE_URL`、`TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI` 和 `TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE`。
- 新增 `scripts/start_lan_dev.sh`，启动前自动同步当前 LAN IP，随后执行 Docker Compose 启动，并验证 health、本机入口和局域网入口。
- 后端飞书免登 start 接口支持 `TASK_FOLLOW_LARK_OAUTH_REDIRECT_MODE=request_host`：局域网 IPv4 Host 访问时按当前 Host 生成 callback；localhost/127.0.0.1 访问时回退 `.env` 固定 callback。
- nginx 反代 `Host` 头已从 `$host` 改为 `$http_host`，避免生成 OAuth redirect 时丢失 `:8080` 端口。
- 该轮修复时检测到本机 `en0` 为 `10.10.11.229`，当时飞书开发者后台确认的重定向 URL 为 `http://10.10.11.229:8080/api/auth/lark-oauth/callback`。
- 本阶段不自动操作飞书开发者后台，后台重定向 URL 仍由人工确认；生产正式域名和反代留到 3.0。

2.3.1 通知类型细分与定时提醒实施内容：

- 版本推进到 `2.3.1`。
- 新增 `weekly_update_digest`，每周五 17:00 按执行人汇总本周未提交的子任务，每人只发送一张卡片。
- 新增 `department_task_split_required`，系统内人工新建部门任务后通知全部负责人；编辑时只通知新增负责人，导入同步不触发。
- 新增 `department_task_due_soon`，每天 09:00 扫描剩余 0-7 天且未完成的部门任务，首次进入窗口时通知全部负责人一次。
- 通知记录新增 `dedupe_key` 唯一去重键，防止服务重启、手动重跑和重复扫描造成重复通知。
- FastAPI lifespan 已接入单实例 APScheduler，时区固定为 `Asia/Shanghai`，支持调度状态接口。
- 当前局域网调试使用 `allowlist` 投递模式，只向贾飞和刘星科真实发送；其他目标记录为 `suppressed`，生产切换 `all` 即可全员启用。
- 通知页新增中文通知类型、类型筛选、调度状态、`suppressed` 状态和部门任务临期手动验证入口。
- 迁移前数据库备份：`/private/tmp/task_follow_2_3_1_pre_notifications_20260610.dump`。
- `python3 -m compileall backend/app backend/alembic/versions`、`npm run build`、`docker compose -f deploy/docker-compose.yml config --quiet` 和 `git diff --check` 均通过。
- `bash scripts/start_lan_dev.sh` 已重建并启动服务；`GET http://127.0.0.1:8080/api/health` 返回 `2.3.1`，本机和局域网入口均返回 200。
- 调度状态实测为运行中、时区 `Asia/Shanghai`、投递模式 `allowlist`；下一次部门任务临期扫描为 `2026-06-11 09:00`，下一次周更新提醒为 `2026-06-12 17:00`。
- 去重验证通过：周提醒按执行人汇总，部门任务拆解提醒和临期提醒重复执行均不会重复生成记录；非白名单人员记录为 `suppressed`，不会调用飞书发送接口。
- 当前数据库没有进入 0-7 天临期窗口的部门任务，因此首次定时扫描预计不产生临期提醒。
- 2026-06-10 启动时本机 `en0` 已变化为 `10.10.11.147`，启动脚本同步后的本地 OAuth callback 也为 `.147`；飞书后台已发布的 `.229` callback 与当前局域网地址不一致，下一次测试免登前需重新确认后台配置或固定局域网地址。

2.3.2 飞书卡片美化与风险通知实施内容：

- 版本推进到 `2.3.2`。
- 周更新汇总、部门任务拆解、部门任务临期和风险项提醒统一为交互卡片，使用语义色标题、事项摘要、关键字段、处理提示和单一主操作按钮。
- 周更新卡片最多展示 8 个子任务；部门任务临期卡片按 T-7 至 T-2 使用橙色、T-1/T-0 使用红色；风险卡片展示影响分、可能性、总分、责任人和来源任务。
- 风险通知由普通文本升级为交互卡片，仅在新增高风险、升级为高风险和开放风险逾期时发送，并按风险、触发类型、处理日期和接收人去重。
- 每日 09:00 调度新增独立 `risk_overdue_scan`，与部门任务临期扫描并行运行。
- 风险登记权限改为按具体任务关系判断：子任务执行人、子任务负责人和部门任务负责人可登记；风险责任人、子任务负责人、部门任务负责人和管理员可管理。
- 风险责任人默认取子任务第一负责人；管理人可在当前子任务负责人范围内改派，跨任务改派返回 422。
- 子任务接口返回风险登记权限、默认责任人和负责人候选；前端仅对有权限人员展示登记入口，会议看板增加风险处理弹窗。
- 新增 `POST /api/notifications/lark-card-preview-suite`，使用模拟数据发送四类验收卡片，不新增或修改真实任务和风险数据。
- 已向贾飞真实发送四张 `[验收示例]` 卡片，通知记录 `63-66` 均为 `sent`，飞书接口返回发送成功。
- 风险权限验证通过：执行人可以登记；非责任执行人不能管理；合法负责人改派成功；非法跨任务改派返回 422。
- 风险逾期去重验证通过：首次为两个接收人生成两条通知，第二次执行新增 0、跳过 2；测试风险和通知记录已清理。
- 浏览器验收通过：通知页显示调度运行中及三项下次执行时间，会议看板风险处理弹窗可正常展示责任人、状态、日期和处理说明。
- 迁移前数据库备份：`/private/tmp/task_follow_2_3_2_pre_card_risk_20260610.dump`。
- `python3 -m compileall backend/app backend/alembic/versions`、`npm run build`、`git diff --check` 均通过。
- `bash scripts/start_lan_dev.sh` 已重建服务；健康接口返回 `2.3.2`，本机和 `http://10.10.11.147:8080` 局域网入口均返回 200。

2.3.3 通知点击追踪与首次使用引导实施内容：

- 版本推进到 `2.3.3`。
- 飞书卡片签名链接新增通知记录 ID，并与接收人身份绑定；签名验证成功后记录首次点击、最后点击和累计点击次数。
- 旧版不含通知 ID 的签名链接继续允许登录，但不补记历史点击；通知与登录用户不匹配时拒绝访问且不登记点击。
- 通知记录页新增点击次数、首次点击时间和最后点击时间，并明确点击仅表示签名链接验证成功。
- 用户新增使用指南版本、处理状态和完成时间；任意认证方式首次进入时自动展示，完成或跳过后跨设备不再自动弹出。
- 全局布局新增按执行人、负责人、管理员区分文案的五步短引导，并在页头保留可重复打开的使用指南入口。
- 飞书业务卡片和测试卡片关闭转发，降低带签名自动登录链接被转发使用的风险。
- 修复历史 Alembic `0005` 对 `0004` 的错误引用，并将 `0005-0009` 内部 revision ID 规范为 32 字符以内，使迁移链可被标准工具解析和记录。
- 对齐用户邮箱、通知去重和风险项索引的 ORM 元数据，清理用户名冗余唯一索引；后端镜像将依赖安装层前置，后续业务代码重建可复用依赖缓存。
- 迁移前数据库备份：`/private/tmp/task_follow_2_3_3_pre_click_onboarding_20260610.dump`；数据库已标记到 Alembic `20260610_0009`，`alembic check` 返回无新增迁移差异。
- 点击链路验证通过：旧链接兼容登录；新链接并发点击两次累计为 2；通知接收人与登录用户不匹配时返回 401 且不增加点击数。
- 使用指南验证通过：首次进入自动展示管理员五步引导，关闭后不再自动弹出，页头“使用指南”可手动重开；验收后已重置贾飞引导状态以便实际首次体验。
- 已向贾飞发送新的测试卡片，通知记录 ID 为 `73`，发送状态 `sent`，等待人工点击验收。

2.3.4 权限分层与总经办双层引导实施内容：

- 版本推进到 `2.3.4`。
- 部门负责人改为按 `department_owner` 角色与所属部门联合判定，可查看本部门牵头母任务并管理相关部门任务；普通同部门人员不再自动获得任务可见权。
- 任务负责人改为按部门任务负责人关系判定，只能拆分和维护自己负责的部门任务，不能通过该身份进入母任务管理。
- 子任务负责人强制继承部门任务负责人；Web 表单取消独立负责人选择，部门任务负责人变化时同步全部未归档子任务。
- Excel 导入和 CSV 对齐不再把任务负责人自动授予部门负责人角色，重跑同步时同样保持负责人继承规则。
- 迁移清理历史上同时具有 `department_owner` 和 `task_owner`、且未被部门负责人字段明确标记的自动角色，避免升级后产生部门级越权。
- 使用引导身份调整为总经办会议相关、部门负责人、任务负责人、子任务执行者和观察者，纯技术管理员不再自动展示业务引导。
- 新增按用户、引导键和版本独立记录的引导进度；总经办首次进入展示系统框架引导，首次主动点击左侧会议看板时展示专项引导。
- 其他四类角色暂时保留 2.3.3 短引导，后续按一个版本一个角色逐步替换。
- 迁移前数据库备份：`/private/tmp/task_follow_2_3_4_pre_permission_guides_20260611.dump`。
- 数据迁移后 119 个有效子任务的第一负责人和多负责人关系均与所属部门任务一致，重复同步不产生差异。
- 权限断言通过：部门负责人可拆分本部门牵头母任务、不可拆分子任务；纯任务负责人不可访问母任务，只能维护本人负责的部门任务；普通同部门人员不再自动可见。
- 浏览器验收通过：总经办首次进入展示五步系统框架引导，首次主动点击会议看板后展示六步专项引导；任务负责人导航隐藏母任务入口，子任务拆解窗口只选择执行人并展示继承负责人。
- 修复 Ant Design Tour 完成与关闭回调重叠导致完成状态被记录为 `skipped` 的问题；完成状态优先且不可被后续跳过覆盖。
- `python3 -m compileall backend/app backend/alembic/versions`、`npm run build`、`alembic check`、Compose 配置检查和 `git diff --check` 均通过。
- `bash scripts/start_lan_dev.sh` 已重建服务；健康接口返回 `2.3.4`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。

2.3.5 部门负责人双层引导实施内容：

- 版本推进到 `2.3.5`。
- 部门负责人新增独立系统框架引导，不再使用旧版通用短引导。
- 部门负责人固定提供母任务管理和部门任务两个板块专项引导，仍仅在首次主动点击左侧菜单时自动触发。
- 当部门负责人本人存在有效未归档子任务执行关系时，额外提供子任务执行专项引导；无执行任务时不展示该引导。
- 前端 Tour 改为按 guide key 驱动，保留总经办 2.3.4 现有引导，并为母任务、部门任务和子任务页面补充稳定引导锚点。
- 本版不调整权限规则、任务数据、角色分配和数据库结构，继续复用 `user_guide_progress` 记录引导状态。
- `python3 -m compileall backend/app` 和 `npm run build` 已通过；前端构建仍存在 Vite 大 chunk 提示，不影响本版交付。
- 浏览器验收通过：刘博洋作为有执行任务的部门负责人，可触发框架、母任务管理、部门任务和子任务执行引导；刘静作为无执行任务的部门负责人，不返回也不触发子任务执行引导。
- 修复侧栏连续切换时板块引导偶发不触发的问题：除 Ant Design Menu 事件外，增加侧栏链接点击捕获，并以 `/auth/me` 返回的模块状态为准。
- `bash scripts/start_lan_dev.sh` 已重建服务；健康接口返回 `2.3.5`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。

2.3.6 任务负责人双层引导实施内容：

- 版本推进到 `2.3.6`。
- 任务负责人新增独立系统框架引导，不再使用旧版通用短引导。
- 任务负责人固定提供部门任务板块专项引导，围绕拆解子任务、指定执行人、继承负责人和跟踪进展展开。
- 当任务负责人本人存在有效负责或执行子任务时，额外提供子任务执行专项引导；无有效子任务关系时不展示该引导。
- 总经办、部门负责人仍按更高优先级展示既有引导；任务负责人不能进入母任务拆分职责的产品口径保持不变。
- 本版不调整权限规则、任务数据、角色分配和数据库结构，继续复用 `user_guide_progress` 记录引导状态。
- `python3 -m compileall backend/app`、`npm run build`、`alembic check`、Compose 配置检查和 `git diff --check` 均通过；前端构建仍存在 Vite 大 chunk 提示，不影响本版交付。
- 浏览器验收通过：李松恒作为任务负责人+执行人，可触发框架、部门任务和子任务执行引导；吴静璇作为无有效子任务关系的任务负责人，不返回也不触发子任务执行引导。
- `bash scripts/start_lan_dev.sh` 已重建服务；健康接口返回 `2.3.6`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。

2.3.7 子任务执行者双层引导实施内容：

- 版本推进到 `2.3.7`。
- 子任务执行者新增独立系统框架引导，不再使用旧版通用短引导。
- 当执行者本人存在有效未归档执行任务时，额外提供子任务执行专项引导；无有效执行任务时不展示该板块引导。
- 执行者引导聚焦本人任务、开启任务、周更新提交、风险登记和完成状态，不涉及任务拆解、负责人维护和会议审阅。
- 总经办、部门负责人和任务负责人仍按更高优先级展示既有引导；观察者继续留到后续版本。
- 本版不调整权限规则、任务数据、角色分配和数据库结构，继续复用 `user_guide_progress` 记录引导状态。
- `python3 -m compileall backend/app`、`npm run build`、`alembic check`、Compose 配置检查和 `git diff --check` 均通过；前端构建仍存在 Vite 大 chunk 提示，不影响本版交付。
- 浏览器验收通过：肖飞作为纯执行人且有执行任务，可触发框架和子任务执行引导；何庚霖作为纯执行人但无有效执行任务，不返回也不触发子任务执行引导。
- `bash scripts/start_lan_dev.sh` 已重建服务；健康接口返回 `2.3.7`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。

2.3.8 观察者双层引导实施内容：

- 版本推进到 `2.3.8`。
- 观察者新增独立系统框架引导，不再使用旧版通用短引导。
- 观察者固定提供会议看板、母任务管理、部门任务和历史时间线四个板块专项引导，均围绕只读审阅、任务追溯和会议准备展开。
- 当观察者本人存在有效未归档执行任务时，额外提供子任务执行专项引导，提示其按执行人身份完成周更新、风险登记和正式提交。
- 引导画像优先级调整为总经办最高，观察者优先于部门负责人、任务负责人和执行者；用于覆盖陈俊伊这类以审阅为主、同时兼任具体任务的多重身份场景。
- 本版不调整权限规则、任务数据、角色分配和数据库结构，继续复用 `user_guide_progress` 记录引导状态。
- `python3 -m compileall backend/app`、`npm run build`、`alembic check` 和 Compose 配置检查均通过；前端构建仍存在 Vite 大 chunk 提示，不影响本版交付。
- 服务已通过 `bash scripts/start_lan_dev.sh` 重建；健康接口返回 `2.3.8`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。
- 后端画像验证通过：陈俊伊返回 `guide_profile=observer`，并返回会议看板、母任务管理、部门任务、历史时间线和子任务执行五个观察者专项引导；总经办人员仍返回 `executive_office`。
- 浏览器验收通过：陈俊伊身份首次进入展示观察者系统框架引导，首次主动点击会议看板、母任务管理、部门任务、历史时间线和子任务执行时分别展示对应观察者专项引导；验收产生的 `observer_%` 引导进度已清理，保留真实首次体验。

2.4.0 正式上线前生产口径收敛实施内容：

- 版本推进到 `2.4.0`。
- 新增生产配置模板 `.env.production.example`，并使用本机实配文件 `env_of` 承载真实生产密钥；正式入口为 `https://task.citronmicrobot.com:4442`，OAuth callback 为 `https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback`。
- `.env.example` 不再默认使用贾飞、刘星科通知白名单；生产通知口径为 `TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE=all`。
- 新增 `TASK_FOLLOW_CORS_ORIGINS`、`TASK_FOLLOW_COOKIE_SECURE` 和 `TASK_FOLLOW_NOTIFICATION_DEBUG_TOOLS_ENABLED`，生产可收敛 CORS、启用 Secure Cookie 并关闭通知调试工具。
- 生产模式默认隐藏并阻断模拟提醒、测试卡片和四类验收卡片；保留飞书诊断、邮箱解析 open_id、正式周提醒、部门任务临期和风险逾期手动触发。
- 系统基础初始化和演示数据开关解耦：角色、权限、基础部门和初始管理员始终可初始化，`TASK_FOLLOW_SEED_DEMO_DATA=false` 不再阻断新库创建管理员。
- 新增 `scripts/preflight_prod_check.py`，只读检查正式 URL、OAuth callback、通知投递模式、调度、CORS、Cookie、飞书诊断、open_id 绑定和 Compose 端口。
- 本版仍不自动操作飞书开发者后台；正式 redirect URL 需人工确认并发布。
- `python3 -m compileall backend/app scripts/preflight_prod_check.py`、`npm run build`、Compose 配置检查、`alembic check` 和 `git diff --check` 均通过；前端构建仍存在 Vite 大 chunk 提示，不影响本版交付。
- `bash scripts/start_lan_dev.sh` 已重建当前局域网服务；健康接口返回 `2.4.0`，本机和 `http://10.10.11.229:8080` 局域网入口均返回 200。
- 当前局域网 `.env` 运行生产预检负面检查时，已正确拦截局域网 URL、`request_host` OAuth、通知白名单、非 Secure Cookie、CORS 未配置和调试工具未关闭等 blocker。
- `env_of` 在跳过真实 HTTP/飞书/DB 外联时预检通过；带 DB 检查时当前沙箱无法访问 Docker socket，会作为预检 blocker 暴露。
- 根据上线前端口隔离要求，正式外部入口已从旧生产端口调整为 `:4442`；`env_of` 已从当前 `.env` 继承真实密钥并覆盖生产口径，`.gitignore` 已忽略该实配文件，仓库只保留无密钥模板 `.env.production.example`。
- `python3 scripts/preflight_prod_check.py --env-file env_of --base-url https://task.citronmicrobot.com:4442 --skip-http --skip-lark --skip-db` 返回 `ready=true`，用于证明本地实配文件在非外联检查项上满足生产口径。
- 生产部署改为离线镜像包流程；新增 `docs/09_production_deploy_runbook.md`，部署目录固定为 `/data/jiafei/taskfollow`，外部 Nginx 监听 `4442` 并反代到 Docker 内网入口 `127.0.0.1:28081`。
- 修复 Compose 后端环境读取隐患：`backend.env_file` 不再固定读取开发 `.env`，生产通过 `TASK_FOLLOW_BACKEND_ENV_FILE=../env_of` 指定真实生产配置；预检会拦截 Compose 展开结果中的局域网地址、`request_host` 和非生产通知口径。
- 生产离线镜像包按生产机 `linux/amd64` 架构重新构建；手册增加错误架构镜像加载后的检查和 `--force-recreate` 恢复命令。
- 后端开关验证通过：`TASK_FOLLOW_COOKIE_SECURE=true` 时 session cookie 选项包含 `secure=True`；`TASK_FOLLOW_NOTIFICATION_DEBUG_TOOLS_ENABLED=false` 时通知调试接口返回 403。

3.0.0 生产第一版上线记录：

- 版本推进到 `3.0.0`，作为生产第一版发布标记。
- 正式入口确认为 `https://task.citronmicrobot.com:4442`；网络链路为公网 `4442` NAT 到生产机 `10.10.20.100:442`，生产机 Nginx 监听 `442` 并反代到 Docker 内网入口 `127.0.0.1:28081`。
- 生产 Docker 内网健康检查和公网正式健康检查均已返回生产版本；生产页面可正式登录。
- 飞书 OAuth 生产 callback 继续使用公网地址 `https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback`；OAuth start 检查需使用 GET，不使用 `curl -I` 的 HEAD 请求。
- 生产初始部署后数据库为空，已确认原因是 Docker volume 不随镜像包迁移；本机业务库已导出 custom dump，生产通过 `pg_restore --clean --if-exists` 恢复人员、任务、子任务和周更新数据。
- 本次迁移问题已集中记录到 `docs/09_production_deploy_runbook.md`：包括 amd64 镜像重打、NAT 端口 4442->442、OAuth HEAD 405、数据库 dump/restore、Compose 误读 `.env`、Docker 残留清理。

3.1.0 手机适配第一阶段实施内容：

- 版本推进到 `3.1.0`。
- 移动端断点统一为 `900px` 以下，用顶部菜单按钮和 Ant Design 抽屉承载导航；桌面端继续保留左侧栏。
- 移动端顶部保留当前用户、周次、使用指南和退出入口，内容区全宽展示并避免全局横向滚动。
- “子任务执行”页在手机端改为分组卡片，优先保障“我执行”任务的更新和风险入口。
- “子任务周更新”页在手机端改为单列任务信息、纵向操作和底部保存/提交按钮，降低手机填报成本。
- 本版不调整数据库结构和后端业务接口；会议看板、历史时间线、通知、人员和后台管理页面后续分批专项适配。
- 3.x 中间版本不重新打生产离线包，下一次完整打包留到 4.0.0 前的测试闭合版本。

3.1.1 手机适配第二阶段实施内容：

- 版本推进到 `3.1.1`。
- 手机端部门任务页使用顶部部门选择器、部门任务卡片和可展开子任务卡片，保留拆解与编辑入口。
- 手机端会议看板总览改为双列指标、紧凑图表、风险逾期卡片和全屏指标明细，桌面端继续保留表格。
- 新增 `POST /api/sub-tasks/{sub_task_id}/reopen`；仅子任务负责人、管理员或具备 `permission.manage` 的人员可以撤回完成。
- 撤回完成后子任务恢复为 `in_progress`，任务进度和当前周相关周更新进度重置为 `0`；历史周更新、风险、开启时间和完成事件不删除，并新增 `reopened` 事件。
- 子任务完成和撤回完成均增加二次确认；负责人可只读进入更新页处理撤回，但不能代执行人填写周更新。
- 本版不调整数据库结构，不发送撤回通知，也不反向修改母任务和部门任务状态。
- 已完成回归验证：负责人撤回成功、仅执行人返回 `403`、重复撤回返回 `409`；当前周进度归零且周更新内容与提交状态保留。
- 已在 `390x844`、`430x932` 和 `1440x900` 视口验收部门任务与会议总览，手机端无全局横向滚动，桌面表格交互保持不变。

3.2.0 生产通知收口与手机适配闭环实施内容：

- 版本推进到 `3.2.0`。
- 删除模拟提醒、测试卡片和四类验收卡片的后端接口、请求模型、模拟数据构造和前端入口；正式卡片模板不再接受 `preview` 参数。
- 通知记录默认排除 `card_preview`、历史测试卡片和历史模拟提醒；管理员可主动勾选“查看历史测试记录”进行审计。
- 手动发送周更新、部门任务临期和风险逾期提醒前增加全员正式投递确认，继续遵循现有去重键。
- 手机端完成母任务管理与详情、母任务看板、部门看板、历史时间线、通知记录、人员、角色权限和 Base 同步专项布局。
- 手机端权限修改改为先调整后显式保存；Base 清空导入要求输入确认文字；人员新增使用移动弹窗。
- 全局 viewport 增加 `viewport-fit=cover`，统一安全区域、触控高度、长文本换行和横向溢出约束。
- 原计划本版不制作生产离线包，下一次完整打包留到 `4.0.0`；因通知收口和手机闭环属于生产重要体验修复，验收后例外制作 3.2.0 生产离线同步包。

3.2.0 生产同步包补充：

- 修复生产预检健康版本隐患：`scripts/preflight_prod_check.py` 改为读取仓库 `VERSION`，不再硬编码 `3.0.0`。
- 新增 `scripts/package_prod_offline.sh`，统一执行静态检查、前端构建、Compose 配置检查、`linux/amd64` 镜像构建、镜像架构校验、镜像保存和 `release_packages/` 压缩包生成；`/private/tmp` 仅作为临时 staging。
- 更新 `docs/09_production_deploy_runbook.md`、`README.md` 和 `deploy/README.md` 的 3.2.0 离线包名称、健康检查版本和生产同步说明。

3.2.1 预检分级与周更新附件权限实施内容：

- 版本推进到 `3.2.1`。
- 生产预检 `open_id` 检查改为按正式通知目标分级：周更新待提交执行人、部门任务负责人和风险通知目标缺失为 blocker，暂无通知目标人员缺失为 warning。
- 生产预检增加 `--base-url` 纯文本校验，避免粘贴 Markdown 链接导致正式入口检查异常。
- 周更新新增附件上传、下载和删除接口；附件只关联具体 `weekly_update`，文件保存到 `TASK_FOLLOW_ATTACHMENT_ROOT/weekly_updates/{id}/`。
- 子任务更新页新增附件卡片；无周更新记录时先保存草稿再上传，手机端附件列表和按钮全宽展示。
- 历史时间线附件改为下载链接；缺少磁盘原文件的历史附件不展示，从本周开始启用真实可下载附件。
- 附件下载权限跟随子任务/周更新可见范围，上传人、执行人、负责人、部门任务负责人、总经办/观察者和管理员可按关系下载，无关任务负责人不可下载。

4.0.0 生产急修同步版实施内容：

- 版本推进到 `4.0.0`，将 3.2.1 已验收能力作为生产急修同步包发布。
- 生产离线包继续输出到仓库 `release_packages/`，`/private/tmp` 仅作为临时 staging，成功后清理。
- 部署手册、README 和 deploy README 已同步 `task-follow-system-4.0.0` 解压目录、`task-follow-system-4.0.0-images.tar` 镜像包和 `/api/health` 期望版本。
- 本版不改变生产域名、NAT、外部 Nginx 或数据库 volume；附件宿主机目录固定为 `/data/jiafei/taskfollow/data/attachments`，避免换版本目录时附件路径跟随解压目录变化。
- 生产升级仍沿用加载镜像后 `docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build`。

4.1.0 部门管理实施内容：

- 版本推进到 `4.1.0`。
- 新增管理员部门管理接口和页面，支持新增部门、编辑部门名称和删除无引用部门。
- 删除部门前固定检查人员、母任务、部门任务、部门任务多部门关联和子部门引用；存在引用时返回阻塞原因，不执行删除。
- 现有 `/departments` 列表接口保持不变，人员、母任务和部门任务等选择器会自动看到新增或改名后的部门。
- 本版不默认制作生产离线包，完成验收后如需生产同步再单独打包。

4.2.0 飞书汇报集成可行性与任务治理方案实施内容：

- 版本推进到 `4.2.0`。
- 新增 `docs/10_report_integration_feasibility.md`，面向大领导、人事和系统建设侧说明飞书汇报、系统周报和任务治理边界。
- 明确系统内生成个人周报可行，飞书原生汇报自动提交当前未发现确定开放接口，不能作为已承诺能力。
- 明确不建议建设长期游离在任务树外的“日常任务池”，后续若实施应以“待归类事项”承接临时工作，归类后补拆任务或关闭为非任务型记录。
- 复核飞书官方汇报开放能力：当前可读规则和任务，查询任务可返回 `form_contents`；绩效补充信息导入属于绩效数据，不等同于汇报周报提交。
- 本版只更新版本和文档，不新增表、不修改业务接口、不制作生产离线包。
- 本轮验证：`python3 -m compileall backend/app scripts/preflight_prod_check.py`、`npm run build`、`git diff --check` 均通过；前端构建仍有既有大 chunk 提示，不影响构建结果。

4.2.1 工作台化待归类事项与任务治理方案实施内容：

- 版本推进到 `4.2.1`。
- 更新 `docs/10_report_integration_feasibility.md`，把待归类事项从治理建议升级为工作台核心机制。
- 明确所有人都可在工作台提交待归类事项；4.2.1 初始口径为事项内容和责任人，4.3.0 根据 `4.2.1task.md` 修订为执行者侧先填写事项内容并选择归类方式，责任链处理后置。
- 明确责任人归类闭环：挂现有任务、补部门任务、提母任务缺失诉求或关闭为非任务记录。
- 明确工作台重新作为个性化行动首页，按多身份叠加展示；会议看板保留为总经办会议和管理审阅入口。
- 更新路线图和决策记录，说明 4.2.1 仍为讨论/方案版，不新增表、不修改业务接口、不制作生产离线包。
- 本轮验证：`python3 -m compileall backend/app scripts/preflight_prod_check.py`、`npm run build`、`git diff --check` 均通过；前端构建仍有既有大 chunk 提示，不影响构建结果。

4.3.0 执行者工作台与待归类事项分版本规划实施内容：

- 版本推进到 `4.3.0`。
- 明确 4.3.0 只做计划安排，不落地代码、不新增表、不制作生产离线包。
- 以 `4.2.1task.md` 为新增输入，同步“待归类事项作为补充入口、周报中心作为聚合出口、角色化工作台作为行动入口”的方案修订。
- 保留正式任务主线：战略目标 -> 母任务 -> 部门任务 -> 子任务 -> 周更新 -> 历史记录 -> 会议看板。
- 新增辅助线：待归类事项 -> 部门任务补充/部门常态化/跨部门协作/周报补充 -> 周报中心 -> 周报材料生成。
- 明确 4.3.x 只做执行者侧闭环：工作台、本人任务、待归类事项提交、个人状态查看、周报草稿、周报确认和历史快照。
- 拆分 4.3.1 至 4.3.6：执行者工作台框架、待归类事项提交入口、个人列表与状态可见、周报中心草稿聚合、周报确认复制和历史快照、执行者体验收尾与 4.4 准备。
- 明确 `4.2.1task.md` 的数据对象设计只作为参考，最终字段以后端实现需要、权限边界和迁移风险为准。
- 明确责任人归类、任务负责人处理、部门负责人补部门任务和总经办秘书处理母任务缺失进入 4.4.x 及后续版本。
- 生产通知继续按当前暂停记录处理，本版不顺手恢复通知。
- 本轮验证：`python3 -m compileall backend/app scripts/preflight_prod_check.py`、`npm run build`、`git diff --check` 均通过；前端构建仍有既有大 chunk 提示，不影响构建结果。

4.3.1 执行者工作台框架实施内容：

- 版本推进到 `4.3.1`。
- 新增 `/workbench` 工作台页面，登录成功、飞书免登、根路径 `/` 和旧 `/dashboard` 均进入工作台。
- 左侧菜单第一项新增“工作台”，会议看板保留为总经办会议和管理审阅入口。
- 工作台复用现有 `/api/sub-tasks`，仅统计当前用户 `viewer_relation` 为 `executor` 或 `both` 的执行任务。
- 工作台展示本周待更新、草稿未提交、临近截止、已完成和风险与卡点入口；更新按钮跳转现有子任务更新页，风险入口复用现有风险登记弹窗。
- 前端新增 `frontend/src/pages/Workbench.tsx`，并将任务身份、人员展示、子任务更新链接等公共展示逻辑抽到 `frontend/src/ui/taskDisplay.tsx`，避免继续把新增页面堆入 `App.tsx`。
- 本版不新增数据库结构、不实现待归类事项提交、不做负责人同意/退回、不恢复生产通知；4.3.2 再进入待归类事项底座。
- 本轮验证：`python3 -m compileall backend/app scripts/preflight_prod_check.py`、`npm run build`、`git diff --check` 均通过；前端构建仍有既有大 chunk 提示，不影响构建结果。Vite 临时服务可打开 `/workbench`，手机宽度 `390x844` 无全局横向滚动；因本机后端和 Docker daemon 未运行，API 数据加载、Docker 重建和 `/api/health` 检查需启动 Docker 后复跑。

4.3.2 待归类事项提交入口实施内容：

- 版本推进到 `4.3.2`。
- 新增 `work_items` 和 `work_item_events` runtime schema，待归类事项提交后默认进入 `pending`，并记录 `created` 事件。
- 新增 `/api/work-items/options` 和 `/api/work-items`，支持四类归类方式：挂载已有部门任务、本部门常态化工作、跨部门协作任务、周报补充记录。
- 挂载已有部门任务严格按本人所属部门过滤，部门任务主部门或多部门关联命中本人 `department_id` 才可选择；无所属部门用户不能提交该类型。
- 工作台新增“提交待归类事项”入口，表单独立拆到 `frontend/src/features/workItems/WorkItemSubmitModal.tsx`，移动端使用全屏表单弹窗。
- 本版不做周报确认、复制、导出、历史快照、责任人同意/退回、任务挂接、会议看板统计和生产通知恢复。

4.3.3 待归类事项个人列表与状态可见实施内容：

- 版本推进到 `4.3.3`。
- `work_items` 增加 `withdrawn_at`，runtime schema 使用幂等补列。
- 新增 `GET /api/work-items?scope=submitted|received`，`submitted` 只返回本人提交事项，`received` 按潜在责任关系返回待确认事项。
- 新增 `POST /api/work-items/{work_item_id}/withdraw`，仅提交人可撤回本人 `pending` 事项，撤回后状态为 `withdrawn` 并写入 `work_item_events`。
- 工作台新增“待归类事项”区域，包含“我的提交”和“待我确认”两个视图；待我确认本版只读，提示处理能力将在 4.4.x 开放。
- 本版不做同意、退回、挂任务、双审核、部门统计、会议看板统计和通知。

4.3.4 周报中心草稿聚合实施内容：

- 版本推进到 `4.3.4`。
- 新增 `GET /api/weekly-reports/draft`，默认聚合当前周，也支持 `week_key=YYYY-Www` 查询历史周草稿。
- 周报草稿仅返回当前登录用户本人数据：作为执行人的周更新、本人未撤回待归类事项、周更新风险/卡点文本、开放/处理中风险项和下周计划。
- 新增 `/weekly-report` 周报中心菜单和页面，页面独立放在 `frontend/src/pages/WeeklyReport.tsx`，展示组件放在 `frontend/src/features/weeklyReport/`。
- 工作台新增“查看本周周报草稿”快捷入口，手机端使用卡片和分区展示，长文本和附件链接自动换行。
- 本版不新增 `weekly_reports` 表，不做确认、复制、导出、历史快照、飞书汇报回写和通知。

4.3.5 周报确认、复制与历史快照实施内容：

- 版本推进到 `4.3.5`。
- 新增 `weekly_reports` 快照表，runtime schema 幂等建表；同一用户同一周唯一，重复确认覆盖本人本周快照。
- 新增 `POST /api/weekly-reports/confirm`、`GET /api/weekly-reports/history`、`GET /api/weekly-reports/{id}`、`GET /api/weekly-reports/{id}/copy-text`。
- 周报中心新增确认本周周报、历史周报、详情弹窗和复制文本能力；复制失败时展示文本弹窗供手动复制。
- 周报文本固定六段，覆盖正式任务进展、跨部门协作补充、部门常态化工作、周报补充记录、风险与问题和下周计划。
- 本版不做导出文档、飞书原生汇报回写、通知、责任人同意/退回、挂任务、双审核、部门统计和会议处理。
- 4.3.6 仍作为执行者侧收尾版本；4.3.7 至 4.3.9 不再规划，验收通过后直接进入 4.4.0。

4.3.6 执行者侧收尾与 4.4 切换实施内容：

- 版本推进到 `4.3.6`。
- 工作台无执行任务、待归类事项空状态和待我确认只读提示已收口，明确处理能力从 4.4.0 开始开放。
- 周报中心强化快照语义：确认后形成历史快照，不随任务或事项变化自动改变；同一周再次确认会覆盖本周快照。
- 周报中心历史空状态、详情加载失败、复制失败和手动复制弹窗文案已优化，移动端按钮保持全宽可点。
- 取消 4.3.7 至 4.3.9 缺陷缓冲规划，4.3.6 验收通过后直接进入 4.4.0 任务负责人/责任人处理线。
- 本版不新增数据库结构，不做导出文档、飞书汇报回写、通知恢复、责任人确认/退回、任务挂接、双审核、部门统计或会议处理。
