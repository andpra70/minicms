#!/bin/bash

set -euo pipefail

REGISTRY="docker.io"
USERNAME="andpra70"
IMAGE_NAME="minicms"
TAG="latest"
IMAGE_REF="${REGISTRY}/${USERNAME}/${IMAGE_NAME}:${TAG}"

docker build -t "${IMAGE_REF}" -f Dockerfile .
docker push "${IMAGE_REF}"
