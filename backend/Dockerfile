FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache fontconfig ttf-liberation
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
COPY public/psc-logo.png ./public/psc-logo.png
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 8000
CMD ["node", "src/server.js"]
