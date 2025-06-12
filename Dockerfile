# Use official Node.js slim image
FROM node:20-slim

# Install required dependencies for Puppeteer & Chrome
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Puppeteer and download compatible Chrome (v137+)
RUN npm i -g puppeteer@24.10.0 && \
    npx puppeteer browsers install chrome

# Create app directory and copy files
WORKDIR /app
COPY . .

# Install app dependencies
RUN npm install

# Set environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/app/node_modules/puppeteer/.local-chromium/linux-1371012/chrome-linux64/chrome
ENV PORT=8080

# Expose port for Cloud Run
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
