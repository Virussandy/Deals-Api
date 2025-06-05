// server.js
import express from 'express';
import dealsRouter from './routes/deals.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use('/deals', dealsRouter); // ✅ Now it’s a proper router

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
