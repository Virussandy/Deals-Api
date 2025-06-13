import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';
import { getBrowser } from '../browser.js';
import { resolveOriginalUrl, sanitizeUrl , convertAffiliateLink} from '../scrapers/utils.js';
import dayjs from 'dayjs';

const router = express.Router();

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

async function processDeals(page = 1) {
  const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
    desidime(page),
    dealsmagnet(page),
  ]);

  const allDeals = [...(desidimeDeals || []), ...(dealsmagnetDeals || [])];
  const dealMap = new Map();
  const dealIds = [];

  for (const deal of allDeals) {
    if (deal?.deal_id) {
      dealMap.set(deal.deal_id, deal);
      dealIds.push(deal.deal_id);
    }
  }

  // Fetch existing deals
  const indexSnapshots = await Promise.all(
    dealIds.map(id => db.collection('deals').doc(id).get())
  );

  const newDeals = [];
  const dealsToUpdate = [];

  for (const snapshot of indexSnapshots) {
    const deal = dealMap.get(snapshot.id);
    if (!snapshot.exists) {
      newDeals.push(deal);
    } else {
      const existingDeal = snapshot.data();
      const existingPostedOn = dayjs(existingDeal.posted_on);
      const newPostedOn = dayjs(deal.posted_on);
      const diffHours = Math.abs(newPostedOn.diff(existingPostedOn, 'hour'));

      if (diffHours > 6) {
        dealsToUpdate.push(deal);
      }
    }
  }

  console.log(`🆕 ${newDeals.length} new deals to resolve and store`);
  console.log(`🕒 ${dealsToUpdate.length} existing deals to update`);

  const browser = await getBrowser();

await asyncPool(
  [...newDeals, ...dealsToUpdate].map(deal => async () => {
    try {
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);

      // Now call affiliate API with resolved URL
      const affiliateResponse = await convertAffiliateLink(resolvedUrl);

      if (affiliateResponse.success) {
        // ✅ If affiliate API gave valid http URL, resolve again
        const finalResolvedUrl = await resolveOriginalUrl(browser, affiliateResponse.newUrl, 1);
        console.log(finalResolvedUrl)
        deal.url = finalResolvedUrl;  // directly assign without sanitize
      } else {
        // ❌ API failed, fallback to your old sanitize method
        deal.url = sanitizeUrl(resolvedUrl)?.replace('dealsmagnet.com/', '');
        console.log(deal.url)
      }

      delete deal.redirectUrl;
    } catch (err) {
      console.error('🔥 Error processing deal:', err);
    }
  }),
  1
);


  await browser.close();

  // const batch = db.batch();

  // // Insert new deals
  // for (const deal of newDeals.reverse()) {
  //   const dealRef = db.collection('deals').doc(deal.deal_id);
  //   batch.set(dealRef, deal);
  // }

  // // Update existing deals where 6hr rule applied
  // for (const deal of dealsToUpdate.reverse()) {
  //   const dealRef = db.collection('deals').doc(deal.deal_id);
  //   batch.set(dealRef, deal);
  // }

  // await batch.commit();

  return {
    message: 'Deals processed successfully',
    scraped: allDeals.length,
    stored: newDeals.length,
    updated: dealsToUpdate.length,
    skipped: allDeals.length - (newDeals.length + dealsToUpdate.length),
  };
}

// ✅ GET handler
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

// ✅ POST handler for Pub/Sub
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
