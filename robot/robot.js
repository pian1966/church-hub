/*
 * Church Hub → Elvanto robot (adapted from Leave Manager's robot; the Elvanto steps are the same).
 * Elvanto's API can't set "Unavailable Volunteers", so this logs into Elvanto with a browser and does it like a person would:
 * People → Volunteers → Unavailable Volunteers → Add Unavailability.
 *
 * Its work list is Church Hub's elvantoSync collection (see js/elvanto-sync.js). It signs in to Church Hub with its own
 * account, which the database rules (firestore.rules, robot()) allow to read that list and the church settings – nothing else.
 *
 * Runs in GitHub Actions (.github/workflows/elvanto-robot.yml). The repository is public, so the log never contains
 * names, dates or anything personal: only request IDs, counts and the shape of Elvanto's pages.
 *
 *   MODE=check    – is there work? (no browser) Prints and outputs "jobs=N"; records that the robot is alive.
 *   MODE=run      – do the work and report back to Church Hub (shown under Leave → Elvanto).
 *   MODE=explore  – log in and describe Elvanto's pages (field names, buttons) so the robot can be adjusted. Changes nothing.
 *   MODE=read     – (nightly) read Elvanto's whole Unavailable Volunteers list – names and dates only, never reasons – into
 *                   elvantoFound/unavailable, for an Administrator to check and apply in Church Hub (Import). Changes nothing
 *                   in Elvanto. Only when "Read Elvanto's unavailable dates" is ticked under Leave → Elvanto.
 *
 * Env: ROBOT_EMAIL, ROBOT_PASSWORD (its Church Hub sign-in), ELVANTO_USERNAME, ELVANTO_PASSWORD;
 *      optional ELV_LIST_PATH, SITE_URL (default https://pian1966.github.io/church-hub/).
 *      For tests: AUTH_URL, FS_URL (stand-in servers), FIREBASE_CONFIG_FILE, FAKE_ELVANTO=1 (no browser; pretends each job worked),
 *      FAKE_ROWS (JSON: the table rows the list would show, for MODE=read), TODAY (yyyy-mm-dd).
 */
const fs = require('fs');
const path = require('path');
const MODE = process.env.MODE || 'run';
const NOTE = 'Church Hub ';
const noteFor = (id) => NOTE + id;
const log = (...a) => console.log(...a);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* ------------------------------ Church Hub (Firestore over HTTPS) ------------------------------ */
function firebaseConfig() {
  const cfg = fs.readFileSync(process.env.FIREBASE_CONFIG_FILE || path.join(__dirname, '..', 'js', 'firebase-config.js'), 'utf8');
  const get = (k) => { const m = cfg.match(new RegExp(k + ":\\s*'([^']*)'")); return m ? m[1] : ''; };
  return { apiKey: get('apiKey'), projectId: get('projectId') };
}
const SITE = process.env.SITE_URL || 'https://pian1966.github.io/church-hub/';
const AUTH_URL = process.env.AUTH_URL || 'https://identitytoolkit.googleapis.com/v1';
const FS_URL = process.env.FS_URL || 'https://firestore.googleapis.com/v1';
let TOKEN = '', CFG = null;

/** The API key only works from the church's website (setup step 8), so say where we come from. */
async function call(url, opts) {
  const res = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ 'Content-Type': 'application/json', Referer: SITE }, TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}, (opts || {}).headers || {}) }));
  const text = await res.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch (e) {}
  if (!res.ok) { const err = new Error('HTTP ' + res.status + ' ' + (((j.error || {}).message) || ((j[0] || {}).error || {}).message || '').slice(0, 120)); err.status = res.status; throw err; }
  return j;
}
async function signIn() {
  CFG = firebaseConfig();
  if (!CFG.apiKey || !CFG.projectId) throw new Error('js/firebase-config.js has no Firebase settings yet.');
  TOKEN = '';
  const j = await call(AUTH_URL + '/accounts:signInWithPassword?key=' + CFG.apiKey, { method: 'POST', body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_PASSWORD, returnSecureToken: true }) })
    .catch(e => { throw new Error('The robot couldn’t sign in to Church Hub (check ROBOT_EMAIL and ROBOT_PASSWORD). ' + e.message); });
  TOKEN = j.idToken;
}
const docsBase = () => FS_URL + '/projects/' + CFG.projectId + '/databases/(default)/documents';
function fromValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = fromValue(x); }); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  return null;
}
function toValue(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(toValue) } };
  if (typeof x === 'object') { const f = {}; Object.entries(x).forEach(([k, v]) => { f[k] = toValue(v); }); return { mapValue: { fields: f } }; }
  return { stringValue: String(x) };
}
const fromDoc = (d) => { const o = {}; Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromValue(v); }); o.id = d.name.split('/').pop(); o._updateTime = d.updateTime; return o; };
async function getDoc(p) { try { return fromDoc(await call(docsBase() + '/' + p)); } catch (e) { if (e.status === 404) return null; throw e; } }
async function waitingJobs() {
  const rows = await call(docsBase() + ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'elvantoSync' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'Waiting' } } } } }) });
  return rows.filter(r => r.document).map(r => fromDoc(r.document));
}
/** Change some fields; with `since`, only if nobody changed the entry in the meantime (else it stays Waiting for next time). */
async function patch(p, fields, since) {
  const q = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&') + (since ? '&currentDocument.updateTime=' + encodeURIComponent(since) : '');
  const body = { fields: {} }; Object.entries(fields).forEach(([k, v]) => { body.fields[k] = toValue(v); });
  try { await call(docsBase() + '/' + p + '?' + q, { method: 'PATCH', body: JSON.stringify(body) }); return true; }
  catch (e) { if (since && (e.status === 400 || e.status === 409 || /FAILED_PRECONDITION/.test(e.message))) return false; throw e; }
}

/* ------------------------------ page helpers ------------------------------ */
async function describe(page, title) {
  // Only structure: input names/types/placeholders/labels, buttons and menu words – never table contents.
  const info = await page.evaluate(() => {
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const lab = (e) => { const id = e.id && document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); return (id && id.innerText) || (e.closest('label') && e.closest('label').innerText) || ''; };
    const fields = [...document.querySelectorAll('input, select, textarea')].filter(vis).slice(0, 60).map(e =>
      [e.tagName.toLowerCase(), e.type || '', 'name=' + (e.name || ''), 'id=' + (e.id || ''), 'ph=' + (e.placeholder || ''), 'label=' + lab(e).trim().slice(0, 40), 'class=' + String(e.className || '').slice(0, 60),
        e.tagName === 'SELECT' ? 'options=' + e.options.length : '', (e.type === 'text' || e.type === 'date') && /\d/.test(e.value) ? 'valueShape=' + e.value.replace(/\d/g, '9') : ''].filter(Boolean).join(' '));
    const buttons = [...document.querySelectorAll('button, input[type=submit], input[type=button], a.btn, a.button, [role=button]')].filter(vis).slice(0, 60)
      .map(e => (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '').trim().slice(0, 40)).filter(t => t && !/@|\d{3,}/.test(t)).map(t => /^[A-Z][a-z]+ [A-Z][a-z]+/.test(t) && !/^(Add|Save|Delete|Remove|Edit|Log|Sign|Submit|Cancel|Unavailable|All)/.test(t) ? '(text)' : t);
    // Only show text that is clearly part of Elvanto's own interface (people's names must never reach the public log).
    const UI = /^(people|volunteers?|unavailab\w*|availab\w*|rosters?|schedul\w*|admin\w*|add\b.*|delete|remove|edit|save|submit|cancel|settings|dashboard|services|groups|reports?|calendar|name|dates?|start\b.*|end\b.*|from|to|notes?|reason|locations?|time|all day|repeat\w*|member|person|search|actions?|status|unavailable volunteers|add unavailability)$/i;
    const safe = (t) => UI.test(t) ? t : (t ? '(text)' : '');
    const links = [...document.querySelectorAll('a[href]')].filter(vis).map(a => ({ t: (a.innerText || '').trim().slice(0, 40), h: a.getAttribute('href') }))
      .filter(x => /people|volunteer|unavail|availab|roster|schedul|admin/i.test(x.h + ' ' + x.t)).slice(0, 40)
      .map(x => safe(x.t) + ' -> ' + x.h.replace(/[?#].*$/, '').replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/ig, '<id>').replace(/\d{3,}/g, '<n>'));
    const heads = [...document.querySelectorAll('h1,h2,h3,th,legend,.modal-title')].filter(vis).map(e => safe(e.innerText.trim().slice(0, 40))).filter(Boolean).slice(0, 30);
    const iframes = [...document.querySelectorAll('iframe')].map(f => f.src.replace(/\?.*$/, '')).slice(0, 5);
    return { fields, buttons: [...new Set(buttons)], links, heads, iframes };
  });
  log('\n=== ' + title + ' — ' + new URL(page.url()).pathname);
  log('headings:', JSON.stringify(info.heads));
  log('buttons:', JSON.stringify(info.buttons));
  if (info.links.length) log('links:', JSON.stringify(info.links));
  if (info.iframes.length) log('iframes:', JSON.stringify(info.iframes));
  info.fields.forEach(f => log('  field:', f));
}

async function login(page, base) {
  await page.goto(base + '/login/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const user = page.locator('input[type=email], input[name*=user i], input[name*=email i], input[name*=login i]:not([type=password]), input[type=text]').first();
  const pass = page.locator('input[type=password]').first();
  await user.fill(process.env.ELVANTO_USERNAME);
  await pass.fill(process.env.ELVANTO_PASSWORD);
  const btn = page.locator('button[type=submit], input[type=submit], button:has-text("Log In"), button:has-text("Login"), button:has-text("Sign In")').first();
  await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), btn.click()]);
  await page.waitForTimeout(3500);
  const stillLogin = await page.locator('input[type=password]').count();
  const body = (await page.locator('body').innerText()).toLowerCase();
  if (/verification code|two-factor|2fa|authenticat(or|ion) code|enter the code/.test(body)) throw new Error('Elvanto is asking for a verification code. Use a robot login without two-step verification.');
  if (stillLogin && /\/login/.test(page.url())) throw new Error('Elvanto login failed – check ELVANTO_USERNAME and ELVANTO_PASSWORD.');
}

/** Finds the Unavailable Volunteers page by following Elvanto's own menu. */
async function openList(page, base) {
  const cached = process.env.ELV_LIST_PATH;
  const tryLinks = async () => {
    const h = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find(a => /unavailab/i.test(a.getAttribute('href') + ' ' + a.innerText)); return a ? a.href : ''; });
    if (h) { await page.goto(h, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500); return true; }
    return false;
  };
  if (cached) { await page.goto(base + cached, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500); if (/unavailab/i.test(await page.locator('body').innerText())) return; }
  for (const p of ['/admin/', '/admin/people/', '/admin/people/volunteers/', '/admin/volunteers/']) {
    await page.goto(base + p, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    if (await tryLinks()) return;
    for (const word of ['People', 'Volunteers']) {
      const l = page.locator(`a:text-is("${word}"), nav a:has-text("${word}")`).first();
      if (await l.count()) { await l.click().catch(() => {}); await page.waitForTimeout(1200); if (await tryLinks()) return; }
    }
  }
  throw new Error('Couldn’t find Unavailable Volunteers in Elvanto’s menus (step: open list).');
}

/** Elvanto shows dates in the church's chosen format; work it out from the field's placeholder or current value. */
function fmtDate(iso, shape) {
  const [y, m, d] = iso.split('-');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1];
  shape = String(shape || '').toLowerCase();
  if (/^yyyy-mm-dd|^9999-99-99/.test(shape)) return `${y}-${m}-${d}`;
  if (/^mm\/dd|^m\/d/.test(shape)) return `${m}/${d}/${y}`;
  if (/mmm|[a-z]{3} 9/.test(shape)) return `${+d} ${mon} ${y}`;
  return `${d}/${m}/${y}`;   // South African default: dd/mm/yyyy
}

async function fieldNear(scope, re) {
  // Inputs whose name, id, placeholder or label matches re.
  const all = scope.locator('input:visible, textarea:visible, select:visible');
  const n = await all.count();
  for (let i = 0; i < n; i++) {
    const e = all.nth(i);
    const desc = await e.evaluate(el => {
      const id = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      const near = el.closest('.form-group, .field, tr, li, div');
      return [el.name, el.id, el.placeholder, id && id.innerText, near && near.querySelector('label') && near.querySelector('label').innerText].join(' ');
    });
    if (re.test(desc)) return e;
  }
  return null;
}

async function addUnavailability(page, base, job) {
  await openList(page, base);
  const add = page.locator('a:has-text("Add Unavailability"), button:has-text("Add Unavailability"), a:has-text("Add Unavailable"), button:has-text("Add")').first();
  if (!(await add.count())) throw new Error('No “Add Unavailability” button (step: add).');
  await add.click(); await page.waitForTimeout(2000);
  const scope = page.locator('.modal:visible, form:visible').last();
  // 1. The person
  const who = (await fieldNear(scope, /member|person|people|volunteer|search|name/i)) || scope.locator('input[type=text]:visible').first();
  await who.click(); await who.fill('');
  await who.type(job.name.split(' ').slice(-1)[0], { delay: 60 });
  await page.waitForTimeout(1800);
  const first = job.name.split(' ')[0].toLowerCase(), last = job.name.split(' ').slice(-1)[0].toLowerCase();
  const opts = page.locator('.ui-autocomplete li:visible, [role=option]:visible, .tt-suggestion:visible, .select2-results li:visible, .autocomplete li:visible, .dropdown-menu li:visible, ul.results li:visible');
  const n = await opts.count(); let picked = false;
  for (let i = 0; i < n; i++) {
    const t = (await opts.nth(i).innerText()).toLowerCase();
    if (t.includes(last) && t.includes(first)) { await opts.nth(i).click(); picked = true; break; }
  }
  if (!picked) throw new Error('Couldn’t find this person in Elvanto’s search – check the person’s name matches Elvanto (Church Hub → People) (step: person, ' + n + ' suggestions).');
  await page.waitForTimeout(800);
  // 2. Dates
  const sd = await fieldNear(scope, /start|from|begin/i), ed = await fieldNear(scope, /end|to|until|finish/i);
  if (!sd || !ed) throw new Error('Couldn’t find the start/end date fields (step: dates).');
  for (const [f, v] of [[sd, job.start], [ed, job.end]]) {
    const type = await f.getAttribute('type');
    const shape = (await f.getAttribute('placeholder')) || (await f.inputValue()).replace(/\d/g, '9');
    await f.click(); await f.fill(type === 'date' ? v : fmtDate(v, shape)); await f.press('Tab').catch(() => {});
  }
  // 3. All day, every location
  const allDay = scope.locator('label:has-text("All Day") input, input[name*=all_day i], input[name*=allday i]').first();
  if (await allDay.count() && !(await allDay.isChecked())) await allDay.check().catch(() => {});
  const locs = scope.locator('input[type=checkbox][name*=location i]');
  for (let i = 0; i < await locs.count(); i++) if (!(await locs.nth(i).isChecked())) await locs.nth(i).check().catch(() => {});
  // 4. Note
  const note = (await fieldNear(scope, /note|comment|reason|description/i)) || scope.locator('textarea:visible').first();
  if (await note.count()) await note.fill(noteFor(job.id));
  // 5. Save
  const save = scope.locator('button:has-text("Submit"), input[type=submit], button:has-text("Save"), button:has-text("Add")').last();
  await save.click(); await page.waitForTimeout(3000);
  const err = await page.locator('.error:visible, .alert-danger:visible, .has-error:visible, .notification.error:visible').count();
  if (err) throw new Error('Elvanto showed an error after saving (step: save).');
}

const DEL = 'button:has-text("Delete"), a:has-text("Delete"), button:has-text("Remove"), a:has-text("Remove"), [title*=Delete i], [aria-label*=Delete i], [title*=Remove i], .fa-trash, .icon-trash';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Every way Elvanto might show a date in its list. */
function dateForms(iso) {
  const [y, m, d] = iso.split('-'); const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1];
  return [`${d}/${m}/${y}`, `${m}/${d}/${y}`, `${y}-${m}-${d}`, `${+d} ${mon} ${y}`, `${mon} ${+d}, ${y}`, `${+d} ${mon}`, `${mon} ${+d}`];
}
async function removeUnavailability(page, base, job) {
  await openList(page, base);
  const NOTE_TXT = job.haveNote || noteFor(job.id);
  const noteRe = new RegExp(esc(NOTE_TXT) + '(?![\\w-])');   // the whole ID, not the start of a longer one
  let rows = page.locator('tr').filter({ hasText: noteRe });
  let how = 'note';
  if ((await rows.count()) === 0) {
    // The note may not be shown in the list: the person's name plus the first day, exactly one match only.
    const [oldStart] = String(job.have).split(' to ');
    const first = job.name.split(' ')[0], last = job.name.split(' ').slice(-1)[0];
    const dateRe = new RegExp(dateForms(oldStart).map(esc).join('|'));
    rows = page.locator('tr').filter({ hasText: last }).filter({ hasText: first }).filter({ hasText: dateRe });
    how = 'name and date';
  }
  const n = await rows.count();
  if (n !== 1) return { check: true, message: (n ? 'Found ' + n + ' possible entries' : 'Couldn’t find the entry') + ' – please remove it by hand (note “' + NOTE_TXT + '”).' };
  const row = rows.first();
  let del = row.locator(DEL).first();
  if (!(await del.count())) {
    // No delete button in the row: open the entry, and make sure it's the right one before deleting.
    await row.locator('a').first().click().catch(() => row.click());
    await page.waitForTimeout(1800);
    const scope = (await page.locator('.modal:visible').count()) ? page.locator('.modal:visible').last() : page.locator('body');
    const txt = await scope.innerText();
    const ok = how === 'note' ? noteRe.test(txt) || (await scope.locator('textarea, input').evaluateAll((els, t) => els.some(e => (e.value || '').includes(t)), NOTE_TXT)) : txt.includes(job.name.split(' ').slice(-1)[0]);
    if (!ok) return { check: true, message: 'Opened the entry but couldn’t confirm it was the right one – please remove it by hand (note “' + NOTE_TXT + '”).' };
    del = scope.locator(DEL).first();
    if (!(await del.count())) throw new Error('No Delete button on the entry (step: remove).');
  }
  page.once('dialog', d => d.accept().catch(() => {}));
  await del.click(); await page.waitForTimeout(1500);
  const confirm = page.locator('.modal:visible button:has-text("Delete"), .modal:visible button:has-text("Yes"), .modal:visible button:has-text("OK"), .modal:visible button:has-text("Confirm"), .modal:visible a:has-text("Delete")').first();
  if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(1500); }
  // Check it's gone.
  await openList(page, base);
  const still = how === 'note' ? await page.locator('tr').filter({ hasText: noteRe }).count() : 0;
  if (still) throw new Error('The entry is still there after deleting (step: remove check).');
  return { message: how === 'note' ? '' : 'Removed the entry matching the person and first day (the note isn’t shown in Elvanto’s list).' };
}


/* ------------------------------ reading the list (MODE=read) ------------------------------ */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad2 = (n) => ('0' + n).slice(-2);
const okDate = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
/** All dates in a piece of text, as yyyy-mm-dd, in order. South African style: 03/04/2026 is 3 April. */
function datesIn(text, year) {
  const s = String(text || ''), out = [];
  const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b';
  const re = new RegExp('(\\d{4})-(\\d{1,2})-(\\d{1,2})|(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{2,4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+' + MON + '\\.?,?(?:\\s+(\\d{4}))?|' + MON + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?(?:\\s+(\\d{4}))?', 'gi');
  let m;
  while ((m = re.exec(s))) {
    let y, mo, d;
    if (m[1]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if (m[4]) { d = +m[4]; mo = +m[5]; y = +m[6]; if (y < 100) y += 2000; if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; } }
    else if (m[7]) { d = +m[7]; mo = MONTHS[m[8].toLowerCase().slice(0, 3)]; y = m[9] ? +m[9] : year; }
    else { mo = MONTHS[m[10].toLowerCase().slice(0, 3)]; d = +m[11]; y = m[12] ? +m[12] : year; }
    if (y && mo && d && okDate(y, mo, d)) out.push(y + '-' + pad2(mo) + '-' + pad2(d));
  }
  return out;
}
/**
 * The Unavailable Volunteers table, row by row (each row = its cells' text) → who is unavailable when.
 * Keeps only names and dates (never the reason); marks entries made for leave (note "Church Hub …" / "Leave Manager …"),
 * which are already in Church Hub. Past entries are left out.
 */
function readRows(rows, today) {
  const year = +String(today).slice(0, 4), entries = [], seen = {};
  let unread = 0;
  (rows || []).forEach(cells => {
    cells = (cells || []).map(clean);
    const all = cells.join(' | ');
    const ds = datesIn(all, year);
    if (!ds.length) { if (cells.some(c => /[A-Za-z]/.test(c)) && cells.length > 1) unread++; return; }
    const name = cells.find(c => /[A-Za-z]{2}/.test(c) && !datesIn(c, year).length && !/^(edit|delete|remove|all day|repeat\w*)$/i.test(c));
    if (!name) { unread++; return; }
    const from = ds[0], to = ds[1] && ds[1] >= ds[0] ? ds[1] : ds[0];
    if (to < today) return;
    const fromLeave = /\b(Church Hub|Leave Manager) [\w-]+/.test(all);
    const key = name.toLowerCase() + '|' + from + '|' + to;
    if (seen[key]) return; seen[key] = 1;
    entries.push({ name: name.slice(0, 80), from, to, fromLeave });
  });
  return { entries, unread };
}
async function readUnavailable(page, base) {
  if (!page) return { rows: JSON.parse(process.env.FAKE_ROWS || '[]'), pages: 1 };
  await openList(page, base);
  const rows = []; const visited = new Set(); let pages = 0;
  for (; pages < 40; pages++) {
    visited.add(page.url());
    rows.push(...await page.$$eval('tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText)).filter(c => c.length)));
    const next = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[rel=next], .pagination a, a[aria-label*="Next" i], a')].find(x => /^(next|›|»|next ›|next »)$/i.test((x.innerText || x.getAttribute('aria-label') || '').trim()) && !x.closest('.disabled'));
      return a && a.href && !/^javascript/i.test(a.href) ? a.href : '';
    });
    if (!next || visited.has(next)) break;
    await page.goto(next, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
  }
  return { rows, pages: pages + 1 };
}

/* ------------------------------ main ------------------------------ */
async function main() {
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_PASSWORD) { log('Robot not set up (no ROBOT_EMAIL / ROBOT_PASSWORD).'); if (MODE === 'check') out('jobs=0'); return; }
  await signIn();
  const settings = (await getDoc('settings/church')) || {}, elv = settings.elvanto || {};
  const base = String(elv.url || '').replace(/\/+$/, '');
  if (MODE === 'read') {
    if (!elv.read) { log('Reading Elvanto’s unavailable dates is switched off in Church Hub (Leave → Elvanto).'); return; }
    if (!base) throw new Error('The Elvanto web address isn’t set in Church Hub (Leave → Elvanto).');
    let browser = null, page = null;
    if (!process.env.FAKE_ELVANTO) {
      const { chromium } = require('playwright');
      browser = await chromium.launch();
      page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'en-GB', timezoneId: 'Africa/Johannesburg' });
      page.setDefaultTimeout(15000);
      await login(page, base); log('Logged in.');
    }
    try {
      const today = process.env.TODAY || new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);   // Johannesburg date
      const got = await readUnavailable(page, base), r = readRows(got.rows, today);
      await patch('elvantoFound/unavailable', { readAt: new Date().toISOString(), entries: r.entries, rows: got.rows.length, unread: r.unread, pages: got.pages });
      log('Read', got.pages, 'page(s):', r.entries.length, 'entries now or later,', r.unread, 'row(s) not understood. Nothing changed in Elvanto.');
    } finally { if (browser) await browser.close(); }
    return;
  }
  const jobs = elv.on ? await waitingJobs() : [];
  if (MODE === 'check') {
    log(elv.on ? 'jobs=' + jobs.length : 'Keeping Elvanto up to date is switched off in Church Hub.'); out('jobs=' + jobs.length);
    await patch('robotStatus/elvanto', { lastCheck: new Date().toISOString() }).catch(() => {});
    return;
  }
  if (MODE === 'run' && !jobs.length) { await patch('robotStatus/elvanto', { lastRun: new Date().toISOString(), done: 0, failed: 0, fatal: '' }).catch(() => {}); log('Nothing to do.'); return; }
  if (!base) throw new Error('The Elvanto web address isn’t set in Church Hub (Leave → Elvanto).');
  const results = []; let fatal = '', listPath = '';
  let browser = null, page = null;
  if (!process.env.FAKE_ELVANTO) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'en-GB', timezoneId: 'Africa/Johannesburg' });
    page.setDefaultTimeout(15000);
  }
  try {
    if (page) { await login(page, base); log('Logged in.'); }
    if (MODE === 'explore') {
      await describe(page, 'After login');
      await openList(page, base); listPath = new URL(page.url()).pathname; await describe(page, 'Unavailable Volunteers');
      const add = page.locator('a:has-text("Add Unavailability"), button:has-text("Add Unavailability"), a:has-text("Add")').first();
      if (await add.count()) { await add.click(); await page.waitForTimeout(2500); await describe(page, 'Add Unavailability form'); }
      log('\nExplore finished. Nothing was changed. List page: ' + listPath);
      if (browser) await browser.close(); return;
    }
    for (const job of jobs) {
      const res = { ok: false, check: false, message: '' };
      try {
        const needRemove = job.have && (job.want === 'Removed' || job.have !== job.start + ' to ' + job.end);
        let extra = '';
        if (needRemove) {
          const r = page ? await removeUnavailability(page, base, job) : {};
          if (r.check) { Object.assign(res, { ok: true, check: true, message: r.message }); results.push(await report(job, res)); log(job.id, 'check'); continue; }
          extra = r.message || '';
        }
        if (job.want === 'Unavailable' && page) await addUnavailability(page, base, job);
        res.ok = true;
        res.message = (job.want === 'Unavailable' ? (needRemove ? 'Old dates removed and new dates added.' : 'Added.') : (job.have ? 'Removed.' : 'Nothing was in Elvanto.')) + (extra ? ' ' + extra : '');
        if (page && !listPath) listPath = new URL(page.url()).pathname;
        log(job.id, 'done');
      } catch (e) {
        res.message = String(e.message || e).slice(0, 250);
        log(job.id, 'failed at', (res.message.match(/step: [a-z ]+/) || ['?'])[0]);
      }
      results.push(await report(job, res));
    }
  } catch (e) {
    fatal = String(e.message || e).slice(0, 250);
    log('Stopped:', fatal.replace(/[\w.+-]+@[\w.-]+/g, '<email>'));
  }
  if (browser) await browser.close();
  await patch('robotStatus/elvanto', { lastRun: new Date().toISOString(), done: results.filter(r => r === 'done').length, failed: results.filter(r => r === 'failed' || r === 'check').length,
    fatal: fatal, listUrl: listPath ? base + listPath : '' }).catch(e => log('Couldn’t record the run:', e.message));
  log('Reported', results.length, 'result(s) to Church Hub.');
}
/** Write the outcome on the entry – unless it changed while the robot worked (then it stays Waiting for the next run). */
async function report(job, res) {
  const done = res.ok && !res.check;
  const fields = { status: res.ok ? (res.check ? 'Check' : 'Done') : 'Failed', note: res.message, doneAt: new Date().toISOString() };
  if (done) { fields.have = job.want === 'Unavailable' ? job.start + ' to ' + job.end : ''; fields.haveNote = job.want === 'Unavailable' ? noteFor(job.id) : ''; }
  const saved = await patch('elvantoSync/' + job.id, fields, job._updateTime);
  if (!saved) log(job.id, 'changed meanwhile – left for next run');
  return saved ? (done ? 'done' : res.ok ? 'check' : 'failed') : 'skipped';
}
function out(line) { fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', line + '\n'); }

if (require.main === module) main().catch(e => { console.log('Robot error:', String(e.message || e).replace(/[\w.+-]+@[\w.-]+/g, '<email>')); process.exit(1); });
module.exports = { fromValue, toValue, noteFor, datesIn, readRows };
