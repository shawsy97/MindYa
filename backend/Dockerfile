FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080

CMD ["npm", "run", "start"]
