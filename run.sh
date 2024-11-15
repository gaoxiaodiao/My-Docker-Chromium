#!/bin/bash
# docker compose up --build -d
# open Google and type “Hello World!”, then send a notification to Telegram, wait for 10 seconds, and exit.
docker exec -it chromium /usr/bin/node /app/main.js -s "https://google.com" -l "/app/plugins/pluginDemo.js"