// browser.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import { randomUUID } from 'crypto';
import path from 'path';

const USER_DATA_DIR = path.resolve('puppeteer-temp');

puppeteer.use(StealthPlugin());

export const getBrowser = async () => {
//   const userDataDir = `/tmp/chrome-user-data-${randomUUID()}`;

  const browser = await puppeteer.launch({
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
  });

  // const pages = await browser.pages();
  // if (pages.length > 0) {
  //   await pages[0].close();
  // }

  return browser;
};
