import axios from 'axios';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

import { db, storage, FieldValue  } from '../firebase.js';

dotenv.config();
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOCKEN;
const MIN_POST_GAP_MINUTES = 15;

export async function canPostToFacebook() {
  const metaRef = db.collection('meta').doc('fb_post_status');
  const doc = await metaRef.get();

  const now = dayjs();

  if (!doc.exists) {
    await metaRef.set({ lastPostAt: now.toISOString(), count: 1 });
    return true;
  }

  const data = doc.data();
  const lastPost = dayjs(data.lastPostAt);

  if (now.diff(lastPost, 'minute') >= MIN_POST_GAP_MINUTES) {
    return true;
  }

  console.warn(`⏳ Waiting: Only ${now.diff(lastPost, 'minute')} min since last post.`);
  return false;
}

export async function updatePostMeta() {
  const metaRef = db.collection('meta').doc('fb_post_status');
  await metaRef.update({
    lastPostAt: new Date().toISOString(),
    count: FieldValue.increment(1),
  });
}


export async function getAllFacebookPostIds(limit = 100) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/posts`,
      {
        params: {
          access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
          limit,
        },
      }
    );

    const posts = response.data?.data || [];
    const postIds = posts.map(post => post.id);
    console.log(`📥 Found ${postIds.length} post(s).`);
    return postIds;
  } catch (err) {
    console.error('❌ Failed to fetch posts:', err.response?.data || err.message);
    return [];
  }
}

export async function deleteFacebookPost(postId) {
  try {
    await axios.delete(
      `https://graph.facebook.com/v18.0/${postId}`,
      {
        params: {
          access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
        },
      }
    );
    console.log(`🗑️ Deleted Facebook post: ${postId}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to delete post ${postId}:`, err.response?.data || err.message);
    return false;
  }
}
