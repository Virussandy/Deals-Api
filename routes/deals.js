import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import {db} from '../firebase.js';
import { notifyChannels } from '../utils/notifier.js';
import fs from 'fs/promises';
import path from 'path';
import { getBrowser } from '../utils/browserManager.js';
import {insertOrReplaceMeeshoInvite, resolveOriginalUrl, sanitizeUrl, convertAffiliateLink } from '../utils/utils.js';
import { uploadImageFromUrl } from '../utils/uploadImage.js';
import dayjs from 'dayjs';
import logger from '../utils/logger.js';

const router = express.Router();
const CACHE_FILE_PATH = path.resolve('./deals_cache.json');

async function readCache() {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
        return {};
    }
    throw error;
  }
}

async function updateCache(newData) {
    const tempPath = CACHE_FILE_PATH + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(newData, null, 2));
    await fs.rename(tempPath, CACHE_FILE_PATH);
}

async function processDeals(page = 1) {
  const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
    desidime(page),
    dealsmagnet(page),
  ]);

  const allDeals = [...(desidimeDeals || []), ...(dealsmagnetDeals || [])];
  const dealMap = new Map();
  const dealIds = [];

  for (const deal of allDeals.reverse()) {
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
  // We'll store deals and their image buffers here to notify *after* saving.
  const validDealsToNotify = [];

  for (const deal of [...newDeals, ...dealsToUpdate]) {
    try {
      logger.info('Processing deal', { redirectUrl: deal.redirectUrl });
      const store = deal.store;
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      logger.info('Resolved URL', { resolvedUrl });

      if (!resolvedUrl) {
        logger.warn('Skipping deal due to failed navigation', { dealId: deal.deal_id });
        continue;
      }

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

      deal.redirectUrl = resolvedUrl;

      try {
        const affiliateResponse = await convertAffiliateLink(deal.redirectUrl);
        if (affiliateResponse.success) {
          deal.redirectUrl = affiliateResponse.newUrl;
          deal.url = deal.redirectUrl;
        } else {
          const redirectedUrl = sanitizeUrl(deal.redirectUrl);
          deal.redirectUrl = redirectedUrl;
          deal.url = redirectedUrl;
        }
      } catch (err) {
        logger.error('Affiliate conversion error:', { error: err.message });
        deal.url = sanitizeUrl(deal.redirectUrl);
      }

      const uploadResult = await uploadImageFromUrl(deal.image, deal.deal_id);
      if (uploadResult && uploadResult.downloadUrl) {
        deal.image = uploadResult.downloadUrl;
        // Store the deal and its buffer for later.
        validDealsToNotify.push({ deal, buffer: uploadResult.buffer });
      } else {
        continue;
      }
  
    } catch (err) {
      logger.error('Unexpected deal processing error', { error: err.message });
    }
  }

  // --- Step 1: Write to Database and Cache ---
  if (validDealsToNotify.length > 0) {
    const batch = db.batch();
    for (const { deal } of validDealsToNotify) {
      const dealRef = db.collection('deals').doc(deal.deal_id);
      batch.set(dealRef, deal);
      cache[deal.deal_id] = deal;
    }
    
    logger.info(`Committing ${validDealsToNotify.length} deals to the database.`);
    await batch.commit();
    await updateCache(cache);
    logger.info('Database and cache have been updated.');

    // --- Step 2: Send Notifications (ONLY after successful write) ---
    logger.info('Starting to send notifications...');
    for (const { deal, buffer } of validDealsToNotify) {
        await notifyChannels(deal, buffer);
    }
  } else {
      logger.info('No new valid deals to save or notify.');
  }

  return {
    message: 'Deals processed successfully',
    scraped: allDeals.length,
    stored: newDeals.length,
    updated: dealsToUpdate.length,
    skipped: allDeals.length - (newDeals.length + dealsToUpdate.length),
  };
}

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  try {
    const result = await processDeals(page);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in GET /deals', { error: error.stack });
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await processDeals(1);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in POST /deals', { error: error.stack });
    res.status(500).json({ error: 'Failed to process deals from Pub/Sub' });
  }
});

export default router;
