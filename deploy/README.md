# 部署说明

1.0.0 采用本地优先 Docker Compose 部署。

```bash
docker compose -f deploy/docker-compose.yml up --build
```

默认服务：

- `nginx`：统一入口，暴露 `http://localhost:8080`
- `frontend`：前端静态资源容器
- `backend`：FastAPI 服务
- `postgres`：PostgreSQL 16

局域网飞书联调优先使用：

```bash
bash scripts/start_lan_dev.sh
```

该脚本会先把 `.env` 中的 Web 地址和飞书 OAuth callback 同步到当前 `en0` 局域网 IP，再启动 Docker Compose。

附件目录默认挂载到：

```text
data/attachments
```

后续接入 NAS 时，调整 `TASK_FOLLOW_ATTACHMENT_ROOT` 和 Compose volume 挂载即可。
