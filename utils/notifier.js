import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { canPostToFacebook, updatePostMeta, getAllFacebookPostIds, deleteFacebookPost } from './facebookUtils.js';

dotenv.config();
const TOKEN = process.env.TELEGRAM_BOT_ID;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOCKEN;

export async function notifyChannels(deal, buffer) {
  try {
    // Send the buffer to all channels
    // await sendToWhatsApp(buffer, deal);
    await sendToTelegram(buffer, deal);
    // await sendToInstagram(buffer, deal);
    await sendToFacebook(buffer, deal);

    console.log(`✅ Sent to all channels for deal ${deal.deal_id}`);
  } catch (err) {
    console.error(`❌ Failed to notify channels for deal ${deal.deal_id}:`, err.message);
  }
}

async function sendToWhatsApp(buffer, deal) {
  console.log(`Would send WhatsApp: ${deal.title}`);
  // Integrate with your WhatsApp API that supports sending image buffer
}

async function sendToTelegram(buffer, deal) {
  console.log(`Would send Telegram: ${deal.title}`);
  // Example:
  const form = new FormData();
  form.append('chat_id', CHAT_ID);
  form.append('photo', buffer,  { filename: `${deal.deal_id}.jpg` });
  form.append('caption', `${deal.title}\nPrice: ${deal.price}\nStore: ${deal.store}\n${deal.redirectUrl}`);
  await axios.post(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, form, { headers: form.getHeaders() });
}

async function sendToInstagram(buffer, deal) {
  console.log(`Would send Instagram: ${deal.title}`);
  // IG Graph API or 3rd party tool
}

async function sendToFacebook(buffer, deal) {
  if (!(await canPostToFacebook())) return;

  // const posts = await getAllFacebookPostIds(100);
  // if (posts.length >= 100) {
  //   const oldestPostId = posts[posts.length - 1];
  //   await deleteFacebookPost(oldestPostId);
  // }

  const form = new FormData();
  form.append('access_token', FACEBOOK_PAGE_ACCESS_TOKEN);
  form.append('source', buffer, { filename: `${deal.deal_id}.jpg` });
  form.append('caption', `${deal.redirectUrl}\n${deal.price}\n${deal.title}`);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
      form,
      { headers: form.getHeaders() }
    );
    console.log(`✅ Facebook post successful: ID = ${response.data.post_id || response.data.id}`);
    await updatePostMeta();
  } catch (err) {
    console.error('❌ Error posting to Facebook:', err.response?.data || err.message);
  }
}


// async function sendToFacebook(buffer, deal) {
//   console.log(`📢 Posting to Facebook: ${deal.title}`);

//   // 🔁 Step 1: Delete oldest post (optional cleanup)
//   const posts = await getAllFacebookPostIds(100); // Get latest 50 posts
//   if (posts.length >= 100) {
//     const oldestPostId = posts[posts.length - 1]; // last = oldest
//     await deleteFacebookPost(oldestPostId);       // delete it
//   }

//   // 🖼️ Step 2: Prepare and upload the image with caption
//   const form = new FormData();
//   form.append('access_token', FACEBOOK_PAGE_ACCESS_TOKEN);
//   form.append('source', buffer, { filename: `${deal.deal_id}.jpg` });
//   form.append(
//     'caption',
//     `${deal.redirectUrl}\n${deal.price}\n${deal.title}`
//   );

//   try {
//     const response = await axios.post(
//       `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/photos`,
//       form,
//       { headers: form.getHeaders() }
//     );

//     console.log(`✅ Facebook post successful: ID = ${response.data.post_id || response.data.id}`);
//   } catch (err) {
//     console.error('❌ Error posting to Facebook:', err.response?.data || err.message);
//   }
// }
