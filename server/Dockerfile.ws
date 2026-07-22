FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY server/ws-server.js ./

EXPOSE 3000

CMD ["node", "ws-server.js"]
