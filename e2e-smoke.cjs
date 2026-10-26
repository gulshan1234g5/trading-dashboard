// Mobile smoke test of live dashboard via Playwright headless chromium.
// Measurement only — records screenshots + errors, does not fix anything.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://gulshan1234g5.github.io/trading-dashboard/';
const OUT = '/tmp/opencode/dashshots';
const errors = [];

function record(type, page, text) {
  errors.push({ page, type, text: String(text).slice(0, 500) });
}

async function scrollBottomToTop(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        y += 800;
        window.scrollTo(0, y);
        if (y >= document.body.scrollHeight) {
          // go back to top
          setTimeout(() => { window.scrollTo(0, 0); res(); }, 300);
        } else {
          setTimeout(step, 100);
        }
      };
      step();
    });
  });
  await page.waitForTimeout(500);
}

async function clickNav(page, text) {
  const el = page.locator(`text=${text}`).locator('visible=true').first();
  await el.click({ timeout: 10000 });
}

async function assertText(page, needles, label, results) {
  const body = await page.evaluate(() => document.body.innerText);
  for (const n of needles) {
    const pass = body.includes(n);
    results.push(`${pass ? 'PASS' : 'FAIL'}  [${label}] contains "${n}"`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  let lockAppeared = false;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  page.on('pageerror', (err) => record('pageerror', page.url(), err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') record('console-error', page.url(), msg.text());
  });
  page.on('requestfailed', (req) => {
    if (req.response() === null) record('requestfailed', page.url(), `${req.method()} ${req.url()} :: ${req.failure() && req.failure().errorText}`);
  });

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

    // lock screen?
    const unlock = page.locator('#unlock-passphrase');
    try {
      await unlock.waitFor({ state: 'visible', timeout: 3000 });
      lockAppeared = true;
      await page.screenshot({ path: path.join(OUT, 'lock.png'), fullPage: true });
      await unlock.fill('demo');
      // submit button near the input
      const submit = page.locator('button:visible').first();
      await submit.click();
      await page.waitForLoadState('networkidle');
    } catch (e) {
      // assume already unlocked
    }

    // a) Overview
    await assertText(page, ['7,000', '2026-10-30', 'Disabled', 'hard floor'], 'overview', results);
    await scrollBottomToTop(page);
    await page.screenshot({ path: path.join(OUT, 'overview.png'), fullPage: true });

    // b) Systems
    await clickNav(page, 'Systems');
    await page.waitForLoadState('networkidle');
    await assertText(page, ['CHAKRA', 'DHRUVA', 'PARKED', 'Now'], 'systems', results);
    await scrollBottomToTop(page);
    await page.screenshot({ path: path.join(OUT, 'systems.png'), fullPage: true });

    // c) Playbook
    await clickNav(page, 'Playbook');
    await page.waitForLoadState('networkidle');
    await assertText(page, ['2026-10-30', '₹22,500'], 'playbook', results);
    await scrollBottomToTop(page);
    await page.screenshot({ path: path.join(OUT, 'playbook.png'), fullPage: true });
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, 'errors.json'), JSON.stringify(errors, null, 2));

  const counts = {
    pageerrors: errors.filter((e) => e.type === 'pageerror').length,
    consoleErrors: errors.filter((e) => e.type === 'console-error').length,
    failedRequests: errors.filter((e) => e.type === 'requestfailed').length,
  };
  const lines = [
    `lock screen appeared: ${lockAppeared}`,
    ...results,
    `pageerrors=${counts.pageerrors} consoleErrors=${counts.consoleErrors} failedRequests=${counts.failedRequests}`,
  ];
  const out = lines.join('\n');
  console.log(out);
  fs.writeFileSync(path.join(OUT, 'summary.txt'), out + '\n');
})().catch((e) => {
  console.error('SMOKE-FAIL', e);
  process.exit(1);
});
