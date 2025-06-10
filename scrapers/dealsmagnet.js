import * as cheerio from 'cheerio';
import { getBrowser } from '../browser.js';
import { generateDealId } from './utils.js';

function cleanText(text) {
  const trimmed = text?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function getUTCTimestamp() {
  return new Date().toISOString();
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

    await tab.goto(`https://www.dealsmagnet.com/new?page=${page}`, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    const html = await tab.content();
    const $ = cheerio.load(html);
    const dealElements = $('div.col-lg-3.col-md-4.col-sm-6.col-6.pl-1.pr-1.pb-2').toArray();

    const tasks = dealElements.map((el) => async () => {
      const card = $(el);

      const title = cleanText(card.find('p.card-text a.MainCardAnchore').text());

      // Determine redirect URL
      let redirectUrl = null;
      const buyButton = card.find('button.buy-button');
      if (buyButton.length > 0) {
        const dataCode = buyButton.attr('data-code');
        if (dataCode) {
          redirectUrl = `https://www.dealsmagnet.com/buy?${dataCode}`;
        }
      } else {
        const dealHref = card.find('p.card-text a.MainCardAnchore').attr('href') || '';
        redirectUrl = dealHref.startsWith('http') ? dealHref : `https://www.dealsmagnet.com${dealHref}`;
      }

      const price = cleanText(card.find('.card-DealPrice').text().replace(/\s+/g, ' ').replace('₹',''));
      const originalPrice = cleanText(card.find('.card-OriginalPrice').text().replace(/\s+/g, ' ').replace('₹',''));

      const discountBig = cleanText(card.find('.card-DiscountPrice .big').text());
      const discountSmall = cleanText(card.find('.card-DiscountPrice .small').text());
      const discount = (discountBig || discountSmall)
        ? [discountBig, discountSmall].filter(Boolean).join(' ')
        : null;

      const image = cleanText("https://deals.sandeepks-jsr.workers.dev/?url="+card.find('.card-img img').attr('data-src')?.replace('-s-', '-o-'));
      const store = cleanText(card.find('.card-footer img').attr('alt'));
      const postedAgo = getUTCTimestamp();

      if (!title || !store || !redirectUrl) {
        return null;
      }

      const deal_id = generateDealId(title, store, redirectUrl);
      if (!deal_id) return null;

      return {
        deal_id,
        title,
        price,
        originalPrice,
        discount,
        store,
        image,
        redirectUrl,
        posted_on: postedAgo,
        url: null,
      };
    });

    const deals = await asyncPool(tasks, 1);
    await tab.close();

    return deals.filter(Boolean);
  } catch (err) {
    console.error('❌ Error parsing DealsMagnet deals:', err);
    return null;
  } finally {
    await browser.close();
  }
}
