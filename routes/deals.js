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

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  try {
    const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
      desidime(page),
      dealsmagnet(page),
    ]);

    const allDeals = [...(desidimeDeals || []), ...(dealsmagnetDeals || [])];

    // 1. Create map of deal_id -> deal
    const dealMap = new Map();
    const dealIds = [];

    for (const deal of allDeals) {
      if (deal?.deal_id) {
        dealMap.set(deal.deal_id, deal);
        dealIds.push(deal.deal_id);
      }
    }

    // 2. Check which deal IDs exist in the lightweight index
    const indexSnapshots = await Promise.all(
      dealIds.map(id => db.collection('deals').doc(id).get())
    );

    const newDeals = indexSnapshots
      .filter(snapshot => !snapshot.exists)
      .map(snapshot => dealMap.get(snapshot.id));

    console.log(`🆕 ${newDeals.length} new deals to resolve and store`);

    // 3. Resolve URLs in parallel
    const browser = await getBrowser();

    await asyncPool(newDeals.map(deal => async () => {
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      deal.url = sanitizeUrl(resolvedUrl)?.replace('dealsmagnet.com/', '');
      delete deal.redirectUrl;
    }), 5);

    await browser.close();

    // 4. Save to /deals and index to /deal_index
    const batch = db.batch();
    for (const deal of newDeals) {
      const dealRef = db.collection('deals').doc(deal.deal_id);
      batch.set(dealRef, deal);
    }

    await batch.commit();

    res.status(200).json({
      message: 'Deals processed successfully',
      scraped: allDeals.length,
      stored: newDeals.length,
      skipped: allDeals.length - newDeals.length,
    });

  } catch (error) {
    console.error('🔥 Error scraping or storing:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
