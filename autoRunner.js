import axios from 'axios';
import logger from './utils/logger.js'; // Import the new logger

const API_URL = 'http://localhost:5000/deals';

let isRunning = false;

async function callDealsAPI() {
  if (isRunning) {
    logger.warn('Previous run still in progress. Skipping this call.');
    return;
  }

  isRunning = true;
  logger.info('Starting API call...');

  try {
    const response = await axios.post(API_URL);
    logger.info('API Success:', { responseData: response.data });
  } catch (error) {
    logger.error('API Error:', { error: error.message });
  } finally {
    isRunning = false;
  }
}

setInterval(callDealsAPI, 30 * 1000);
