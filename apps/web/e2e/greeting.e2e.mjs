/**
 * Sapaan pendek (review putaran 4, poin 3): "oi" dulu menunggu model ±30 detik lalu dijawab
 * "kurang paham". Sapaan dikenali dari contoh di `data/understanding/intent.json`, jadi balasannya
 * teks tetap tanpa model.
 *
 * Tes ini MENGIRIM pesan (membuat percakapan tamu), karena itu hanya berjalan dengan
 * `E2E_SEND=1`:
 *
 *   E2E_SEND=1 E2E_BASE_URL=https://ai.pralon.co.id pnpm --filter @snouty/web e2e
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const SEND = process.env.E2E_SEND === '1';
/** Kriteria pemilik: dibalas dalam < 2 detik. */
const LIMIT_MS = 2_000;

let browser;
before(async () => {
  if (SEND) browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

for (const greeting of ['oi', 'halo', 'p']) {
  test(`"${greeting}" is answered with the greeting in under 2 s`, { skip: !SEND }, async () => {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.keyboard.press('Escape');
    const field = page.locator('textarea').first();
    await field.fill(greeting);
    const started = Date.now();
    await field.press('Enter');
    // Kalimat pembuka sapaan pertama (`REPLY_COPY.OUT_OF_SCOPE` di API).
    const reply = page.getByText('siap bantu merencanakan pipa air bersih');
    await reply.waitFor({ timeout: 30_000 });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < LIMIT_MS, `balasan "${greeting}" butuh ${elapsed} ms`);
    assert.equal(await page.getByText('belum menangkap maksudnya').count(), 0);
    await page.close();
  });
}
