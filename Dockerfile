FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-package-lock

COPY server.js hosted-auth.js ./
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "server.js"]
