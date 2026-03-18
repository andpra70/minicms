#!/bin/bash

set -euo pipefail

git add .
git commit -a -m "Update code"
git push

