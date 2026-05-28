FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm --workspace @gtm/database run generate \
 && npm --workspace @gtm/database run build \
 && npm --workspace @gtm/shared run build \
 && npm --workspace @gtm/api run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/node_modules /app/node_modules
COPY --from=builder /repo/packages/database /app/packages/database
COPY --from=builder /repo/packages/shared /app/packages/shared
COPY --from=builder /repo/apps/api /app/apps/api
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
