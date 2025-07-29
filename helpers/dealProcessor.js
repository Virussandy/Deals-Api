import fs from 'fs/promises';
import path from 'path';
import {db,storage} from '../firebase.js';
import { getBrowser } from '../browser.js';
import { resolveOriginalUrl, sanitizeUrl, convertAffiliateLink } from '../utils/utils.js';
import dayjs from 'dayjs';

const CACHE_FILE_PATH = path.resolve('./deals_cache.json');

async function readCache() {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist, return empty
    return {};
  }
}

async function updateCache(newData) {
  await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(newData, null, 2));
}

export async function processSourceDeals(fetchDealsFn, page = 1) {
  const deals = await fetchDealsFn(page);
  const dealMap = new Map();
  const dealIds = [];

  for (const deal of deals) {
    if (deal?.deal_id) {
      dealMap.set(deal.deal_id, deal);
      dealIds.push(deal.deal_id);
    }
  }

  // 🔄 Load local cache instead of Firestore
  const cache = await readCache();
  const newDeals = [];
  const dealsToUpdate = [];

  for (const id of dealIds) {
    const deal = dealMap.get(id);
    const cachedDeal = cache[id];

    if (!cachedDeal) {
      newDeals.push(deal);
    } else {
      const existingPostedOn = dayjs(cachedDeal.posted_on);
      const newPostedOn = dayjs(deal.posted_on);
      const diffHours = Math.abs(newPostedOn.diff(existingPostedOn, 'hour'));
      if (diffHours > 24) {
        dealsToUpdate.push(deal);
      }
    }
  }

    console.log(`🆕 ${newDeals.length} new deals to resolve and store`);
    console.log(`🕒 ${dealsToUpdate.length} existing deals to update`);

  const browser = await getBrowser();

const validDeals = [];

  for (const deal of [...newDeals, ...dealsToUpdate]) {
    console.log("\n");
    try {
      console.log(deal.redirectUrl);
      const store = deal.store;

      if (store === 'DesiDime') {
        console.warn(`Skipping deal because store is DesiDime: ${deal.deal_id}`);
        continue;
      }

      if (deal.title && deal.title.includes("18+")) {
        console.log(`⛔ Skipping 18+ deal: ${deal.title}`);
        continue; // Skip this deal
      }

      if (store === 'Meesho'){
        insertOrReplaceMeeshoInvite(deal.redirectUrl);
      }

      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      console.log(resolvedUrl);

      deal.redirectUrl = resolvedUrl;

      try {
        const affiliateResponse = await convertAffiliateLink(deal.redirectUrl);
        if (affiliateResponse.success) {
          deal.redirectUrl = affiliateResponse.newUrl;
          const finalUrl = await resolveOriginalUrl(browser, affiliateResponse.newUrl, 1);
          if (!finalUrl) {
            console.warn(`⏩ Skipping deal due to failed affiliate resolution: ${deal.deal_id}`);
            continue;
          }
          deal.url = finalUrl;
        } else {
          const redirectedUrl = sanitizeUrl(deal.redirectUrl);
          deal.redirectUrl = redirectedUrl;
          deal.url = redirectedUrl;
        }
      } catch (err) {
        console.error('Affiliate conversion error:', err.message);
        deal.url = sanitizeUrl(deal.redirectUrl);
      }

      // delete deal.redirectUrl;

      // Upload image to Firebase Storage if image_url exists
        const uploadResult = await uploadImageFromUrl(deal.image, deal.deal_id);
        if (uploadResult && uploadResult.downloadUrl) {
          deal.image = uploadResult.downloadUrl;
          await notifyChannels(deal, uploadResult.buffer);
        } else {
          continue;
        }
  
      validDeals.push(deal);

    } catch (err) {
      console.error('Unexpected deal processing error:', err.message);
    }
    console.log(deal.url);
    break;
  }


  await browser.close();

  const batch = db.batch();

  // ⬇ Push to Firestore & update cache
  for (const deal of validDeals.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
    cache[deal.deal_id] = deal;
  }

  await batch.commit();

  // 🔄 Save the updated cache
  await updateCache(cache);

  return {
    message: 'Deals processed successfully (with local cache)',
    scraped: deals.length,
    stored: newDeals.length,
    updated: dealsToUpdate.length,
    skipped: deals.length - (newDeals.length + dealsToUpdate.length),
  };
}
