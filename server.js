import express from 'express';
import dotenv from 'dotenv';
import dealsRouter from './routes/deals.js';
import desidimeRouter from './routes/desidime.js';
import dealsmagnetRouter from './routes/dealsmagnet.js';
import notificationRouter from './routes/notification.js';
import { closeBrowser } from './utils/browserManager.js';
import logger from './utils/logger.js'; // Import the new logger

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.use('/deals', dealsRouter);
app.use('/desidime', desidimeRouter);
app.use('/dealsmagnet', dealsmagnetRouter);
app.use('/notifications', notificationRouter);

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    await closeBrowser();
    logger.info('Shutdown complete.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', { error: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { reason });
  gracefulShutdown('unhandledRejection');
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
