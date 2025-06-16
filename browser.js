// browser.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export const getBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-features=site-per-process',
        '--disable-breakpad',
        '--no-zygote',
        '--disable-web-security',
        '--start-maximized',
        '--window-size=1366,768',
        '--user-data-dir=/tmp/chrome-user-data',
      ],
  });

  const pages = await browser.pages();
  if (pages.length > 0) {
    await pages[0].close();
  }

  return browser;
};
