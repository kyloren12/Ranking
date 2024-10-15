const express = require('express');
const bodyParser = require('body-parser');
const noblox = require('noblox.js');
const { getRobloxCookie } = require('./getRobloxCookie'); // Import the new script for refreshing cookie

const app = express();
const PORT = process.env.PORT || 3000;
const GROUP_ID = process.env.GROUP_ID; // Ensure this is set in your environment variables

app.use(bodyParser.json());

// Middleware to log every incoming request
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path} with body:`, JSON.stringify(req.body, null, 2));
  next();
});

app.post("/api/setRank", async (req, res) => {
  const { userid, rank, key, groupId } = req.body;

  // Debugging input values
  console.log(`Input values: 
    userId = ${userid}, 
    rank = ${rank}, 
    key = ${key}, 
    groupId = ${groupId}`);

  try {
    // Check if the provided key matches the environment variable
    if (key !== process.env.AUTH_KEY) {
      console.log('Unauthorized access attempt with key:', key);
      return res.status(403).json({ message: 'Unauthorized' });
    }

    let robloxCookie = process.env.ROBLOX_COOKIE;

    // Attempt to log in using the ROBLOX_COOKIE
    try {
      console.log('Logging in with ROBLOX_COOKIE...');
      await noblox.setCookie(robloxCookie);
      const user = await noblox.getCurrentUser();
      console.log('Logged in as user:', JSON.stringify(user, null, 2));
    } catch (err) {
      console.error('ROBLOX_COOKIE might have expired. Refreshing...');
      
      // If the cookie is invalid, refresh it using Puppeteer
      robloxCookie = await getRobloxCookie();
      await noblox.setCookie(robloxCookie);

      console.log('Cookie refreshed and set!');
    }

    // Attempt to promote the user
    console.log(`Attempting to promote user ${userid} to rank ${rank} in group ${groupId || GROUP_ID}`);
    const rankUpdateResponse = await noblox.setRank(groupId || GROUP_ID, userid, rank);
    console.log(`Successfully promoted user ${userid} to rank ${rank} in group ${groupId || GROUP_ID}. Response:`, JSON.stringify(rankUpdateResponse, null, 2));

    res.status(200).json({ message: 'Rank updated successfully' });
  } catch (err) {
    // Detailed error logging
    console.error("Error updating rank:", err);
    if (err.message) {
      console.error("Error message:", err.message);
    }
    if (err.response) {
      console.error("Error response:", err.response);
    }
    res.status(500).json({ message: 'Error updating rank', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
