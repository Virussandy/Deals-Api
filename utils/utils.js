import { URL } from 'url';
import crypto from 'crypto';
import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const api_token = process.env.EARN_KARO_API_KEY;

export function normalizeText(text) {
  return text.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // remove all special characters
    .replace(/\s+/g, ' ')         // collapse multiple spaces to one
    .trim();
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

export function generateDealId(title,store) {
  const normalizedTitle = normalizeText(title);
  const normalizedStore = normalizeText(store);
  // const normalizedUrl = normalizeUrl(url);

  if (!normalizedTitle || !normalizedStore) return null;
  // if (!normalizedUrl ) return null;

  // Take first 5 words or fewer
  // const firstWords = normalizedTitle.split(/\s+/).slice(0, 5).join(' ');

  const hash = crypto.createHash('sha256');
  hash.update(normalizedTitle + normalizedStore);
  // hash.update(url);
  return hash.digest('hex');
}

// export function generateDealId(url) {
//   if (!url || typeof url !== 'string') return null;

//   // Normalize (optional but recommended)
//   const normalizedUrl = url.trim().toLowerCase();

//   const hash = crypto.createHash('sha256');
//   hash.update(normalizedUrl);
//   return hash.digest('hex');
// }


 export function insertOrReplaceMeeshoInvite(url, inviteCode = '384288512', source = 'android_app', campaignId = 'default') {
  try {
    const parsedUrl = new URL(url);

    // Required affiliate params
    const params = parsedUrl.searchParams;
    params.set('af_force_deeplink', 'true');
    params.set('host_internal', 'single_product');
    params.set('pid', 'meesho_affiliate_portal');
    params.set('is_retargeting', 'true');
    params.set('af_click_lookback', '7d');
    params.set('af_reengagement_window', '14d');
    params.set('product_name', 'product');
    params.set('utm_source', source);  // YouTube, Insta, etc.
    params.set('c', `${inviteCode}:${source}:${campaignId}`); // tracking code

    parsedUrl.search = params.toString();
    return parsedUrl.toString();
  } catch (e) {
    return url; // fallback for invalid URLs
  }
}

export async function convertAffiliateLink(redirectUrl) {
  try {
    if (!api_token) {
      console.error("❌ API token is missing!");
      return { success: false, reason: "No token" };
    }

    const data = JSON.stringify({
      deal: redirectUrl,
      convert_option: "convert_only"
    });

    const config = {
      method: 'post',
      url: 'https://ekaro-api.affiliaters.in/api/converter/public',
      timeout: 15000, // ⏱️ Max wait time: 10 seconds
      headers: {
        'Authorization': `Bearer ${api_token}`,
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

export async function resolveOriginalUrl(browser, redirectUrl, retries, delayMs = 30000) {
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    let tab;
    try {
      tab = await browser.newPage();
      await tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36');
      await tab.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      await tab.goto(redirectUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(1000); // buffer for JS redirects

      const finalUrl = tab.url();
      await tab.close();

      if (finalUrl?.startsWith('http')) {
        return finalUrl.replace('/dealsmagnet.com', '');
      }
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      if (tab) {
        try { await tab.close(); } catch (e) {}
      }
      if (attempt < retries) await delay(delayMs);
    }
  }

  return null; // 🚫 Failure explicitly returned
}
