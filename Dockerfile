# syntax=docker/dockerfile:1
# Single image: builds the client and serves it from the Fastify backend.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/sim/package.json packages/sim/
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST=/app/client
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/sim/package.json packages/sim/
COPY apps/client/package.json apps/client/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --workspace @neon-wilds/server --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/client/dist ./client
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "apps/server/dist/index.js"]
