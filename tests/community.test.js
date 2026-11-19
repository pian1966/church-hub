/* Tests for js/community.js – the Community board and the Marketplace, looked after by keepers. Made-up people only.
 * Run: node tests/community.test.js */
'use strict';
const C = require('../js/community.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const DAY = 864e5, NOW = Date.UTC(2026, 10, 19, 10), tim = { id: 'p14', firstName: 'Timothy', preferredName: 'Tim', lastName: 'Jacobs' }, thandi = { id: 'p02', firstName: 'Thandi', lastName: 'Mokoena' };

console.log('Pinning a notice');
const n = C.make('board', { kind: 'need', title: '  I need a plumber  ', body: 'Leaking geyser', phone: '082 555 0101 (after 5)' }, tim, NOW);
ok(n.status === 'waiting' && n.endsAt === NOW + 30 * DAY && n.renews === 0 && n.personId === 'p14' && n.name === 'Tim', 'waits for a keeper, for 30 days, with only the first name');
ok(n.title === 'I need a plumber' && !/[a-z]/i.test(n.phone) && n.phone.startsWith('082 555 0101') && !('price' in n), 'tidied: the title trimmed, the phone number only digits and signs, no Marketplace fields');
ok(C.make('board', { title: '   ' }, tim, NOW).error === 'title', 'a notice needs a title');
ok(C.make('board', { kind: 'nonsense', title: 'x' }, tim, NOW).kind === 'need', 'an unknown kind becomes "I need help"');
ok(C.make('board', { title: 'x'.repeat(200), body: 'y'.repeat(900) }, tim, NOW).title.length === 80 && C.make('board', { title: 'x', body: 'y'.repeat(900) }, tim, NOW).body.length === 600, 'kept short (as the rules allow)');

console.log('Listing something');
const base = { kind: 'sale', title: 'Pine bookshelf', price: 'R 1 250,50', condition: 'good', category: 'furniture', area: '  Hilton ', rulesOk: true, photos: 5, thumb: 'data:x' };
const l = C.make('market', base, tim, NOW);
ok(l.price === 1250.5 && l.area === 'Hilton' && l.photos === 3 && l.offer === false && !('phone' in l), 'the price read as people type it; at most 3 photos; no phone number');
ok(C.make('market', Object.assign({}, base, { rulesOk: false }), tim, NOW).error === 'rules', 'the Marketplace rules must be accepted');
ok(C.make('market', Object.assign({}, base, { price: '' }), tim, NOW).error === 'price' && !C.make('market', Object.assign({}, base, { price: '', offer: true }), tim, NOW).error, 'something for sale needs a price – or is open to offers');
ok(C.make('market', Object.assign({}, base, { kind: 'free', price: '500' }), tim, NOW).price === 0 && C.make('market', Object.assign({}, base, { kind: 'wanted', price: '' }), tim, NOW).price === 0, 'free things cost nothing; wanted needs no price');
ok(C.make('market', Object.assign({}, base, { condition: 'x', category: 'y' }), tim, NOW).condition === 'good' && C.make('market', Object.assign({}, base, { category: 'y' }), tim, NOW).category === 'other', 'unknown condition and category fall back');
ok(C.parsePrice('1,250.00') === 1250 && C.parsePrice('450') === 450 && C.parsePrice('99,95') === 99.95 && C.parsePrice('free') === -1, 'prices in the ways people write them');

console.log('Keepers decide');
const a = C.decide(Object.assign({ id: 'b1' }, n), 'approve', '', thandi, NOW + DAY);
ok(a.status === 'live' && a.endsAt === NOW + 31 * DAY && a.by === 'Thandi' && a.decidedAt === NOW + DAY && a.note === '', 'approved: live for 30 days from now');
ok(C.decide(n, 'change', '', thandi, NOW).error === 'note' && C.decide(n, 'decline', ' ', thandi, NOW).error === 'note', 'asking for a change or declining needs a kind note');
const ch = C.decide(n, 'change', 'Which suburb?', thandi, NOW);
ok(ch.status === 'change' && ch.note === 'Which suburb?' && C.decide(n, 'decline', 'Not for the board', thandi, NOW).status === 'declined', 'asked for a change, or declined');

console.log('What people see');
const who = { id: 'p15', ids: ['p15'] }, me = { id: 'p14', ids: ['p14'] };
const items = [
  Object.assign({}, a, { id: 'live' }),
  Object.assign({}, n, { id: 'wait' }),
  Object.assign({}, a, { id: 'old', endsAt: NOW - DAY }),
  Object.assign({}, a, { id: 'sorted', status: 'done', doneAt: NOW + DAY - 3600e3 }),
  Object.assign({}, a, { id: 'sortedLong', status: 'done', doneAt: NOW - 5 * DAY }),
  Object.assign({}, ch, { id: 'change' })
];
const t = NOW + DAY;
ok(C.shown(items, who, t).map(x => x.id).sort().join() === 'live,sorted', 'others see what is live and what was sorted today (with its stamp)');
ok(C.shown(items, me, t).map(x => x.id).sort().join() === 'change,live,old,sorted,wait', 'the poster also sees their own, waiting or not');
ok(C.waiting(items).map(x => x.id).join() === 'wait', 'the keepers’ list: waiting ones');
ok(C.latest(items, t, 3).map(x => x.id).join() === 'live', 'the latest on Home: live ones only');
ok(C.needsMe(items, me, t).map(x => x.id).join() === 'change' && C.needsMe(items, who, t).length === 0, 'the poster is told what needs them');
const soon = Object.assign({}, a, { id: 'soon', endsAt: t + 2 * DAY });
ok(C.ending(soon, t) && !C.ending(a, t) && C.daysLeft(soon, t) === 2, 'ending within a few days');
ok(C.tidy(items.concat([Object.assign({}, a, { id: 'gone', endsAt: t - 31 * DAY }), Object.assign({}, a, { id: 'gone2', status: 'done', doneAt: t - 40 * DAY }), Object.assign({}, a, { id: 'gone3', status: 'declined', decidedAt: t - 40 * DAY })]), t).join() === 'gone,gone2,gone3',
  'ended, sorted or declined more than 30 days ago: deleted (POPIA)');

console.log('Renewing, sorted, reports');
const r1 = C.renew(soon, t), r2 = C.renew(r1, t), r3 = C.renew(r2, t);
ok(r1.renews === 1 && r1.endsAt === t + 30 * DAY && r2.renews === 2 && r3 === null, 'renewed twice at most');
ok(C.renew(Object.assign({}, a, { endsAt: t - 1 }), t) === null, 'an ended one can’t be renewed');
ok(C.done(a, t).status === 'done' && C.done(a, t).doneAt === t && C.stamped(C.done(a, t), t + 3600e3) && !C.stamped(C.done(a, t), t + 2 * DAY), 'sorted: a stamp for a day');
const rep = C.report(a, 'p15', t);
ok(rep.reports.join() === 'p15' && C.report(rep, 'p15', t) === null && C.report(n, 'p15', t) === null, 'reported once each, and only when live');
ok(C.reported([Object.assign({}, rep, { id: 'r' }), a], t).map(x => x.id).join() === 'r', 'the keepers see what was reported');

console.log('Changing it');
const live = Object.assign({ id: 'L1', createdAt: '2026-11-01 08:00' }, C.decide(l, 'approve', '', thandi, NOW));
const cheaper = C.edit('market', live, Object.assign({}, base, { price: '900' }), tim, t);
ok(cheaper.status === 'live' && cheaper.price === 900 && cheaper.endsAt === live.endsAt, 'a lower price stays up');
const changed = C.edit('market', live, Object.assign({}, base, { title: 'Oak bookshelf' }), tim, t);
ok(changed.status === 'waiting' && changed.id === 'L1' && changed.createdAt === '2026-11-01 08:00' && changed.endsAt === live.endsAt, 'any other change goes back to a keeper');
ok(C.edit('market', live, Object.assign({}, base, { price: '2000' }), tim, t).status === 'waiting', 'a higher price too');

console.log('Messages to the poster');
const m = C.message('board', Object.assign({ id: 'b1' }, a), thandi, 'About your notice', ' I can recommend someone ');
ok(m.kind === 'direct' && m.about === 'board' && m.aboutId === 'b1' && m.to.join() === 'p14' && m.fromId === 'p02' && m.body === 'I can recommend someone' && m.readBy.join() === 'p02', 'a private message, about this notice');
ok(C.message('board', a, tim, 'x', 'hello').error === 'nobody' && C.message('board', a, thandi, 'x', '  ').error === 'empty', 'never to yourself; never empty');

console.log('The look');
ok(C.tilt('b1') === C.tilt('b1') && [...'abcdefghijklmnop'].every(c => Math.abs(C.tilt(c)) <= 3), 'each note keeps its own slant, never more than 3°');
ok(C.BOARD_KINDS.every(k => /^#[0-9A-F]{6}$/i.test(k[3])) && C.BOARD_KINDS.length === 4, 'four kinds of notice, each its own colour');

console.log(fails ? `\n${fails} FAILED` : '\nAll passed');
process.exit(fails ? 1 : 0);
