/* Tests for js/tips.js (Home: What's new and Did you know?). Run: node tests/tips.test.js */
'use strict';
const Tips = require('../js/tips.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const allOn = () => true, ids = ctx => Tips.forPerson(ctx).map(t => t.id);
const member = { tags: ['everyone', 'member'], on: allOn };
const librarian = { tags: ['everyone', 'member', 'librarian'], on: allOn };
const admin = { tags: ['everyone', 'admin', 'staffwork', 'librarian'], on: allOn };

console.log('Who hears what');
ok(ids(member).includes('lib-there') && ids(member).includes('lib-ask') && !ids(member).some(id => ['lib-lend', 'lib-repair', 'lib-out', 'lib-remind'].includes(id)), 'a member hears that there is a library and how to ask for a book – not how to lend or repair');
ok(ids(librarian).includes('lib-repair') && !ids(librarian).includes('lib-there'), 'a librarian hears how to lend and repair, not the members’ library tips');
ok(!ids(member).some(id => /^admin-|^ros-|^kids-|^pastor-|^senior-|^people-/.test(id)), 'a member hears nothing meant for staff');
ok(ids(admin).includes('admin-viewas') && ids(admin).includes('people-search') && !ids(admin).includes('kids-medical') && !ids(admin).includes('pastor-notes'), 'an Administrator gets their tips, not those about notes only Pastors or Children’s ministry see');
ok(ids({ tags: ['everyone', 'kids', 'staffwork'], on: allOn }).includes('kids-medical') && ids({ tags: ['everyone', 'member', 'carer'], on: allOn }).includes('carer-msg'), 'Children’s ministry and carers get their own tips');
const noLibrary = { tags: ['everyone', 'member'], on: id => id !== 'library' };
ok(!ids(noLibrary).some(id => id.startsWith('lib-')), 'nothing about a part that is switched off or closed to them');
ok(Tips.TIPS.every(t => t.id && t.text && (t.who || []).length) && new Set(Tips.TIPS.map(t => t.id)).size === Tips.TIPS.length, 'every tip has an id, a text and an audience; no id twice');

console.log('One tip at a time');
const tips = Tips.forPerson(member);
let r = Tips.next(tips, []);
ok(r.tip.id === tips[0].id && r.seen.join() === tips[0].id, 'the first tip first');
r = Tips.next(tips, r.seen);
ok(r.tip.id === tips[1].id && r.seen.length === 2, 'then the next one');
r = Tips.next(tips, tips.map(t => t.id));
ok(r.tip.id === tips[0].id && r.seen.length === 1, 'after the last, it starts again');
ok(Tips.next(tips, ['gone', tips[0].id]).seen.indexOf('gone') < 0 && Tips.next([], ['x']).tip === null, 'tips no longer offered are forgotten; no tips, no tip');

console.log('What’s new');
const NEWS = [
  { date: '2026-11-15', who: ['everyone'], text: 'A' },
  { date: '2026-11-10', who: ['librarian'], text: 'B' },
  { date: '2026-11-01', who: ['everyone'], text: 'C' },
  { date: '2026-11-20', who: ['everyone'], text: 'later' },
  { date: '2026-11-12', who: ['everyone'], app: 'library', text: 'D' }
];
ok(Tips.news(member, '2026-11-15', 2, NEWS).map(n => n.text).join() === 'A,D', 'the newest first, at most two, only from the last two weeks and not before their day');
ok(Tips.news(noLibrary, '2026-11-15', 3, NEWS).map(n => n.text).join() === 'A', 'news only for those it is for');
ok(Tips.news(librarian, '2026-11-15', 3, NEWS).map(n => n.text).join() === 'A,D,B', 'librarians get their own news too');
ok(Tips.news(member, '2027-03-01').length === 0, 'old news isn’t shown');
ok(Tips.NEWS.every(n => /^\d{4}-\d\d-\d\d$/.test(n.date) && n.text && (n.who || []).length), 'every news line has a date, a text and an audience');

console.log(fails ? fails + ' failed' : 'All passed');
process.exit(fails ? 1 : 0);
