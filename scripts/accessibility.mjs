import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('http://localhost:5180/');
await page.evaluate(() => document.fonts.ready);
for (const path of ['/', '/register', '/app', '/app/trace']) {
  if (path === '/app') {
    await page.goto('http://localhost:5180/');
    await page.getByRole('button', { name: 'Explore the live demo' }).click();
    await page.waitForURL('**/app');
  } else await page.goto('http://localhost:5180' + path);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  console.log(
    JSON.stringify({
      path,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary, html: n.html })),
      })),
    }),
  );
}
await browser.close();
