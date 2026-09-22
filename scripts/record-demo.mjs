// Records real UI operations at normal speed against a disposable synthetic demo.
// Requires the full application on localhost:5180, Playwright Chromium and Poppler.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

await mkdir('artifacts/recordings', { recursive: true });
await mkdir('output/video', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  recordVideo: { dir: 'artifacts/recordings', size: { width: 1600, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(process.env.RECORDING_URL || 'http://localhost:5180/');
await page.evaluate(() => document.fonts.ready);
const start = Date.now();
const rehearsal = process.env.RECORDING_DRY_RUN === '1';
const shotLog = [];
async function at(seconds, label) {
  const remaining = rehearsal ? 0 : seconds * 1000 - (Date.now() - start);
  if (remaining > 0) await page.waitForTimeout(remaining);
  const actual = (Date.now() - start) / 1000;
  if (!rehearsal && actual > seconds + 6) throw new Error(`Shot ${label} missed its timing: ${actual}`);
  shotLog.push({ seconds: actual, label });
  console.log(`${actual.toFixed(1)}s: ${label}`);
}
async function tab(name) {
  await page.getByRole('tab', { name, exact: true }).click();
}
async function inspect(code) {
  await page
    .getByRole('row')
    .filter({ hasText: code })
    .getByRole('button', { name: 'Inspect record' })
    .click();
}
async function closeDialog() {
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
}

try {
  await at(8, 'Enter the synthetic full-application demo');
  await page.getByRole('button', { name: 'Explore the live demo' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Ember & Oak.' })).toBeVisible();
  await at(23, 'Trace the paprika lot');
  await page.getByRole('link', { name: 'Recall workspace' }).click();
  await expect(page.locator('.trace-stats')).toContainText('480');
  await page.locator('.trace-workspace').scrollIntoViewIfNeeded();
  await at(31, 'Inspect the source and provenance path');
  await page.getByTestId('rf__node-batch-smoky-1').click();
  await at(43, 'Return to the live trace');
  await closeDialog();
  await page.evaluate(() => window.scrollTo(0, 0));
  await at(53, 'Read customer deliveries');
  await tab('Customer deliveries');
  await at(65, 'Inspect the uncertain batch');
  await tab('Batch scope');
  await page.locator('.trace-workspace').scrollIntoViewIfNeeded();
  await at(72, 'Read the original missing-spice note');
  await inspect('CHL-1909-X');
  await at(83, 'Keep uncertainty visible');
  await closeDialog();
  await at(87, 'Save the original rehearsal');
  await page.getByRole('button', { name: 'Save this rehearsal', exact: true }).click();
  await at(93, 'Freeze the evidence');
  await page.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await at(98, 'Review the saved uncertainty');
  await page.getByRole('button', { name: 'Review snapshot' }).click();
  await at(104, 'Return to the live records');
  await closeDialog();
  await page.getByRole('link', { name: 'Recall workspace' }).click();
  await tab('Batch scope');
  await inspect('CHL-1909-X');
  await page.getByRole('button', { name: 'Resolve record gap', exact: true }).click();
  await at(110, 'Enter recovered source evidence');
  const repair = page.getByRole('dialog', { name: 'Resolve the record gap' });
  await repair.getByLabel('Recovered input 1', { exact: true }).selectOption('lot-paprika-b');
  await repair.getByLabel('Recovered quantity 1', { exact: true }).fill('0.5');
  await repair
    .getByLabel('Recovered source reference')
    .pressSequentially('Synthetic recovered production record EEO-1909-X: PAP-2410, 0.5 kg.', { delay: 35 });
  await repair
    .getByLabel('What did you verify?')
    .pressSequentially(
      "Synthetic training correction. The recovered spice entry completes this batch's ingredient records.",
      { delay: 25 },
    );
  await repair.getByRole('checkbox').check();
  await at(122, 'Append the correction and recalculate');
  await repair.getByRole('button', { name: 'Save evidence & recheck' }).click();
  await expect(repair).not.toBeVisible();
  await at(127, 'Compare original and current evidence');
  await tab('Evidence changes');
  await page.locator('.evidence-changes').scrollIntoViewIfNeeded();
  await expect(page.locator('.evidence-changes')).toContainText('1 batch changed classification');
  await page.screenshot({ path: 'artifacts/screenshots/evidence-changes.png', fullPage: false });
  await at(136, 'Download the unchanged original report');
  await page.getByRole('link', { name: 'Rehearsals & reports', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download evidence pack' }).click();
  const download = await downloadPromise;
  await download.saveAs('artifacts/recordings/original-rehearsal.pdf');
  execFileSync('pdftoppm', [
    '-f',
    '3',
    '-singlefile',
    '-scale-to',
    '1500',
    '-png',
    'artifacts/recordings/original-rehearsal.pdf',
    'artifacts/recordings/original-investigation',
  ]);
  await at(141, 'Inspect the actual exported PDF investigation page');
  await page.goto(pathToFileURL(resolve('artifacts/recordings/original-investigation.png')).href);
  await at(159, 'Business hypothesis and validation plan');
  await page.goto(pathToFileURL(resolve('submission/.build/slide-07.png')).href);
  await at(175, 'Closing frame');
  await page.goto(pathToFileURL(resolve('submission/.build/slide-09.png')).href);
  await at(185, 'End of the narration guide');
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    rehearsal ? 'artifacts/recordings/dry-run-shots.json' : 'output/video/recording-shots.json',
    JSON.stringify(
      { source: 'Full local application; synthetic records', javascriptErrors: errors, shots: shotLog },
      null,
      2,
    ),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(
    rehearsal ? 'artifacts/recordings/dry-run.webm' : 'artifacts/recordings/batchlight-screen.webm',
  );
  console.log('Saved artifacts/recordings/batchlight-screen.webm');
} finally {
  await browser.close();
}
