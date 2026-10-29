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

console.log('Couples and wedding anniversaries');
{
  const W = d => [{ label: 'Wedding anniversary', date: d }];
  const P = [
    // h1: a married couple; only Karen has the anniversary
    { id: 'brian', firstName: 'Brian', lastName: 'Fourie', familyId: 'h1', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1975-03-12' },
    { id: 'karen', firstName: 'Karen', lastName: 'Fourie', familyId: 'h1', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1978-07-01', keyDates: W('2001-04-21') },
    { id: 'kidf', firstName: 'Mia', lastName: 'Fourie', familyId: 'h1', familyRole: 'child' },
    // h2: grandparents plus their married son and his wife (wife has a different surname)
    { id: 'gpa', lastName: 'Smith', familyId: 'h2', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1950-01-01', keyDates: W('1972-06-10') },
    { id: 'gma', lastName: 'Smith', familyId: 'h2', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1952-01-01' },
    { id: 'son', lastName: 'Smith', familyId: 'h2', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1980-01-01', keyDates: W('2010-02-14') },
    { id: 'dil', lastName: 'Jones', familyId: 'h2', familyRole: 'adult', maritalStatus: 'Married', birthDate: '1982-01-01', keyDates: W('2010-02-14') },
    // h3: married, partner's status not recorded, same surname
    { id: 'tom', lastName: 'Nkosi', familyId: 'h3', familyRole: 'adult', maritalStatus: 'Married', keyDates: W('2015-09-05') },
    { id: 'zan', lastName: 'Nkosi', familyId: 'h3', familyRole: 'adult', maritalStatus: '' },
    // h4: married woman living with her single brother – not a couple
    { id: 'sis', lastName: 'Botha', familyId: 'h4', familyRole: 'adult', maritalStatus: 'Married', keyDates: W('2012-01-01') },
    { id: 'bro', lastName: 'Botha', familyId: 'h4', familyRole: 'adult', maritalStatus: 'Single' },
    // h5: both married with different dates; h6: a widow whose husband died
    { id: 'x1', lastName: 'Zulu', familyId: 'h5', familyRole: 'adult', maritalStatus: 'Married', keyDates: W('2000-01-01') },
    { id: 'x2', lastName: 'Zulu', familyId: 'h5', familyRole: 'adult', maritalStatus: 'Married', keyDates: W('2000-01-02') },
    { id: 'w1', lastName: 'Pike', familyId: 'h6', familyRole: 'adult', maritalStatus: 'Married', keyDates: W('1990-01-01') },
    { id: 'w2', lastName: 'Pike', familyId: 'h6', familyRole: 'adult', maritalStatus: 'Married', deceasedAt: '2026-01-01' },
    // h7: partners (one not recorded yet); h8: one Married, one Partner - not paired
    { id: 'pa', lastName: 'Dube', familyId: 'h7', familyRole: 'adult', maritalStatus: 'Partner', keyDates: W('2019-05-05') },
    { id: 'pb', lastName: 'Dube', familyId: 'h7', familyRole: 'adult', maritalStatus: 'Not known' },
    { id: 'm1', lastName: 'Shah', familyId: 'h8', familyRole: 'adult', maritalStatus: 'Married' },
    { id: 'm2', lastName: 'Shah', familyId: 'h8', familyRole: 'adult', maritalStatus: 'Partner' }
  ];
  const F = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'].map(id => ({ id }));
  const cs = HS.couples(P, F), find = (a, b) => cs.filter(c => [c.a, c.b].sort().join() === [a, b].sort().join())[0];
  const fk = find('brian', 'karen');
  ok(fk && fk.sure && fk.copy && fk.copy.from === 'karen' && fk.copy.to === 'brian' && fk.copy.date === '2001-04-21', 'the only two adults: a sure couple, and Karen’s anniversary is suggested for Brian');
  ok(find('son', 'dil') && find('gpa', 'gma') && !find('son', 'gma') && !find('gpa', 'son'), 'several married adults: paired by the same anniversary, surname and age (not parent with son)');
  ok(find('gpa', 'gma').copy.to === 'gma' && !find('gpa', 'gma').sure && !find('son', 'dil').copy, 'grandparents: copy to Granny (a likely couple); son and wife already match');
  const nk = find('tom', 'zan');
  ok(nk && nk.kind === 'spouse' && nk.mark.id === 'zan' && nk.mark.status === 'Married' && nk.copy.to === 'zan', 'partner with no marital status: suggest marking them married and copying the date');
  ok(!find('sis', 'bro'), 'a married person and their single brother are not a couple');
  ok(find('x1', 'x2') && find('x1', 'x2').differ && !find('x1', 'x2').copy, 'different anniversaries are flagged, nothing copied');
  ok(!cs.some(c => c.a === 'w2' || c.b === 'w2'), 'someone who has died is never suggested');
  const pd = find('pa', 'pb');
  ok(pd && pd.kind === 'partner' && !pd.copy && !pd.differ && pd.mark.id === 'pb' && pd.mark.status === 'Partner', 'partners: suggested as partners, no anniversary copied');
  ok(!find('m1', 'm2'), 'one Married and one Partner are not paired (statuses disagree)');
  ok(find('brian', 'karen').kind === 'spouse', 'married couples are spouses');
  const F2 = F.map(f => f.id === 'h1' ? { id: 'h1', notCouples: [HS.pairKey('karen', 'brian')] } : f);
  ok(!HS.couples(P, F2).some(c => c.a === 'brian' || c.b === 'brian'), '“not a couple” is remembered');
  ok(HS.couplesToCheck(P, F).some(c => c.a === 'son' || c.b === 'son'), 'to check: couples not yet confirmed, even with nothing to fix');
  const F3 = F.map(f => f.id === 'h2' ? { id: 'h2', couples: [HS.pairKey('son', 'dil'), HS.pairKey('gpa', 'gma')] } : f);
  const c3 = HS.couples(P, F3), sd = c3.find(c => [c.a, c.b].sort().join() === 'dil,son');
  ok(sd.confirmed && sd.sure && !HS.couplesToCheck(P, F3).some(c => c.a === 'son' || c.b === 'son'), 'a confirmed couple is certain and drops off the list');
  ok(HS.couplesToCheck(P, F3).some(c => [c.a, c.b].sort().join() === 'gma,gpa'), '…unless there’s still something to fix (Granny’s anniversary)');
}

console.log('Late spouses: who a widow or widower was probably married to');
{
  const W = d => [{ label: 'Wedding anniversary', date: d }];
  const P = [
    { id: 'elsa', firstName: 'Elsa', lastName: 'van der Merwe', familyRole: 'adult', familyId: 'h1', maritalStatus: 'Widowed', birthDate: '1950-03-01', keyDates: W('1975-06-07') },
    { id: 'johan', firstName: 'Johan', lastName: 'van der Merwe', familyRole: 'adult', familyId: 'h1', maritalStatus: 'Married', birthDate: '1948-01-01', deceasedAt: '2026-02-02', keyDates: W('1975-06-07') },
    { id: 'ruth', firstName: 'Ruth', lastName: 'Smith', familyRole: 'adult', familyId: 'h2', maritalStatus: 'Widowed', email: 'smiths@example.com', birthDate: '1945-01-01' },
    { id: 'bob', firstName: 'Bob', lastName: 'Smith', familyRole: 'adult', familyId: '', email: 'SMITHS@example.com', deceasedAt: '2019-05-05' },
    { id: 'tom', firstName: 'Tom', lastName: 'Smith', familyRole: 'adult', familyId: '', birthDate: '1990-01-01', deceasedAt: '2021-01-01' },
    { id: 'ann', firstName: 'Ann', lastName: 'Jones', familyRole: 'adult', familyId: 'h3', maritalStatus: 'Married', deceasedAt: '2024-01-01', mobile: '082 111 2222' },
    { id: 'ben', firstName: 'Ben', lastName: 'Jones', familyRole: 'adult', familyId: '', maritalStatus: 'Married', deceasedAt: '2020-01-01', mobile: '+27 82 111 2222' },
    { id: 'kid', firstName: 'Kid', lastName: 'Smith', familyRole: 'child', familyId: 'h2', deceasedAt: '2010-01-01' },
    { id: 'lone', firstName: 'Lone', lastName: 'Ndlovu', familyRole: 'adult', familyId: 'h9', maritalStatus: 'Widowed' }
  ];
  const dead = p => !!p.deceasedAt;
  const s = HS.lateSpouseSuggestions(P, dead), pair = (a, b) => s.find(x => x.a === a && x.b === b);
  ok(pair('elsa', 'johan') && pair('elsa', 'johan').reasons.includes('same household') && pair('elsa', 'johan').reasons.includes('same wedding date'), 'a widow is matched with the husband in her household with the same wedding date');
  ok(pair('ruth', 'bob') && pair('ruth', 'bob').reasons.join() === 'same email,same surname', 'a widow matched by a shared email and surname (not to the much younger Tom Smith)');
  ok(!s.some(x => x.b === 'tom'), 'someone 45 years younger isn’t suggested');
  ok(s.some(x => [x.a, x.b].sort().join() === 'ann,ben' && x.bothDied), 'two people who have both died can be suggested (same phone and surname)');
  ok(!s.some(x => x.b === 'kid' || x.a === 'kid') && !s.some(x => x.a === 'lone'), 'children never; no suggestion without enough clues');
  ok(s.every(x => s.filter(y => [y.a, y.b].includes(x.a) || [y.a, y.b].includes(x.b)).length === 1), 'each person in at most one suggestion');
  const P2 = P.map(p => p.id === 'elsa' ? Object.assign({}, p, { notLateSpouse: ['johan'] }) : p.id === 'ruth' ? Object.assign({}, p, { lateSpouseSet: true }) : p);
  const s2 = HS.lateSpouseSuggestions(P2, dead);
  ok(!s2.some(x => x.a === 'elsa' && x.b === 'johan') && !s2.some(x => x.a === 'ruth'), '“not a couple” and people an Administrator already settled are left out');
  const P3 = P.map(p => p.id === 'elsa' ? Object.assign({}, p, { lateSpouseId: 'johan' }) : p);
  ok(!HS.lateSpouseSuggestions(P3, dead).some(x => x.b === 'johan'), 'someone already named as a late spouse isn’t suggested again');
  // A widow in her own household, and her husband who died married (Elvanto often keeps them apart)
  const P4 = [
    { id: 'gwen', firstName: 'Gwen', lastName: 'Mcfarlane', familyRole: 'adult', familyId: 'g1', maritalStatus: 'Widowed' },
    { id: 'nigel', firstName: 'Nigel', lastName: 'McFarlane', familyRole: 'adult', familyId: 'g2', maritalStatus: 'Married', deceasedAt: '2023-04-04' },
    { id: 'stan', firstName: 'Stan', lastName: 'Pike', familyRole: 'adult', familyId: 'g3', maritalStatus: 'Married' },
    { id: 'sue', firstName: 'Sue', lastName: 'Pike', familyRole: 'adult', familyId: 'g3', maritalStatus: 'Married', deceasedAt: '2025-01-01' },
    { id: 'jo', firstName: 'Jo', lastName: 'Dube', familyRole: 'adult', familyId: 'g4', maritalStatus: 'Married' },
    { id: 'al', firstName: 'Al', lastName: 'Dube', familyRole: 'adult', familyId: 'g4', maritalStatus: 'Married' },
    { id: 'old', firstName: 'Old', lastName: 'Dube', familyRole: 'adult', familyId: '', maritalStatus: 'Married', deceasedAt: '2000-01-01' }
  ];
  const s4 = HS.lateSpouseSuggestions(P4, dead), g = s4.find(x => x.a === 'gwen');
  ok(g && g.b === 'nigel' && g.reasons.includes('same surname') && g.reasons.includes('widowed, and they died married'), 'a widow and a man of her surname who died married are suggested, even in different households (any capitals)');
  const st = s4.find(x => x.a === 'stan');
  ok(st && st.b === 'sue' && st.stillMarried && st.reasons.includes('still recorded as Married'), 'someone still recorded as Married whose spouse has died is suggested (to change to Widowed)');
  ok(!s4.some(x => x.a === 'jo' || x.a === 'al'), 'not someone whose married partner is alive in their household');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll household tests passed');
process.exit(fails ? 1 : 0);
