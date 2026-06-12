#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(tr -d '[:space:]' < "${ROOT}/VERSION")"
STAMP="${TASK_FOLLOW_PACKAGE_STAMP:-$(date +%Y%m%d)}"
ARCHIVE_NAME="task-follow-system-${VERSION}-prod-offline-${STAMP}"
PACKAGE_DIR="task-follow-system-${VERSION}"
RELEASE_DIR="${TASK_FOLLOW_RELEASE_DIR:-${ROOT}/release_packages}"
STAGING="/private/tmp/${PACKAGE_DIR}"
ARCHIVE="${RELEASE_DIR}/${ARCHIVE_NAME}.tar.gz"
IMAGE_TAR="${STAGING}/docker-images/task-follow-system-${VERSION}-images.tar"
PLATFORM="${TASK_FOLLOW_PACKAGE_PLATFORM:-linux/amd64}"

mkdir -p "${RELEASE_DIR}"

if [[ -e "${STAGING}" || -e "${ARCHIVE}" ]]; then
  echo "Package path already exists: ${STAGING} or ${ARCHIVE}" >&2
  echo "Set TASK_FOLLOW_PACKAGE_STAMP to a new value and rerun." >&2
  exit 1
fi

if [[ ! -f "${ROOT}/env_of" ]]; then
  echo "Missing production env file: ${ROOT}/env_of" >&2
  exit 1
fi

echo "==> Version: ${VERSION}"
echo "==> Platform: ${PLATFORM}"
echo "==> Staging: ${STAGING}"

cd "${ROOT}"

echo "==> Static checks"
python3 -m compileall backend/app scripts/preflight_prod_check.py
npm --prefix frontend run build
docker compose --env-file env_of -f deploy/docker-compose.yml config --quiet
git diff --check

echo "==> Build production images for ${PLATFORM}"
docker buildx build --platform "${PLATFORM}" -t task-follow-system-backend:latest --load backend
docker buildx build --platform "${PLATFORM}" -t task-follow-system-frontend:latest --load frontend

echo "==> Verify image architecture"
docker image inspect --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}' \
  task-follow-system-backend:latest \
  task-follow-system-frontend:latest \
  postgres:16-alpine \
  nginx:1.27-alpine

BACKEND_ARCH="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' task-follow-system-backend:latest)"
FRONTEND_ARCH="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' task-follow-system-frontend:latest)"
POSTGRES_ARCH="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' postgres:16-alpine)"
NGINX_ARCH="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' nginx:1.27-alpine)"

if [[ "${BACKEND_ARCH}" != "${PLATFORM}" || "${FRONTEND_ARCH}" != "${PLATFORM}" || "${POSTGRES_ARCH}" != "${PLATFORM}" || "${NGINX_ARCH}" != "${PLATFORM}" ]]; then
  echo "Image architecture mismatch." >&2
  echo "backend=${BACKEND_ARCH}, frontend=${FRONTEND_ARCH}, postgres=${POSTGRES_ARCH}, nginx=${NGINX_ARCH}" >&2
  echo "Pull linux/amd64 postgres:16-alpine and nginx:1.27-alpine before packaging if needed." >&2
  exit 1
fi

echo "==> Copy source and production env"
mkdir -p "${STAGING}/docker-images"
rsync -a \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude '.venv/' \
  --exclude 'venv/' \
  --exclude 'env/' \
  --exclude 'node_modules/' \
  --exclude 'backend/.env' \
  --exclude 'backend/.env.*' \
  --exclude 'frontend/.env' \
  --exclude 'frontend/.env.*' \
  --exclude 'frontend/node_modules/' \
  --exclude 'frontend/dist/' \
  --exclude 'UI/' \
  --exclude 'dist/' \
  --exclude 'build/' \
  --exclude '__pycache__/' \
  --exclude '.pytest_cache/' \
  --exclude '.ruff_cache/' \
  --exclude 'data/attachments/*' \
  --exclude 'migration_artifacts/' \
  --exclude 'base_download/' \
  --exclude 'docker-images/' \
  --exclude 'release_packages/' \
  --exclude '*_nginx/' \
  --exclude '*.csv' \
  --exclude '*.xlsx' \
  --exclude '*.xls' \
  --exclude '*.tar' \
  --exclude '*.tar.gz' \
  --exclude '*.pem' \
  --exclude '*.key' \
  --exclude '*.p12' \
  --exclude '*.pfx' \
  "${ROOT}/" "${STAGING}/"

chmod 600 "${STAGING}/env_of"

echo "==> Save Docker images"
docker save -o "${IMAGE_TAR}" \
  task-follow-system-backend:latest \
  task-follow-system-frontend:latest \
  postgres:16-alpine \
  nginx:1.27-alpine

echo "==> Create archive"
tar -C "/private/tmp" -czf "${ARCHIVE}" "${PACKAGE_DIR}"
rm -rf "${STAGING}"
find "${RELEASE_DIR}" -maxdepth 1 -type f -name 'task-follow-system-*-prod-offline-*.tar.gz' ! -name "${ARCHIVE_NAME}.tar.gz" -delete

echo "Package ready:"
echo "${ARCHIVE}"
