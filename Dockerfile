# syntax=docker/dockerfile:1

# ---- build: install all dependencies, compile TypeScript, CSS and static pages
FROM node:26-slim AS build
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime: compiled output plus production dependencies only
FROM node:26-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system app && useradd --system --gid app --home /app app
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
USER app
EXPOSE 3000
# Run node directly so it is PID 1 and receives SIGTERM. The worker service
# overrides this with: node dist/entrypoints/worker.js
CMD ["node", "dist/entrypoints/web.js"]
