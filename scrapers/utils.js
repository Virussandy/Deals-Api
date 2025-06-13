import { URL } from 'url';
import crypto from 'crypto';
import axios from 'axios';

const api_token = process.env.EARN_KARO_API_KEY;

export function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.origin + u.pathname;
  } catch (err) {
    return url.trim();
  }
}

export function generateDealId(title, store, url) {
  const normalizedTitle = normalizeText(title);
  const normalizedStore = normalizeText(store);
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedTitle || !normalizedStore || !normalizedUrl) return null;

  const hash = crypto.createHash('sha256');
  hash.update(normalizedTitle + normalizedStore + normalizedUrl);
  return hash.digest('hex');
}


export async function convertAffiliateLink(redirectUrl) {

  try {
    const data = JSON.stringify({
      deal: redirectUrl,
      convert_option: "convert_only"
    });

    const config = {
      method: 'post',
      url: 'https://ekaro-api.affiliaters.in/api/converter/public',
      headers: { 
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODRiYWVjYzdmODE5ODM3MGMwMmFjZWUiLCJlYXJua2FybyI6IjQ0Mzg4NzYiLCJpYXQiOjE3NDk3OTA4MDR9.yLdZLl_TnD5TodH7tzvcVtr7TuqtYPSWZiRFiDCL6JU`,  // <-- Replace your token here
        'Content-Type': 'application/json'
      },
      data: data
    };

    const response = await axios(config);

    if (response.data?.success === 1 && response.data?.data?.startsWith("http")) {
      return {
        success: true,
        newUrl: response.data.data
      };
    } else {
      return { success: false, reason: "Invalid response format" };
    }
  } catch (error) {
    console.error("Affiliate API error:", error?.response?.data || error?.message);
    return { success: false, reason: "API call failed" };
  }


  // const payload = {
  //   deal: redirectUrl,
  //   convert_option: "convert_only"
  // };

  // try {
  //   const response = await axios.post(
  //     'https://ekaro-api.affiliaters.in/api/converter/public',
  //     payload,
  //     {
  //       headers: {
  //         'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODRiYWVjYzdmODE5ODM3MGMwMmFjZWUiLCJlYXJua2FybyI6IjQ0Mzg4NzYiLCJpYXQiOjE3NDk3OTA4MDR9.yLdZLl_TnD5TodH7tzvcVtr7TuqtYPSWZiRFiDCL6JU',
  //         'Content-Type': 'application/json'
  //       },
  //       timeout: 10000
  //     }
  //   );

  //   if (response?.data?.success === 1) {
  //     return { success: true, convertedUrl: response.data.data };
  //   } else {
  //     return { success: false, error: response.data?.message || 'Unknown error' };
  //   }
  // } catch (error) {
  //   console.error('Affiliate API error:', error.response?.data || error.message);
  //   return { success: false, error: error.message };
  // }
}



export function sanitizeUrl(inputUrl) {
  try {
    const parsedUrl = new URL(inputUrl);

    const unwantedParams = [
      'tag', 'ascsubtag', 'affid', 'affExtParam1', 'affExtParam2',
      'utm_source', 'utm_medium', 'utm_campaign', 'th',
      'cmpid', '_refId', '_appId', 'dealsmagnet.com', 'aod', 'psc', 'admitad_uid', 
      'tagtag_uid', 'referrer', 'af_siteid', 'tsid', 'Aff_Desidime',
      'affinity_int', 'af_tranid', 'af_prt', 'pid', 'c'

    ];

    for (const param of unwantedParams) {
      parsedUrl.searchParams.delete(param);
    }

    if (parsedUrl.searchParams.has('openid.return_to')) {
      try {
        const nestedRaw = parsedUrl.searchParams.get('openid.return_to');
        const decoded = decodeURIComponent(nestedRaw);
        const nestedUrl = new URL(decoded);

        for (const param of unwantedParams) {
          nestedUrl.searchParams.delete(param);
        }

        parsedUrl.searchParams.set('openid.return_to', nestedUrl.toString());
      } catch (err) {
        console.warn(`Failed nested openid.return_to in: ${inputUrl}`);
      }
    }

    return parsedUrl.toString();
  } catch (err) {
    return inputUrl;
  }
}

export async function resolveOriginalUrl(browser, redirectUrl, retries, delayMs = 5000) {
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    let tab;
    try {
      tab = await browser.newPage();

      // Add better User-Agent to prevent bot blocking
      await tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110 Safari/537.36');

      await tab.goto(redirectUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      const finalUrl = tab.url();
      await tab.close();

      // ✅ Extra protection: If finalUrl is valid HTTP(S)
      if (finalUrl?.startsWith('http')) {
        return finalUrl;
      }
    } catch (err) {
      console.error(`Attempt ${attempt} failed to resolve URL:`, err.message);
      if (tab) await tab.close();
      if (attempt < retries) {
        await delay(delayMs);
      }
    }
  }

  // If all retries failed, better to return null to indicate failure
  return null;
}

