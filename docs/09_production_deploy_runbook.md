# 4.0.0 生产离线部署与升级操作手册

本手册适用于将离线包复制到生产机 `/data/jiafei/taskfollow` 后，从解压开始部署或升级。正式公网入口为 `https://task.citronmicrobot.com:4442`；NAT 将公网 `4442` 映射到生产机 `10.10.20.100:442`；生产机 Nginx 再反代到本系统 Docker 内网入口 `127.0.0.1:28081`。离线镜像包按生产机架构 `linux/amd64` 构建。

## 1. 解压离线包

```bash
cd /data/jiafei/taskfollow
tar -xzf task-follow-system-4.0.0-prod-offline-YYYYMMDD.tar.gz
cd task-follow-system-4.0.0
chmod 600 env_of
```

确认生产配置文件存在：

```bash
grep -E 'TASK_FOLLOW_WEB_BASE_URL|TASK_FOLLOW_DOCKER_HTTP_PORT|TASK_FOLLOW_ATTACHMENT_HOST_PATH|TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI|TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE|TASK_FOLLOW_COOKIE_SECURE|TASK_FOLLOW_BACKEND_ENV_FILE' env_of
```

期望关键值：

```text
TASK_FOLLOW_BACKEND_ENV_FILE=../env_of
TASK_FOLLOW_DOCKER_HTTP_PORT=28081
TASK_FOLLOW_ATTACHMENT_HOST_PATH=/data/jiafei/taskfollow/data/attachments
TASK_FOLLOW_WEB_BASE_URL=https://task.citronmicrobot.com:4442
TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI=https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
TASK_FOLLOW_NOTIFICATION_DELIVERY_MODE=all
TASK_FOLLOW_COOKIE_SECURE=true
```

创建稳定附件目录。数据库使用 Docker volume，不在版本目录里；附件使用宿主机目录，本版固定到 `/data/jiafei/taskfollow/data/attachments`，避免以后换版本目录时附件目录跟着变化。

```bash
mkdir -p /data/jiafei/taskfollow/data/attachments
```

如果旧版本目录里已经有附件文件，先复制到稳定目录。没有附件时这一步会提示源目录不存在，可以跳过。

```bash
cp -a /data/jiafei/taskfollow/task-follow-system-*/data/attachments/. /data/jiafei/taskfollow/data/attachments/ 2>/dev/null || true
```

## 2. 加载离线镜像

```bash
docker load -i docker-images/task-follow-system-4.0.0-images.tar
docker images | grep task-follow-system
docker images | grep -E 'postgres|nginx'
```

至少应看到：

```text
task-follow-system-backend
task-follow-system-frontend
postgres:16-alpine
nginx:1.27-alpine
```

如果生产机曾加载过错误架构镜像，重新加载新版镜像后执行：

```bash
docker image inspect --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}' task-follow-system-backend:latest task-follow-system-frontend:latest postgres:16-alpine nginx:1.27-alpine
```

四个镜像都应显示 `linux/amd64`。

## 3. 启动容器

首次启动或升级启动都使用同一组命令。`--no-build` 用于确保生产机不重新构建、不联网拉依赖。

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build
docker compose --env-file env_of -f deploy/docker-compose.yml ps
```

如果上一轮因镜像架构错误留下了已创建但未启动的容器，使用强制重建容器：

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build --force-recreate
```

查看启动日志：

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml logs --tail=120 backend
docker compose --env-file env_of -f deploy/docker-compose.yml logs --tail=120 nginx
```

确认 Docker 内网入口：

```bash
curl --noproxy '*' -sS http://127.0.0.1:28081/api/health
```

期望返回：

```json
{"status":"ok","version":"4.0.0"}
```

如果本机之前已有同名服务，先不要删除 volume。需要重启时只执行：

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml restart
```

## 4. 配置外部 Nginx 反代

本系统容器只暴露内网入口 `127.0.0.1:28081`。公网 `4442` 已通过 NAT 映射到生产机内网端口 `442`，因此生产机 Nginx 监听 `442`，再反代到 Docker 入口。

示例配置：

```nginx
server {
    listen 442 ssl http2;
    server_name task.citronmicrobot.com;

    ssl_certificate     /data/jiafei/taskfollow/ssl/task.citronmicrobot.com.pem;
    ssl_certificate_key /data/jiafei/taskfollow/ssl/task.citronmicrobot.com.key;

    location / {
        proxy_pass http://127.0.0.1:28081;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }
}
```

检查并重载 Nginx：

```bash
nginx -t
nginx -s reload
```

如果生产机使用 systemd 管理 Nginx，也可以使用：

```bash
systemctl reload nginx
```

## 5. 正式入口验证

反代启用后先检查生产机本地端口 `442`：

```bash
curl -k --noproxy '*' -sS --resolve task.citronmicrobot.com:442:127.0.0.1 https://task.citronmicrobot.com:442/api/health
```

再检查公网正式入口：

```bash
curl --noproxy '*' -sS https://task.citronmicrobot.com:4442/api/health
```

期望返回：

```json
{"status":"ok","version":"4.0.0"}
```

检查 OAuth redirect：

```bash
curl --noproxy '*' -sS -D - -o /dev/null 'https://task.citronmicrobot.com:4442/api/auth/lark-oauth/start?next_path=/meeting-board/overview'
```

检查响应头 `Location` 中的 `redirect_uri`，URL 解码后必须等于：

```text
https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
```

## 6. 飞书后台确认

进入飞书开放平台该应用的“安全设置”，确认“重定向 URL”已存在并已发布：

```text
https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
```

登录系统后进入“通知记录”页，点击“飞书诊断”。期望 tenant token 和 app token 均通过。

## 7. 上线前预检

在生产目录执行：

```bash
python3 scripts/preflight_prod_check.py --env-file env_of --base-url https://task.citronmicrobot.com:4442
```

只有当输出满足以下条件时，才进入发布确认：

```json
{
  "ready": true,
  "blockers": []
}
```

如果出现 blocker，先暂停上线。常见 blocker 处理：

- `http:health`：检查外部 Nginx、端口 `4442`、Docker 入口 `28081`。
- `http:oauth_callback`：检查飞书后台 redirect URL 是否为 `4442` 且已发布。
- `lark:diagnostic`：检查飞书应用密钥、权限和发布状态。
- `db:missing_open_id`：补齐相关人员 open_id 后再运行预检。
- `compose:*`：检查是否使用 `docker compose --env-file env_of ...`，以及 `env_of` 是否包含生产值。

## 8. 导入本机业务数据

生产包只包含代码、配置和镜像。若生产数据库是新 volume，需要单独复制本机导出的 PostgreSQL dump，并在生产目录恢复。

将 dump 文件复制到生产目录后执行：

```bash
cd /data/jiafei/taskfollow/task-follow-system-4.0.0
docker compose --env-file env_of -f deploy/docker-compose.yml stop backend
docker compose --env-file env_of -f deploy/docker-compose.yml cp task_follow_prod_data_YYYYMMDD.dump postgres:/tmp/task_follow.dump
docker compose --env-file env_of -f deploy/docker-compose.yml exec -T postgres pg_restore -U task_user -d task_follow --clean --if-exists --no-owner --no-acl --exit-on-error /tmp/task_follow.dump
docker compose --env-file env_of -f deploy/docker-compose.yml start backend
```

恢复后检查核心数据量：

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml exec -T postgres psql -U task_user -d task_follow -c "select 'users' as table_name, count(*) from users union all select 'parent_tasks', count(*) from parent_tasks union all select 'department_tasks', count(*) from department_tasks union all select 'sub_tasks', count(*) from sub_tasks union all select 'weekly_updates', count(*) from weekly_updates;"
curl --noproxy '*' -sS https://task.citronmicrobot.com:4442/api/health
```

## 9. 本次生产迁移问题记录

### 9.1 离线镜像架构错误

现象：生产机 `docker load` 后启动失败，提示镜像平台 `linux/arm64` 与宿主机 `linux/amd64` 不匹配。

原因：本地 Mac 默认构建/保存了 arm64 镜像。

处理：

```bash
docker buildx build --platform linux/amd64 -t task-follow-system-backend:latest --load backend
docker buildx build --platform linux/amd64 -t task-follow-system-frontend:latest --load frontend
docker pull docker.io/library/nginx@sha256:62223d644fa234c3a1cc785ee14242ec47a77364226f1c811d2f669f96dc2ac8
docker pull docker.io/library/postgres@sha256:79950da386bda7fcc9d57aa9aa9be6c6d7407596a9b8f68014b09a778a9ab316
docker tag docker.io/library/nginx@sha256:62223d644fa234c3a1cc785ee14242ec47a77364226f1c811d2f669f96dc2ac8 nginx:1.27-alpine
docker tag docker.io/library/postgres@sha256:79950da386bda7fcc9d57aa9aa9be6c6d7407596a9b8f68014b09a778a9ab316 postgres:16-alpine
docker image inspect --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}' task-follow-system-backend:latest task-follow-system-frontend:latest postgres:16-alpine nginx:1.27-alpine
```

后续打包前必须确认四个镜像均为 `linux/amd64`。

### 9.2 反代端口理解偏差

现象：生产机 Nginx 配置为监听 `4442` 后，公网访问 `4442` 连接被拒绝。

原因：实际 NAT 是“公网 `4442` -> 生产机 `442`”，生产机已有另一路“公网 `4443` -> 生产机 `443`”给其他系统使用。

处理：系统配置、飞书 OAuth 和公网访问仍使用 `https://task.citronmicrobot.com:4442`；生产机 Nginx 监听端口改为 `442`。

### 9.3 OAuth 检查使用 HEAD 导致 405

现象：`curl -I` 检查 OAuth start 返回 `HTTP/2 405`，响应头显示 `allow: GET`。

原因：`-I` 发的是 HEAD 请求，而 OAuth start 只允许 GET。

处理：使用 GET 但不跟随跳转：

```bash
curl --noproxy '*' -sS -D - -o /dev/null 'https://task.citronmicrobot.com:4442/api/auth/lark-oauth/start?next_path=/meeting-board/overview'
```

### 9.4 新生产库为空

现象：正式域名可登录，但人员、任务为空。

原因：离线包只包含代码、配置和镜像；PostgreSQL 数据在 Docker volume 中，不随镜像包迁移。

处理：从本机旧库 `pg_dump -Fc` 导出，生产机用 `pg_restore --clean --if-exists` 恢复。首次生产迁移使用的 dump 为 `task_follow_2_4_0_prod_data_20260611.dump`；后续升级按日期命名为 `task_follow_prod_data_YYYYMMDD.dump`。恢复后核心数据量应接近：`users=87`、`parent_tasks=34`、`department_tasks=86`、`sub_tasks=119`、`weekly_updates=194`。

### 9.5 Compose 误读开发 `.env`

风险：若 `backend.env_file` 固定为 `../.env`，生产容器会读取局域网测试配置，导致 OAuth redirect、通知白名单或 CORS 口径错误。

处理：`deploy/docker-compose.yml` 使用 `${TASK_FOLLOW_BACKEND_ENV_FILE:-../.env}`，生产 `env_of` 固定写入 `TASK_FOLLOW_BACKEND_ENV_FILE=../env_of`；预检脚本检查 Compose 展开结果不能包含 `10.10.*` 或 `request_host`。

### 9.6 Docker 残留清理

建议先看占用：

```bash
docker system df
docker system df -v
docker images -f dangling=true
```

安全优先的清理顺序：

```bash
docker builder prune -f
docker image prune -f
```

生产机不要随意执行 `docker system prune -a --volumes`，避免误删数据库 volume。

## 10. 回滚提示

如果需要回滚到上一版，优先保留 PostgreSQL volume，不执行 `docker compose down -v`。

推荐流程：

```bash
docker compose --env-file env_of -f deploy/docker-compose.yml stop
cd /data/jiafei/taskfollow/<上一版目录>
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build
```

回滚后重新检查：

```bash
curl --noproxy '*' -sS http://127.0.0.1:28081/api/health
curl --noproxy '*' -sS https://task.citronmicrobot.com:4442/api/health
```
