FROM node:20-alpine

# Add build tools for native modules (like better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
# Use npm ci for more reliable builds in CI/Docker
RUN npm ci --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Port 3002 is the default for the API
EXPOSE 3002

CMD ["node", "index.js"]
