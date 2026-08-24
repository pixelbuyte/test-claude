import { chromium } from 'playwright-core';
import fs from 'fs';

const OUT = process.env.OUT;
const SITE = 'http://localhost:4182';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
  recordVideo: { dir: `${OUT}/rec`, size: { width: 1280, height: 720 } },
  reducedMotion: 'no-preference',
});
await ctx.route('**/s2/favicons*', (route) => {
  const d = new URL(route.request().url()).searchParams.get('domain') || '';
  const f = `${OUT}/fav-${d}.png`;
  route.fulfill({ path: fs.existsSync(f) ? f : `${OUT}/fav-stripe.com.png`, contentType: 'image/png' });
});

const page = await ctx.newPage();

const OVERLAY_CSS = `
/* the dev-server badge is not part of the product */
nextjs-portal{display:none!important}
#film-cap{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;
  padding:26px 56px 34px;font-family:var(--font-display),ui-sans-serif,system-ui,sans-serif;
  background:linear-gradient(to top,rgba(26,23,20,.94) 0%,rgba(26,23,20,.86) 55%,rgba(26,23,20,0) 100%);
  opacity:0;transform:translateY(14px);transition:opacity .45s ease,transform .45s ease}
#film-cap.on{opacity:1;transform:translateY(0)}
#film-cap b{display:block;color:#fff;font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-.02em}
#film-cap span{display:block;margin-top:8px;color:#e0d4c6;font-size:19px;line-height:1.4;font-weight:400}
#film-cap em{font-style:normal;color:#f4a58a}
#film-card{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;background:#f8f4ef;
  font-family:var(--font-display),ui-sans-serif,system-ui,sans-serif;text-align:center;
  opacity:0;transition:opacity .6s ease;pointer-events:none}
#film-card.on{opacity:1}
#film-card h1{margin:0;font-size:76px;line-height:1;font-weight:600;letter-spacing:-.035em;color:#1a1714}
#film-card p{margin:0;font-size:26px;color:#6d6458;max-width:760px;line-height:1.4}
#film-card .rule{width:64px;height:4px;border-radius:2px;background:#d24622}
#film-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;
  border-radius:50%;background:rgba(210,70,34,.32);border:2px solid #d24622;pointer-events:none;
  opacity:0;transition:opacity .3s ease,transform .55s cubic-bezier(.4,0,.2,1),left .55s cubic-bezier(.4,0,.2,1),top .55s cubic-bezier(.4,0,.2,1)}
#film-cursor.on{opacity:1}
`;

async function installOverlay() {
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(() => {
    for (const id of ['film-cap', 'film-card', 'film-cursor']) {
      document.getElementById(id)?.remove();
    }
    const cap = document.createElement('div');
    cap.id = 'film-cap';
    cap.innerHTML = '<b></b><span></span>';
    const card = document.createElement('div');
    card.id = 'film-card';
    card.innerHTML = '<h1></h1><div class="rule"></div><p></p>';
    const cur = document.createElement('div');
    cur.id = 'film-cursor';
    document.body.append(cap, card, cur);

    window.__cap = (title, sub) => {
      const c = document.getElementById('film-cap');
      if (title === null) { c.classList.remove('on'); return; }
      c.querySelector('b').innerHTML = title;
      c.querySelector('span').innerHTML = sub ?? '';
      c.classList.add('on');
    };
    window.__card = (h, p) => {
      const c = document.getElementById('film-card');
      if (h === null) { c.classList.remove('on'); return; }
      c.querySelector('h1').innerHTML = h;
      c.querySelector('p').innerHTML = p ?? '';
      c.classList.add('on');
    };
    window.__cursor = (x, y) => {
      const c = document.getElementById('film-cursor');
      if (x === null) { c.classList.remove('on'); return; }
      c.style.left = x + 'px'; c.style.top = y + 'px';
      c.classList.add('on');
    };
  });
}

const wait = (ms) => page.waitForTimeout(ms);
const cap = (t, s) => page.evaluate(([t, s]) => window.__cap(t, s), [t, s]);
const card = (h, p) => page.evaluate(([h, p]) => window.__card(h, p), [h, p]);
const cursorTo = async (sel) => {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => window.__cursor(x, y), [x, y]);
  return { x, y };
};
const scrollTo = (y) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y);

await page.goto(SITE, { waitUntil: 'networkidle' });
await installOverlay();
await wait(600);

// ── 1. Title card ────────────────────────────────────────────────────────
await card('UPrank', 'The public leaderboard for any site or tool.');
await wait(2600);
await card(null);
await wait(900);

// ── 2. The hero and the promise ──────────────────────────────────────────
await cap('Every placement has a published price',
  'A permanent rank, or a timed spot in a tier. That is the whole model.');
await wait(3600);
await cap('No auctions. No bidding. Ever.',
  'Nobody can outbid you, and money never reorders listings inside a tier.');
await wait(3800);
await cap(null);
await wait(600);

// ── 3. The board: permanent Top 5 ────────────────────────────────────────
await scrollTo(1150);
await wait(1400);
await cap('Permanent Top 5',
  'Buy one specific rank, <em>#1</em> to <em>#5</em>. One fixed payment, and it is yours until you cancel.');
await wait(4000);
await cap('Open ranks are shown, with the price on them',
  '<em>#1</em> is $4,500. Nobody bids it up while you think about it.');
await wait(3800);
await cap(null);

// ── 4. Timed tiers ───────────────────────────────────────────────────────
await scrollTo(1980);
await wait(1400);
await cap('Timed tiers',
  'A guaranteed place in the Top 10, 20 or 50 for a fixed duration — then it expires on its own.');
await wait(4000);
await cap('Inside a tier: first come, first served',
  'Never who paid the most. Buying longer buys more time, not a higher position.');
await wait(3900);
await cap(null);
await wait(500);

// ── 5. Back to the widget: the toggle ────────────────────────────────────
await scrollTo(0);
await wait(1500);
await cap('Two ways in, one toggle', 'Own a rank permanently, or rent one for a set time.');
await wait(1800);
await cursorTo('button:has-text("Rent for a set time")');
await wait(800);
await page.locator('button:has-text("Rent for a set time")').click();
await wait(1800);
await cursorTo('button:has-text("Top 20")');
await wait(700);
await page.locator('button:has-text("Top 20")').click();
await wait(1600);
await cap('Pick the tier, pick the duration', 'The price never moves while you are choosing it.');
await wait(3200);

// ── 6. The one field ─────────────────────────────────────────────────────
await cursorTo('#hero-url');
await wait(700);
await page.locator('#hero-url').click();
await cap('Now paste your link', 'That is the entire form. No account, no signup.');
await page.locator('#hero-url').pressSequentially('skinstel.com', { delay: 115 });
await wait(2600);
await cap('Name, description and favicon are pulled from your site',
  'Already listed? The same URL upgrades your listing in place instead of duplicating it.');
await wait(4000);
await page.evaluate(() => window.__cursor(null));
await cap(null);
await wait(700);

// ── 7. End card ──────────────────────────────────────────────────────────
await card('Fixed prices.<br>Fixed ranks.<br>No auctions.',
  'List anything for free, or claim a spot at a price you can read before you pay it.');
await wait(4200);
await card(null);
await wait(800);

await page.close();
await ctx.close();
await b.close();
const f = fs.readdirSync(`${OUT}/rec`).filter((n) => n.endsWith('.webm'));
console.log('recorded:', f.join(','));
