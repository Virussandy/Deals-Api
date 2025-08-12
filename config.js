import dotenv from 'dotenv';
import path from 'path';

// Determine the environment ('production' or 'development')
const env = process.env.NODE_ENV || 'production';

// Load the appropriate .env file
const envPath = path.resolve(process.cwd(), `.env.${env}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.log(`Note: Could not find ${envPath} file, relying on system environment variables.`);
}

// Ensure SERVER_ID is set, as it's critical for the round-robin scheduler.
if (!process.env.SERVER_ID) {
  console.error("FATAL ERROR: SERVER_ID environment variable is not set. Please assign a unique ID to this server instance (e.g., 'server_1').");
  process.exit(1);
}

// Export all the configuration variables
export default {
  env,
  port: process.env.PORT,
  // This is the unique, static ID for this server instance.
  serverId: process.env.SERVER_ID,
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
    keyFilename: path.resolve(process.cwd(), `firebaseKey.${env}.json`),
  },
};
