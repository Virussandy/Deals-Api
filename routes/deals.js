import express from 'express';
import desidime from '../scrapers/desidime.js';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import db from '../firebase.js';
import { getBrowser } from '../browser.js';
import { resolveOriginalUrl, sanitizeUrl , convertAffiliateLink} from '../utils/utils.js';
import dayjs from 'dayjs';

const router = express.Router();

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

      if (diffHours > 24) {
        dealsToUpdate.push(deal);
      }
    }
  }

  console.log(`🆕 ${newDeals.length} new deals to resolve and store`);
  console.log(`🕒 ${dealsToUpdate.length} existing deals to update`);

  const browser = await getBrowser();

for (const deal of [...newDeals, ...dealsToUpdate]) {
  try {
    console.log(deal.redirectUrl)
    deal.redirectUrl = await resolveOriginalUrl(browser, deal.redirectUrl, 1);
    console.log(deal.redirectUrl)
    try{
       const affiliateResponse = await convertAffiliateLink(deal.redirectUrl);
      if (affiliateResponse.success) {
        deal.url = await resolveOriginalUrl(browser,affiliateResponse.newUrl, 1);
      } else {
        deal.url = sanitizeUrl(deal.redirectUrl);
      }
      delete deal.redirectUrl;
    }catch(err){
      console.error('Error convert Affiliate link');
    }
  } catch (err) {
    console.error('Error processing deal:', err);
  }
  console.log(deal.url)
  console.log('\n');
}

  await browser.close();

  const batch = db.batch();

  // Insert new deals
  for (const deal of newDeals.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
  }

  // Update existing deals where 6hr rule applied
  for (const deal of dealsToUpdate.reverse()) {
    const dealRef = db.collection('deals').doc(deal.deal_id);
    batch.set(dealRef, deal);
  }

  await batch.commit();

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
