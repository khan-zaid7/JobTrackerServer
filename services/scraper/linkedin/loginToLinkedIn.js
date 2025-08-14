// helpers/loginToLinkedIn.js
import dotenv from 'dotenv';
import { humanDelay, typeLikeHuman, simulateFeedScroll } from '../../../utils/humanUtils.js';
import { 
    GLOBAL_NAV,
    LINKEDIN_LOGIN_URL,
    LOGIN_BUTTON_LOCATOR,
    LOGIN_EMAIL_INPUT,
    LOGIN_PASSWORD_INPUT
  } from '../../../config/pageLocators.js';

dotenv.config();

const { LINKEDIN_EMAIL1, LINKEDIN_PASSWORD1 } = process.env;
if (!LINKEDIN_EMAIL1 || !LINKEDIN_PASSWORD1) {
  throw new Error('❌ Missing LINKEDIN_EMAIL1 or LINKEDIN_PASSWORD1 in .env');
}

export async function loginToLinkedIn(page) {
  try {
    await openLoginPage(page);
    await fillCredentials(page, LINKEDIN_EMAIL1, LINKEDIN_PASSWORD1);
    await submitLoginForm(page);
    await waitForFeedPage(page);
    await simulateFeedScroll(page);
    console.log('✅ Login successful. Ready for next step.');
    return true;
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    throw new Error('Login to LinkedIn failed.');
  }
}

// === Subtasks ===

async function openLoginPage(page) {
  console.log('🌐 Navigating to LinkedIn Login Page...');
  await page.goto(LINKEDIN_LOGIN_URL(), { waitUntil: 'domcontentloaded' });
  await humanDelay(1500, 3000);
}

async function fillCredentials(page, email, password) {
  console.log('⌨️ Typing email...');
  const emailInput = await page.locator(LOGIN_EMAIL_INPUT());
  await emailInput.scrollIntoViewIfNeeded();
  await humanDelay(500, 1000);
  await emailInput.click();
  await typeLikeHuman(emailInput, email);

  console.log('🔐 Typing password...');
  const passwordInput = await page.locator(LOGIN_PASSWORD_INPUT());
  await humanDelay(500, 1000);
  await passwordInput.click();
  await typeLikeHuman(passwordInput, password);
}

async function submitLoginForm(page) {
  console.log('🖱️ Clicking login button...');
  const loginButton = page.locator(LOGIN_BUTTON_LOCATOR());
  const box = await loginButton.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 10, box.y + 10);
  }
  await humanDelay(500, 1200);
  await loginButton.click();
}

async function waitForFeedPage(page) {
  console.log('⏳ Waiting for feed page or login confirmation...');
  await page.waitForSelector(GLOBAL_NAV(), { timeout: 30000 });
  await humanDelay(2000, 3000);
}
