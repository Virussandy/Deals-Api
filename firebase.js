// firebase.js
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./firebaseKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://ozonic-offnbuy.firebasestorage.app', // 🔁 Replace this
});

export const db = admin.firestore();
export const storage = admin.storage().bucket();
export const FieldValue = admin.firestore.FieldValue;