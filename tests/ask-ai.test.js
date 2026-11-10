/* Tests for js/ask-ai.js (Ask in your own words, with AI): what is sent, and how the AI's answer is checked.
 * Run: node tests/ask-ai.test.js */
'use strict';
const AI = require('../js/ask-ai.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }
const F = [
  { key: 'name', en: 'Name', type: 'text' }, { key: 'firstName', en: 'First name', type: 'text' },
  { key: 'household', en: 'Household', type: 'list', options: ['Tim & Clare Jacobs', 'Naidoo family'] },
  { key: 'category', en: 'Category', type: 'choice', options: ['Church Partner', 'Attender'] },
  { key: 'gender', en: 'Gender', type: 'choice', options: ['Male', 'Female'] },
  { key: 'age', en: 'Age', type: 'number' }, { key: 'birthday', en: 'Birthday', type: 'anniv' }, { key: 'added', en: 'Date added', type: 'date' },
  { key: 'spouse', en: 'Spouse or partner', type: 'text' }, { key: 'spouseCategory', en: 'Spouse or partner’s category', type: 'choice', options: ['Church Partner', 'Attender'] },
  { key: 'careGroup', en: 'Care group', type: 'list', options: ['Hilton North'] }, { key: 'volunteer', en: 'Volunteer', type: 'yesno' }
];
const SLOTS = [{ id: '10:00', label: '10am', time: '10:00' }, { id: '17:00', label: '5pm', time: '17:00' }];
const ctx = { today: '2026-11-10', services: true, slots: SLOTS, slotLabel: id => (SLOTS.find(s => s.id === id) || {}).label, positions: ['Sound desk'],
  people: [{ id: 'p1', names: ['Andy Pike', 'Andrew Pike'] }], words: { partner: ['Parishioner', 'Parishioners'] } };
const fl = r => r.filters.map(x => x.field + ' ' + x.op + (x.value ? ' ' + x.value : '') + (x.value2 ? '–' + x.value2 : '') + (x.unit ? ' ' + x.unit : '')).join(' | ');

console.log('What is sent');
const body = AI.request('all men who are church partners whose wives are not church partners', F, ctx), sent = JSON.stringify(body);
ok(body.contents[0].parts[0].text.includes('whose wives are not church partners') && body.generationConfig.responseMimeType === 'application/json', 'the question and a JSON answer are asked for');
ok(!sent.includes('Tim & Clare Jacobs') && !sent.includes('Naidoo family'), 'household names are never sent');
ok(!sent.includes('Andy Pike'), 'no one’s name from the church is sent');
ok(sent.includes('Hilton North') && sent.includes('Church Partner') && sent.includes('Sound desk'), 'choices, care group names and positions are sent');
ok(sent.includes('Parishioner'), 'the church’s own word is sent');

console.log('Checking the answer');
let r = AI.check({ kind: 'people', filters: [{ field: 'gender', op: 'eq', value: 'male' }, { field: 'category', op: 'eq', value: 'Church Partner' },
  { field: 'spouse', op: 'nempty' }, { field: 'spouseCategory', op: 'ne', value: 'Church Partner' }], match: 'all', notUnderstood: [] }, F, ctx);
ok(fl(r) === 'gender eq Male | category eq Church Partner | spouse nempty | spouseCategory ne Church Partner' && r.ai && !r.unknown.length, 'a good answer is kept, choices spelt as the church does: ' + fl(r));
r = AI.check({ kind: 'people', filters: [{ field: 'idNumber', op: 'empty' }, { field: 'pastoralNotes', op: 'has', value: 'x' }, { field: 'age', op: 'gt', value: '60' }] }, F, ctx);
ok(fl(r) === 'age gt 60' && r.refused.join() === 'idNumber,pastoralNotes', 'fields this person can’t search on are refused, not used');
r = AI.check({ kind: 'people', filters: [{ field: 'category', op: 'eq', value: 'Elder' }, { field: 'age', op: 'gt', value: 'sixty' }, { field: 'gender', op: 'starts', value: 'm' }] }, F, ctx);
ok(!r.filters.length && r.unknown.length === 3, 'a made-up choice, a word for a number and an op the field doesn’t have are dropped and reported');
r = AI.check({ kind: 'people', filters: [{ field: 'birthday', op: 'next', value: '2', unit: 'weeks' }, { field: 'added', op: 'between', value: '2026-01-01', value2: '2026-02-30' }, { field: 'birthday', op: 'month', value: '4' }] }, F, ctx);
ok(fl(r) === 'birthday next 2 weeks | birthday month 4', 'next 2 weeks and April kept; an impossible date dropped: ' + fl(r));
r = AI.check({ kind: 'people', filters: [{ field: 'category', op: 'eq', value: 'Church Partner' }, { field: 'category', op: 'eq', value: 'Attender' }, { field: 'volunteer', op: 'yes' }], match: 'logic', logic: '(1 or 2) and 3' }, F, ctx);
ok(r.match === 'logic' && r.logic === '(1 OR 2) AND 3', 'its logic is kept when it fits the filters');
r = AI.check({ kind: 'people', filters: [{ field: 'volunteer', op: 'yes' }], match: 'logic', logic: '1 OR 4; drop table' }, F, ctx);
ok(r.match === 'all' && !r.logic, 'logic that doesn’t fit falls back to “all”');
r = AI.check({ kind: 'people', filters: [{ field: 'firstName', op: 'starts', value: 'M' }], notUnderstood: ['blue-eyed'] }, F, ctx);
ok(fl(r) === 'firstName starts M' && r.unknown.join() === 'blue-eyed', 'words it couldn’t use are shown');

console.log('Services');
r = AI.check({ kind: 'services', services: { from: '2026-11-12', to: '2027-02-02', slots: ['10am'], gaps: 'some', personName: 'andrew pike', missingPos: ['Sound desk', 'Juggling'] } }, F, ctx);
ok(r.kind === 'services' && r.q.from === '2026-11-12' && r.q.slots.join() === '10:00' && r.q.gaps === 'some' && r.q.personId === 'p1' && r.q.missingPos.join() === 'Sound desk' && r.unknown.join() === 'Juggling', 'services: dates, 10am, gaps, the person matched here, an unknown position reported');
r = AI.check({ kind: 'services', services: { personName: 'Bob Smith' } }, F, ctx);
ok(r.noPerson === 'Bob Smith' && r.q.from === '2026-11-10', 'someone not in the church is said; no dates means from today');
r = AI.check({ kind: 'services', services: {} }, F, Object.assign({}, ctx, { services: false }));
ok(r.refused.join() === 'services', 'services refused for someone who can’t see the rosters');

console.log('Reading Gemini’s reply');
ok(AI.read({ candidates: [{ content: { parts: [{ text: '```json\n{"kind":"people","filters":[]}\n```' }] } }] }).kind === 'people', 'JSON is read, even wrapped in a code block');
ok(AI.read({ candidates: [] }) === null && AI.read({ candidates: [{ content: { parts: [{ text: 'Sorry' }] } }] }) === null, 'anything else is null (then the built-in rules are used)');

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); } else console.log('\nAll AI search tests passed');
