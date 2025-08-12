import admin from 'firebase-admin';
import { createRequire } from 'module';
import config from './config.js';
import logger from './utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const require = createRequire(import.meta.url);
const keyFilename = path.resolve(process.cwd(), `firebaseKey.${config.env}.json`);

// This is an immediately-invoked async function to set up Firebase.
// It runs once when the application starts.
(async () => {
  try {
    // In production, the key comes from an environment variable set by Secret Manager.
    // We write it to a file so the rest of the app can use it normally.
    if (config.env === 'production' && process.env.FIREBASE_KEY_JSON) {
      logger.info('Found FIREBASE_KEY_JSON env var. Writing to key file for initialization.');
      await fs.writeFile(keyFilename, process.env.FIREBASE_KEY_JSON);
    }

    // Now, require the file which either existed (for local dev) or was just created.
    const serviceAccount = require(keyFilename);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: config.firebase.storageBucket,
      databaseURL: config.firebase.databaseURL,
    });

    logger.info('Firebase Admin SDK initialized successfully.');

  } catch (error) {
    logger.error('CRITICAL: Firebase initialization failed.', {
      error: error.message,
      hasEnvVar: !!process.env.FIREBASE_KEY_JSON,
    });
    // If Firebase can't start, the app is useless. Exit immediately.
    process.exit(1);
  }
})();


export const db = admin.firestore();
export const rtdb = admin.database();
export const storage = admin.storage().bucket();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
