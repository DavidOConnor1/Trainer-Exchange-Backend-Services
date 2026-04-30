FROM node:22-alpine AS builder

WORKDIR /app
COPY services/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

RUN addgroup -g 1001 -S nodejs && \
    adduser -S -u 1001 -G nodejs nodejs

WORKDIR /app

COPY --chown=nodejs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs services/card-data-services/ .

# Create empty .env file (prevents file not found error)
RUN touch .env

# Remove development files
RUN rm -rf tests/ .git/ .github/ coverage/ && \
    npm cache clean --force

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server/server.js"]