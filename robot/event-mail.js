/*
 * Church & Trellis – the email robot for Events: sends event reminders by email, 3 days and 1 day before, to the people who
 * ticked "Email me reminders too" when they signed up (js/events.js). The reminders in Messages don't need it: each person's
 * own Church & Trellis writes those.
 *
 * Runs every morning in GitHub Actions (.github/workflows/event-reminders.yml). It signs in to Church & Trellis with the
 * robot's own account (the same one the Elvanto robot uses; the database rules let it read events and sign-ups and note
 * which reminders it sent – nothing else), and sends through the church's Gmail with an app password.
 * Set up: docs/EVENT-EMAILS.md. Until GMAIL_USER and GMAIL_APP_PASSWORD are set it says so and stops – nothing breaks.
 *
 * The repository is public, so the log never shows names, addresses or events: only counts.
 *
 * Env: ROBOT_EMAIL, ROBOT_PASSWORD (its Church & Trellis sign-in), GMAIL_USER, GMAIL_APP_PASSWORD (the church's Gmail and an
 *      app password for it); optional MAIL_FROM_NAME (default: the church's name), SITE_URL.
 *      For tests: AUTH_URL, FS_URL (stand-in servers), FIREBASE_CONFIG_FILE, FAKE_MAIL=<file> (write the emails to that file
 *      instead of sending), NOW (milliseconds).
 */
const fs = require('fs');
const path = require('path');
const { fromValue, toValue } = require('./robot.js');
const Events = require('../js/events.js');
const log = (...a) => console.log(...a);

const SITE = process.env.SITE_URL || 'https://app.churchandtrellis.com/';
const AUTH_URL = process.env.AUTH_URL || 'https://identitytoolkit.googleapis.com/v1';
const FS_URL = process.env.FS_URL || 'https://firestore.googleapis.com/v1';
let TOKEN = '', CFG = null;

function firebaseConfig() {
  const cfg = fs.readFileSync(process.env.FIREBASE_CONFIG_FILE || path.join(__dirname, '..', 'js', 'firebase-config.js'), 'utf8');
  const get = (k) => { const m = cfg.match(new RegExp(k + ":\\s*'([^']*)'")); return m ? m[1] : ''; };
  return { apiKey: get('apiKey'), projectId: get('projectId') };
}
async function call(url, opts) {
  const res = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ 'Content-Type': 'application/json', Referer: SITE }, TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }));
  const text = await res.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch (e) {}
  if (!res.ok) { const err = new Error('HTTP ' + res.status + ' ' + String(((j.error || {}).message) || '').slice(0, 120)); err.status = res.status; throw err; }
  return j;
}
async function signIn() {
  CFG = firebaseConfig();
  if (!CFG.apiKey || !CFG.projectId) throw new Error('js/firebase-config.js has no Firebase settings yet.');
  const j = await call(AUTH_URL + '/accounts:signInWithPassword?key=' + CFG.apiKey, { method: 'POST', body: JSON.stringify({ email: process.env.ROBOT_EMAIL, password: process.env.ROBOT_PASSWORD, returnSecureToken: true }) })
    .catch(e => { throw new Error('The robot couldn’t sign in to Church & Trellis (check ROBOT_EMAIL and ROBOT_PASSWORD). ' + e.message); });
  TOKEN = j.idToken;
}
const docsBase = () => FS_URL + '/projects/' + CFG.projectId + '/databases/(default)/documents';
const fromDoc = (d) => { const o = {}; Object.entries(d.fields || {}).forEach(([k, v]) => { o[k] = fromValue(v); }); o.id = d.name.split('/').pop(); return o; };
async function getDoc(p) { try { return fromDoc(await call(docsBase() + '/' + p)); } catch (e) { if (e.status === 404) return null; throw e; } }
/** Every document in a collection (a page at a time). */
async function all(coll) {
  const out = []; let token = '';
  do {
    const j = await call(docsBase() + '/' + coll + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    (j.documents || []).forEach(d => out.push(fromDoc(d)));
    token = j.nextPageToken || '';
  } while (token);
  return out;
}
async function patch(p, fields) {
  const q = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const body = { fields: {} }; Object.entries(fields).forEach(([k, v]) => { body.fields[k] = toValue(v); });
  await call(docsBase() + '/' + p + '?' + q, { method: 'PATCH', body: JSON.stringify(body) });
}

/* ---------- the words, in each person's language (the app's own translations) ---------- */
let I18n = null;
function words(lang) {
  if (!I18n) I18n = require('../js/i18n.js');
  const code = /^st/.test(lang) ? 'st' : String(lang || 'en').replace(/[^a-z-]/gi, '');
  if (code !== 'en' && !I18n.word(code, 'Events')) { try { require('../js/lang/' + code + '.js'); } catch (e) {} }   // Sesotho and the other languages
  return (s, v) => String(I18n.word(code, s) || s).replace(/\{(\w+)\}/g, (m, k) => v && v[k] !== undefined ? v[k] : m);
}
function dayName(iso, lang) {
  const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  try { return d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return iso; }
}

/* ---------- sending ---------- */
let transport = null;
async function send(to, subject, text, fromName) {
  if (process.env.FAKE_MAIL) { fs.appendFileSync(process.env.FAKE_MAIL, JSON.stringify({ to, subject, text, fromName }) + '\n'); return; }
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  }
  await transport.sendMail({ from: { name: fromName, address: process.env.GMAIL_USER }, to, subject, text });
}

async function main() {
  if (!process.env.FAKE_MAIL && (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD)) {
    log('Email reminders for events aren’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD) – nothing to do. See docs/EVENT-EMAILS.md.');
    return;
  }
  if (!process.env.ROBOT_EMAIL || !process.env.ROBOT_PASSWORD) { log('The robot has no Church & Trellis sign-in yet (ROBOT_EMAIL, ROBOT_PASSWORD) – see docs/EVENT-EMAILS.md.'); return; }
  const now = process.env.NOW ? +process.env.NOW : Date.now();
  await signIn();
  const st = (await getDoc('settings/church')) || {};
  if ((st.modules || {}).events !== true) { log('Events is switched off in Church & Trellis – nothing to do.'); return; }
  const church = String(st.churchName || ''), fromName = process.env.MAIL_FROM_NAME || church || 'Church & Trellis';
  const events = await all('events'), signups = await all('eventSignups');
  const due = Events.emailsDue(events, signups, now);
  let sent = 0, failed = 0;
  for (const d of due) {
    const lang = d.signup.lang || 'en', T = words(lang), mail = Events.email(d.event, d.signup, now, T, church, (iso) => dayName(iso, lang));
    try {
      await send(d.signup.email, mail.subject, mail.text, fromName);
      await patch('eventSignups/' + d.signup.id, { mailed: Events.mailedAfter(d.signup, d.r), updatedAt: new Date(now).toISOString().replace('T', ' ').slice(0, 19) });
      sent++;
    } catch (e) { failed++; log('One reminder couldn’t be sent:', String(e.message || e).replace(/[\w.+-]+@[\w.-]+/g, '<email>').slice(0, 160)); }
  }
  await patch('robotStatus/eventMail', { lastRun: new Date(now).toISOString(), sent, failed }).catch(e => log('Couldn’t record the run:', e.message));
  log('Event reminders: ' + sent + ' sent' + (failed ? ', ' + failed + ' failed' : '') + ' (' + events.length + ' events, ' + signups.length + ' sign-ups looked at).');
  if (failed && !sent) process.exitCode = 1;
}

if (require.main === module) main().catch(e => { console.log('Robot error:', String(e.message || e).replace(/[\w.+-]+@[\w.-]+/g, '<email>')); process.exit(1); });
module.exports = { words, dayName };
