import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import crypto from 'crypto'
import { getBrowser } from '../browser.js';

const browser = await getBrowser();
const tab = await browser.newPage();
  await tab.setRequestInterception(true);

  // Block unnecessary resources
  tab.on('request', req => {
    const blocked = ['image', 'stylesheet', 'font'];
    if (blocked.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

puppeteer.use(StealthPlugin());

/**
 * Helper to run async tasks with concurrency limit.
 * @param {Array<Function>} tasks Array of functions returning promises.
 * @param {number} limit concurrency limit.
 * @returns {Promise<Array>} results of all tasks.
 */
function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.search = ''; // Remove query params
    return u.origin + u.pathname;
  } catch (err) {
    return url.trim();
  }
}

function generateDealId(title, store, url) {
  const normalizedTitle = normalizeText(title);
  const normalizedStore = normalizeText(store);
  const normalizedUrl = normalizeUrl(url);

  const hash = crypto.createHash('sha256');
  hash.update(normalizedTitle + normalizedStore + normalizedUrl);
  return hash.digest('hex');
}


async function resolveOriginalUrl(browser, redirectUrl, retries = 1, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let tab;
    try {
      tab = await browser.newPage();
      await tab.goto(redirectUrl, { waitUntil: 'domcontentloaded', timeout: 0 });
      const finalUrl = tab.url();
      await tab.close();
      return finalUrl;
    } catch (err) {
      if (tab) await tab.close();
      console.warn(`Attempt ${attempt} failed for URL: ${redirectUrl}. Retrying...`);
      if (attempt < retries) {
        await delay(delayMs);
      }
    }
  }
  console.error(`All ${retries} attempts failed for URL: ${redirectUrl}`);
  return 'N/A';
}

/**
 * Removes affiliate and tracking query parameters from URLs.
 * @param {string} inputUrl The full URL to be cleaned.
 * @returns {string} Cleaned URL.
 */
function sanitizeUrl(inputUrl) {
  try {
    const parsedUrl = new URL(inputUrl);

    const unwantedParams = [
      'tag',
      'ascsubtag',
      'affid',
      'affExtParam1',
      'affExtParam2',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'th',
      'cmpid',
      '_refId',
      '_appId',
    ];

    // Remove unwanted top-level query params
    for (const param of unwantedParams) {
      parsedUrl.searchParams.delete(param);
    }

    // Handle nested openid.return_to (Amazon sign-in URL case)
    if (parsedUrl.searchParams.has('openid.return_to')) {
      try {
        const nestedRaw = parsedUrl.searchParams.get('openid.return_to');
        const decoded = decodeURIComponent(nestedRaw);
        const nestedUrl = new URL(decoded);

        for (const param of unwantedParams) {
          nestedUrl.searchParams.delete(param);
        }

        // Manually set without double encoding
        parsedUrl.searchParams.set('openid.return_to', nestedUrl.toString());
      } catch (err) {
        console.warn(`Failed to process nested openid.return_to in: ${inputUrl}`);
      }
    }

    return parsedUrl.toString();
  } catch (err) {
    return inputUrl;
  }
}



async function asyncPool(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

function getISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString();
}


export default async function scrapeDesiDime(page = 1) {
  // const browser = await puppeteer.launch({
  //   headless: 'new',
  //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
  // });
  // const defaultPages = await browser.pages();
  // if (defaultPages.length > 0) {
  //   await defaultPages[0].close();
  // }
  // const tab = await browser.newPage();

  await tab.goto(`https://www.desidime.com/new?page=${page}&deals_view=deal_grid_view`, {
    waitUntil: 'networkidle2',
    timeout: 0,
  });

  const html = await tab.content();
  const $ = cheerio.load(html);
  const dealElements = $('div#deals-grid ul.cf > li.tablet-grid-25.padfix.grid-20').toArray();

  const tasks = dealElements.map((li) => async () => {
    const el = $(li);

    const title = el.find('div.deal-dsp a').text().trim() || 'N/A';
    const price = el.find('div.deal-price').text().trim() || 'N/A';
   
    let discount;
    const percentSpan = el.find('div.deal-percent span.percentoff').text().trim();
    const offSpan = el.find('div.deal-percent span.dealoff').text().trim();

    if (percentSpan && offSpan) {
      discount = `${percentSpan} ${offSpan}`;
    } else {
      const discountDiv = el.find('div.deal-discount').text().trim();
      discount = discountDiv || 'N/A';
    }


    const store = el.find('div.deal-store.ftl').text().trim() || 'N/A';
    const image =
      el.find('div.deal-box-image img').attr('data-src')?.replace('/medium/', '/original/') || 'N/A';
    // const posted = el.find('div.promotime time').text().trim() || 'N/A';

    const posted = getISTTimestamp(); // replaces scraped value


    const redirectUrl = el.find('div.getdeal a').attr('data-href');

    // let originalUrl = 'N/A';

    // if (redirectUrl) {
    //   const resolvedUrl = await resolveOriginalUrl(browser, redirectUrl);
    //   originalUrl = sanitizeUrl(resolvedUrl);
    // }

    const deal_id = generateDealId(title,store,originalUrl)

    return {
      deal_id,
      title,
      price,
      discount,
      store,
      image,
      url: redirectUrl,
      posted_on: posted,
    };
  });

  const deals = await asyncPool(tasks, 5);
  // await tab.close();
  return deals;
}
