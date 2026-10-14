/**
 * Ketik cepat di composer (review putaran 4, poin 1): huruf yang diketik tanpa jeda dulu hilang
 * ("1 kaar mandi", "sumber ar toren") karena React #185. Tes ini mengetik ke halaman sungguhan —
 * jsdom tidak menjalankan penjadwalan event diskret React yang memicu bug itu.
 *
 *   E2E_BASE_URL=http://localhost:3000 pnpm --filter @snouty/web e2e
 *
 * Tidak ada pesan yang dikirim; tes hanya mengetik.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const U1 =
  'Rumah 1 lantai ukuran 10 x 6 m, tanah 15 x 8 m, 1 kamar mandi, 1 dapur, tanpa wastafel ' +
  'terpisah, sumber air toren atap, untuk air bersih dan pembuangan';

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

/** Halaman sambutan dengan composer terfokus, plus penampung error halaman. */
async function openComposer() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error' && /React|Maximum update depth/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // Onboarding pertama kali menutupi halaman; Escape melewatinya.
  await page.keyboard.press('Escape');
  const field = page.locator('textarea').first();
  await field.click();
  return { page, field, errors };
}

for (const delay of [0, 5, 10]) {
  test(`typing U1 with ${delay} ms between keys keeps every letter`, async () => {
    const { page, field, errors } = await openComposer();
    await field.pressSequentially(U1, { delay });
    assert.equal(await field.inputValue(), U1);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('pasted and IME-committed text is kept whole', async () => {
  const { page, field, errors } = await openComposer();
  // `insertText` mengirim satu event input tanpa keydown — sama dengan tempel dan komit IME ponsel.
  for (const word of U1.split(' ')) await page.keyboard.insertText(`${word} `);
  assert.equal(await field.inputValue(), `${U1} `);
  assert.deepEqual(errors, []);
  await page.close();
});
