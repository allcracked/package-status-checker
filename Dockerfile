# =============================================================================
# Stage 1: Build
# Installs all deps (including native build tools for better-sqlite3),
# compiles TypeScript, then prunes dev dependencies.
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Native build tools required to compile better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

# =============================================================================
# Stage 2: Production
# Lean image — only compiled JS and production node_modules.
# Secrets are injected at runtime by Coolify (not baked into the image).
# =============================================================================
FROM node:20-alpine AS production

# Run as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

# Copy compiled output and pruned node_modules from builder
COPY --from=builder --chown=appuser:appgroup /usr/src/app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /usr/src/app/node_modules ./node_modules

# Persistent data directory for SQLite — mount a Coolify volume here
RUN mkdir -p /data && chown appuser:appgroup /data

USER appuser

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Coolify uses this to determine container health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/ || exit 1

CMD ["node", "--max-old-space-size=256", "dist/index.js"]
