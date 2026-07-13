FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY ws-server.js ./

EXPOSE 3002

CMD ["node", "ws-server.js"]
