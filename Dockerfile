# 런하이 API 서버 + 웹 앱 (단일 컨테이너)
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
# 서버 모드 웹 빌드 (같은 출처의 /api 사용)
RUN VITE_API_URL=/ npm run build -w @runhigh/web && npm run build -w @runhigh/server

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data WEB_DIST=/app/web
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/apps/server/dist ./server
COPY --from=build /app/apps/web/dist ./web
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/server.mjs"]
