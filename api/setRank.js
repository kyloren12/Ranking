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
    console.log('Attempting to log in with ROBLOX_COOKIE...');
    let loggedIn = false;

    if (process.env.ROBLOX_COOKIE) {
      const cookieResponse = await noblox.setCookie(process.env.ROBLOX_COOKIE);
      if (cookieResponse) {
        console.log('Successfully logged in with ROBLOX_COOKIE');
        loggedIn = true;
      } else {
        console.error('Failed to set cookie. Trying username and password...');
      }
    } else {
      console.error('No ROBLOX_COOKIE provided. Trying username and password...');
    }

    // If login via cookie failed, try using username and password
    if (!loggedIn) {
      const username = process.env.ROBUX_USERNAME; // Get username from environment variables
      const password = process.env.ROBUX_PASSWORD; // Get password from environment variables
      
      if (!username || !password) {
        console.error('Username or password not provided in environment variables.');
        return res.status(500).json({ message: 'Username or password not set in environment variables.' });
      }

      console.log('Logging in with username and password...');
      const loginResponse = await noblox.login(username, password);
      if (!loginResponse) {
        console.error('Failed to log in with username and password.');
        return res.status(500).json({ message: 'Login failed with username and password.' });
      }
      console.log('Successfully logged in with username and password.');
    }

    // Debugging logged-in user
    console.log('Checking logged in user...');
    const user = await noblox.getCurrentUser();
    console.log('Logged in as user:', JSON.stringify(user, null, 2));

    // Attempt to promote the user
    console.log(`Attempting to promote user ${userid} to rank ${rank} in group ${groupId || GROUP_ID}`);
    const rankUpdateResponse = await noblox.setRank(groupId || GROUP_ID, userid, rank);
    console.log(`Successfully promoted user ${userid} to rank ${rank} in group ${groupId || GROUP_ID}. Response:`, JSON.stringify(rankUpdateResponse, null, 2));

    res.status(200).json({ message: 'Rank updated successfully' });
  } catch (err) {
    // Detailed error logging
    console.error("Error updating rank:", err);
    // Logging specific error information
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
