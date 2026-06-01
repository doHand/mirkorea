import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/screen1_initial.png' });
console.log('screen1 URL:', page.url());

const inputs = await page.$$('input');
for (const inp of inputs) {
  const type = await inp.getAttribute('type');
  const name = await inp.getAttribute('name');
  const placeholder = await inp.getAttribute('placeholder');
  console.log('  input:', JSON.stringify({ type, name, placeholder }));
}

const usernameField = page.locator('input').first();
const passwordField = page.locator('input[type="password"]');
await usernameField.fill('admin');
await passwordField.fill('admin1234');
await page.screenshot({ path: '/tmp/screen2_form_filled.png' });

const loginBtn = page.locator('button[type="submit"], button:has-text("로그인")');
await loginBtn.click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/screen3_dashboard.png' });
console.log('screen3 URL:', page.url());

await browser.close();
