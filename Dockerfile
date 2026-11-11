# ---------- 1) build do front (Vite + React + TS) ----------
FROM node:24-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 2) build do servidor (TypeScript -> JS) ----------
FROM node:24-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---------- 3) imagem final ----------
FROM node:24-alpine
# versão da aplicação (vem do compose: ${APP_VERSION:-X.Y.Z}) — aparece no label da imagem
ARG APP_VERSION=dev
LABEL org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.source="https://github.com/Sebratel/dev_ReactJS_AcessControl"
ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PORT=8080

RUN apk add --no-cache tzdata wget && \
    addgroup -S app && adduser -S app -G app && \
    mkdir -p /app/data && chown app:app /app/data

WORKDIR /app
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/package.json ./package.json
COPY --from=server /app/server/dist ./dist
COPY --from=web /app/web/dist ./public
ENV PUBLIC_DIR=/app/public \
    DATA_PATH=/app/data
# banco SQLite da aplicação (cadastros, concessões e log) — montar um volume aqui
VOLUME ["/app/data"]

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" > /dev/null || exit 1

CMD ["node", "dist/main.js"]
