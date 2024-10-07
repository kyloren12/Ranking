
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
