# Yapix: API management, mock server and API testing (maintained continuation of YApi).
#   docker build -t yapix .
#   docker compose up        (see docker-compose.yml)

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build-client && npm prune --omit=dev --no-audit --no-fund \
    && rm -rf client/plugin-module.js test

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    YAPIX_CONFIG=/data/config.json
WORKDIR /app
COPY --from=build /app /app
RUN chmod +x /app/docker/entrypoint.sh \
    && mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.YAPIX_PORT || 3000) + '/api/user/status').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["/app/docker/entrypoint.sh"]
