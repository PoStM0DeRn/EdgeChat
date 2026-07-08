FROM oven/bun:1 AS builder
WORKDIR /build

COPY package.json bun.lock ./
RUN bun install

COPY prisma/ ./prisma/
RUN bunx prisma generate

COPY . .
RUN bun run build


FROM oven/bun:1-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y caddy && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/.next/standalone/ ./next-service-dist/
COPY --from=builder /build/.next/static/ ./next-service-dist/.next/static/
COPY --from=builder /build/public/ ./next-service-dist/public/

COPY --from=builder /build/prisma/ ./prisma/
COPY --from=builder /build/node_modules/prisma/ ./node_modules/prisma/
COPY --from=builder /build/node_modules/@prisma/ ./node_modules/@prisma/
COPY --from=builder /build/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /build/node_modules/.bin/ ./node_modules/.bin/

COPY Caddyfile ./
COPY docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/db /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

VOLUME ["/app/db", "/app/uploads"]

EXPOSE 81 3000

ENTRYPOINT ["/app/entrypoint.sh"]
