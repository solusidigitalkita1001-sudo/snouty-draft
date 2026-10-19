/**
 * Onboarding hanya untuk kunjungan pertama (pemilik 2026-10-19: "kalo user ini udh pernah buka
 * website nya tolong wizardnya jangan tampilin lagi"). Tidak mengirim pesan — hanya membuka beranda:
 *
 *   E2E_BASE_URL=https://ai.pralon.co.id pnpm --filter @snouty/web e2e
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

/** Ada dialog onboarding setelah beranda selesai dimuat dan state server terbaca. */
async function wizardShown(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  return (await page.locator('[role="dialog"][aria-modal="true"]').count()) > 0;
}

test('kunjungan pertama tampil; dibuka lagi, ditutup di tengah jalan, atau cookie berganti: tidak tampil', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  assert.equal(await wizardShown(page), true, 'kunjungan pertama menampilkan wizard');
  // Tanpa menyelesaikan wizard (tab ditutup di tengah jalan), lalu kembali.
  assert.equal(await wizardShown(page), false, 'kunjungan kedua tidak menampilkan wizard');
  // Sesi tamu baru (cookie dihapus) di browser yang sama.
  await context.clearCookies();
  assert.equal(await wizardShown(page), false, 'cookie berganti, browser sama: tidak tampil');
  await context.close();
});
