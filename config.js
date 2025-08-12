import dotenv from 'dotenv';
import path from 'path';

// Determine the environment ('production' or 'development')
const env = process.env.NODE_ENV || 'production';

// --- Universal Environment Variable Loading ---
// In production, we'll load all variables from a single DOTENV_CONTENTS variable.
// In development, we'll load from the .env.development file.
if (env === 'production' && process.env.DOTENV_CONTENTS) {
  console.log('Loading environment variables from DOTENV_CONTENTS...');
  // The dotenv.parse method reads a string and returns an object of variables
  const parsed = dotenv.parse(Buffer.from(process.env.DOTENV_CONTENTS, 'utf-8'));
  // We then merge these parsed variables into the global process.env object
  for (const key in parsed) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      process.env[key] = parsed[key];
    }
  }
} else {
  // This is the fallback for local development
  console.log('Loading environment variables from .env.development file...');
  const envPath = path.resolve(process.cwd(), '.env.development');
  dotenv.config({ path: envPath });
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
  },
};
