FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/client/package.json apps/client/package.json
COPY --from=builder /app/apps/server/package.json apps/server/package.json
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm","start"]
