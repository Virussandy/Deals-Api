import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import {db,storage} from '../firebase.js';
import { notifyChannels } from '../utils/notifier.js';
import fs from 'fs/promises';
import path from 'path';
import { getBrowser } from '../browser.js';
import {insertOrReplaceMeeshoInvite, resolveOriginalUrl, sanitizeUrl, convertAffiliateLink } from '../utils/utils.js';
import { uploadImageFromUrl } from '../utils/uploadImage.js';
import dayjs from 'dayjs';

const router = express.Router();
const CACHE_FILE_PATH = path.resolve('./deals_cache.json');
const USER_DATA_DIR = path.resolve('puppeteer-temp');

async function readCache() {
  try {
    const data = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function updateCache(newData) {
  await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(newData, null, 2));
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

  console.log(`🆕 ${newDeals.length} new deals to resolve and store`);
  console.log(`🕒 ${dealsToUpdate.length} existing deals to update`);

  const browser = await getBrowser();
  const validDeals = [];

  for (const deal of [...newDeals, ...dealsToUpdate]) {
    console.log("\n");
    try {
      console.log(deal.redirectUrl);
      const store = deal.store;
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      console.log(resolvedUrl);

      if (!resolvedUrl) {
        console.warn(`⏩ Skipping deal due to failed navigation: ${deal.deal_id}`);
        continue;
      }

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

      deal.redirectUrl = resolvedUrl;

      try {
        const affiliateResponse = await convertAffiliateLink(deal.redirectUrl);
        if (affiliateResponse.success) {
          deal.redirectUrl = affiliateResponse.newUrl;
          // const finalUrl = await resolveOriginalUrl(browser, affiliateResponse.newUrl, 1);
          // if (!finalUrl) {
          //   console.warn(`⏩ Skipping deal due to failed affiliate resolution: ${deal.deal_id}`);
          //   continue;
          // }
          deal.url = deal.redirectUrl;
        } else {
          const redirectedUrl = sanitizeUrl(deal.redirectUrl);
          deal.redirectUrl = redirectedUrl;
          deal.url = redirectedUrl;
        }
      } catch (err) {
        console.error('Affiliate conversion error:', err.message);
        deal.url = sanitizeUrl(deal.redirectUrl);
      }

        const uploadResult = await uploadImageFromUrl(deal.image, deal.deal_id);
        if (uploadResult && uploadResult.downloadUrl) {
          deal.image = uploadResult.downloadUrl;
        } else {
          continue;
        }

        validDeals.push(deal);

        await notifyChannels(deal, uploadResult.buffer);
  
      // try {
      //       await db.collection('deals').doc(deal.deal_id).set(deal);
      //       cache[deal.deal_id] = deal;
            // await updateCache(cache);
      //       await notifyChannels(deal, uploadResult.buffer);
      //       console.log(`Saved deal ${deal.deal_id}`);
      //     } catch (err) {
      //       console.error(`Failed to save deal ${deal.deal_id}:`, err.message);
      //     }
    } catch (err) {
      console.error('Unexpected deal processing error:', err.message);
    }
    // console.log(deal.url);
  }

  await browser.close();
  await fs.rm(USER_DATA_DIR, { recursive: true, force: true });

  const batch = db.batch();

  for (const deal of validDeals.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
    cache[deal.deal_id] = deal;
    // notifyChannels(deal).catch(e => console.error('Notify failed', e));
  }

    await batch.commit();
    await updateCache(cache);

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
    console.error('🔥 Error in GET:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await processDeals(1);
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in POST:', error);
    res.status(500).json({ error: 'Failed to process deals from Pub/Sub' });
  }
});

export default router;
