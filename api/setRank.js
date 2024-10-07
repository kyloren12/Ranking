const express = require('express');
const bodyParser = require('body-parser');
const noblox = require('noblox.js');

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

    // Attempt to log in using the ROBLOX_COOKIE
    console.log('Logging in with ROBLOX_COOKIE...');
    const cookieResponse = await noblox.setCookie(process.env.ROBLOX_COOKIE);
    console.log('Cookie set response:', cookieResponse);

    // Debugging logged-in user
    const user = await noblox.getCurrentUser();
    console.log('Logged in as user:', JSON.stringify(user, null, 2));

    // Attempt to promote the user
    const success = await noblox.setRank(groupId, userid, rank);
    if (success) {
      console.log(`User ID ${userid} was promoted to rank ${rank}.`);
      return res.status(200).json({ message: `User ID ${userid} was promoted to rank ${rank}.` });
    } else {
      console.log(`Failed to promote User ID ${userid}.`);
      return res.status(500).json({ message: 'Failed to promote user.' });
    }
  } catch (error) {
    console.error('Error in /api/setRank:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
