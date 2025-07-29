import express from 'express';
import dotenv from 'dotenv';
import dealsRouter from './routes/deals.js';
import desidimeRouter from './routes/desidime.js';
import dealsmagnetRouter from './routes/dealsmagnet.js';
import notificationRouter from './routes/notification.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use('/deals', dealsRouter);
app.use('/desidime', desidimeRouter);
app.use('/dealsmagnet', dealsmagnetRouter);
app.use(express.json()); // if not already added
app.use('/notifications', notificationRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
