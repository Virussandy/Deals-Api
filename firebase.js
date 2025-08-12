import admin from 'firebase-admin';
import config from './config.js';
import logger from './utils/logger.js';

try {
  // Construct the service account object directly from environment variables
  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // When using .env files, the private key needs to be parsed correctly
    private_key: process.env.FIREBASE_PRIVATE_KEY,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  console.log(serviceAccount.project_id);
  // Check if all required keys are present
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('Missing required Firebase credential environment variables.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: config.firebase.storageBucket,
    databaseURL: config.firebase.databaseURL,
  });

  logger.info('Firebase Admin SDK initialized successfully from environment variables.');

} catch (error) {
  logger.error('CRITICAL: Firebase initialization failed.', {
    error: error.message,
  });
  // If Firebase can't start, the app is useless. Exit immediately.
  process.exit(1);
}

export const db = admin.firestore();
export const rtdb = admin.database();
export const storage = admin.storage().bucket();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
