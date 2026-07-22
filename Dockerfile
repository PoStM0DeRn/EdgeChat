FROM node:20-alpine AS builder
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma/ ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

RUN mkdir -p /build/db && DATABASE_URL="file:/build/db/custom.db" npx prisma db push --skip-generate

FROM node:20-alpine AS runner
WORKDIR /app

RUN mkdir -p /app/db /app/uploads

COPY --from=builder /build/.next/standalone/ ./next-service-dist/
COPY --from=builder /build/.next/static/ ./next-service-dist/.next/static/
COPY --from=builder /build/public/ ./next-service-dist/public/

COPY --from=builder /build/node_modules/@prisma/ ./node_modules/@prisma/
COPY --from=builder /build/node_modules/.prisma/ ./node_modules/.prisma/

COPY --from=builder /build/db/custom.db /app/db-init/custom.db

COPY docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

VOLUME ["/app/db", "/app/uploads"]

EXPOSE 3001

ENTRYPOINT ["/app/entrypoint.sh"]
