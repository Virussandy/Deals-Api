// server.js
import express from 'express';
import deals from './test.js';

import dotenv from 'dotenv';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 8080;

app.use('/test', deals); // ✅ Now it’s a proper router

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
