import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// 로그인
await page.goto('http://localhost:3000/login');
await page.waitForLoadState('networkidle');
await page.locator('input').first().fill('admin');
await page.locator('input[type="password"]').fill('admin1234');
await page.locator('button:has-text("로그인")').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

// 창고 선택
const warehouseSelect = page.locator('select, [role="combobox"]').first();
await warehouseSelect.selectOption({ index: 1 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/screen4_warehouse_selected.png' });
console.log('screen4 URL:', page.url());

// 상품 관리 페이지
await page.locator('a:has-text("상품 관리"), nav >> text=상품 관리').click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/screen5_products.png' });
console.log('screen5 URL:', page.url());

await browser.close();
