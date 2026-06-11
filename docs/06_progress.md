# 公司工作任务跟踪系统进度记录

## 1. 文档用途

本文档用于记录项目阶段进展、已完成事项、待确认问题、验证结果和下一步计划。每次完成较大变更后应更新本文档。

## 2. 当前状态

当前状态：2.3.1 通知类型细分与定时提醒已进入实施，聚焦周五更新汇总、部门任务拆解通知、部门任务临期提醒和调试白名单。

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
