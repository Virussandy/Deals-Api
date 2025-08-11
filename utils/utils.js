import { URL } from 'url';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { retry } from './network.js'; // Import the new retry utility

dotenv.config();

const api_token = process.env.EARN_KARO_API_KEY;

export function normalizeText(text) {
  return text.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
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

  if (!normalizedTitle || !normalizedStore) return null;

  const hash = crypto.createHash('sha256');
  hash.update(normalizedTitle + normalizedStore);
  return hash.digest('hex');
}

 export function insertOrReplaceMeeshoInvite(url, inviteCode = '384288512', source = 'android_app', campaignId = 'default') {
  try {
    const parsedUrl = new URL(url);
    const params = parsedUrl.searchParams;
    params.set('af_force_deeplink', 'true');
    params.set('host_internal', 'single_product');
    params.set('pid', 'meesho_affiliate_portal');
    params.set('is_retargeting', 'true');
    params.set('af_click_lookback', '7d');
    params.set('af_reengagement_window', '14d');
    params.set('product_name', 'product');
    params.set('utm_source', source);
    params.set('c', `${inviteCode}:${source}:${campaignId}`);

    parsedUrl.search = params.toString();
    return parsedUrl.toString();
  } catch (e) {
    return url;
  }
}

export async function convertAffiliateLink(redirectUrl) {
  if (!api_token) {
    console.error("❌ API token is missing!");
    return { success: false, reason: "No token" };
  }

  const operation = async () => {
    const data = JSON.stringify({
      deal: redirectUrl,
      convert_option: "convert_only"
    });

    const config = {
      method: 'post',
      url: 'https://ekaro-api.affiliaters.in/api/converter/public',
      timeout: 15000,
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
      // Throw an error to trigger a retry for specific, temporary issues.
      if (response.status >= 500) {
          throw new Error(`API returned status ${response.status}`);
      }
      return { success: false, reason: "Invalid response format" };
    }
  };

  try {
      // Wrap the API call in our retry utility.
      return await retry(operation, 3, 2000); // 3 retries, 2-second delay
  } catch (error) {
    console.error("Affiliate API error after retries:", error?.response?.data || error?.message);
    return { success: false, reason: "API call failed after multiple attempts" };
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
  const operation = async () => {
    let tab;
    try {
      tab = await browser.newPage();
      await tab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36');
      await tab.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      await tab.goto(redirectUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(res => setTimeout(res, 1000));

      const finalUrl = tab.url();
      
      if (finalUrl?.startsWith('http')) {
        return finalUrl.replace('/dealsmagnet.com', '');
      }
      // If we didn't get a valid URL, throw an error to trigger a retry.
      throw new Error('Navigation did not result in a valid http/https URL.');
    } finally {
      if (tab) {
        await tab.close();
      }
    }
  };
  
  try {
      return await retry(operation, retries, delayMs);
  } catch(err) {
      console.error(`URL resolution failed for ${redirectUrl} after retries.`, err.message);
      return null;
  }
}
