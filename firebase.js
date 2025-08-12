import admin from 'firebase-admin';
import { createRequire } from 'module';
import config from './config.js'; // Import the new config
import logger from './utils/logger.js';

const require = createRequire(import.meta.url);

try {
  const serviceAccount = require(config.firebase.keyFilename);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: config.firebase.storageBucket,
    databaseURL: config.firebase.databaseURL,
  });
  
  logger.info('Firebase Admin SDK initialized successfully.');

} catch (error) {
  logger.error('Firebase initialization failed. Please check your key file path and configuration.', { 
    error: error.message,
    path: config.firebase.keyFilename 
  });
  // Exit the process if Firebase can't initialize, as it's a critical dependency.
  process.exit(1); 
}


export const db = admin.firestore();
export const rtdb = admin.database(); // Realtime Database export
export const storage = admin.storage().bucket();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
