FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund
COPY packages/database packages/database
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm --workspace @gtm/database run generate \
 && npm --workspace @gtm/shared run build \
 && npm --workspace @gtm/web run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo /app
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["npm", "run", "start"]
