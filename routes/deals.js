import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';
import { getBrowser } from '../browser.js';


const browser = await getBrowser();

const router = express.Router();
const CACHE_FILE_PATH = path.resolve('./cached_deals.json');

router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;

  try {
    // Load old deals from cache
    let oldDeals = [];
    let oldDealsMap = {};
    try {
      const data = await fs.readFile(CACHE_FILE_PATH, 'utf8');
      oldDeals = JSON.parse(data);
      oldDealsMap = Object.fromEntries(oldDeals.map(d => [d.deal_id, true]));
    } catch (err) {
      console.warn('No previous cache found, starting fresh.');
    }

    // Scrape new deals
    // const desidimeDeals = await desidime(page);
    // const dealsmagnetDeals = await dealsmagnet(page);
    const [desidimeDeals, dealsmagnetDeals] = await Promise.all([
      desidime(page),
      dealsmagnet(page)
    ]);
    
    const scrapedDeals = [...desidimeDeals, ...dealsmagnetDeals];

    // Filter only new deals
    const newDeals = scrapedDeals.filter(deal => deal.deal_id && !oldDealsMap[deal.deal_id]);

    let stored = 0;
    for (const deal of newDeals) {
      const docId = deal.deal_id.toString();
      const cleanDeal = JSON.parse(JSON.stringify(deal));
      await db.collection('deals').doc(docId).set(cleanDeal);
      console.log('✅ Stored new deal:', docId);
      stored++;
    }

    // Append new deals to the old cache and write back
    const updatedCache = [...newDeals, ...oldDeals];
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(updatedCache, null, 2));

    res.status(200).json({
      message: 'Deals processed successfully',
      scraped: scrapedDeals.length,
      stored,
      skipped: scrapedDeals.length - newDeals.length,
      cache_updated_count: updatedCache.length,
    });

  } catch (error) {
    console.error('🔥 Error scraping or storing:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
