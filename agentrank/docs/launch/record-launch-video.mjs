import { chromium } from 'playwright-core';
import fs from 'fs';
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({
  viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2,
  recordVideo: { dir: `${OUT}/rec2`, size: { width: 1280, height: 720 } },
});
await ctx.route('**/s2/favicons*', (r) => {
  const d = new URL(r.request().url()).searchParams.get('domain') || '';
  const f = `${OUT}/fav-${d}.png`;
  r.fulfill({ path: fs.existsSync(f) ? f : `${OUT}/fav-stripe.com.png`, contentType: 'image/png' });
});
const page = await ctx.newPage();
await page.goto('file://' + OUT + '/stage.html', { waitUntil: 'networkidle' });
// hide the dev badge inside the framed site
await page.waitForTimeout(2800);
// The stage is file:// and the site is http://localhost — cross-origin, so the
// parent cannot touch contentDocument. Playwright's frame handle can.
const siteFrame = page.frames().find((f) => f.url().includes('localhost:4182'));
if (siteFrame) {
  await siteFrame.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await siteFrame.waitForLoadState('networkidle').catch(() => {});
}

const wait = (ms) => page.waitForTimeout(ms);
const cam = (x, y, s) => page.evaluate(([x, y, s]) => window.__cam(x, y, s), [x, y, s]);
const cap = (t, sub) => page.evaluate(([t, sub]) => window.__cap(t, sub), [t, sub]);
const card = (h, p, d) => page.evaluate(([h, p, d]) => window.__card(h, p, d), [h, p, d]);

// ── 1. Title ───────────────────────────────────────────────────────────────
await cam(540, 300, 0.62);
await card('URank', 'The public leaderboard for any site or tool.', 'playlocal.space');
await wait(3400);
await card(null); await wait(900);

// ── 2. Wide on the hero ────────────────────────────────────────────────────
await cap('Every placement has a published price',
  'A permanent rank, or a timed spot in a tier. Nothing else.');
await wait(3800);

// ── 3. Push in on the claim card ───────────────────────────────────────────
await cap('No auctions. Nobody can outbid you.',
  'The number you see is the number you pay.');
await cam(852, 372, 1.0);
await wait(4000);

// ── 4. The one field ───────────────────────────────────────────────────────
await cap('Paste your link. That&rsquo;s the whole form.',
  'Name, description and favicon come from your site.');
await cam(852, 428, 1.22);
await wait(3900);

// ── 5. Down to the board ───────────────────────────────────────────────────
await cap(null); await wait(400);
await cam(540, 1180, 0.78);
await cap('Permanent Top 5', 'Buy one specific rank. It stays yours until you cancel.');
await wait(4000);

// ── 6. An open rank, priced on the row ─────────────────────────────────────
await cap('Open ranks show their price',
  '<em>#1</em> is $4,500 — nobody bids it up while you decide.');
await cam(540, 1120, 1.02);
await wait(4000);

// ── 7. The highlight, held ─────────────────────────────────────────────────
await cap('Highlight adds a glow — never a rank',
  'Pure visual emphasis. Your position does not move.');
await cam(540, 1272, 1.06);
await wait(5200);

// ── 8. Timed tiers ─────────────────────────────────────────────────────────
await cap('Timed tiers expire on their own',
  'A guaranteed place in the Top 10, 20 or 50 for a fixed duration.');
await cam(540, 1626, 1.02);
await wait(4400);

// ── 9. Pull back ───────────────────────────────────────────────────────────
await cap('Inside a tier: first come, first served',
  'Never who paid the most. Longer buys more time, not a better spot.');
await cam(540, 1400, 0.62);
await wait(4200);
await cap(null); await wait(600);

// ── 10. End card ───────────────────────────────────────────────────────────
await card('Fixed prices.<br>Fixed ranks.<br>No auctions.',
  'List anything for free, or claim a spot at a price you can read before you pay.',
  'playlocal.space');
await wait(4400);
await card(null); await wait(700);

await page.close(); await ctx.close(); await b.close();
console.log('recorded:', fs.readdirSync(`${OUT}/rec2`).join(','));
