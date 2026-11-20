/* Tests for js/name-list.js – names from a photo of a paper sign-up sheet (or typed): reading Gemini's answer, matching
 * names to people on the phone, one sign-up per household. Made-up people only. Run: node tests/name-list.test.js */
'use strict';
const N = require('../js/name-list.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const P = (id, f, l, fam, role, pref) => ({ id, firstName: f, lastName: l, familyId: fam || '', familyRole: role || 'adult', preferredName: pref || '' });
const people = [
  P('p1', 'Johannes', 'van der Merwe', 'f1', 'adult', 'Johan'), P('p2', 'Elsa', 'van der Merwe', 'f1'), P('p3', 'Liam', 'van der Merwe', 'f1', 'child'),
  P('p4', 'Thabo', 'Nkosi', 'f2'), P('p5', 'Ayanda', 'Nkosi', 'f2'),
  P('p6', 'Megan', 'Smith', 'f3'), P('p7', 'David', 'Smith', 'f3'), P('p8', 'Dave', 'Smit'),
  P('p9', 'Kavi', 'Govender'), P('p10', 'Zoë', 'O’Brien')
];

console.log('The request to Gemini');
const req = N.request({ data: 'QUJD', mimeType: 'image/jpeg' }, { country: 'South Africa' });
const sent = JSON.stringify(req);
ok(req.contents[0].parts[0].inlineData.data === 'QUJD' && req.generationConfig.responseMimeType === 'application/json', 'the photo goes, asking for JSON');
ok(!/Thabo|Nkosi|Govender|van der Merwe/.test(sent), 'nothing about anyone at church is sent with it');
ok(/Leave out headings/.test(sent) && !/mobile and email/.test(sent), 'for a sign-up sheet it reads names only');
ok(/mobile and email/.test(JSON.stringify(N.request({ data: 'x' }, { contacts: true }))), 'for visitor cards it reads the mobile number and email address too');

console.log('Reading the answer');
const resp = { candidates: [{ content: { parts: [{ text: '```json\n{"names":[{"written":"Thabo Nkosi +2","first":"Thabo","last":"Nkosi","guests":2},{"written":"Bob Bloggs","first":"Bob","last":"Bloggs","crossed":true},' +
  '{"written":"The Smiths","last":"Smith","family":true},{"written":"Mrs","first":"Mrs","last":"Govender"},{"written":"Ann Lee","first":"Ann","last":"Lee","mobile":"082 555 0101","email":"ANN@example.com","guests":99}]}\n```' }] } }] };
const rows = N.rows(N.read(resp));
ok(rows.length === 4 && !rows.some(r => /Bloggs/.test(r.written)), 'crossed-out names are left out');
ok(rows[0].guests === 2 && rows[1].family && rows[2].first === '' && rows[2].last === 'Govender', 'guests, a household, and a title is not a first name');
ok(rows[3].mobile === '082 555 0101' && rows[3].email === 'ann@example.com' && rows[3].guests === 20, 'contact details tidied; guests kept sensible');
ok(N.read({}) === null && N.rows(null).length === 0, 'a broken answer gives nothing, not an error');

console.log('Typed names');
const t = N.fromText('John & Mary Smith\nMr & Mrs Naidoo +2\nThe Jacobs\nSmith, David\n1. Kavi Govender 082 555 1234 kavi@example.com\n\n');
ok(t.length === 7, 'one or two people per line, empty lines ignored');
ok(t[0].first === 'John' && t[0].last === 'Smith' && t[1].first === 'Mary' && t[1].last === 'Smith', '“John & Mary Smith” is two people');
ok(t[2].title === 'Mr' && t[2].last === 'Naidoo' && t[2].guests === 2 && t[3].title === 'Mrs' && t[3].guests === 0, '“Mr & Mrs Naidoo +2”: two people, the guests once');
ok(t[4].family && /Jacobs/.test(t[4].last) && t[5].first === 'David' && t[5].last === 'Smith', 'a household; “Smith, David”');
ok(t[6].first === 'Kavi' && t[6].last === 'Govender' && t[6].mobile === '082 555 1234' && t[6].email === 'kavi@example.com', 'a mobile and an email on the line are picked out');

console.log('Matching to people');
const m = N.match(N.fromText('Johan vd Merwe\nJohan van der Merwe\nThabo Nkosie\nDavid Smith\nDave Smith\nAyanda\nZoe OBrien\nNomsa Dube\nThe Smiths\nNkosi'), people);
ok(m[0].status !== 'sure' || m[0].ids[0] === 'p1', 'a shortened surname is never matched to the wrong person');
ok(m[1].status === 'sure' && m[1].ids.join() === 'p1', 'the name they go by (Johan for Johannes) matches');
ok(m[2].status === 'sure' && m[2].ids.join() === 'p4', 'a slip of the pen (Nkosie) still matches');
ok(m[3].status === 'sure' && m[3].ids.join() === 'p7', 'David Smith is David Smith, not Dave Smit');
ok(m[4].status === 'maybe' && m[4].options.length >= 2, 'Dave Smith could be David Smith or Dave Smit: the person chooses');
ok(m[5].status === 'maybe' && m[5].options[0].join() === 'p5', 'a first name alone is only a suggestion');
ok(m[6].status === 'sure' && m[6].ids.join() === 'p10', 'accents and apostrophes don’t matter');
ok(m[7].status === 'none' && m[7].options.length === 0, 'someone not in People: not found');
ok(m[8].status === 'sure' && m[8].ids.join() === 'p6,p7', '“The Smiths” is the Smith household');
ok(m[9].status === 'maybe' && m[9].options.length === 2, 'a surname alone: the person chooses who');
ok(N.match(N.rows({ names: [{ written: 'Thabo Nkosi', first: 'Thabo', last: 'Nkosi', unsure: true }] }), people)[0].status === 'maybe', 'hard-to-read handwriting is always checked');

console.log('One sign-up per household');
const g = N.group([{ ids: ['p3'], guests: 1 }, { ids: ['p2'], guests: 3 }, { ids: ['p4'] }, { ids: ['p4'] }, { ids: ['p9'], guests: 1 }], people, 2);
ok(g.length === 3, 'three households');
ok(g[0].lead === 'p2' && g[0].people.join() === 'p2,p3' && g[0].guests === 2, 'the adult leads; guests added up but no more than the event allows');
ok(g[1].people.join() === 'p4' && g[2].people.join() === 'p9' && g[2].guests === 1, 'someone written twice counts once');

console.log('Saying a name (what speech recognition hears)');
const ids = (txt, min) => N.rank(txt, people, min).map(h => h.id);
ok(ids('Tabo Kosi')[0] === 'p4', '“Tabo Kosi” sounds like Thabo Nkosi');
ok(ids('Johan Vandermerwe')[0] === 'p1', '“Vandermerwe” is van der Merwe');
ok(ids('Kavvy Govender')[0] === 'p9' && ids('cavey go vendor|Kavi Govender')[0] === 'p9', 'the best of what it thought it heard is used');
ok(ids('Megan').join() === 'p6', 'a first name alone finds them');
ok(ids('Nomsa Dube').length === 0, 'nobody who doesn’t sound like it');
ok(N.sound('Ndlovu') === N.sound('Dlovu') && N.sound('Phillips') === N.sound('Filips'), 'sounds-like: Ndlovu / Dlovu, Phillips / Filips');
const pseudo = N.asPerson('3', 'Ayanda Nkosi (Church Partner)');
ok(pseudo.firstName === 'Ayanda' && pseudo.lastName === 'Nkosi', 'a name in a dropdown can be matched too');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
