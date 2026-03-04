#!/bin/bash

set -euo pipefail

git add .
git commit -a -m "Update code"
git push

docker compose down --remove-orphans
docker compose up --build -d
