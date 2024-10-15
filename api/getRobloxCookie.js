const puppeteer = require('puppeteer');
require('dotenv').config();

async function getRobloxCookie() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the Roblox login page
    await page.goto('https://www.roblox.com/newlogin');

    // Fill in the login form
    await page.type('#login-username', process.env.ROBLOX_USERNAME);
    await page.type('#login-password', process.env.ROBLOX_PASSWORD);
    
    // Click the login button
    await page.click('#login-button');

    // Wait for navigation after login
    await page.waitForNavigation();

    // Retrieve the .ROBLOSECURITY cookie
    const cookies = await page.cookies();
    const robloxCookie = cookies.find(cookie => cookie.name === '.ROBLOSECURITY');

    await browser.close();

    if (!robloxCookie) {
      throw new Error('Unable to retrieve Roblox cookie');
    }

    return robloxCookie.value;
  } catch (err) {
    console.error('Error logging into Roblox:', err);
    await browser.close();
    throw err;
  }
}

module.exports = { getRobloxCookie };
