import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-documents-project-snouty-draft/8b7ae3a9-b65c-460b-8faf-578d8f514a9a/scratchpad/bo';
mkdirSync(OUT, { recursive: true });

const PAGES = (process.env.PAGES ?? 'leads,market').split(',');

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('input[type=email]', 'jo.admin@local.test');
await page.fill('input[type=password]', 'LokalUji2026!');
await page.click('button[type=submit]');
await page.waitForTimeout(4000);
process.stdout.write('after login: ' + page.url() + '\n');

for (const slug of PAGES) {
  await page.goto('http://localhost:3000/internal/' + slug, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  process.stdout.write('\n== ' + slug + ' == ' + page.url() + '\n' + body + '\n');
  await page.screenshot({ path: OUT + '/' + slug + '.png', fullPage: true });
}

await browser.close();
