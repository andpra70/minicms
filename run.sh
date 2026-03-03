#!/bin/bash

set -euo pipefail

REGISTRY="docker.io"
USERNAME="andpra70"
IMAGE_NAME="minicms"
TAG="latest"
CONTAINER_NAME="minicms"
PORT="6061"
IMAGE_REF="${REGISTRY}/${USERNAME}/${IMAGE_NAME}:${TAG}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  docker rm -f "${CONTAINER_NAME}"
fi

docker pull "${IMAGE_REF}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:${PORT}" \
  "${IMAGE_REF}"
