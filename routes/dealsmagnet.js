import express from 'express';
import dealsmagnet from '../scrapers/dealsmagnet.js';
import { processSourceDeals } from '../helpers/dealProcessor.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await processSourceDeals(dealsmagnet, page);
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in DealsMagnet GET:', error);
    res.status(500).json({ error: 'Failed to process DealsMagnet deals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await processSourceDeals(dealsmagnet, 1);
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in DealsMagnet POST:', error);
    res.status(500).json({ error: 'Failed to process DealsMagnet deals' });
  }
});

export default router;
