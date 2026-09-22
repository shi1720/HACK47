import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const base = process.env.DEMO_URL || 'http://127.0.0.1:5182/HACK47/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.getByRole('button', { name: 'Explore the live demo' }).click();
await expect(page.getByRole('heading', { name: 'Welcome to Ember & Oak.' })).toBeVisible();
await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
await page.getByRole('link', { name: 'Recall workspace' }).click();
await expect(page.locator('.trace-stats')).toContainText('480');
await page.getByRole('button', { name: 'Save this rehearsal' }).click();
await page.getByRole('button', { name: 'Save snapshot' }).click();
await expect(page.locator('.recall-card')).toContainText('480');
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await context.setOffline(true);
await page.reload();
await expect(page.locator('.recall-card')).toContainText('480');
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Download evidence pack' }).click();
const download = await downloadPromise;
await download.saveAs('artifacts/demo-evidence-pack.pdf');
if ((await readFile('artifacts/demo-evidence-pack.pdf')).subarray(0, 4).toString() !== '%PDF')
  throw new Error('Export was not PDF');
await context.setOffline(false);
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  JSON.stringify({
    url: base,
    localDemo: true,
    offlineFirstReload: true,
    pdfExport: true,
    javascriptErrors: errors.length,
  }),
);
await browser.close();
