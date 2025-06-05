# Use official Node.js image
FROM node:18-slim

# Install dependencies for Chromium to run
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation libasound2 libatk1.0-0 \
    libatk-bridge2.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy project files
COPY . .

# Install Node.js dependencies
RUN npm install

# Set environment variable to disable Puppeteer sandbox (needed on GCR)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start app
CMD ["node", "server.js"]
