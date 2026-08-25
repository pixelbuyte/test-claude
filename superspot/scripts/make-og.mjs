/**
 * Regenerates app/opengraph-image.png — the social preview card.
 *
 * The card is composed inside the running site so it inherits the real
 * self-hosted fonts (Anton / Chakra Petch / DM Mono) and the live CSS
 * variables, rather than re-declaring the design system somewhere it
 * could silently drift.
 *
 *   npm run build && npm start        # in one shell
 *   node scripts/make-og.mjs          # in another
 */
import { chromium } from "playwright";

const OUT = new URL("../app/opengraph-image.png", import.meta.url).pathname;
const SITE = process.env.OG_SITE ?? "http://localhost:3000";

const CARD = `
<div id="og" style="
  width:1200px;height:630px;position:relative;overflow:hidden;
  background:var(--void);display:flex;flex-direction:column;
  justify-content:space-between;padding:64px;box-sizing:border-box;">

  <div style="position:absolute;inset:0;background:
    radial-gradient(720px 420px at 0% 0%, rgba(204,255,0,.10), transparent 62%),
    radial-gradient(620px 400px at 100% 100%, rgba(255,46,136,.08), transparent 60%);"></div>

  <!-- Ghost rank numeral, same architectural role it plays on the page -->
  <span class="ghost-rank" style="position:absolute;right:-40px;top:50%;
    transform:translateY(-50%);font-size:30rem;line-height:.8;">01</span>

  <div style="position:relative;display:flex;align-items:baseline;gap:16px;">
    <span style="font-family:var(--font-display);font-size:40px;line-height:1;
      letter-spacing:-.03em;text-transform:uppercase;color:var(--bone);">SuperSpot</span>
    <span class="num" style="font-size:15px;letter-spacing:.2em;
      text-transform:uppercase;color:var(--dust);">playlocal.space</span>
  </div>

  <div style="position:relative;">
    <p class="num" style="margin:0 0 18px;font-size:17px;letter-spacing:.22em;
      text-transform:uppercase;color:var(--acid);">5 spots · timed reigns · steal the top</p>
    <h1 style="margin:0;font-family:var(--font-display);font-size:132px;line-height:.82;
      letter-spacing:-.03em;text-transform:uppercase;color:var(--bone);">
      Pay to sit<br/>at the top
    </h1>
  </div>

  <div style="position:relative;display:flex;align-items:flex-end;
    justify-content:space-between;gap:32px;">
    <p style="margin:0;max-width:620px;font-size:20px;line-height:1.5;color:var(--ash);">
      Rent a featured spot for 6 hours or 3 days. Anyone can rip it out from under
      you by covering what's left on your clock — plus a premium.
    </p>
    <span style="flex:none;font-family:var(--font-display);font-size:30px;line-height:1;
      letter-spacing:-.03em;text-transform:uppercase;background:var(--acid);
      color:#07070a;padding:12px 20px;">Claim a spot</span>
  </div>
</div>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});

await page.goto(SITE, { waitUntil: "networkidle" });
await page.evaluate((html) => {
  document.documentElement.classList.add("dark");
  document.body.style.margin = "0";
  document.body.innerHTML = html;
}, CARD);
await page.waitForTimeout(600);

await page.locator("#og").screenshot({ path: OUT });
await browser.close();
console.log("wrote", OUT);
