FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
USER node
EXPOSE 3000 3100
CMD ["node","src/api/server.js"]
