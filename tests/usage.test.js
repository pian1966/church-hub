// Run: node tests/usage.test.js – Usage: adoption, who is on now, versions, parts used (js/usage.js). Made-up data only.
const Usage = require('../js/usage.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const today = '2026-11-25', now = Date.parse('2026-11-25T10:00:00Z');
const P = (id, extra) => Object.assign({ id, category: 'Church Partner', familyRole: 'adult' }, extra);
const R = (id, extra) => Object.assign({ id, firstSeen: '2026-10-01', lastSeen: '2026-11-20T08:00:00Z', version: '0.117.13', platform: 'android', days: {} }, extra);

console.log('Who counts, and who is on the app');
{
  const people = [P('a'), P('b', { appInvited: '2026-11-01' }), P('c'), P('d', { appFirstSeen: '2026-11-02' }), P('e', { category: 'Attendee' }), P('f', { category: 'Attendee', details: { appInvited: '2026-11-01' } }),
    P('kid', { familyRole: 'child' }), P('left', { active: false }), P('dead', { deceasedAt: '2026-01-01' }), P('merged', { mergedInto: 'a' }), P('gone', { category: 'Deceased' })];
  const records = [R('a'), R('e')];
  const a = Usage.adoption(people, records);
  ok(a.partners.total === 4 && a.partners.on === 2 && a.partners.invited === 1 && a.partners.none === 1, 'Church Partners: 4 adults – on (a, d), invited (b), not invited (c)');
  ok(a.partners.pct === 50, 'half the Church Partners are on');
  ok(a.others.total === 2 && a.others.on === 1 && a.others.invited === 1, 'everyone else: on (e), invited (f)');
  ok(a.all.total === 6, 'children, people who left or died and merged duplicates are not counted');
  ok(Usage.adoption([], []).all.pct === 0, 'no people, no divide by zero');
  const n = Usage.notOn(people, records);
  ok(n.map(x => x.id).join() === 'c,b,f', 'not on yet: Church Partners first, not invited before invited');
}

console.log('Right now, today, this week');
{
  const recs = [R('now', { lastSeen: '2026-11-25T09:57:00Z' }), R('old', { lastSeen: '2026-11-25T09:50:00Z' }), R('future', { lastSeen: '2026-11-25T11:00:00Z' }), R('never', { lastSeen: '' })];
  ok(Usage.onNow(recs, now).join() === 'now', 'on now = opened in the last 5 minutes (not 10 minutes ago, not a clock far in the future, not never)');
  const d = (date, n) => ({ [date]: { n } });
  const r2 = [R('x', { days: Object.assign({}, d('2026-11-25', 2), d('2026-11-20', 1)) }), R('y', { days: d('2026-11-19', 1) }), R('z', { days: d('2026-10-20', 1) })];
  ok(Usage.active(r2, today, 1) === 1, 'active today: 1');
  ok(Usage.active(r2, today, 6) === 1, 'active in 6 days: x only (19 Nov is outside)');
  ok(Usage.active(r2, today, 7) === 2, 'active in 7 days (today and the 6 before): x and y');
    ok(Usage.active(r2, today, 30) === 2, 'z (36 days ago) is outside 30 days');
  const dl = Usage.daily(r2, today, 7);
  ok(dl.length === 7 && dl[6].date === today && dl[6].n === 1 && dl[0].date === '2026-11-19' && dl[0].n === 1, 'daily: 7 days, oldest first, today last');
  const wd = Usage.weekdays([R('w', { days: { '2026-11-22': { n: 3 }, '2026-11-25': { n: 1 }, '2026-10-01': { n: 9 } } })], today, 28);
  ok(wd[0] === 3 && wd[3] === 1 && wd.reduce((s, x) => s + x, 0) === 4, 'sessions by weekday: Sunday 3, Wednesday 1, a session 8 weeks ago left out');
}

console.log('Growth');
{
  const people = [P('a', { appFirstSeen: '2026-11-24' }), P('b'), P('c', { appFirstSeen: '2026-09-01' }), P('kid', { familyRole: 'child', appFirstSeen: '2026-09-01' })];
  const g = Usage.growth(people, [R('b', { firstSeen: '2026-11-10' })], today, 4);
  ok(g.length === 4 && g[3].date === today && g[3].total === 3, 'last point is today: a, b and c have started (not the child)');
  ok(g[2].date === '2026-11-18' && g[2].total === 2 && g[0].total === 1, 'earlier weeks count only those started by then');
}

console.log('Versions and platforms');
{
  ok(Usage.compare('0.9.0', '0.10.0') === -1 && Usage.compare('0.117.13', '0.117.13') === 0 && Usage.compare('1.0.0', '0.200.0') === 1, 'versions compare as numbers, not text');
  const v = Usage.versions([R('a'), R('b'), R('c', { version: '0.9.4' }), R('d', { version: '0.117.2' }), R('e', { version: '' })], '0.117.13');
  ok(v.map(x => x.version).join() === '0.117.13,0.117.2,0.9.4', 'newest first; a record with no version is left out');
  ok(v[0].latest && v[0].n === 2 && !v[1].latest && !v[2].latest, 'only the current version is up to date');
  const p = Usage.platforms([R('a'), R('b', { platform: 'app' }), R('c', { platform: 'weird' }), R('d', { platform: undefined })]);
  ok(p.map(x => x.id + x.n).join() === 'android1,app1,browser2', 'platforms: Android, home screen, browser; anything unknown counts as a browser');
}

console.log('Which parts are used');
{
  const day = (v) => ({ n: 1, v });
  const recs = [R('a', { days: { '2026-11-25': day({ home: 9, rosters: 3, people: 1 }), '2026-11-24': day({ rosters: 2 }) } }), R('b', { days: { '2026-11-25': day({ rosters: 1, messages: 4 }) } }),
    R('c', { days: { '2026-09-01': day({ library: 50 }) } })];
  const s = Usage.sections(recs, today, 30, ['home']);
  ok(s.map(x => x.id).join() === 'rosters,messages,people', 'most opened first; Home is skipped and an old month is left out');
  ok(s[0].views === 6 && s[0].people === 2 && s[2].people === 1, 'views and different people are counted');
  ok(!JSON.stringify(s).includes('"a"') && !('who' in s[0]), 'no names or ids in the part counts');
}

console.log('The whole summary and the demo');
{
  const people = Array.from({ length: 40 }, (_, i) => P('p' + i)).concat(Array.from({ length: 20 }, (_, i) => P('q' + i, { category: 'Attendee' })));
  const recs = Usage.demo(people, today, now, '0.117.13');
  ok(recs.length > 10 && recs.length < 60 && recs.every(r => r.id && r.version && r.platform), 'the demo makes records for some of the people');
  ok(JSON.stringify(recs) === JSON.stringify(Usage.demo(people, today, now, '0.117.13')), 'the demo is the same every time');
  const s = Usage.summary({ people, records: recs, today, now, latest: '0.117.13' });
  ok(s.adoption.all.on === recs.length && s.recorded === recs.length, 'everyone with a record is counted as on the app');
  ok(s.active30 >= s.active7 && s.active7 >= s.activeToday, 'month ≥ week ≥ today');
  ok(s.stickiness >= 0 && s.stickiness <= 100 && s.daily.length === 14 && s.growth.length === 12 && s.weekdays.length === 7, 'the pieces have the right shape');
  ok(Usage.summary({ people: [], records: [], today, now, latest: '1.0.0' }).stickiness === 0, 'an empty church gives zeros, not errors');
}
console.log('How much each person uses it');
{
  const mk = (n, parts, extra) => R('u', Object.assign({ firstSeen: '2026-01-01', lastSeen: '2026-11-25T08:00:00Z', days: Object.fromEntries(Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - i * 864e5).toISOString().slice(0, 10); return [d, { n: 1, v: Object.fromEntries(parts.map(x => [x, 1])) }]; })) }, extra));
  const many = ['people', 'rosters', 'messages', 'events'], p = P('u');
  const L = (rec, person) => Usage.level(person || p, rec, today, true);
  ok(Usage.level(P('x'), undefined, today, true).n === 0 && Usage.level(P('x'), undefined, today, true).id === 'none', 'not on the app: level 0');
  ok(Usage.level(P('x', { appFirstSeen: '2026-11-02' }), undefined, today, false).n === null, 'no usage recorded at all: only "on the app", no rating');
  ok(L(mk(1, many)).n === 1 && L(mk(3, many)).n === 2 && L(mk(5, many)).n === 3 && L(mk(12, many)).n === 4 && L(mk(20, many)).n === 5, 'days opened in 4 weeks: 0–1 → 1, 2–3 → 2, 4–7 → 3, 8–15 → 4, 16+ → 5');
  ok(L(mk(20, ['people'])).n === 3, 'one part only caps it at Regular');
  ok(L(mk(20, ['people', 'rosters', 'messages'])).n === 4, 'fewer than 4 parts: not a Power user');
  ok(L(mk(20, many.concat(['home']))).parts === 4, 'Home does not count as a part');
  ok(L(mk(20, many, { firstSeen: '2026-11-20' }), P('u', { appFirstSeen: '2026-11-20' })).n === 1, 'first opened in the last 14 days: Just started');
  ok(Usage.LEVELS[5][0] === 'power' && Usage.LEVELS.length === 6, 'six steps: not on the app, then five');
  const slip = L(mk(0, [], { lastSeen: '2026-10-20T08:00:00Z' }));
  ok(slip.slipping && slip.n === 1, 'was on the app, not opened for 3 weeks: Just started and slipping away');
  ok(!L(mk(20, many)).slipping && !L(mk(0, [], { lastSeen: '2026-11-10T08:00:00Z' })).slipping, 'used lately, or only a fortnight away: not slipping');
  ok(L(mk(0, [], { firstSeen: '2026-11-20', lastSeen: '2026-11-20T08:00:00Z' }), P('u', { appFirstSeen: '2026-11-20' })).slipping === false, 'someone new is never "slipping"');
  const lv = Usage.levels([P('a'), P('b'), P('kid', { familyRole: 'child' }), P('c', { appFirstSeen: '2026-10-01' })], [mk(20, many, { id: 'a' })], today);
  ok(Object.keys(lv).join() === 'a,b,c' && lv.a.n === 5 && lv.b.n === 0 && lv.c.n === 1 && lv.c.slipping, 'levels for each adult (not the child); on the app with no recent use is Just started, slipping');
  const sp = Usage.spread(lv); ok(sp.counts.join() === '1,1,0,0,0,1' && sp.slipping === 1, 'the spread counts adults at each level');
  ok(Usage.summary({ people: [P('a')], records: [], today, now, latest: '1' }).levels.a.n === 0, 'the summary carries the levels');
}

console.log('The record each app keeps');
{
  ok(Usage.partOf('#/rosters/2026-11') === 'rosters' && Usage.partOf('') === 'home' && Usage.partOf('#/') === 'home' && Usage.partOf('#/people/p/p12') === 'people', 'the part is the first word of the address');
  ok(Usage.partOf('#/start') === '' && Usage.partOf('#/<script>') === '', 'anything that isn’t a part of the app is not counted');
  ok(Usage.platformOf({ android: true, standalone: true }) === 'android' && Usage.platformOf({ standalone: true }) === 'app' && Usage.platformOf({}) === 'browser', 'Android app, home screen, browser');
  const c = { id: 'p1', today, now: '2026-11-25T10:00:00.000Z', version: '0.118.0', platform: 'app' };
  const r = Usage.merge(null, { [today]: { n: 1, v: { rosters: 2, evil: 5 } } }, c);
  ok(r.id === 'p1' && r.firstSeen === today && r.lastSeen === c.now && r.version === '0.118.0' && r.platform === 'app', 'a first record');
  ok(r.days[today].n === 1 && r.days[today].v.rosters === 2 && !('evil' in r.days[today].v), 'counts the parts, not anything else');
  ok(Object.keys(r).sort().join() === 'days,firstSeen,id,lastSeen,platform,version', 'only the fields the rules allow');
  const prev = { id: 'p1', firstSeen: '2026-09-01', days: { [today]: { n: 2, v: { rosters: 1, people: 1 } }, '2026-10-21': { n: 1, v: {} }, '2026-10-22': { n: 1, v: {} }, 'junk': { n: 4 } }, secret: 'x' };
  const m = Usage.merge(prev, { [today]: { n: 0, v: { rosters: 3 } }, '2026-11-24': { n: 1, v: { me: 1 } } }, c);
  ok(m.firstSeen === '2026-09-01' && m.days[today].n === 2 && m.days[today].v.rosters === 4 && m.days[today].v.people === 1 && m.days['2026-11-24'].v.me === 1, 'adds to what is stored');
  ok(!m.days['2026-10-21'] && !!m.days['2026-10-22'] && !m.days.junk && !('secret' in m), 'keeps only the last 35 days, real dates, and nothing else');
  ok(Usage.merge({ days: { [today]: { n: -5, v: { me: 1e9 } } } }, {}, c).days[today].n === 0 && Usage.merge({ days: { [today]: { n: 1, v: { me: 1e9 } } } }, {}, c).days[today].v.me === 9999, 'counts are whole numbers within limits');
  const big = {}; for (let i = 0; i < 60; i++) big[new Date(Date.parse(today) - i * 864e5).toISOString().slice(0, 10)] = { n: 1, v: {} };
  ok(Object.keys(Usage.merge({ days: big }, {}, c).days).length === 35, 'never more than 35 days (the rules allow no more)');
  ok(Usage.merge({ firstSeen: '2027-01-01' }, {}, c).firstSeen === today, 'a first day in the future is put right');
}

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); } else console.log('\nAll passed');
