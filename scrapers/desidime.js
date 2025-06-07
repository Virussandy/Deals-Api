import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { getBrowser } from '../browser.js';
import { generateDealId } from './utils.js';

puppeteer.use(StealthPlugin());

function cleanText(text) {
  const trimmed = text?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString();
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

export default async function scrapeDesiDime(page = 1) {
  const browser = await getBrowser();

  try {
    const tab = await browser.newPage();
    await tab.setRequestInterception(true);

    tab.on('request', req => {
      const blocked = ['image', 'stylesheet', 'font'];
      if (blocked.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await tab.goto(`https://www.desidime.com/new?page=${page}&deals_view=deal_grid_view`, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    const html = await tab.content();
    const $ = cheerio.load(html);
    const dealElements = $('div#deals-grid ul.cf > li.tablet-grid-25.padfix.grid-20').toArray();

    const tasks = dealElements.map((li) => async () => {
      const el = $(li);

      const title = cleanText(el.find('div.deal-dsp a').text());
      const price = cleanText(el.find('div.deal-price').text());

      let discount = null;
      const percentSpan = cleanText(el.find('div.deal-percent span.percentoff').text());
      const offSpan = cleanText(el.find('div.deal-percent span.dealoff').text());
      if (percentSpan && offSpan) {
        discount = `${percentSpan} ${offSpan}`;
      } else {
        discount = cleanText(el.find('div.deal-discount').text());
      }

      const store = cleanText(el.find('div.deal-store.ftl').text());
      const image = cleanText(
        el.find('div.deal-box-image img').attr('data-src')?.replace('/medium/', '/original/')
      );

      const posted = getISTTimestamp();
      const redirectUrl = cleanText(el.find('div.getdeal a').attr('data-href'));

      // Skip if any essential field is missing
      if (!title || !store || !redirectUrl) {
        return null;
      }

      const deal_id = generateDealId(title, store, redirectUrl);
      if (!deal_id) return null;

      return {
        deal_id,
        title,
        price,
        originalPrice: null,
        discount,
        store,
        image,
        redirectUrl,
        posted_on: posted,
        url: null,
      };
    });

    const deals = await asyncPool(tasks, 1);
    await tab.close();

    // Filter out nulls (invalid or incomplete deals)
    return deals.filter(Boolean);

  } catch (err) {
    console.error('❌ Error parsing DesiDime deals:', err);
    return null;
  } finally {
    await browser.close(); // always close browser after use
  }
}
