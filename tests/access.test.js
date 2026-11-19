/* Tests for js/access.js (who can see what, and what each kind of person can do – the one place).
 * Also checks that the lists firestore.rules and tests/fake-firebase.js keep (they can't load js/access.js) still match it.
 * Run: node tests/access.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const A = require('../js/access.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

console.log('Kinds of access');
ok(A.ROLE_IDS.every(r => A.ROLES[r]) && A.ROLES.none && A.ROLES.admin.perms[0] === '*', 'every role has its entry');
ok(Object.keys(A.ROLES).every(r => A.ROLES[r].label && A.ROLES[r].can), 'each with a label and a line saying what it can do');
ok(A.RESTRICTED.join() === 'medical,notes', 'medical and pastoral notes stay restricted (not even Administrators)');
ok(A.kindOf('member', false) === 'partner' && A.kindOf('member', true) === 'attendee' && A.kindOf('pastor') === 'pastor' && A.kindOf('carer', false) === 'partner',
  'Basic access is a Church Partner or an attendee; "View as Carer" counts as Basic access');

console.log('What Pastors can do');
ok(A.pastorTicks({ pastorCan: ['leave', 'settings'] }, 'p1').join() === 'leave,settings', 'the Pastors’ ticks, sorted');
ok(A.pastorTicks({ pastorCan: ['leave'], seniorCan: ['settings', 'words'], seniorPastorId: 'p1' }, 'p1').join() === 'settings,words', 'the Senior Pastor gets their own ticks');
ok(A.pastorTicks({ pastorCan: ['leave'], seniorCan: ['settings'], seniorPastorId: 'p1' }, 'p2').join() === 'leave', '…and the other Pastors theirs');
ok(A.pastorTicks({}, 'p1').length === 0 && A.pastorTicks(null, '').length === 0, 'nothing ticked: nothing extra');
ok(A.abilityPerms(['people', 'leave']).join() === 'people.delete,people.changes,leave.manage', 'each tick gives its screen permissions');

console.log('Attendees');
ok(A.attendeeCan({}).join() === 'names,write', 'names and writing unless the church chose otherwise');
ok(A.attendeeCan({ attendeeCan: ['reply', 'odd'] }).join() === 'reply' && A.attendeeCan({ attendeeCan: [] }).length === 0, 'unknown choices dropped; none at all is allowed');
ok(A.ATTENDEE_ROWS.length === A.ATTENDEE_OPTIONS.length && A.ATTENDEE_ROWS.every(r => r[1] && r[2]), 'every choice has its wording for Settings');

console.log('Access and roles, in plain words');
{
  const share = [['mobile', 'Mobile'], ['email', 'Email'], ['address', 'Home address']];
  const words = l => l.map(x => x.t + (x.list ? ':' + x.list.join('+') : '')).join(' | ');
  ok(A.overviewKinds({}).join() === 'admin,pastor,rosters,kids,partner,attendee' && A.overviewKinds({ seniorPastorId: 'p2' })[1] === 'senior', 'one card per kind of person; the Senior Pastor only once one is chosen');
  ok(/Not pastoral notes/.test(words(A.summary('admin', {}).see)), 'Administrators: everything except pastoral and medical notes');
  const pa = A.summary('pastor', { pastorCan: ['leave'], seniorCan: ['settings'], seniorPastorId: 'p2' });
  ok(/Approve leave/.test(words(pa.can)) && !/Change the church/.test(words(pa.can)), 'Pastors: what they always may, and only their own ticks');
  ok(/Change the church/.test(words(A.summary('senior', { pastorCan: ['leave'], seniorCan: ['settings'], seniorPastorId: 'p2' }).can)) && /View as/.test(words(A.summary('senior', { seniorPastorId: 'p2' }).can)), '…the Senior Pastor theirs, and View as');
  ok(/Nothing more/.test(words(A.summary('pastor', {}).can)), 'no ticks: says so');
  ok(words(A.summary('rosters', { seeOthers: { rosters: ['mobile', 'email'] } }, share).see) === 'In the church directory: their name, photo and {list}:Mobile+Email', 'contact details follow Settings (Roster coordinators)');
  ok(/names and photos only/.test(words(A.summary('partner', {}, share).see)) && /Everyone in their own Care Group/.test(words(A.summary('partner', {}).see)) && /carers of their own/.test(words(A.summary('partner', { seeCareOwn: false }).see)), 'Church Partners: the directory and their own Care Group, as set');
  ok(/Every Care Group/.test(words(A.summary('kids', { seeCare: ['kids'] }).see)) && !/Every Care Group/.test(words(A.summary('kids', {}).see)), 'all Care Groups only when ticked');
  ok(/Community board/.test(words(A.summary('partner', { modules: { board: true } }).can)) && !/Community board/.test(words(A.summary('partner', {}).can)), 'the Community board only when it is on');
  const at = A.summary('attendee', {});
  ok(/names of Church Partners/.test(words(at.see)) && /Write to the Office/.test(words(at.can)) && !/Reply/.test(words(at.can)), 'attendees: names and writing by default');
  ok(/Only read/.test(words(A.summary('attendee', { attendeeCan: [] }).can)) && /church directory/.test(words(A.summary('attendee', { attendeeCan: ['directory'] }, share).see)), '…and what Settings → Attendees changes');
}

console.log('Care Groups');
ok(A.seesCare({}, 'member') && !A.seesCare({ seeCareOwn: false }, 'member') && A.seesCare({ seeCare: ['kids'] }, 'kids') && !A.seesCare({}, 'rosters'),
  'Church Partners see their own group unless switched off; other roles only when ticked');

console.log('Parts of the app plug in here');
const ids = A.PARTS.map(p => p.id);
ok(['board', 'market', 'support'].every(id => ids.includes(id)), 'the Community board, the Marketplace and the Subscription have their entries');
ok(A.PARTS.every(p => p.name && p.desc && Object.keys(p.perms).length && Object.keys(p.perms).every(k => k.indexOf(p.id + '.') === 0)),
  'each part names its permissions "<part>.<what>"');
ok(A.partPerms().length === new Set(A.partPerms()).size && A.isPartPerm('board.keep') && !A.isPartPerm('people.view') && !A.isPartPerm('board.nothing'), 'no permission twice; only the parts’ own count');
ok(A.allows('people.view', { kind: 'admin' }) === null, 'a permission no part adds is left to the old rules');
const people = [{ id: 'a', appRole: 'admin' }, { id: 'p', appRole: 'pastor' }, { id: 's', appRole: 'member' }, { id: 'm', appRole: 'member' }];
const st = { rosterExtra: ['s'] };
ok(A.jobHolders('keepers', 'board', st, people).join() === 'a,p,s', 'first keepers: the Administrators, the Pastors and the church secretary (decided 19 Nov 2026)');
ok(A.jobHolders('keepers', 'market', { keepers: { market: ['m', 'gone', 'm'] } }, people).join() === 'm', 'once the church chooses, its own keepers (people no longer here dropped)');
ok(A.jobHolders('keepers', 'support', st, people).length === 0 && A.jobHolders('nothing', 'board', st, people).length === 0, 'no keepers where a part has none');
const who = (kind, id, more) => Object.assign({ kind: kind, id: id, settings: st, people: people }, more || {});
ok(A.allows('board.keep', who('partner', 's')) && A.allows('board.keep', who('admin', 'a')) && !A.allows('board.keep', who('partner', 'm')), 'keepers keep; others don’t');
ok(!A.allows('board.keep', who('attendee', 's')), 'a keeper must be a Church Partner or on the staff');
ok(['admin', 'pastor', 'rosters', 'kids', 'partner'].every(k => A.allows('market.view', who(k)) && A.allows('market.post', who(k))) && !A.allows('market.view', who('attendee')) && !A.allows('market.post', who('attendee')),
  'Marketplace: Church Partners and staff, never attendees (decided 19 Nov 2026)');
ok(!A.allows('board.view', who('attendee')), 'Community board: not attendees until the church decides');
ok(A.allows('support.manage', who('admin')) && A.allows('support.manage', who('pastor', 'p', { ticks: ['settings'] })) && !A.allows('support.manage', who('pastor', 'p', { ticks: ['leave'] })) && !A.allows('support.manage', who('partner')),
  'Subscription: Administrators, and Pastors with the “settings” tick (as before)');
ok(A.PARTS.filter(p => p.soon).length === 0, 'no placeholders left: the board and the marketplace are built (0.97.0)');
ok(A.apps().some(a => a[0] === 'board') && A.apps().some(a => a[0] === 'market') && A.apps().length === A.APPS.length + 2, 'Settings → Apps offers the Community board and the Marketplace (off until switched on)');
ok(A.PARTS.filter(p => p.id === 'board' || p.id === 'market').every(p => p.optIn), 'both are off until an Administrator switches them on');

console.log('Every part registered in the app is a known part');
const modSrc = fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => /^mod-.*\.js$/.test(f)).map(f => read('js/' + f)).join('\n');
const registered = new Set([...modSrc.matchAll(/register\(\s*(?:\w+\s*=\s*)?\{\s*id:\s*'(\w+)'/g)].map(m => m[1]));
ok(A.PARTS.every(p => registered.has(p.id)), 'each part in js/access.js has its module (js/mod-*.js)');
ok(A.APPS.every(a => registered.has(a[0])), 'each app in Settings → Apps has its module');
for (const id of ['board', 'market']) ok(/perm: '\w+\.view'/.test(read('js/mod-' + id + '.js')) && /roles: \[\]/.test(read('js/mod-' + id + '.js')), id + ': opened only by its permission');

console.log('The database rules and their copy keep the same lists');
const rules = read('firestore.rules'), fake = read('tests/fake-firebase.js');
const listIn = s => s.replace(/[\s']/g, '').split(',').filter(Boolean);
const okRoles = (rules.match(/function okRoles\(d\) \{\s*return d\.get\('roles', \[\]\)\.hasOnly\(\[([^\]]*)\]\)/) || [])[1];
ok(okRoles && listIn(okRoles).join() === A.ROLE_IDS.join(), 'firestore.rules: the roles (okRoles)');
const staff = (rules.match(/function staff\(\) \{ return isRole\(\[([^\]]*)\]\)/) || [])[1];
ok(staff && listIn(staff).join() === A.STAFF_ROLES.join(), 'firestore.rules: the staff roles');
const abil = (rules.match(/\/\/ Abilities: ([a-z, ]+)\./) || [])[1];
ok(abil && listIn(abil).join() === A.abilityIds().join(), 'firestore.rules: the Pastors’ abilities');
const usedMay = new Set([...rules.matchAll(/may\('(\w+)'\)/g)].map(m => m[1]));
ok([...usedMay].every(x => A.abilityIds().includes(x)), 'firestore.rules checks no ability Settings doesn’t offer' + ([...usedMay].filter(x => !A.abilityIds().includes(x)).join(' ')));
const attOnly = (rules.match(/attendeeCan\.hasOnly\(\[([^\]]*)\]\)/) || [])[1];
ok(attOnly && listIn(attOnly).join() === A.ATTENDEE_OPTIONS.join(), 'firestore.rules: what attendees may be allowed');
const attDefaults = [...rules.matchAll(/get\('attendeeCan', \[([^\]]*)\]\)/g)].map(m => listIn(m[1]).join());
ok(attDefaults.length >= 2 && attDefaults.every(x => x === A.ATTENDEE_CAN.join()), 'firestore.rules: what attendees may do until the church chooses');
const fakeAny = (fake.match(/var ANY = \[([^\]]*)\], STAFF = \[([^\]]*)\]/) || []);
ok(fakeAny[1] && listIn(fakeAny[1]).join() === A.ROLE_IDS.join() && listIn(fakeAny[2]).join() === A.STAFF_ROLES.join(), 'tests/fake-firebase.js: the roles');
ok((fake.match(/on = Array\.isArray\(on\) \? on : \[([^\]]*)\]/) || [])[1] !== undefined && listIn(fake.match(/on = Array\.isArray\(on\) \? on : \[([^\]]*)\]/)[1]).join() === A.ATTENDEE_CAN.join(), 'tests/fake-firebase.js: what attendees may do until the church chooses');
ok(/\['names', 'directory', 'write', 'reply'\]/.test(fake) && A.ATTENDEE_OPTIONS.join() === 'names,directory,write,reply', 'tests/fake-firebase.js: what attendees may be allowed');
ok(/match \/subscription\/\{\w+\} \{ allow read, write: if false; \}/.test(rules), 'firestore.rules: subscription has its section, closed until built');
for (const c of ['board', 'market']) ok(new RegExp('match /' + c + '/\\{id\\} \\{\\s*allow read: if seesItem\\(\'' + c + '\'').test(rules) && fake.includes(c + ': communityPolicy(\'' + c + '\')'), 'firestore.rules and its copy: ' + c + ' is open to whom js/access.js says (seesItem, keepsPart)');
// Keepers: the first ones (js/access.js JOBS.keepers defaults) are the Administrators, the Pastors and settings rosterExtra – as in the rules
ok(/isRole\(\['admin', 'pastor'\]\) \|\| \(meIn\(st\.get\('rosterExtra', \[\]\)\)/.test(rules) && /is\(c, \['admin', 'pastor'\]\) \|\| meIn\(c, st\.rosterExtra \|\| \[\]\)/.test(fake), 'firestore.rules and its copy: the first keepers match js/access.js');
ok(/communityPerson\(\) \{ return anyone\(\) && !attendee\(\); \}/.test(rules) && A.PARTS.filter(p => p.id === 'board' || p.id === 'market').every(p => p.perms[p.id + '.view'].kinds.join() === A.NOT_ATTENDEES.join()), 'never attendees, in the rules as in js/access.js');

console.log(fails ? `\n${fails} FAILED` : '\nAll passed');
process.exit(fails ? 1 : 0);
