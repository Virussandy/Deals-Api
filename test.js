import axios from 'axios';
import express from 'express';

const apiToken = process.env.AFFILIATE_API_TOKEN;
const router = express.Router();


async function convertAffiliateLink(redirectUrl) {
  const payload = {
    deal: redirectUrl,
    convert_option: "convert_only"
  };

  const config = {
    method: 'post',
    url: 'https://ekaro-api.affiliaters.in/api/converter/public',
    headers: {
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODRiYWVjYzdmODE5ODM3MGMwMmFjZWUiLCJlYXJua2FybyI6IjQ0Mzg4NzYiLCJpYXQiOjE3NDk3OTA4MDR9.yLdZLl_TnD5TodH7tzvcVtr7TuqtYPSWZiRFiDCL6JU',
      'Content-Type': 'application/json'
    },
    data: payload,
    timeout: 10000
  };

  try {
    const response = await axios(config);
    if (response?.data?.success === 1) {
      return { success: true, convertedUrl: response.data.data };
    } else {
      return { success: false, error: response.data?.message || 'Unknown error' };
    }
  } catch (error) {
    console.error('Affiliate API error:', error.message);
    return { success: false, error: error.message };
  }
}

router.get('/', async (req, res) => {

  try {
    const result = await convertAffiliateLink("https://www.amazon.in/dp/B0744RJW22");
    res.status(200).json(result);
  } catch (error) {
    console.error('🔥 Error in GET:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

export default router;
