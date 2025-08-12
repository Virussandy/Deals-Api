import dotenv from 'dotenv';
import path from 'path';

// Determine the environment ('production' or 'development')
const env = process.env.NODE_ENV || 'production';

// Load the appropriate .env file
const envPath = path.resolve(process.cwd(), `.env.${env}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  // This will fail gracefully if the file doesn't exist,
  // which is fine if you set environment variables directly.
  console.log(`Note: Could not find ${envPath} file, relying on system environment variables.`);
}

// Export all the configuration variables
export default {
  env,
  port: process.env.PORT,
  earnKaroApiKey: process.env.EARN_KARO_API_KEY,
  telegram: {
    botId: process.env.TELEGRAM_BOT_ID,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
  },
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOCKEN,
  },
  firebase: {
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    databaseURL: process.env.FIREBASE_DB_URL,
    // The key file is also environment-specific now
    keyFilename: path.resolve(process.cwd(), `firebaseKey.${env}.json`),
  },
};
