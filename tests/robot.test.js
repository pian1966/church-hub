// Run: node tests/robot.test.js – the Elvanto robot's side that talks to Church Hub (sign-in, work list, reporting),
// against stand-in Google servers. The Elvanto browser steps are Leave Manager's robot's and are skipped (FAKE_ELVANTO=1).
const http = require('http'), { execFile } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const R = require('../robot/robot.js');

console.log('Reading Elvanto’s unavailable dates (names and dates only)');
ok(JSON.stringify(R.datesIn('03/04/2026 – 05/04/2026')) === '["2026-04-03","2026-04-05"]' && JSON.stringify(R.datesIn('Mon 3 Nov – Wed 5 Nov', 2026)) === '["2026-11-03","2026-11-05"]', 'dates as Elvanto may write them (day first, or with month names)');
ok(!R.datesIn('Decline 3 things', 2026).length && !R.datesIn('31/02/2026').length, 'words that only look like months, and impossible dates, aren’t dates');
{
  const rr = R.readRows([['Anna Example', '3 Nov 2026', '5 Nov 2026', 'Hospital', 'Edit'], ['Ben Example', '01/01/2020', ''], ['Cara Example', '10/11/2026', '', 'Church Hub L12'], ['Anna Example', '3 Nov 2026', '5 Nov 2026', 'x'], ['Some text', 'more']], '2026-10-29');
  ok(rr.entries.length === 2 && rr.entries[0].name === 'Anna Example' && rr.entries[0].from === '2026-11-03' && rr.entries[0].to === '2026-11-05', 'a row → name, first and last day (doubles once)');
  ok(!JSON.stringify(rr).includes('Hospital'), 'the reason is never kept');
  ok(!rr.entries.some(e => e.name === 'Ben Example') && rr.entries[1].fromLeave === true && rr.unread === 1, 'past entries left out; entries made for leave marked; rows not understood counted');
}

console.log('Converting values');
const sample = { a: 'x', n: 3, f: 1.5, b: true, z: null, m: { k: 'v' }, l: ['p', 1] };
ok(JSON.stringify(R.fromValue(R.toValue(sample))) === JSON.stringify(sample), 'text, numbers, yes/no, maps and lists survive the round trip');

// ---- stand-in Google servers ----
const DB = {}, calls = [];
let clock = 1;
const stamp = () => '2026-10-26T10:00:' + String(clock++).padStart(2, '0') + '.000000Z';
const put = (p, data) => { DB[p] = { data, updateTime: stamp() }; };
const docJSON = (p) => ({ name: 'projects/demo/databases/(default)/documents/' + p, fields: R.toValue(DB[p].data).mapValue.fields, updateTime: DB[p].updateTime });
function reset(on) {
  Object.keys(DB).forEach(k => delete DB[k]); calls.length = 0;
  put('settings/church', { churchName: 'Test', elvanto: { on, url: 'https://example.elvanto.eu', robotEmail: 'robot@example.com' } });
  put('elvantoSync/LA', { personId: 'p1', name: 'Anna Example', start: '2026-11-02', end: '2026-11-04', want: 'Unavailable', have: '', haveNote: '', status: 'Waiting', note: '' });
  put('elvantoSync/LB', { personId: 'p2', name: 'Ben Example', start: '2026-11-09', end: '2026-11-09', want: 'Removed', have: '2026-11-09 to 2026-11-09', haveNote: 'Leave Manager LB', status: 'Waiting', note: '' });
  put('elvantoSync/LC', { personId: 'p3', name: 'Cara Example', start: '2026-12-01', end: '2026-12-02', want: 'Unavailable', have: '2026-12-01 to 2026-12-02', haveNote: 'Church Hub LC', status: 'Done', note: '' });
}
let changeDuringRun = null;
const srv = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), send = (code, j) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)); };
    calls.push({ method: req.method, path: u.pathname, referer: req.headers.referer, auth: req.headers.authorization || '', body });
    if (u.pathname.endsWith('/accounts:signInWithPassword')) {
      const b = JSON.parse(body);
      return b.email === 'robot@example.com' && b.password === 'secret' && u.searchParams.get('key') === 'test-key' ? send(200, { idToken: 'TOKEN' }) : send(400, { error: { message: 'INVALID_PASSWORD' } });
    }
    if (req.headers.authorization !== 'Bearer TOKEN') return send(403, { error: { message: 'PERMISSION_DENIED' } });
    const m = u.pathname.match(/\/documents\/?(.*)$/), p = m ? decodeURIComponent(m[1]) : '';
    if (u.pathname.endsWith(':runQuery')) {
      const rows = Object.keys(DB).filter(k => k.startsWith('elvantoSync/') && DB[k].data.status === 'Waiting').map(k => ({ document: docJSON(k) }));
      return send(200, rows.length ? rows : [{ readTime: 'x' }]);
    }
    if (req.method === 'GET') return DB[p] ? send(200, docJSON(p)) : send(404, { error: { message: 'NOT_FOUND' } });
    if (req.method === 'PATCH') {
      if (changeDuringRun && p.startsWith('elvantoSync/')) { changeDuringRun(); changeDuringRun = null; }   // someone changes the leave just before the robot reports back
      const since = u.searchParams.get('currentDocument.updateTime');
      if (since && (!DB[p] || DB[p].updateTime !== since)) return send(400, { error: { message: 'FAILED_PRECONDITION' } });
      const fields = JSON.parse(body).fields, cur = DB[p] ? DB[p].data : {};
      Object.keys(fields).forEach(k => { cur[k] = R.fromValue(fields[k]); }); put(p, cur);
      return send(200, docJSON(p));
    }
    send(404, {});
  });
});

function runRobot(mode, extraEnv) {
  const outFile = path.join(os.tmpdir(), 'robot-out-' + Date.now());
  return new Promise(resolve => execFile(process.execPath, [path.join(__dirname, '..', 'robot', 'robot.js')], {
    env: Object.assign({}, process.env, { MODE: mode, ROBOT_EMAIL: 'robot@example.com', ROBOT_PASSWORD: 'secret', FAKE_ELVANTO: '1', GITHUB_OUTPUT: outFile,
      AUTH_URL: 'http://127.0.0.1:' + srv.address().port + '/v1', FS_URL: 'http://127.0.0.1:' + srv.address().port + '/v1', FIREBASE_CONFIG_FILE: path.join(os.tmpdir(), 'robot-test-config.js') }, extraEnv || {})
  }, (err, stdout) => { let o = ''; try { o = fs.readFileSync(outFile, 'utf8'); fs.unlinkSync(outFile); } catch (e) {} resolve({ err, stdout, out: o }); }));
}

srv.listen(0, '127.0.0.1', async () => {
  // Test Firebase settings (the real js/firebase-config.js is never touched)
  const cfgPath = path.join(os.tmpdir(), 'robot-test-config.js');
  fs.writeFileSync(cfgPath, "window.CHURCH_HUB_FIREBASE = { apiKey: 'test-key', authDomain: 'x', projectId: 'demo', appId: 'x' };\n");
  try {
    console.log('Checking for work');
    reset(true);
    let r = await runRobot('check');
    ok(/jobs=2/.test(r.out), 'finds the 2 waiting entries (not the one already done)');
    ok(calls.every(c => c.referer === 'https://pian1966.github.io/church-hub/'), 'says it comes from the church’s website (the key only works from there)');
    ok(DB['robotStatus/elvanto'] && DB['robotStatus/elvanto'].data.lastCheck, 'records that it is alive');
    reset(false); r = await runRobot('check');
    ok(/jobs=0/.test(r.out), 'nothing to do while switched off in Church Hub');
    r = await runRobot('check', { ROBOT_PASSWORD: 'wrong' });
    ok(r.err && /couldn’t sign in to Church Hub/.test(r.stdout), 'a wrong password is reported plainly');

    console.log('Doing the work and reporting back');
    reset(true); r = await runRobot('run');
    const A = DB['elvantoSync/LA'].data, B = DB['elvantoSync/LB'].data;
    ok(A.status === 'Done' && A.have === '2026-11-02 to 2026-11-04' && A.haveNote === 'Church Hub LA' && /Added/.test(A.note), 'added: status Done, Elvanto now has those dates, note “Church Hub <id>”');
    ok(B.status === 'Done' && B.have === '' && B.haveNote === '' && /Removed/.test(B.note), 'removed: Leave Manager’s old entry gone');
    ok(DB['elvantoSync/LC'].data.note === '', 'entries not waiting are left alone');
    ok(DB['robotStatus/elvanto'].data.lastRun && DB['robotStatus/elvanto'].data.done === 2, 'records the run (2 done)');
    ok(!/Anna|Ben|Cara|Example|2026-1[12]/.test(r.stdout), 'the public log has no names or dates');

    console.log('Reading the list every night');
    reset(true); r = await runRobot('read', { FAKE_ROWS: JSON.stringify([['Anna Example', '3 Nov 2026', '5 Nov 2026', 'Hospital']]), TODAY: '2026-10-29' });
    ok(!DB['elvantoFound/unavailable'] && /switched off/.test(r.stdout), 'does nothing until “Read Elvanto’s unavailable dates” is ticked in Church Hub');
    DB['settings/church'].data.elvanto.read = true;
    r = await runRobot('read', { FAKE_ROWS: JSON.stringify([['Anna Example', '3 Nov 2026', '5 Nov 2026', 'Hospital']]), TODAY: '2026-10-29' });
    const F = (DB['elvantoFound/unavailable'] || {}).data || {};
    ok(F.entries && F.entries.length === 1 && F.entries[0].name === 'Anna Example' && F.readAt && F.rows === 1, 'writes what it found for an Administrator to check (Import)');
    ok(!JSON.stringify(F).includes('Hospital') && !/Anna|Example|2026-11/.test(r.stdout), 'no reasons kept; the public log has no names or dates');

    console.log('Leave changed while the robot was working');
    reset(true);
    changeDuringRun = () => { DB['elvantoSync/LA'].data.end = '2026-11-06'; DB['elvantoSync/LA'].updateTime = stamp(); };
    r = await runRobot('run');
    ok(DB['elvantoSync/LA'].data.status === 'Waiting' && DB['elvantoSync/LA'].data.end === '2026-11-06', 'its result isn’t written over the change – the entry stays waiting for the next run');
  } finally {
    fs.unlinkSync(cfgPath);
    srv.close();
    console.log(fails ? '\n' + fails + ' FAILED' : '\nAll robot tests passed');
    process.exit(fails ? 1 : 0);
  }
});
