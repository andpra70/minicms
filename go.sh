#!/bin/bash

git add .
git commit -a -m "Update code"
git push

docker compose up --build -d 

