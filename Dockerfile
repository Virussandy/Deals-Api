FROM node:20-slim

# Install required dependencies for Chromium
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
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files and install dependencies
COPY . .

RUN npm install

# Install Chrome explicitly using puppeteer-core
RUN node -e "require('puppeteer-core/lib/cjs/puppeteer/node/install.js').download('chrome')"

# Set env and expose port
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
