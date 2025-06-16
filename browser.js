// browser.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export const getBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--disable-features=site-per-process',
        '--disable-breakpad',
        '--no-zygote',
        '--disable-dev-shm-usage',
        '--disable-web-security',
    ],
  });

  const pages = await browser.pages();
  if (pages.length > 0) {
    await pages[0].close();
  }

  return browser;
};
