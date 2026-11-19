/*
 * Church & Trellis – the payment doorway: a tiny Cloudflare Worker at churchandtrellis.com/pay.
 *
 * The Pay button in the app (js/mod-support.js) and the Give button on the website (site/index.html) send people here with
 * the amount, the currency and the church's own short reference. This page turns that into PayFast's payment form and
 * sends the person straight on to PayFast, where they pay by card, Instant EFT or SnapScan.
 *
 * Why a doorway? PayFast needs Church & Trellis's merchant ID and key on every payment, and a secret passphrase to sign it.
 * Those must never be in the repository (it is public) or in the app. They live only in this Worker's own secret settings
 * on Cloudflare (MERCHANT_ID, MERCHANT_KEY, PASSPHRASE), which only the owner can see. How to set it up: docs/PAYFAST-SETUP.md.
 *
 * PayFast takes payment in rand. A church that gives in its own money (US$4.95, ₹150, KSh 300) is shown the amount in rand
 * on the way: the rate is looked up when it pays (a free public exchange-rate list, cached for half a day). Nothing about
 * the church or its people is sent anywhere: only the amount, the currency and the church's short reference ("CH-7K2P9Q").
 *
 * One payment at a time (a coffee, a year of coffees, or a gift): no debit orders, so a payment holiday never has to be
 * cancelled anywhere – the church simply doesn't pay that month.
 *
 * Tested with node: tests/coffee.test.js (the end of it). Paste the whole file into the Worker on Cloudflare.
 */

const LIVE = 'https://www.payfast.co.za/eng/process';
const SANDBOX = 'https://sandbox.payfast.co.za/eng/process';
const RATES = ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/zar.json',
  'https://latest.currency-api.pages.dev/v1/currencies/zar.json'];
const HOME = 'https://churchandtrellis.com/';
const MIN_RAND = 5;   // PayFast's smallest payment
const KINDS = { month: 'One coffee a month', year: 'Ten coffees a year', gift: 'A gift' };

/* ---------- MD5 (PayFast signs a payment with it; Cloudflare's crypto has no MD5) ---------- */
function md5(str) {
  const bytes = new TextEncoder().encode(str), n = bytes.length;
  const words = new Uint32Array(((n + 8 >> 6) + 1) * 16);
  for (let i = 0; i < n; i++) words[i >> 2] |= bytes[i] << (i % 4 * 8);
  words[n >> 2] |= 0x80 << (n % 4 * 8);
  words[words.length - 2] = n * 8;
  const K = [], S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < words.length; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d; d = c; c = b;
      const x = (a + f + K[i] + words[o + g]) >>> 0, s = S[(i >> 4) * 4 + i % 4];
      b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0; a = t;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(s => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

/** Encoded the way PayFast's own (PHP urlencode) examples do: spaces as +, capital hex, only letters, digits and -_. kept. */
function enc(v) {
  return encodeURIComponent(String(v).trim()).replace(/%20/g, '+').replace(/[!'()*~]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
}
/** PayFast's signature: MD5 of the filled-in fields, in the form's order, then the passphrase. */
function signature(fields, passphrase) {
  let s = fields.filter(([, v]) => String(v).trim() !== '').map(([k, v]) => k + '=' + enc(v)).join('&');
  if (passphrase) s += '&passphrase=' + enc(passphrase);
  return md5(s);
}

const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
function backUrl(v) {
  try { const u = new URL(v); return u.protocol === 'https:' || u.hostname === 'localhost' ? u.href : ''; } catch (e) { return ''; }
}

/**
 * What the app or website asked for, checked. → { ok, error, amount, currency, kind, ref, forOther, ok_url, no_url }
 * amount: in the church's own money; currency: 3 letters; kind: month | year | gift; ref: CH-XXXXXX (a church), or HELP / HUB
 * (a gift from the website: for churches that can't pay, or for keeping Church & Trellis going); for: another church's id.
 */
function readAsk(url) {
  const p = url.searchParams, amount = Math.round(parseFloat(p.get('amount')) * 100) / 100;
  const currency = String(p.get('currency') || 'ZAR').toUpperCase(), kind = p.get('kind') || 'gift', ref = String(p.get('ref') || '').toUpperCase();
  const forOther = p.get('for') || '', okUrl = backUrl(p.get('ok') || '') || HOME, noUrl = backUrl(p.get('no') || '') || okUrl;
  if (!(amount > 0) || amount > 10000000) return { error: 'amount' };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'currency' };
  if (!KINDS[kind]) return { error: 'kind' };
  if (!/^(CH-[0-9A-Z]{6}|HELP|HUB)$/.test(ref)) return { error: 'ref' };
  if (forOther && !/^[\w-]{1,60}$/.test(forOther)) return { error: 'for' };
  return { ok: true, amount, currency, kind, ref, forOther, okUrl, noUrl };
}

/** The fields PayFast needs, in its order. rand: the amount in rand. */
function payFields(ask, rand, env, now) {
  const what = ask.forOther ? 'For another church' : ask.ref === 'HELP' ? 'For churches that can’t pay' : ask.ref === 'HUB' ? 'Keeping Church & Trellis going' : KINDS[ask.kind];
  return [
    ['merchant_id', env.MERCHANT_ID], ['merchant_key', env.MERCHANT_KEY],
    ['return_url', ask.okUrl], ['cancel_url', ask.noUrl],
    ['m_payment_id', ask.ref + '-' + (now || Date.now()).toString(36).toUpperCase()],
    ['amount', rand.toFixed(2)],
    ['item_name', 'Church & Trellis: ' + what],
    ['item_description', ask.currency === 'ZAR' ? '' : ask.amount + ' ' + ask.currency],
    ['custom_str1', ask.ref], ['custom_str2', ask.kind], ['custom_str3', ask.forOther],
    ['custom_str4', ask.amount + ' ' + ask.currency]
  ];
}

/** Rand per unit of a currency, from the public list (cached by Cloudflare for half a day). */
async function randFor(amount, currency, fetchFn) {
  if (currency === 'ZAR') return amount;
  for (const src of RATES) {
    try {
      const r = await fetchFn(src, { cf: { cacheTtl: 43200, cacheEverything: true } });
      if (!r.ok) continue;
      const rate = ((await r.json()).zar || {})[currency.toLowerCase()];
      if (rate > 0) return Math.round(amount / rate * 100) / 100;
    } catch (e) { /* try the next list */ }
  }
  return 0;
}

/* ---------- the pages people see (small: many pay for every megabyte) ---------- */
function page(title, body) {
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex"><title>' + esc(title) + ' · Church & Trellis</title><style>' +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF6EF;color:#231E1A;font:17px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}' +
    'main{max-width:420px;margin:24px;padding:36px 30px;background:#fff;border-radius:24px;box-shadow:0 10px 40px rgba(60,40,20,.10);text-align:center}' +
    'h1{font-size:1.45rem;margin:14px 0 6px}p{color:#645B53;margin:8px 0}b{color:#231E1A}.amt{font-size:2.2rem;font-weight:800;color:#231E1A;margin:12px 0 2px}' +
    '.btn{display:inline-block;margin-top:18px;background:#E8590C;color:#fff;border:0;border-radius:999px;padding:13px 26px;font:700 1rem inherit;cursor:pointer;text-decoration:none}' +
    '.alt{display:block;margin-top:14px;color:#645B53}@keyframes s{to{transform:translateY(-6px);opacity:0}}.st path{animation:s 1.8s ease-in-out infinite}.st path+path{animation-delay:.3s}.st path+path+path{animation-delay:.6s}' +
    '@media (prefers-reduced-motion:reduce){.st path{animation:none}}</style></head><body><main>' +
    '<svg class="st" width="72" height="72" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#C9935F" stroke-width="3" stroke-linecap="round"><path d="M24 16c-3-4 3-6 0-10"/><path d="M32 16c-3-4 3-6 0-10"/><path d="M40 16c-3-4 3-6 0-10"/></g>' +
    '<path d="M12 22h36v12a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill="#fff" stroke="#E2D9CE" stroke-width="2"/><path d="M48 26h3a6 6 0 0 1 0 12h-4" fill="none" stroke="#E2D9CE" stroke-width="3"/>' +
    '<path d="M14 28h32" stroke="#E8590C" stroke-width="5"/><ellipse cx="30" cy="54" rx="22" ry="4" fill="#EFE8DF"/></svg>' + body + '</main></body></html>',
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' } });
}
function sorry(title, text, back) {
  return page(title, '<h1>' + esc(title) + '</h1><p>' + text + '</p>' + (back ? '<a class="btn" href="' + esc(back) + '">Go back</a>' : ''));
}
function money(n, code) { return code === 'ZAR' ? 'R' + n.toFixed(2).replace(/\.00$/, '') : n + ' ' + code; }

/** The doorway itself. env: the Worker's secret settings. fetchFn: for tests. */
async function handle(request, env, fetchFn) {
  const url = new URL(request.url);
  if (!/\/pay\/?$/.test(url.pathname)) return Response.redirect(HOME, 302);
  if (!env || !env.MERCHANT_ID || !env.MERCHANT_KEY)
    return sorry('Payments open soon', 'Thank you for wanting to give. Paying online isn’t open yet – please try again in a few days.', url.searchParams.get('no') && backUrl(url.searchParams.get('no')));
  const ask = readAsk(url);
  if (!ask.ok) return sorry('Something’s not quite right', 'That payment link is missing something. Please go back and press Pay again.', backUrl(url.searchParams.get('no') || '') || HOME);
  const rand = await randFor(ask.amount, ask.currency, fetchFn || fetch);
  if (!rand) return sorry('Please try again shortly', 'We couldn’t look up today’s exchange rate for ' + esc(ask.currency) + '. Please go back and try again in a few minutes.', ask.noUrl);
  if (rand < MIN_RAND)
    return sorry('A little too small for PayFast', 'This comes to ' + esc(money(rand, 'ZAR')) + ', and PayFast can’t take less than R' + MIN_RAND + '. Paying for the year (ten coffees) keeps the bank charges down too – or add a coffee as a gift.', ask.noUrl);
  const fields = payFields(ask, rand, env);
  fields.push(['signature', signature(fields, env.PASSPHRASE || '')]);
  const action = String(env.SANDBOX || '').toLowerCase() === 'yes' ? SANDBOX : LIVE;
  const inputs = fields.filter(([, v]) => String(v).trim() !== '').map(([k, v]) => '<input type="hidden" name="' + k + '" value="' + esc(String(v).trim()) + '">').join('');
  const foreign = ask.currency === 'ZAR' ? '' : '<p>That is <b>' + esc(money(ask.amount, ask.currency)) + '</b>. PayFast takes payment in rand; your bank changes it from ' + esc(ask.currency) + '.</p>';
  return page('Taking you to PayFast',
    '<h1>Thank you!</h1><p>Taking you to PayFast to pay</p><div class="amt">' + esc(money(rand, 'ZAR')) + '</div>' + foreign +
    '<form id="pf" method="post" action="' + action + '">' + inputs + '<button class="btn" type="submit">Continue to PayFast</button></form>' +
    '<a class="alt" href="' + esc(ask.noUrl) + '">Not now</a>' +
    '<p style="font-size:.85rem;margin-top:18px">Card, Instant EFT or SnapScan. Church & Trellis never sees your card or bank details.</p>' +
    '<script>setTimeout(function(){document.getElementById("pf").submit()},900)</script>');
}

export default {
  fetch: (request, env) => handle(request, env),
  // For tests (tests/coffee.test.js); Cloudflare only uses fetch.
  _: { md5, enc, signature, readAsk, payFields, randFor, handle, MIN_RAND }
};
