const express = require('express');
const bodyParser = require('body-parser');
const noblox = require('noblox.js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const GROUP_ID = process.env.GROUP_ID;

// 👇 put your robux webhook link here
const ROBUX_BALANCE_WEBHOOK = "https://discord.com/api/webhooks/1411356138267611248/mSI8HHUlMqAAb1fQFSvkTrj1dpIsLWjUh05xE3lS3d08z2zH0t9lKg4KIL24ydyJFdmG";

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
  console.log(`Received request: ${req.method} ${req.path} with body:`, JSON.stringify(req.body, null, 2));
  next();
});

// Send webhook to Discord (promotion/errors)
async function sendDiscordWebhook({ title, description, color = 0x3498db, fields = [], thumbnail = null }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await axios.post(webhookUrl, {
      embeds: [
        {
          title,
          description,
          color,
          fields,
          thumbnail: thumbnail ? { url: thumbnail } : undefined,
          timestamp: new Date().toISOString()
        }
      ]
    });
  } catch (_) {}
}

// Send webhook to a hardcoded Robux webhook
async function sendRobuxWebhook({ title, description, color = 0xf1c40f, fields = [], thumbnail = null }) {
  try {
    await axios.post(ROBUX_BALANCE_WEBHOOK, {
      embeds: [
        {
          title,
          description,
          color,
          fields,
          thumbnail: thumbnail ? { url: thumbnail } : undefined,
          timestamp: new Date().toISOString()
        }
      ]
    });
  } catch (_) {}
}

app.post("/api/setRank", async (req, res) => {
  const { userid, rank, key, groupId } = req.body;

  console.log(`Input values: 
    userId = ${userid}, 
    rank = ${rank}, 
    key = ${key}, 
    groupId = ${groupId}`);

  try {
    // 🔒 Auth key check
    if (key !== process.env.AUTH_KEY) {
      const reason = `Unauthorized attempt with key: ${key}`;
      console.log(reason);
      await sendDiscordWebhook({
        title: "❌ Promotion Failed",
        description: reason,
        color: 0xff0000
      });
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // 🔒 Enforce group ID check
    if (groupId && String(groupId) !== String(GROUP_ID)) {
      const reason = `Group ID mismatch: request=${groupId}, env=${GROUP_ID}`;
      console.error(reason);
      await sendDiscordWebhook({
        title: "❌ Promotion Failed",
        description: reason,
        color: 0xff0000
      });
      return res.status(400).json({ message: reason });
    }

    // Login handling
    let loggedIn = false;
    if (process.env.ROBLOX_COOKIE) {
      const cookieResponse = await noblox.setCookie(process.env.ROBLOX_COOKIE);
      if (cookieResponse) {
        console.log('Logged in with cookie');
        loggedIn = true;

        // ✅ Check Robux balance
        try {
          const botUser = await noblox.getCurrentUser();
          const robuxRes = await axios.get(
            `https://economy.roblox.com/v1/users/${botUser.UserID}/currency`,
            {
              headers: { Cookie: `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}` }
            }
          );

          const robux = robuxRes.data.robux;
          console.log(`${botUser.UserName} has ${robux} R$`);

          if (robux >= 0) {
            await sendRobuxWebhook({
              title: "💰 Robux Balance Detected",
              description: `${botUser.UserName} currently has Robux in their account.`,
              color: 0xf1c40f,
              thumbnail: `https://www.roblox.com/headshot-thumbnail/image?userId=${botUser.UserID}&width=150&height=150&format=png`,
              fields: [
                { name: "Username", value: botUser.UserName, inline: true },
                { name: "User ID", value: String(botUser.UserID), inline: true },
                { name: "Balance", value: `${robux} R$`, inline: true }
              ]
            });
          }
        } catch (balanceErr) {
          console.error("Failed to fetch Robux balance:", balanceErr.message);
        }
      } else {
        console.error('Cookie login failed.');
      }
    }

    if (!loggedIn) {
      const username = process.env.ROBUX_USERNAME;
      const password = process.env.ROBUX_PASSWORD;
      if (!username || !password) {
        const reason = 'Username or password missing from environment variables.';
        console.error(reason);
        await sendDiscordWebhook({
          title: "❌ Promotion Failed",
          description: reason,
          color: 0xff0000
        });
        return res.status(500).json({ message: reason });
      }

      const loginResponse = await noblox.login(username, password);
      if (!loginResponse) {
        const reason = 'Login with username/password failed.';
        console.error(reason);
        await sendDiscordWebhook({
          title: "❌ Promotion Failed",
          description: reason,
          color: 0xff0000
        });
        return res.status(500).json({ message: reason });
      }

      console.log('Logged in with username/password');
    }

    const botUser = await noblox.getCurrentUser();
    console.log('Logged in as:', botUser.UserName);

    const finalGroupId = GROUP_ID;
    const username = await noblox.getUsernameFromId(userid);
    const thumbnail = `https://www.roblox.com/headshot-thumbnail/image?userId=${userid}&width=150&height=150&format=png`;

    const rankUpdateResponse = await noblox.setRank(finalGroupId, userid, rank);
    const newRoleName = await noblox.getRole(finalGroupId, rank);

    const description = `Successfully promoted **${username}** in group **${finalGroupId}**.`;

    console.log(`✅ ${description}`);
    await sendDiscordWebhook({
      title: "✅ Promotion Successful",
      description,
      color: 0x00ff00,
      thumbnail,
      fields: [
        { name: "Username", value: username, inline: true },
        { name: "User ID", value: String(userid), inline: true },
        { name: "New Rank", value: `${rank} - ${newRoleName?.name || 'Unknown'}`, inline: true }
      ]
    });

    res.status(200).json({ message: 'Rank updated successfully' });

  } catch (err) {
    const username = userid ? await noblox.getUsernameFromId(userid).catch(() => "Unknown") : "Unknown";
    const reason = `Error promoting user ${username} (ID: ${userid}) to rank ${rank}: ${err.message}`;
    console.error("Error:", reason);
    await sendDiscordWebhook({
      title: "❌ Promotion Failed",
      description: reason,
      color: 0xff0000,
      fields: [
        { name: "Username", value: username, inline: true },
        { name: "User ID", value: String(userid), inline: true },
        { name: "Target Rank", value: String(rank), inline: true }
      ]
    });
    res.status(500).json({ message: 'Error updating rank', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
