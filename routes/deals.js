import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  try {
    // ✅ STEP 1: Load existing deal_ids from Firestore (one-time read)
    const snapshot = await db.collection('deals').select().get();  // Only fetch IDs
    const existingIds = new Set(snapshot.docs.map(doc => doc.id));
    console.log(`✅ Loaded ${existingIds.size} existing deal IDs from Firestore`);

    // ✅ STEP 2: Scrape new deals
    const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
      desidime(page),
      dealsmagnet(page)
    ]);
    const scrapedDeals = [...desidimeDeals, ...dealsmagnetDeals];

    // ✅ STEP 3: Filter out deals already in Firestore
    const newDeals = scrapedDeals.filter(deal => deal.deal_id && !existingIds.has(deal.deal_id));

    // ✅ STEP 4: Store only new deals
    let stored = 0;
    for (const deal of newDeals) {
      const docId = deal.deal_id.toString();
      await db.collection('deals').doc(docId).set(deal);
      stored++;
    }

    res.status(200).json({
      message: 'Deals processed successfully',
      scraped: scrapedDeals.length,
      stored,
      skipped: scrapedDeals.length - stored,
    });

  } catch (error) {
    console.error('🔥 Error scraping or storing:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
