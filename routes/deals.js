import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';
import { getBrowser } from '../browser.js';
import { resolveOriginalUrl, sanitizeUrl } from '../scrapers/utils.js';

const router = express.Router();

// Parallel pool function
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
    const snapshot = await db.collection('deals').select().get();
    const existingIds = new Set(snapshot.docs.map(doc => doc.id));
    console.log(`✅ Loaded ${existingIds.size} existing deal IDs from Firestore`);

    // No browser passed — handled inside scrapers
    const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
      desidime(page),
      dealsmagnet(page)
    ]);
    const allDeals = [...(desidimeDeals || []), ...(dealsmagnetDeals || [])];

    const newDeals = allDeals.filter(deal => deal?.deal_id && !existingIds.has(deal.deal_id));
    console.log(`🆕 ${newDeals.length} new deals to resolve and store`);

    // Open browser for resolving URLs only
    const browser = await getBrowser();

    await asyncPool(newDeals.map((deal) => async () => {
      const resolvedUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
      deal.url = sanitizeUrl(resolvedUrl)?.replace('dealsmagnet.com/', '');
      delete deal.redirectUrl;
    }), 5);

    await browser.close();

    for (const deal of newDeals) {
      await db.collection('deals').doc(deal.deal_id).set(deal);
    }

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
