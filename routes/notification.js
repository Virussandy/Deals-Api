import express from 'express';
import admin from '../firebase.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { title, body, imageUrl, data } = req.body;

  if (!data?.deal_id) {
    return res.status(400).json({ success: false, error: "Missing 'deal_id' in data" });
  }

  const message = {
    notification: {
      title,
      body,
      imageUrl: imageUrl || undefined,
    },
    android: {
      priority: 'high',
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
    },
    data: data || {},
    topic: 'all',
  };

  const notificationEntry = {
    deal_id: data.deal_id,
    timestamp: new Date().toISOString(),
  };

  try {
    // ✅ Send FCM notification
    const response = await admin.messaging().send(message);

    // ✅ Save to Realtime Database
    await admin.database().ref(`Notifications/${data.deal_id}`).set(notificationEntry);

    res.status(200).json({ success: true, fcmResponse: response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;