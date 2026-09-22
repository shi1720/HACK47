import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SessionResponse, Workspace } from '../../shared/types';
import AxeBuilder from '@axe-core/playwright';

const password = 'Kitchen-passphrase-1720';
const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@example.com`;

async function register(page: Page, workspaceName = 'E2E Test Kitchen') {
  const email = uniqueEmail();
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Test Maker');
  await page.getByLabel('Business / kitchen name').fill(workspaceName);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Create your workspace' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /recovery code/i })).toBeVisible();
  const recoveryCode = (await dialog.locator('code, .recovery-code').first().textContent())!.trim();
  expect(recoveryCode.length).toBeGreaterThan(30);
  await dialog.getByRole('button', { name: 'I saved my code' }).click();
  await expect(dialog).not.toBeVisible();
  return { email, recoveryCode };
}

async function serverWorkspace(context: BrowserContext): Promise<Workspace> {
  const response = await context.request.get('/api/workspace');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function addLot(page: Page, code = 'PEPPER-E2E-01') {
  await page.getByRole('button', { name: 'Receive a lot', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receive an ingredient lot' });
  await dialog.getByLabel('Supplier lot code').fill(code);
  await dialog.getByLabel('Received on').fill('2026-09-15');
  await dialog.getByLabel('Ingredient name').fill('Test smoked paprika');
  await dialog.getByLabel('Supplier', { exact: true }).fill('Synthetic Spice Company');
  await dialog.getByLabel('Quantity received').fill('10');
  await dialog.getByLabel('Source reference').fill('Synthetic delivery note E2E-001');
  await dialog.getByRole('button', { name: 'Save lot', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();
}

async function addBatch(page: Page, sourceId: string, code: string, quantity: string, complete = true) {
  await page.getByRole('button', { name: 'Record a batch', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record a production batch' });
  await dialog.getByLabel('Batch code').fill(code);
  await dialog.getByLabel('Produced on').fill('2026-09-16');
  await dialog.getByLabel('Product name').fill('Synthetic sauce');
  await dialog.getByLabel('Quantity produced').fill('100');
  await dialog.getByLabel('Source reference').fill(`Synthetic production sheet ${code}`);
  if (sourceId) {
    await dialog.getByRole('combobox', { name: 'Input 1', exact: true }).selectOption(sourceId);
    await dialog.getByRole('spinbutton', { name: 'Input 1 quantity', exact: true }).fill(quantity);
  }
  if (complete) await dialog.getByLabel('Every ingredient lot is recorded').check();
  await dialog.getByRole('button', { name: 'Save batch', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test('a second tab cannot overwrite offline edits and can take over after the first closes', async ({
  page,
  context,
}) => {
  await register(page, 'Two Tab Kitchen');
  await page.goto('/app/lots');
  await addLot(page, 'ORIGINAL-LOT');
  await expect.poll(async () => (await serverWorkspace(context)).lots.length).toBe(1);
  const second = await context.newPage();
  await second.goto('/app/lots');
  await expect(second.getByText(/open in another tab/)).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await addLot(page, 'WRITER-OFFLINE');
  await second.getByRole('button', { name: 'Receive a lot', exact: true }).click();
  const blocked = second.getByRole('dialog');
  await blocked.getByLabel('Supplier lot code').fill('SHOULD-NOT-EXIST');
  await blocked.getByLabel('Ingredient name').fill('Blocked lot');
  await blocked.getByLabel('Supplier', { exact: true }).fill('Synthetic supplier');
  await blocked.getByLabel('Quantity received').fill('1');
  await blocked.getByLabel('Source reference').fill('Synthetic record');
  await blocked.getByRole('button', { name: 'Save lot', exact: true }).click();
  await expect(blocked.getByRole('alert')).toContainText('another tab');
  await page.close();
  await second.reload();
  await expect(second.getByText('WRITER-OFFLINE', { exact: true })).toBeVisible();
  await addLot(second, 'TAKEOVER-OFFLINE');
  await context.setOffline(false);
  await expect.poll(async () => (await serverWorkspace(context)).lots.length).toBe(3);
  expect((await serverWorkspace(context)).lots.map((lot) => lot.code).sort()).toEqual([
    'ORIGINAL-LOT',
    'TAKEOVER-OFFLINE',
    'WRITER-OFFLINE',
  ]);
});

test('a stock conflict from another device preserves the rejected offline record across reload', async ({
  browser,
  baseURL,
}) => {
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  try {
    const a = await first.newPage();
    const b = await second.newPage();
    const credentials = await register(a, 'Concurrent Devices Kitchen');
    await a.goto('/app/lots');
    await addLot(a, 'SHARED-STOCK');
    await expect.poll(async () => (await serverWorkspace(first)).lots.length).toBe(1);
    const lot = (await serverWorkspace(first)).lots[0];
    await b.goto('/login');
    await b.getByLabel('Email', { exact: true }).fill(credentials.email);
    await b.getByLabel('Password', { exact: false }).fill(password);
    await b.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(b).toHaveURL(/\/app$/);
    await a.goto('/app/batches');
    await b.goto('/app/batches');
    await Promise.all([
      a.evaluate(async () => {
        await navigator.serviceWorker.ready;
      }),
      b.evaluate(async () => {
        await navigator.serviceWorker.ready;
      }),
    ]);
    await first.setOffline(true);
    await second.setOffline(true);
    await addBatch(a, lot.id, 'DEVICE-A-BATCH', '7');
    await addBatch(b, lot.id, 'DEVICE-B-BATCH', '7');
    await first.setOffline(false);
    await expect.poll(async () => (await serverWorkspace(first)).batches.length).toBe(1);
    await second.setOffline(false);
    await expect(b.locator('.sync-banner')).toContainText('allocated');
    await expect(b.getByText('DEVICE-B-BATCH', { exact: true })).toBeVisible();
    await b.reload();
    await expect(b.locator('.sync-banner')).toContainText('allocated');
    await expect(b.getByText('DEVICE-B-BATCH', { exact: true })).toBeVisible();
    const authoritative = await serverWorkspace(first);
    expect(authoritative.batches.map((batch) => batch.code)).toEqual(['DEVICE-A-BATCH']);
    expect(authoritative.revision).toBe(2);
    await b.goto('/app/settings');
    await expect(b.getByRole('button', { name: 'Download pending changes', exact: true })).toBeVisible();
    const pendingDownload = b.waitForEvent('download');
    await b.getByRole('button', { name: 'Download pending changes', exact: true }).click();
    const file = await (await pendingDownload).path();
    const pending = JSON.parse(await readFile(file!, 'utf8'));
    expect(pending).toHaveLength(1);
    expect(pending[0].command.payload.code).toBe('DEVICE-B-BATCH');
  } finally {
    await first.close();
    await second.close();
  }
});

test('a recovered source resolves uncertainty while the earlier rehearsal remains unchanged', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  const initial = await serverWorkspace(context);
  const lot = initial.lots.find((record) => record.code === 'PAP-2410')!;
  const uncertainBatch = initial.batches.find((record) => record.code === 'CHL-1909-X')!;
  await page.goto('/app/trace');
  await page.getByLabel('Which ingredient are we following?').selectOption('lot-paprika-a');
  await page.getByRole('button', { name: 'Save this rehearsal', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Before evidence repair');
  await page.getByRole('dialog').getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect.poll(async () => (await serverWorkspace(context)).recalls.length).toBe(1);
  const originalReport = (await serverWorkspace(context)).recalls[0];
  expect(originalReport.result.investigationBatchIds).toContain(uncertainBatch.id);
  await page.goto('/app/trace');
  await page.getByRole('tab', { name: 'Batch scope', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'CHL-1909-X' })
    .getByRole('button', { name: 'Inspect record' })
    .click();
  await page.getByRole('button', { name: 'Resolve record gap', exact: true }).click();
  const repair = page.getByRole('dialog', { name: 'Resolve the record gap' });
  await repair.getByRole('combobox', { name: 'Recovered input 1', exact: true }).selectOption(lot.id);
  await repair.getByRole('spinbutton', { name: 'Recovered quantity 1', exact: true }).fill('0.5');
  await repair.getByLabel('Recovered source reference').fill('Recovered production sheet, page 2');
  await repair
    .getByLabel('What did you verify?')
    .fill('Checked the original label and all recorded inputs. Synthetic exercise.');
  await repair.getByRole('checkbox').check();
  await repair.getByRole('button', { name: 'Save evidence & recheck', exact: true }).click();
  await expect(repair).not.toBeVisible();
  await expect
    .poll(
      async () =>
        (await serverWorkspace(context)).batches.find((record) => record.id === uncertainBatch.id)
          ?.recordsComplete,
    )
    .toBe(true);
  await page.getByRole('tab', { name: 'Evidence changes', exact: true }).click();
  const comparison = page.getByRole('region', { name: 'Evidence changes since the last snapshot' });
  await expect(comparison.getByRole('heading', { name: 'New evidence. Original history.' })).toBeVisible();
  await expect(comparison.getByRole('status')).toContainText('1 batch changed classification');
  const changedRow = comparison.getByRole('row').filter({ hasText: 'CHL-1909-X' });
  await expect(changedRow.getByRole('cell').nth(1)).toContainText('Needs investigation');
  await expect(changedRow.getByRole('cell').nth(2)).toContainText('No recorded connection');
  await expect(changedRow.getByRole('cell').nth(3)).toContainText('Recovered production sheet, page 2');
  await expect(comparison).toContainText('The original snapshot is unchanged.');
  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="Evidence changes since the last snapshot"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await testInfo.attach('evidence-comparison-accessibility', {
    body: JSON.stringify(accessibility.violations, null, 2),
    contentType: 'application/json',
  });
  expect(accessibility.violations).toEqual([]);
  const final = await serverWorkspace(context);
  expect(final.batches.find((record) => record.id === uncertainBatch.id)?.source).toContain(
    'Recovered production sheet',
  );
  expect(final.recalls[0]).toEqual(originalReport);
  expect(
    final.recalls[0].snapshot.batches.find((record) => record.id === uncertainBatch.id)?.recordsComplete,
  ).toBe(false);
  const activity = await (await context.request.get('/api/audit')).json();
  expect(activity.at(-1).action).toBe('batch.resolve');
});

test('a maker can register, connect real records, save a rehearsal and download its PDF', async ({
  page,
  context,
}, testInfo) => {
  await register(page);
  await page.goto('/app/lots');
  await addLot(page);
  await expect.poll(async () => (await serverWorkspace(context)).lots.length).toBe(1);

  await page.goto('/app/batches');
  await page.getByRole('button', { name: 'Record a batch', exact: true }).click();
  const batch = page.getByRole('dialog', { name: 'Record a production batch' });
  await batch.getByLabel('Batch code').fill('SAUCE-E2E-01');
  await batch.getByLabel('Produced on').fill('2026-09-16');
  await batch.getByLabel('Product name').fill('Test smoked sauce');
  await batch.getByLabel('Quantity produced').fill('100');
  await batch.getByLabel('Source reference').fill('Synthetic production sheet E2E-B01');
  const lot = (await serverWorkspace(context)).lots[0];
  await batch.getByRole('combobox', { name: 'Input 1', exact: true }).selectOption(lot.id);
  await batch.getByRole('spinbutton', { name: 'Input 1 quantity', exact: true }).fill('2');
  await batch.getByLabel('Every ingredient lot is recorded').check();
  await batch.getByRole('button', { name: 'Save batch', exact: true }).click();
  await expect(batch).not.toBeVisible();
  await expect.poll(async () => (await serverWorkspace(context)).batches.length).toBe(1);

  await page.goto('/app/shipments');
  await page.getByRole('button', { name: 'Log a delivery', exact: true }).click();
  const shipment = page.getByRole('dialog', { name: 'Record a shipment' });
  await shipment.getByLabel('Shipment reference').fill('DELIVERY-E2E-01');
  await shipment.getByLabel('Shipped on').fill('2026-09-17');
  const produced = (await serverWorkspace(context)).batches[0];
  await shipment.getByLabel('Production batch').selectOption(produced.id);
  await shipment.getByLabel('Customer / retailer').fill('Synthetic Corner Pantry');
  await shipment.getByLabel('Contact email or phone').fill('pantry@example.invalid');
  await shipment.getByLabel('Quantity shipped').fill('60');
  await shipment.getByLabel('Source reference').fill('Synthetic dispatch E2E-D01');
  await shipment.getByRole('button', { name: 'Save shipment', exact: true }).click();
  await expect(shipment).not.toBeVisible();
  await expect.poll(async () => (await serverWorkspace(context)).shipments.length).toBe(1);

  await page.goto('/app/trace');
  await expect(page.getByRole('heading', { name: 'Follow the ingredient.' })).toBeVisible();
  await page.getByRole('tab', { name: 'Customer deliveries', exact: true }).click();
  await expect(page.getByText('Synthetic Corner Pantry', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save this rehearsal', exact: true }).click();
  const recall = page.getByRole('dialog', { name: 'Save this rehearsal' });
  await recall.getByLabel('Title', { exact: true }).fill('Test paprika rehearsal');
  await recall
    .getByLabel('Reason for the review')
    .fill('Synthetic test only. Rehearse source-to-customer tracing.');
  await recall.getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/recalls$/);
  await expect.poll(async () => (await serverWorkspace(context)).recalls.length).toBe(1);
  const saved = (await serverWorkspace(context)).recalls[0];
  expect(saved.result.shippedUnits).toBe(60);
  expect(saved.result.onHandUnits).toBe(40);
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: /Download (PDF|evidence pack)/i })
    .first()
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const filePath = testInfo.outputPath('saved-rehearsal.pdf');
  await download.saveAs(filePath);
  const content = await readFile(filePath);
  expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  expect(content.byteLength).toBeGreaterThan(3000);
  await testInfo.attach('rehearsal-pdf', { path: filePath, contentType: 'application/pdf' });
});

test('recovery uses the shown code once, rotates it, and restores the same workspace', async ({
  page,
  context,
}) => {
  const credentials = await register(page, 'Recovery Test Kitchen');
  const initial = await serverWorkspace(context);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: /Sign out/ }).click();
  await page.goto('/recover');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Recovery code', { exact: true }).fill(credentials.recoveryCode);
  await page.getByLabel('New password').fill('New-kitchen-passphrase-1720');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  const recoveryDialog = page.getByRole('dialog');
  await expect(recoveryDialog.getByRole('heading', { name: /recovery code/i })).toBeVisible();
  const rotated = (await recoveryDialog.locator('code, .recovery-code').first().textContent())!.trim();
  expect(rotated).not.toBe(credentials.recoveryCode);
  await recoveryDialog.getByRole('button', { name: 'I saved my code' }).click();
  expect((await serverWorkspace(context)).id).toBe(initial.id);
  await page.goto('/app/settings');
  await page.getByRole('button', { name: /Sign out/ }).click();
  await page.goto('/recover');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Recovery code', { exact: true }).fill(credentials.recoveryCode);
  await page.getByLabel('New password').fill('Another-passphrase-1720');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or recovery code is incorrect');
});

test('the first offline reload works and new receipts and a PDF rehearsal synchronize exactly once', async ({
  page,
  context,
}, testInfo) => {
  await register(page, 'Offline Test Kitchen');
  await page.getByRole('link', { name: 'Ingredient lots', exact: true }).click();
  await addLot(page, 'ONLINE-LOT');
  await expect.poll(async () => (await serverWorkspace(context)).lots.length).toBe(1);
  // Do not warm the PDF chunk or reload online. A newly installed worker must
  // precache the complete application before the first disconnected navigation.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('ONLINE-LOT', { exact: true })).toBeVisible();
  await addLot(page, 'OFFLINE-LOT');
  await page.getByRole('link', { name: /Recall workspace/ }).click();
  await page.getByRole('button', { name: 'Save this rehearsal', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Offline rehearsal');
  await page.getByRole('dialog').getByRole('button', { name: 'Save snapshot', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/recalls$/);
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: /Download (PDF|evidence pack)/i })
    .first()
    .click();
  const download = await downloadPromise;
  const filePath = testInfo.outputPath('offline-first-rehearsal.pdf');
  await download.saveAs(filePath);
  expect((await readFile(filePath)).subarray(0, 5).toString()).toBe('%PDF-');
  await page.getByRole('link', { name: 'Ingredient lots', exact: true }).click();
  await page.reload();
  await expect(page.getByText('OFFLINE-LOT', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(
      async () => (await serverWorkspace(context)).lots.filter((lot) => lot.code === 'OFFLINE-LOT').length,
    )
    .toBe(1);
  await page.reload();
  await expect(page.getByText('OFFLINE-LOT', { exact: true })).toBeVisible();
  const synced = await serverWorkspace(context);
  expect(synced.lots).toHaveLength(2);
  expect(synced.recalls).toHaveLength(1);
  expect(synced.revision).toBe(3);
  const audit = await context.request.get('/api/audit');
  const entries = (await audit.json()) as { action: string }[];
  expect(entries.filter((entry) => entry.action === 'lot.create')).toHaveLength(2);
});

test('two independent browser contexts never see each other’s private records', async ({
  browser,
  baseURL,
}) => {
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  try {
    const firstPage = await first.newPage();
    const secondPage = await second.newPage();
    await register(firstPage, 'Private Kitchen One');
    await register(secondPage, 'Private Kitchen Two');
    await firstPage.goto('/app/lots');
    await addLot(firstPage, 'PRIVATE-LOT-ONE');
    await expect.poll(async () => (await serverWorkspace(first)).lots.length).toBe(1);
    await secondPage.goto('/app/lots');
    await expect(secondPage.getByText('PRIVATE-LOT-ONE', { exact: true })).toHaveCount(0);
    const a = await serverWorkspace(first);
    const b = await serverWorkspace(second);
    expect(a.id).not.toBe(b.id);
    expect(b.lots).toHaveLength(0);
    const session = await second.request.get('/api/auth/session');
    const data = (await session.json()) as SessionResponse;
    const attempt = await second.request.post('/api/commands', {
      headers: { Origin: baseURL!, 'X-CSRF-Token': data.csrfToken },
      data: {
        id: 'foreign-lot-command',
        expectedRevision: b.revision,
        command: { type: 'lot.status', payload: { id: a.lots[0].id, status: 'hold' } },
      },
    });
    expect(attempt.status()).toBe(400);
    expect((await serverWorkspace(first)).lots[0].status).toBe('available');
  } finally {
    await first.close();
    await second.close();
  }
});

test('mobile layouts and a record form stay within a 390px viewport', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(await overflow()).toBe(false);
  await register(page, 'Mobile Test Kitchen');
  for (const route of [
    '/app',
    '/app/lots',
    '/app/batches',
    '/app/shipments',
    '/app/trace',
    '/app/settings',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await overflow(), `horizontal overflow at ${route}`).toBe(false);
  }
  await page.goto('/app/lots');
  await addLot(page, 'MOBILE-LOT');
  expect(await overflow()).toBe(false);
  await expect.poll(async () => (await serverWorkspace(context)).lots.length).toBe(1);
});

test('landing, registration and workspace pass automated WCAG accessibility checks', async ({
  page,
}, testInfo) => {
  const check = async (label: string, activeLayer?: string) => {
    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
    // The background is intentionally dimmed while a modal is open. Check its
    // normal state separately, then check the active dialog's complete subtree.
    if (activeLayer) builder.include(activeLayer);
    const results = await builder.analyze();
    await testInfo.attach(`accessibility-${label}`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
    expect(
      results.violations.map(({ id, impact, nodes }) => ({
        id,
        impact,
        elements: nodes.map((node) => node.target),
      })),
      label,
    ).toEqual([]);
  };
  await page.goto('/');
  await check('landing');
  await page.goto('/register');
  await check('registration');
  await register(page, 'Accessible Test Kitchen');
  await check('workspace');
  await page.goto('/app/lots');
  await check('ingredient-lots');
  await page.getByRole('button', { name: 'Receive a lot', exact: true }).click();
  await check('receive-lot-dialog', '[role="dialog"]');
});

test('three CSV files preview atomically, import their graph, and reject a duplicate without mutation', async ({
  page,
  context,
}) => {
  await register(page, 'Spreadsheet Test Kitchen');
  await page.goto('/app/import');
  const files = ['lots.csv', 'batches.csv', 'shipments.csv'].map((name) => resolve('public/samples', name));
  await page.getByLabel('Import files', { exact: true }).setInputFiles(files);
  await expect(page.getByRole('heading', { name: 'Ready to add', exact: true })).toBeVisible();
  expect((await serverWorkspace(context)).lots).toHaveLength(0);
  await page.getByRole('button', { name: 'Import these records', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Added 5 ingredient lots, 6 batches and 4 deliveries');
  await expect.poll(async () => (await serverWorkspace(context)).batches.length).toBe(6);
  const imported = await serverWorkspace(context);
  expect(imported.lots).toHaveLength(5);
  expect(imported.shipments).toHaveLength(4);
  expect(imported.revision).toBe(1);
  await page.getByLabel('Import files', { exact: true }).setInputFiles(files);
  await expect(page.getByRole('alert')).toContainText(/already|duplicate/i);
  await expect(page.getByRole('button', { name: 'Import these records', exact: true })).toHaveCount(0);
  expect((await serverWorkspace(context)).revision).toBe(1);
  await page.goto('/app/trace');
  await expect(page.locator('.trace-stats > div').first()).toContainText('480');
  await page.getByRole('tab', { name: 'Batch scope', exact: true }).click();
  await expect(page.locator('tbody').getByText('Recorded connection', { exact: true })).toHaveCount(4);
  await expect(page.locator('tbody').getByText('Needs investigation', { exact: true })).toHaveCount(1);
});

test('a changed login cannot replace another account’s pending offline records', async ({
  page,
  context,
  baseURL,
}) => {
  await register(page, 'Original Private Kitchen');
  await page.goto('/app/lots');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await addLot(page, 'ORIGINAL-PENDING-LOT');
  // A changed server session is simulated through the context's shared cookie
  // jar; it must not turn cached account A records into account B records.
  const switched = await context.request.post('/api/auth/register', {
    headers: { Origin: baseURL! },
    data: {
      name: 'Different Owner',
      email: uniqueEmail(),
      password,
      workspaceName: 'Different Private Kitchen',
    },
  });
  expect(switched.status()).toBe(201);
  await context.setOffline(false);
  await expect(page.locator('.sync-banner')).toContainText('different account');
  await page.reload();
  await expect(page.locator('.sync-banner')).toContainText('different account');
  await expect(page.getByText('ORIGINAL-PENDING-LOT', { exact: true })).toBeVisible();
  await expect(page.getByText('Different Private Kitchen', { exact: true })).toHaveCount(0);
  expect((await serverWorkspace(context)).lots).toHaveLength(0);
});

test('an offline rehearsal keeps its original snapshot when another device changes the records', async ({
  browser,
  baseURL,
}) => {
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  try {
    const a = await first.newPage();
    const b = await second.newPage();
    const credentials = await register(a, 'Snapshot Integrity Kitchen');
    await a.goto('/app/lots');
    await addLot(a, 'ORIGINAL-SOURCE');
    await expect.poll(async () => (await serverWorkspace(first)).lots.length).toBe(1);
    await b.goto('/login');
    await b.getByLabel('Email', { exact: true }).fill(credentials.email);
    await b.getByLabel('Password', { exact: false }).fill(password);
    await b.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(b).toHaveURL(/\/app$/);
    await a.goto('/app/trace');
    await a.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await first.setOffline(true);
    await a.getByRole('button', { name: 'Save this rehearsal', exact: true }).click();
    await a.getByRole('dialog').getByLabel('Title', { exact: true }).fill('Original offline rehearsal');
    await a.getByRole('dialog').getByRole('button', { name: 'Save snapshot', exact: true }).click();
    await b.goto('/app/lots');
    await addLot(b, 'LATER-SOURCE');
    await expect.poll(async () => (await serverWorkspace(second)).revision).toBe(2);
    await first.setOffline(false);
    await expect(a.locator('.sync-banner')).toContainText('will not silently recompute');
    await a.reload();
    await expect(a.locator('.sync-banner')).toContainText('will not silently recompute');
    await expect(a.getByRole('heading', { name: 'Original offline rehearsal', exact: true })).toBeVisible();
    expect((await serverWorkspace(first)).recalls).toHaveLength(0);
    const originalDownload = a.waitForEvent('download');
    await a.getByRole('button', { name: 'JSON', exact: true }).click();
    const file = await (await originalDownload).path();
    const snapshot = JSON.parse(await readFile(file!, 'utf8'));
    expect(snapshot.snapshot.lots.map((lot: { code: string }) => lot.code)).toEqual(['ORIGINAL-SOURCE']);
  } finally {
    await first.close();
    await second.close();
  }
});
