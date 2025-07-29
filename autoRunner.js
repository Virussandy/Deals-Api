import axios from 'axios';

const API_URL = 'http://localhost:5000/deals'; // Replace with your actual API URL

let isRunning = false;

async function callDealsAPI() {
  if (isRunning) {
    console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Previous run still in progress. Skipping this call.`);
    return;
  }

  isRunning = true;
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 Starting API call...`);

  try {
    const response = await axios.post(API_URL);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ API Success:`, response.data);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ API Error:`, error.message);
  } finally {
    isRunning = false;
  }
}


// Call every 30 seconds
setInterval(callDealsAPI, 30 * 1000);