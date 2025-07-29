// firebase.js
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('./firebaseKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gs://ozonic-offnbuy.firebasestorage.app', // 🔁 Replace this
<<<<<<< HEAD
  databaseURL: "https://ozonic-offnbuy-default-rtdb.firebaseio.com/"
=======
>>>>>>> 68a29315fe9e902667911e329ea3428881fd017d
});

export const db = admin.firestore();
export const storage = admin.storage().bucket();
<<<<<<< HEAD
export default admin;
=======
export const FieldValue = admin.firestore.FieldValue;
>>>>>>> 68a29315fe9e902667911e329ea3428881fd017d
