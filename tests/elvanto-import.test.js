// Run: node tests/elvanto-import.test.js – reading a (made-up) Elvanto People export laid out like the church's real one.
const fs = require('fs'), path = require('path');
const E = require('../js/elvanto-import.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const rows = E.parseCSV(fs.readFileSync(path.join(__dirname, 'fixtures', 'elvanto-people.csv'), 'utf8'));
const head = rows[0], m = E.guess(head), col = k => head[m[k]];

console.log('Choosing the right columns');
ok(col('id') === 'Member ID', 'Elvanto’s person reference: Member ID');
ok(col('relationship') === 'Family Relationship', 'relationship from “Family Relationship”, not “Family Member Names & Relationships”');
ok(col('family') === 'Primary & Spouse Full Names', 'families from “Primary & Spouse Full Names” (no Family ID in this export)');
ok(col('lastName') === 'Last Name' && col('email') === 'Email Address' && col('category') === 'People Category', 'names, email and category');
ok(!Object.values(m).some(i => /ID Number|Security|Notes|Gender/.test(head[i])), 'ID numbers, security codes, notes and gender are never read');

console.log('Reading the people');
const recs = E.records(rows.slice(1), m, '2026-10-26'), by = n => recs.find(r => r.firstName === n);
ok(recs.length === 11, 'all 11 rows read');
ok(!by('Brian').child && !by('Karen').child, 'parents of children are adults (the old importer made them children)');
ok(by('Mia').child && by('Leo').child, 'children: Mia by age, Leo by relationship (no birthday)');
ok(!by('Anna').child, 'a grown-up “Child” (26) is an adult');
ok(by('Brian').birthDate === '1975-03-12' && by('Sipho').birthDate === '' && by('Sipho').birthDay === '06-04', 'birthdays “12 March, 1975”; “4 June” kept as day and month');
ok(by('Grace').marital === 'Partner', 'marital status “Partner” understood');
ok(by('Brian').family && by('Brian').family === by('Leo').family && !by('Sipho').family && !by('Grace').family, 'family members grouped; single people aren’t a “family of one”');

console.log('Matching (empty Church Hub)');
const pl = E.plan(recs, []);
ok(pl.added === 11 && pl.updated === 0, 'everyone added – nobody merged, though the Fouries and Naidoos share an email');
ok(pl.families === 2 && pl.sharedEmails === 2, '2 families; 2 shared email addresses reported');

console.log('Categories');
ok(E.guessCategory('CCH NON Member_Partner') === 'Attender' && E.guessCategory('CCH_OFFICIAL_Member_Partner') === 'Church Partner', 'non-members → Attender, official members/partners → Church Partner');
ok(E.guessCategory('Visiting Preacher_Guest') === 'Visiting Minister' && E.guessCategory('Legacy') === 'Former member', 'visiting preachers → Visiting Minister, legacy → Former member');

console.log('Making the people');
const p = E.toPerson(by('Peter'), null, {}, '', '2026-10-26');
ok(p.active === false && p.category === 'Deceased' && p.deceasedAt === '2026-02-02', 'Deceased in Elvanto → recorded as died, with the date');
const o = E.toPerson(by('Old'), null, {}, '', '2026-10-26');
ok(o.active === false && o.category === 'Former member', 'Archived in Elvanto → marked as left');
ok(E.toPerson(by('Mia'), null, {}, 'f1', '2026-10-26').maritalStatus === undefined, 'children get no marital status');

console.log('Importing again');
const people = recs.map((r, i) => ({ id: 'p' + i, firstName: r.firstName, lastName: r.lastName, preferredName: r.preferredName, email: r.email, elvantoId: r.id }));
const again = E.plan(recs, people);
ok(again.added === 0 && again.updated === 11 && again.items.every(x => x.how === 'Elvanto ID'), 'everyone matched by Elvanto ID – nothing doubled');
// After the old importer: Brian's record was overwritten by Karen, then Mia (same email), and had no Elvanto ID
const damaged = [{ id: 'x1', firstName: 'Mia', lastName: 'Fourie', email: 'fourie.family@example.com' }];
const fix = E.plan(recs, damaged);
ok(fix.items.find(x => x.rec.firstName === 'Mia').personId === 'x1' && fix.items.filter(x => x.personId).length === 1, 'a merged record is matched to one person only; the others are added');

ok(E.plan(recs, [{ id: 'h1', firstName: 'Priya', lastName: 'Naidoo', email: 'priya.own@example.com' }]).items.find(x => x.rec.firstName === 'Priya').personId === 'h1', 'someone added by hand with their own email is matched by name');
ok(E.plan(recs, [{ id: 'h2', firstName: 'Priya', lastName: 'Naidoo', email: 'x@example.com', elvantoId: 'other' }]).items.find(x => x.rec.firstName === 'Priya').personId === null, 'but not someone already linked to a different Elvanto person');

console.log('Parents from Elvanto families');
const ids = {}; recs.forEach((r, i) => { ids[r.row] = 'p' + i; });
const gl = E.guardianLinks(recs, ids), idOf = n => ids[by(n).row];
ok(gl.filter(l => l.childId === idOf('Mia')).map(l => l.adultId).sort().join() === [idOf('Brian'), idOf('Karen')].sort().join(), 'Mia’s parents: the Primary and the Spouse of her Elvanto family');
ok(gl.every(l => l.canConsent && l.mayCollect && !l.confirmed), 'they may consent and collect – to be confirmed by a person');
ok(!gl.some(l => l.childId === idOf('Anna')), 'a grown-up “Child” gets no parents linked');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll Elvanto import tests passed');
process.exit(fails ? 1 : 0);
