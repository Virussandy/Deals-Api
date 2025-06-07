import { URL } from 'url';
import crypto from 'crypto';

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

export async function resolveOriginalUrl(browser, redirectUrl, retries = 1, delayMs = 3000) {
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    let tab;
    try {
      tab = await browser.newPage();
      await tab.goto(redirectUrl, { waitUntil: 'domcontentloaded', timeout: 0 });
      const finalUrl = tab.url();
      await tab.close();
      return finalUrl;
    } catch (err) {
      if (tab) await tab.close();
      if (attempt < retries) {
        await delay(delayMs);
      }
    }
  }
  return 'N/A';
}
