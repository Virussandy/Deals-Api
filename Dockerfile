# Use official Node.js image (based on Debian)
FROM node:20

# Install required system dependencies for Puppeteer
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

# Install Puppeteer globally (v24.10.0)
RUN npm install -g puppeteer@24.10.0 && \
    npx puppeteer browsers install chrome

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install project dependencies
RUN npm install

# Set environment variables
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the app
CMD ["node", "server.js"]
