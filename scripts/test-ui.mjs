// Tests the actual built app with an isolated in-memory database.
// Run `npx playwright install chromium` once before `npm run test:ui`.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createDatabase } from '../backend/src/db.js';
import { loadConfig } from '../backend/src/config.js';
import { migrate } from '../backend/src/migrate.js';
import { seed } from '../backend/src/seed.js';
import { createApp } from '../backend/src/app.js';

const config = loadConfig({
  mode: 'test',
  databaseMode: 'embedded',
  dataDir: 'memory://',
  showDemoHelp: true,
});
const db = await createDatabase(config);
let server, browser;
const failures = [];
const screenshots = process.env.UI_SCREENSHOTS;
const report = (message) => console.log(`PASS ${message}`);
async function capture(page, name) {
  if (!screenshots) return;
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, name + '.png'), fullPage: true });
}
async function noOverflow(page) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    'The page should fit the viewport',
  );
}
function watch(page) {
  page.on('pageerror', (e) => failures.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`);
  });
  page.setDefaultTimeout(10000);
}
const serviceRow = (page, name) =>
  page
    .locator('.operator-service')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
const publicRow = (page, name) =>
  page.locator('.detail-service').filter({ has: page.getByRole('heading', { name, exact: true }) });
async function publish(page, name, status, note) {
  await serviceRow(page, name).getByRole('button', { name: 'Update status', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('radio', { name: status, exact: true }).check();
  if (status === 'Unavailable')
    await modal.getByLabel('Reason', { exact: true }).selectOption('network');
  await modal.getByLabel('Helpful note (optional)').fill(note);
  await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  await serviceRow(page, name)
    .locator('.status-badge')
    .filter({ hasText: new RegExp(`^${status}$`) })
    .waitFor();
}
try {
  await migrate(db);
  await seed(db, 'SevaDemo2026!');
  server = await new Promise((resolve) => {
    const s = createApp(db, config).listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
  });
  const citizens = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const citizen = await citizens.newPage();
  watch(citizen);
  await citizen.goto('/');
  await citizen.getByRole('heading', { name: '8 centres found' }).waitFor();
  await citizen.evaluate(() => document.fonts.ready);
  await noOverflow(citizen);
  await capture(citizen, 'directory');
  await citizen.getByLabel('Area, centre or PIN code').fill('247667');
  await citizen.getByRole('button', { name: 'Find centres', exact: true }).click();
  await citizen.getByRole('heading', { name: '3 centres found' }).waitFor();
  await citizen.getByLabel('Service', { exact: true }).selectOption('certificate-printing');
  await citizen.getByRole('button', { name: 'Find centres', exact: true }).click();
  await citizen.getByRole('radio', { name: 'Unavailable', exact: true }).check();
  await citizen.getByRole('heading', { name: '2 centres found' }).waitFor();
  await citizen.getByLabel('Area, centre or PIN code').fill('no-such-centre-123');
  await citizen.getByRole('button', { name: 'Find centres', exact: true }).click();
  await citizen.getByRole('heading', { name: 'No centres match your search' }).waitFor();
  report('search, service/status filters and empty results');

  await citizen.goto('/centres/roorkee-civil-lines');
  await publicRow(citizen, 'Certificate printing')
    .getByRole('button', { name: 'Find alternatives' })
    .click();
  const alternatives = citizen.getByRole('dialog');
  await alternatives.locator('.centre-card').first().waitFor();
  assert.ok((await alternatives.locator('.centre-card').count()) > 0);
  await alternatives.getByRole('link', { name: 'View centre', exact: true }).first().click();
  await alternatives.waitFor({ state: 'hidden' });
  assert.ok(!citizen.url().endsWith('/roorkee-civil-lines'));
  await citizen.goto('/centres/roorkee-civil-lines');
  await citizen.getByRole('heading', { name: 'Civil Lines Seva Centre', exact: true }).waitFor();
  await citizen.reload();
  await citizen.getByRole('heading', { name: 'Civil Lines Seva Centre', exact: true }).waitFor();
  report('alternative links and built-app deep links');

  const operators = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  const operator = await operators.newPage();
  watch(operator);
  await operator.goto('/operator');
  await operator.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  await operator.getByLabel('Email address').fill('roorkee@sevasignal.demo');
  await operator.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await operator.getByRole('button', { name: 'Sign in', exact: true }).click();
  await operator
    .getByRole('alert')
    .filter({ hasText: 'Email or password is incorrect.' })
    .waitFor();
  await operator.getByLabel('Password', { exact: true }).fill('SevaDemo2026!');
  await operator.getByRole('button', { name: 'Sign in', exact: true }).click();
  await operator.getByRole('heading', { name: 'Civil Lines Seva Centre', exact: true }).waitFor();
  await capture(operator, 'dashboard');
  report('protected-route redirect, failed login and successful operator login');

  await publish(
    operator,
    'PAN assistance',
    'Unavailable',
    'Portal connection interrupted for verification.',
  );
  await citizen.getByRole('button', { name: 'Refresh', exact: true }).click();
  await publicRow(citizen, 'PAN assistance').locator('.status-badge.unavailable').waitFor();
  await publicRow(citizen, 'PAN assistance')
    .getByText('Portal connection interrupted for verification.', { exact: false })
    .waitFor();
  await operator.getByRole('tab', { name: 'Activity & incidents' }).click();
  await operator
    .locator('.incident')
    .filter({ hasText: 'Portal connection interrupted for verification.' })
    .getByText('Reported unavailable', { exact: true })
    .waitFor();
  await operator.getByRole('tab', { name: 'Service board' }).click();
  await publish(operator, 'PAN assistance', 'Available', 'Connection restored after verification.');
  await operator.getByRole('tab', { name: 'Activity & incidents' }).click();
  await operator
    .locator('.incident')
    .filter({ hasText: 'Portal connection interrupted for verification.' })
    .getByText('Resolved', { exact: true })
    .waitFor();
  report('operator updates appear in another browser and resolve incident history');

  await operator.getByRole('tab', { name: 'Service board' }).click();
  await serviceRow(operator, 'Pension application support')
    .getByRole('button', { name: 'Remove Pension application support' })
    .click();
  await operator.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await operator.getByRole('dialog').waitFor({ state: 'hidden' });
  await serviceRow(operator, 'Pension application support').waitFor({ state: 'hidden' });
  await operator.getByRole('button', { name: 'Add a service', exact: true }).click();
  await operator.getByRole('dialog').getByLabel('Choose a service').selectOption('pension-support');
  await operator
    .getByRole('dialog')
    .getByRole('button', { name: 'Add service', exact: true })
    .click();
  await serviceRow(operator, 'Pension application support')
    .locator('.status-badge.unknown')
    .waitFor();
  await operator.getByRole('tab', { name: 'Centre profile' }).click();
  await operator
    .getByLabel('About your centre')
    .fill('A fictional centre profile edited through the browser.');
  await operator.getByRole('button', { name: 'Save changes', exact: true }).click();
  await operator.getByRole('status').filter({ hasText: 'Centre details saved.' }).waitFor();
  await citizen.getByRole('button', { name: 'Refresh', exact: true }).click();
  await citizen
    .getByText('A fictional centre profile edited through the browser.', { exact: true })
    .waitFor();
  report('service removal/re-addition and profile changes persist');

  // Give a real confirmation a short deadline to verify the client-side timer
  // without a one-minute delay. It must expire before the next 30-second poll.
  await db.query(
    "UPDATE centre_services SET expires_at=NOW()+INTERVAL '3 seconds' WHERE centre_id=$1 AND service_id=$2",
    ['roorkee-civil-lines', 'pan-assistance'],
  );
  await citizen.getByRole('button', { name: 'Refresh', exact: true }).click();
  await publicRow(citizen, 'PAN assistance').locator('.status-badge.available').waitFor();
  await publicRow(citizen, 'PAN assistance')
    .locator('.status-badge.unknown')
    .waitFor({ timeout: 8000 });
  report('an open page changes to Unknown when its confirmation expires');

  await citizen.setViewportSize({ width: 390, height: 844 });
  await citizen.goto('/?city=Roorkee');
  await citizen.getByRole('heading', { name: '3 centres found' }).waitFor();
  await noOverflow(citizen);
  await capture(citizen, 'mobile-directory');
  await citizen.getByRole('button', { name: 'Refine your search', exact: true }).click();
  await citizen.getByLabel('City', { exact: true }).waitFor({ state: 'visible' });
  await citizen.getByRole('button', { name: 'Refine your search', exact: true }).click();
  await citizen.getByRole('button', { name: 'Switch to Hindi' }).click();
  await citizen.getByRole('heading', { name: /थोड़ी जानकारी/ }).waitFor();
  assert.equal(await citizen.locator('html').getAttribute('lang'), 'hi');
  await citizen.evaluate(() => document.fonts.ready);
  await noOverflow(citizen);
  await capture(citizen, 'mobile-hindi');
  await citizen.reload();
  await citizen.getByRole('heading', { name: /थोड़ी जानकारी/ }).waitFor();
  assert.equal(await citizen.locator('html').getAttribute('lang'), 'hi');
  await operator.setViewportSize({ width: 390, height: 844 });
  await operator.getByRole('tab', { name: 'Service board' }).click();
  await serviceRow(operator, 'PAN assistance').waitFor();
  await noOverflow(operator);
  await capture(operator, 'mobile-dashboard');
  await serviceRow(operator, 'PAN assistance')
    .getByRole('button', { name: 'Update status', exact: true })
    .click();
  await operator.getByRole('dialog').waitFor();
  await noOverflow(operator);
  await operator.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await operator.getByRole('button', { name: 'Sign out', exact: true }).click();
  await operator.getByRole('heading', { name: 'Welcome back.', exact: true }).waitFor();
  report('mobile layouts, filters, Hindi persistence, modal controls and logout');
  assert.deepEqual(failures, [], 'No uncaught browser errors or server errors');
  report('no uncaught browser errors or HTTP 5xx responses');
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
}
