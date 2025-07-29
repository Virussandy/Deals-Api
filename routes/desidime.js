import express from 'express';
import desidime from '../scrapers/desidime.js';
import { processSourceDeals } from '../helpers/dealProcessor.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await processSourceDeals(desidime, page);
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in Desidime GET:', error);
    res.status(500).json({ error: 'Failed to process Desidime deals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await processSourceDeals(desidime, 1);
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in Desidime POST:', error);
    res.status(500).json({ error: 'Failed to process Desidime deals' });
  }
});

export default router;
