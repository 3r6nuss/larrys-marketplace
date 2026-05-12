FROM node:20-slim

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Switch back to npm install for better resilience
RUN npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

# Port 3002 is the default for the API
EXPOSE 3002

CMD ["node", "index.js"]
