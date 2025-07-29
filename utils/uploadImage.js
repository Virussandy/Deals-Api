import { db, storage } from '../firebase.js';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * Uploads an image from a remote URL to Firebase Storage, and saves the new link to Firestore.
 */
export async function uploadImageFromUrl(imageUrl, dealId) {
  try {
    // Step 1: Fetch image as buffer
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch image');
    const buffer = await response.buffer();

    // Step 2: Define file path and upload to Firebase Storage
    const fileExtension = path.extname(imageUrl).split('?')[0] || '.jpg';
    const filename = `deals/images/${dealId}_${uuidv4()}${fileExtension}`;
    const file = storage.file(filename);

    file.save(buffer, {
          metadata: {
              contentType: response.headers.get('content-type'),
              metadata: {
                  firebaseStorageDownloadTokens: uuidv4(), // required for public URL
              },
          },
          public: true, // optionally make it public
          resumable: false,
      });

    // Step 3: Construct the download URL
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(filename)}?alt=media`;

    // Step 4: Save the image URL to Firestore (optional)
    // await db.collection('deals').doc(dealId).update({
    //   image_url: downloadUrl,
    // });

    console.log(`✅ Uploaded & saved to Firestore: ${downloadUrl}`);
    return {downloadUrl, buffer};

  } catch (err) {
    console.error('❌ Failed to upload image from URL:', err.message);
    return null;
  }
}
