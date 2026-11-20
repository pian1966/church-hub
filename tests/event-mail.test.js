// Run: node tests/event-mail.test.js – the email robot for Events (robot/event-mail.js): reminders 3 days and 1 day before,
// against stand-in Google servers. Nothing is really sent (FAKE_MAIL writes the emails to a file). Made-up people only.
const http = require('http'), { execFile } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const R = require('../robot/robot.js');
const at = (y, m, d, h) => new Date(y, m - 1, d, h || 0).getTime();

console.log('Words in the person’s language');
const M = require('../robot/event-mail.js');
ok(M.words('af')('Reminder: {title}', { title: 'X' }) === 'Herinnering: X' && M.words('en')('tomorrow') === 'tomorrow', 'Afrikaans, and English');
ok(M.words('st')('tomorrow') === 'hosane' && M.words('xx')('tomorrow') === 'tomorrow', 'Sesotho too; an unknown language is English');

// ---- stand-in Google servers ----
const DB = {}, calls = [];
const put = (p, data) => { DB[p] = { data }; };
const docJSON = (p) => ({ name: 'projects/demo/databases/(default)/documents/' + p, fields: R.toValue(DB[p].data).mapValue.fields, updateTime: 'x' });
function reset(on) {
  Object.keys(DB).forEach(k => delete DB[k]); calls.length = 0;
  put('settings/church', { churchName: 'St Example’s', modules: { events: on } });
  put('events/ev1', { title: 'Men’s breakfast', date: '2026-11-28', time: '07:30', end: '', place: 'Church hall', address: '', who: 'all', signup: true, closes: '', guests: 0, email: true, status: 'live' });
  put('events/ev2', { title: 'Quiet day', date: '2026-11-28', time: '09:00', end: '', place: '', address: '', who: 'all', signup: true, closes: '', guests: 0, email: false, status: 'live' });
  put('eventSignups/ev1_p1', { eventId: 'ev1', by: 'p1', people: ['p1'], names: ['Anna Example'], guests: 0, email: 'anna@example.org', lang: 'af', mailed: [] });
  put('eventSignups/ev1_p2', { eventId: 'ev1', by: 'p2', people: ['p2'], names: ['Ben Example'], guests: 0, email: '', lang: 'en', mailed: [] });
  put('eventSignups/ev2_p3', { eventId: 'ev2', by: 'p3', people: ['p3'], names: ['Cara Example'], guests: 0, email: 'cara@example.org', lang: 'en', mailed: [] });
}
const srv = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), send = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    calls.push({ method: req.method, path: u.pathname, referer: req.headers.referer });
    if (u.pathname.endsWith('/accounts:signInWithPassword')) {
      const b = JSON.parse(body);
      return b.email === 'robot@example.com' && b.password === 'secret' ? send(200, { idToken: 'TOKEN' }) : send(400, { error: { message: 'INVALID_PASSWORD' } });
    }
    if (req.headers.authorization !== 'Bearer TOKEN') return send(403, { error: { message: 'PERMISSION_DENIED' } });
    const m = u.pathname.match(/\/documents\/?(.*)$/), p = m ? decodeURIComponent(m[1]) : '';
    if (req.method === 'GET' && (p === 'events' || p === 'eventSignups')) return send(200, { documents: Object.keys(DB).filter(k => k.startsWith(p + '/')).map(docJSON) });
    if (req.method === 'GET') return DB[p] ? send(200, docJSON(p)) : send(404, { error: { message: 'NOT_FOUND' } });
    if (req.method === 'PATCH') {
      const fields = JSON.parse(body).fields, cur = DB[p] ? DB[p].data : {};
      Object.keys(fields).forEach(k => { cur[k] = R.fromValue(fields[k]); }); put(p, cur);
      return send(200, docJSON(p));
    }
    send(404, {});
  });
});
const mailFile = path.join(os.tmpdir(), 'event-mail-' + Date.now() + '.jsonl'), cfgPath = path.join(os.tmpdir(), 'event-mail-config.js');
function run(now, extraEnv) {
  try { fs.unlinkSync(mailFile); } catch (e) {}
  return new Promise(resolve => execFile(process.execPath, [path.join(__dirname, '..', 'robot', 'event-mail.js')], {
    env: Object.assign({}, process.env, { ROBOT_EMAIL: 'robot@example.com', ROBOT_PASSWORD: 'secret', FAKE_MAIL: mailFile, NOW: String(now),
      AUTH_URL: 'http://127.0.0.1:' + srv.address().port + '/v1', FS_URL: 'http://127.0.0.1:' + srv.address().port + '/v1', FIREBASE_CONFIG_FILE: cfgPath }, extraEnv || {})
  }, (err, stdout) => { let mails = []; try { mails = fs.readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch (e) {} resolve({ err, stdout, mails }); }));
}

srv.listen(0, '127.0.0.1', async () => {
  fs.writeFileSync(cfgPath, "window.CHURCH_HUB_FIREBASE = { apiKey: 'test-key', authDomain: 'x', projectId: 'demo', appId: 'x' };\n");
  try {
    console.log('Not set up yet');
    let r = await new Promise(resolve => execFile(process.execPath, [path.join(__dirname, '..', 'robot', 'event-mail.js')], { env: Object.assign({}, process.env, { GMAIL_USER: '', GMAIL_APP_PASSWORD: '', FAKE_MAIL: '' }) }, (err, stdout) => resolve({ err, stdout })));
    ok(!r.err && /aren’t set up yet/.test(r.stdout), 'without the church’s Gmail it says so and stops – nothing breaks');

    console.log('Sending');
    reset(true);
    r = await run(at(2026, 11, 24, 7));
    ok(!r.mails.length, '4 days before: nothing yet');
    r = await run(at(2026, 11, 25, 7));
    ok(r.mails.length === 1 && r.mails[0].to === 'anna@example.org', '3 days before: only to the person who asked for email (not to Ben, nor for an event without email)');
    ok(/^Herinnering: Men’s breakfast – St Example’s$/.test(r.mails[0].subject) && /Liewe Anna/.test(r.mails[0].text) && /oor 3 dae/.test(r.mails[0].text) && r.mails[0].fromName === 'St Example’s', 'in her language (Afrikaans), from the church');
    ok(JSON.stringify(DB['eventSignups/ev1_p1'].data.mailed) === '["3"]', 'it notes that the 3-day email went');
    r = await run(at(2026, 11, 26, 7));
    ok(!r.mails.length, 'never twice');
    r = await run(at(2026, 11, 27, 7));
    ok(r.mails.length === 1 && /môre/.test(r.mails[0].text) && JSON.stringify(DB['eventSignups/ev1_p1'].data.mailed) === '["3","1"]', 'the day before: the 1-day email');
    ok(DB['robotStatus/eventMail'] && DB['robotStatus/eventMail'].data.sent === 1, 'records the run');
    ok(!/Anna|Ben|Cara|example\.org|breakfast|2026-11/.test(r.stdout), 'the public log has no names, addresses or events');
    ok(calls.every(c => c.referer === 'https://pian1966.github.io/church-hub/'), 'says it comes from the church’s website');

    console.log('Missed a day, cancelled, switched off');
    reset(true); r = await run(at(2026, 11, 27, 7));
    ok(r.mails.length === 1 && JSON.stringify(DB['eventSignups/ev1_p1'].data.mailed) === '["3","1"]', 'if the 3-day one was missed, only the 1-day one goes');
    reset(true); DB['events/ev1'].data.status = 'cancelled'; r = await run(at(2026, 11, 25, 7));
    ok(!r.mails.length, 'no reminders for a cancelled event');
    reset(false); r = await run(at(2026, 11, 25, 7));
    ok(!r.mails.length && /switched off/.test(r.stdout), 'nothing while Events is switched off in Church & Trellis');
  } finally {
    try { fs.unlinkSync(cfgPath); fs.unlinkSync(mailFile); } catch (e) {}
    srv.close();
    console.log(fails ? '\n' + fails + ' FAILED' : '\nAll email robot tests passed');
    process.exit(fails ? 1 : 0);
  }
});
