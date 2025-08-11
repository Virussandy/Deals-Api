import fs from 'fs/promises';
import path from 'path';
import {db} from '../firebase.js';
import { getBrowser } from '../utils/browserManager.js';
import { resolveOriginalUrl, sanitizeUrl, convertAffiliateLink } from '../utils/utils.js';
import dayjs from 'dayjs';
import { uploadImageFromUrl } from '../utils/uploadImage.js';
import { notifyChannels } from '../utils/notifier.js';
import logger from '../utils/logger.js'; // Import the new logger

const CACHE_FILE_PATH = path.resolve('./deals_cache.json');

async function readCache() {
    try {
      const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
          return {};
      }
      throw err;
    }
  }
  
  async function updateCache(newData) {
    const tempPath = CACHE_FILE_PATH + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(newData, null, 2));
    await fs.rename(tempPath, CACHE_FILE_PATH);
  }

export async function processSourceDeals(fetchDealsFn, page = 1) {
  const deals = await fetchDealsFn(page);
  if (!deals) {
      logger.info(`No deals returned from ${fetchDealsFn.name}.`);
      return { message: 'No deals found', scraped: 0, stored: 0, updated: 0, skipped: 0 };
  }

  const dealMap = new Map();
  const dealIds = [];

  for (const deal of deals) {
    if (deal?.deal_id) {
      dealMap.set(deal.deal_id, deal);
      dealIds.push(deal.deal_id);
    }
  }

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

    logger.info(`${newDeals.length} new deals to resolve and store`);
    logger.info(`${dealsToUpdate.length} existing deals to update`);

  const browser = await getBrowser();
  const validDeals = [];

  for (const deal of [...newDeals, ...dealsToUpdate]) {
    try {
      logger.info('Processing deal', { redirectUrl: deal.redirectUrl });
      const store = deal.store;

      if (store === 'DesiDime') {
        logger.warn('Skipping deal because store is DesiDime', { dealId: deal.deal_id });
        continue;
      }

      if (deal.title && deal.title.includes("18+")) {
        logger.info('Skipping 18+ deal', { title: deal.title });
        continue;
      }

      if (store === 'Meesho'){
        insertOrReplaceMeeshoInvite(deal.redirectUrl);
      }

      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      logger.info('Resolved URL', { resolvedUrl });

      if (!resolvedUrl) {
        logger.warn('Skipping deal due to failed navigation', { dealId: deal.deal_id });
        continue;
      }

      deal.redirectUrl = resolvedUrl;

      try {
        const affiliateResponse = await convertAffiliateLink(deal.redirectUrl);
        if (affiliateResponse.success) {
          deal.redirectUrl = affiliateResponse.newUrl;
          const finalUrl = await resolveOriginalUrl(browser, affiliateResponse.newUrl, 1);
          if (!finalUrl) {
            logger.warn('Skipping deal due to failed affiliate resolution', { dealId: deal.deal_id });
            continue;
          }
          deal.url = finalUrl;
        } else {
          const redirectedUrl = sanitizeUrl(deal.redirectUrl);
          deal.redirectUrl = redirectedUrl;
          deal.url = redirectedUrl;
        }
      } catch (err) {
        logger.error('Affiliate conversion error', { error: err.message });
        deal.url = sanitizeUrl(deal.redirectUrl);
      }

      const uploadResult = await uploadImageFromUrl(deal.image, deal.deal_id);
      if (uploadResult && uploadResult.downloadUrl) {
        deal.image = uploadResult.downloadUrl;
        await notifyChannels(deal, uploadResult.buffer);
      } else {
        continue;
      }
  
      validDeals.push(deal);

    } catch (err) {
      logger.error('Unexpected deal processing error', { error: err.message });
    }
    logger.info('Final deal URL', { url: deal.url });
  }

  const batch = db.batch();

  for (const deal of validDeals.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
    cache[deal.deal_id] = deal;
  }

  if (validDeals.length > 0) {
    await batch.commit();
    await updateCache(cache);
  }

  return {
    message: 'Deals processed successfully (with local cache)',
    scraped: deals.length,
    stored: newDeals.length,
    updated: dealsToUpdate.length,
    skipped: deals.length - (newDeals.length + dealsToUpdate.length),
  };
}
