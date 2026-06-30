# Stage 1: Build
FROM node:18-alpine AS builder
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production && rm -f package-lock.json
COPY --from=builder /app/dist ./dist
# Create uploads directory and place default avatars
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "dist/index.js"]
