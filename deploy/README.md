# 部署说明

4.0.0 采用 Docker Compose 部署，生产入口通过外部反向代理统一暴露。

```bash
docker compose -f deploy/docker-compose.yml up --build
```

默认服务：

- `nginx`：统一入口，本地默认暴露 `http://localhost:8080`；生产通过 `TASK_FOLLOW_DOCKER_HTTP_PORT=28081` 作为内网反代目标
- `frontend`：前端静态资源容器
- `backend`：FastAPI 服务
- `postgres`：PostgreSQL 16

局域网飞书联调可使用：

```bash
bash scripts/start_lan_dev.sh
```

该脚本会先把 `.env` 中的 Web 地址和飞书 OAuth callback 同步到当前 `en0` 局域网 IP，再启动 Docker Compose。局域网脚本不用于生产。

生产部署前，使用仓库根目录本机实配文件 `env_of` 或生产服务器环境变量；`.env.production.example` 仅作为无密钥模板参考。正式外部入口为：

```text
https://task.citronmicrobot.com:4442
```

飞书 OAuth 重定向 URL 为：

```text
https://task.citronmicrobot.com:4442/api/auth/lark-oauth/callback
```

使用离线包部署生产容器时，先加载镜像，再显式指定 `env_of` 启动：

```bash
docker load -i docker-images/task-follow-system-4.0.0-images.tar
docker compose --env-file env_of -f deploy/docker-compose.yml up -d --no-build
```

上线前执行只读预检：

```bash
python3 scripts/preflight_prod_check.py --env-file env_of --base-url https://task.citronmicrobot.com:4442
```

生产附件目录默认挂载到：

```text
/data/jiafei/taskfollow/data/attachments
```

后续接入 NAS 时，调整 `TASK_FOLLOW_ATTACHMENT_HOST_PATH` 即可；容器内仍固定使用 `/data/attachments`。
