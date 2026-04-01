FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev && npm cache clean --force

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
COPY scripts ./scripts

RUN mkdir -p /app/data/logs

EXPOSE 9000

CMD ["node", "dist/main.js"]
