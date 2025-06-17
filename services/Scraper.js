import { firefox } from 'playwright';
import { loginToLinkedIn } from './loginToLinkedIn.js';

const browser = await firefox.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext();
const page = await context.newPage();

await loginToLinkedIn(page); // Task 1
