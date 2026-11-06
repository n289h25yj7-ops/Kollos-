# Familien-App: Backend + Web-App in einem Container.
# Bauen & starten: siehe README ("Online stellen").

# --- 1) Web-Version der App bauen -------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
# Leere API-URL: die Web-App spricht mit dem Server, von dem sie geladen wurde.
RUN npx expo export --platform web --output-dir /web

# --- 2) Backend ---------------------------------------------------------------
FROM node:22-alpine
WORKDIR /srv/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
COPY --from=web /web /srv/web

ENV NODE_ENV=production \
    PORT=4100 \
    DATA_DIR=/data \
    WEB_DIR=/srv/web \
    TRUST_PROXY=1 \
    TZ=Europe/Berlin
VOLUME /data
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4100/health || exit 1
CMD ["npx", "tsx", "src/server.ts"]
