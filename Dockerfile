# Stage 1: Build frontend static files
FROM oven/bun:1 AS frontend-build
WORKDIR /app/frontend-svelte

# Install deps (cached layer)
COPY frontend-svelte/package.json frontend-svelte/bun.lock ./
RUN bun install --frozen-lockfile

# Copy source + build static SPA
COPY frontend-svelte/ ./
RUN bun run build


# Stage 2: Install backend production deps
FROM oven/bun:1 AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production


# Stage 3: Final — single bun process serves API + static + WS
FROM oven/bun:1
WORKDIR /app/backend

# Backend code + deps
COPY backend/src/ ./src/
COPY backend/package.json ./
COPY --from=backend-deps /app/backend/node_modules ./node_modules

# Built frontend → backend serves it as static files
COPY --from=frontend-build /app/frontend-svelte/build ./static

# SQLite data dir (mount as volume)
RUN mkdir -p ./data

# Tell backend where static files live
ENV STATIC_DIR=/app/backend/static
ENV DATABASE_URL=./data/database.db
# Use 8080 internally — phonemizer WASM grabs port 3000
ENV BACKEND_PORT=8080

EXPOSE 8080

CMD ["bun", "src/index.ts"]
