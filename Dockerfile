# Stage 1: Base image
FROM node:24.18.0-alpine AS base
WORKDIR /app
COPY package*.json ./

# Stage 2: Builder
FROM base AS builder
RUN npm ci
COPY tsconfig.json tsconfig.test.json ./
COPY src/ ./src/
COPY db/ ./db/
RUN npm run build

# Stage 3: Migration (Includes development dependencies for node-pg-migrate)
FROM base AS migration
RUN npm ci --include=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
CMD ["npm", "run", "migrate:up"]

# Stage 4: Production Runtime
FROM base AS runtime
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
