import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';
import { getBrowser } from '../browser.js';
import { resolveOriginalUrl, sanitizeUrl } from '../scrapers/utils.js';

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

  const indexSnapshots = await Promise.all(
    dealIds.map(id => db.collection('deals').doc(id).get())
  );

  const newDeals = indexSnapshots
    .filter(snapshot => !snapshot.exists)
    .map(snapshot => dealMap.get(snapshot.id));

  console.log(`🆕 ${newDeals.length} new deals to resolve and store`);

  const browser = await getBrowser();

  await asyncPool(
    newDeals.map(deal => async () => {
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      deal.url = sanitizeUrl(resolvedUrl)?.replace('dealsmagnet.com/', '');
      delete deal.redirectUrl;
    }),
    1
  );

  await browser.close();

  const batch = db.batch();
  for (const deal of newDeals.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
  }

  await batch.commit();

  return {
    message: 'Deals processed successfully',
    scraped: allDeals.length,
    stored: newDeals.length,
    skipped: allDeals.length - newDeals.length,
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
    const result = await processDeals(1); // Always use page 1 for Pub/Sub
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in POST:', error);
    res.status(500).json({ error: 'Failed to process deals from Pub/Sub' });
  }
});

export default router;
