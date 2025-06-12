# Puppeteer v24 requires Chrome 137+ and these dependencies
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
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer v24+ does not auto-install Chrome, so we must do it manually
RUN npm i -g puppeteer@24.10.0 && \
    npx puppeteer browsers install chrome

WORKDIR /app
COPY . .

# Install your project dependencies
RUN npm install

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
