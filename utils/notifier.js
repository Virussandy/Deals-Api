import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { canPostToFacebook, updatePostMeta } from './facebookUtils.js';
import { retry } from './network.js'; // Import the new retry utility

dotenv.config();
const TOKEN = process.env.TELEGRAM_BOT_ID;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOCKEN;

export async function notifyChannels(deal, buffer) {
  try {
    // Await all notifications, they can run in parallel.
    await Promise.all([
        sendToTelegram(buffer, deal),
        sendToFacebook(buffer, deal)
        // Add other channels here, e.g., sendToWhatsApp(buffer, deal)
    ]);

    console.log(`✅ Sent to all channels for deal ${deal.deal_id}`);
  } catch (err) {
    console.error(`❌ Failed to notify all channels for deal ${deal.deal_id}:`, err.message);
  }
}

async function sendToTelegram(buffer, deal) {
  const operation = async () => {
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('photo', buffer, { filename: `${deal.deal_id}.jpg` });
    form.append('caption', `${deal.title}\nPrice: ${deal.price}\nStore: ${deal.store}\n${deal.redirectUrl}`);
    
    await axios.post(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, form, { headers: form.getHeaders() });
    console.log(`✅ Telegram notification sent for: ${deal.title}`);
  };

  try {
    // Wrap the Telegram post in our retry utility.
    await retry(operation, 2, 2000); // 2 retries, 2-second delay
  } catch (err) {
      console.error('❌ Error posting to Telegram after retries:', err.response?.data || err.message);
      // Re-throw the error so Promise.all in notifyChannels can catch it if needed.
      throw err;
  }
}

async function sendToFacebook(buffer, deal) {
  if (!(await canPostToFacebook())) {
      console.log('⏩ Skipping Facebook post due to rate limiting.');
      return;
  }

  const operation = async () => {
    const form = new FormData();
    form.append('access_token', FACEBOOK_PAGE_ACCESS_TOKEN);
    form.append('source', buffer, { filename: `${deal.deal_id}.jpg` });
    form.append('caption', `${deal.redirectUrl}\n${deal.price}\n${deal.title}`);

    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
      form,
      { headers: form.getHeaders() }
    );
    console.log(`✅ Facebook post successful: ID = ${response.data.post_id || response.data.id}`);
  };

  try {
    // Wrap the Facebook post in our retry utility.
    await retry(operation, 2, 3000); // 2 retries, 3-second delay
    await updatePostMeta();
  } catch (err) {
    console.error('❌ Error posting to Facebook after retries:', err.response?.data || err.message);
    // Re-throw the error.
    throw err;
  }
}
