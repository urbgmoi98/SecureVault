FROM node:20-alpine AS dependencies

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache libstdc++ \
  && addgroup -S appgroup \
  && adduser -S appuser -G appgroup \
  && chown appuser:appgroup /app

COPY --from=dependencies --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

USER appuser
EXPOSE 3000
CMD ["node", "server.js"]
