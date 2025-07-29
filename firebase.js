// firebase.js
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./firebaseKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://ozonic-offnbuy.firebasestorage.app', // 🔁 Replace this
  databaseURL: "https://ozonic-offnbuy-default-rtdb.firebaseio.com/"
});

export const db = admin.firestore();
export const storage = admin.storage().bucket();
export default admin;