// Run: node tests/households.test.js – households and the adults responsible for children.
const HS = require('../js/households.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const people = [
  { id: 'mum', familyRole: 'adult', familyId: 'h1' }, { id: 'dad', familyRole: 'adult', familyId: 'h2' }, { id: 'step', familyRole: 'adult', familyId: 'h1' },
  { id: 'kid', familyRole: 'child', familyId: 'h1', householdIds: ['h2'] }, { id: 'lone', familyRole: 'child', familyId: '' },
  { id: 'gone', familyRole: 'adult', familyId: 'h1', active: false }
];
console.log('Households');
ok(HS.householdsOf(people[3]).join() === 'h1,h2', 'a child of separated parents lives in both homes');
ok(HS.inHousehold(people[3], 'h2') && !HS.inHousehold(people[0], 'h2'), 'in a household by main home or extra home');

console.log('Suggested parents (upgrade)');
const sug = HS.suggestedLinks(people, []);
ok(sug.filter(l => l.childId === 'kid').map(l => l.adultId).sort().join() === 'dad,mum,step', 'the adults of every home the child lives in (not someone who has left)');
ok(sug.every(l => !l.confirmed && l.canConsent), 'unconfirmed, so a person checks them (e.g. the step-parent shouldn’t consent)');
ok(HS.suggestedLinks(people, [{ childId: 'kid', adultId: 'mum' }]).every(l => l.childId !== 'kid'), 'children who already have links are left alone');

console.log('Who can consent, and what needs doing');
const links = [
  { childId: 'kid', adultId: 'mum', relationship: 'Mother', canConsent: true, confirmed: true },
  { childId: 'kid', adultId: 'step', relationship: 'Step-parent', canConsent: false, confirmed: false },
  { childId: 'kid', adultId: '', name: 'Granny', relationship: 'Trusted collector', canConsent: true, confirmed: true }
];
ok(HS.consentAdults('kid', links).map(l => l.adultId).join() === 'mum', 'only adults in Church Hub marked “can give consent”');
const nd = HS.needs(people, links);
ok(nd.noConsenter.map(c => c.id).join() === 'lone' && nd.unconfirmed.map(c => c.id).join() === 'kid', 'to-dos: a child with nobody to consent; links still to confirm');
ok(HS.defaultsFor('Step-parent').canConsent === false && HS.defaultsFor('Legal guardian').canConsent === true && HS.defaultsFor('Trusted collector').mayCollect, 'sensible defaults per relationship');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll household tests passed');
process.exit(fails ? 1 : 0);
