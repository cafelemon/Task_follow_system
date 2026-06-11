#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

eval "$(python3 scripts/sync_lan_env.py --apply --format shell)"

echo "LAN URL: ${TASK_FOLLOW_WEB_BASE_URL}"
echo "Lark OAuth redirect URL: ${TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI}"

docker compose -f deploy/docker-compose.yml up --build -d
docker compose -f deploy/docker-compose.yml restart nginx

health_url="http://127.0.0.1:8080/api/health"
for _ in $(seq 1 30); do
  health_body="$(curl -s "${health_url}" || true)"
  if printf '%s' "${health_body}" | grep -q '"status":"ok"'; then
    echo "Health OK: ${health_body}"
    break
  fi
  sleep 1
done

health_body="$(curl -s "${health_url}" || true)"
if ! printf '%s' "${health_body}" | grep -q '"status":"ok"'; then
  echo "Health check failed: ${health_url}" >&2
  echo "${health_body}" >&2
  exit 1
fi

local_code="$(curl --noproxy '*' -s -o /tmp/task_follow_start_lan_local.html -w '%{http_code}' http://127.0.0.1:8080/)"
lan_code="$(curl --noproxy '*' -s -o /tmp/task_follow_start_lan_lan.html -w '%{http_code}' "${TASK_FOLLOW_WEB_BASE_URL}/")"

echo "Local root HTTP: ${local_code}"
echo "LAN root HTTP: ${lan_code}"

if [ "${local_code}" != "200" ] || [ "${lan_code}" != "200" ]; then
  echo "Frontend entry check failed" >&2
  exit 1
fi

echo "Confirm this redirect URL in Feishu console:"
echo "${TASK_FOLLOW_LARK_OAUTH_REDIRECT_URI}"
