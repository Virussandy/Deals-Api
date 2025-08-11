// utils/browserManager.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Apply the stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// This variable will hold our single browser instance.
let browserInstance = null;

/**
 * These are the launch options for the Puppeteer browser.
 * They are configured to be efficient and avoid common issues in a server environment.
 */
const launchOptions = {
    headless: 'new',
    args: [
      '--start-minimized',
      '--disable-infobars',
      '--disable-popup-blocking',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas',
      '--disable-features=site-per-process',
      '--disable-breakpad',
      '--no-zygote',
      '--disable-web-security',
      '--start-maximized',
      '--window-size=1366,768',
      '--aggressive-cache-discard',
      '--disable-cache',
      '--disable-application-cache',
      '--disable-offline-load-stale-cache',
      '--disable-gpu-shader-disk-cache',
      '--media-cache-size=0',
      '--disk-cache-size=0',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--mute-audio',
      '--no-default-browser-check',
      '--autoplay-policy=user-gesture-required',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-notifications',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-sync',
    ],
};

/**
 * Gets the shared browser instance. If it doesn't exist or is disconnected,
 * it launches a new one.
 * @returns {Promise<import('puppeteer').Browser>} A promise that resolves to the browser instance.
 */
export async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  console.log('🚀 Launching new browser instance...');
  browserInstance = await puppeteer.launch(launchOptions);

  // Set up a listener to clear the instance if the browser disconnects.
  browserInstance.on('disconnected', () => {
    console.log('Browser disconnected. Cleaning up instance.');
    browserInstance = null;
  });

  return browserInstance;
}

/**
 * Closes the shared browser instance if it exists.
 */
export async function closeBrowser() {
  if (browserInstance) {
    console.log('Closing browser instance...');
    await browserInstance.close();
    browserInstance = null;
  }
}