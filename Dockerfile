FROM lscr.io/linuxserver/chromium:latest

ENV CHROME_CLI="--remote-allow-origins=\* --remote-debugging-port=3003"

COPY ./src /app/

RUN cd /app/ && npm install && rm -rf /var/lib/apt/lists/*