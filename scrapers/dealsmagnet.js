import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import crypto from 'crypto'

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

function getISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString();
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
      'dealsmagnet.com',
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

export default async function scrapeDealsMagnet(page = 1) {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
   });

  // const defaultPages = await browser.pages();
  // if (defaultPages.length > 0) {
  //   await defaultPages[0].close();
  // }
  const tab = await browser.newPage();

  await tab.goto(`https://www.dealsmagnet.com/new?page=${page}`, {
    waitUntil: 'networkidle2',
    timeout: 0,
  });

  const html = await tab.content();
  const $ = cheerio.load(html);

  const dealElements = $('div.col-lg-3.col-md-4.col-sm-6.col-6.pl-1.pr-1.pb-2').toArray();

  const tasks = dealElements.map((el) => async () => {
    const card = $(el);

    const title = card.find('p.card-text a.MainCardAnchore').text().trim() || 'N/A';
    const buyButton = card.find('button.buy-button');
    let buyUrl = 'N/A';

    // if (buyButton.length > 0) {
    //   const dataCode = buyButton.attr('data-code');
    //   if (dataCode) {
    //     buyUrl = `https://www.dealsmagnet.com/buy?${dataCode}`;
    //   }
    // } else {
    //   const dealHref = card.find('p.card-text a.MainCardAnchore').attr('href') || '';
    //   buyUrl = `https://www.dealsmagnet.com${dealHref}`;
    // }

    if (buyButton.length > 0) {
      const dataCode = buyButton.attr('data-code');
      if (dataCode) {
        buyUrl = `https://www.dealsmagnet.com/buy?${dataCode}`;
      }
    } else {
      const dealHref = card.find('p.card-text a.MainCardAnchore').attr('href') || '';
      buyUrl = dealHref.startsWith('http') ? dealHref : `https://www.dealsmagnet.com${dealHref}`;
    }

    let originalUrl = 'N/A';

    // if (buyUrl) {
    //   const resolvedUrl = await resolveOriginalUrl(browser, buyUrl);
    //   originalUrl = sanitizeUrl(resolvedUrl)?.replace('dealsmagnet.com/','');
    // }


    const price = card.find('.card-DealPrice').text().replace(/\s+/g, ' ').trim() || 'N/A';
    const originalPrice = card.find('.card-OriginalPrice').text().replace(/\s+/g, ' ').trim() || 'N/A';

    const discount = card.find('.card-DiscountPrice .big').text().trim() + ' ' + 
                     card.find('.card-DiscountPrice .small').text().trim() || 'N/A';

    const image = card.find('.card-img img').attr('data-src')?.replace('-s-','-o-') || 'N/A';

    const store = card.find('.card-footer img').attr('alt') || 'N/A';

    // const postedAgo = card.find('.TimeDuration').text().trim() || 'N/A';
    const postedAgo = getISTTimestamp();

    const deal_id = generateDealId(title,store,originalUrl)
    return {
      deal_id,
      title,
      price,
      originalPrice,
      discount,
      store,
      image,
      dealUrl: buyUrl,
      posted_on: postedAgo,
    };
  });

  const deals = await asyncPool(tasks, 5);

  await browser.close();

  return deals;
}

