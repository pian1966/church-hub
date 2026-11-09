/* Tests for People directory search matching (partial search over personal information).
   Run: node tests/directory-search.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fails = 0;
function check(ok, msg) {
  if (ok) {
    console.log('  ✓ ' + msg);
  } else {
    console.error('  ✗ FAIL: ' + msg);
    fails++;
  }
}

const sandbox = {
  console: console,
  window: { Countries: { church: () => ({ code: 'ZA', dial: '27' }) } },
  Hub: {
    esc: s => s,
    today: () => '2026-11-04',
    names: p => {
      const a = [((p.firstName || '') + ' ' + (p.lastName || '')).trim()];
      const k = p.preferredName ? (p.preferredName + ' ' + (p.lastName || '')).trim() : '';
      if (k && k.toLowerCase() !== a[0].toLowerCase()) a.push(k);
      return a;
    },
    matches: (text, query) => {
      const t = String(text || '').toLowerCase().replace(/\s+/g, ' ');
      const PS = require('../js/people-search.js');
      return PS.words(String(query || '').toLowerCase()).every(w => {
        if (t.indexOf(w) >= 0) return true;
        const alts = PS.alts ? PS.alts(w) : [];
        return alts.some(a => t.indexOf(a) >= 0);
      });
    }
  },
  I18n: {
    t: s => s,
    tn: (s, p, n) => n + ' ' + (n === 1 ? s : p)
  },
  Store: {
    pref: () => 'last',
    settings: () => ({ country: 'ZA' }),
    find: () => [],
    list: () => []
  },
  LeaveCore: {
    iso: d => d.toISOString().slice(0, 10),
    parse: s => new Date(s),
    addDays: (d, n) => new Date(d.getTime() + n * 86400000)
  },
  PrivacyLaw: {
    forChurch: () => ({ short: 'POPIA' })
  },
  PeopleParts: {
    state: {},
    actions: {},
    SORTS: {
      last: { label: 'Surname', cmp: () => 0 }
    },
    age: () => 30,
    canBasic: () => true,
    canDup: () => false,
    canSeeAll: () => false,
    catTags: () => '',
    deceased: () => false,
    familyOf: () => null,
    hasConsent: () => true,
    householdNames: p => (p.household ? [p.household] : []),
    isMe: () => false,
    known: p => p.preferredName || p.firstName,
    lateSuggestions: () => [],
    visiblePeople: () => [],
    seeTier: () => 'member',
    tierSees: f => f === 'mobile' || f === 'email' || f === 'address',
    mayShare: (p, f) => {
      if (p.noConsent) return false;
      return f === 'mobile' || f === 'email' || f === 'address';
    },
    addressLines: p => (p.address ? [p.address] : [])
  }
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'people', 'directory.js'), 'utf8');
vm.runInContext(code, sandbox);

const matchesPerson = sandbox.PeopleParts.matchesPerson;

console.log('Directory search: partial matching of personal information');

const person = {
  firstName: 'Lerato',
  lastName: 'Khumalo',
  preferredName: 'Lolo',
  email: 'lerato.khumalo@example.com',
  mobile: '082 555 1234',
  address: '42 Kloof Street, Gardens',
  household: 'Khumalo family'
};

// Name matching
check(matchesPerson(person, 'Lerato'), 'finds by first name');
check(matchesPerson(person, 'Khumalo'), 'finds by last name');
check(matchesPerson(person, 'Lolo'), 'finds by preferred name');
check(matchesPerson(person, 'ler khu'), 'multi-word partial name query');

// Email matching
check(matchesPerson(person, 'lerato.khumalo'), 'finds by email prefix');
check(matchesPerson(person, 'example.com'), 'finds by email domain');
check(matchesPerson(person, '@example'), 'finds by partial email containing @');

// Mobile number matching
check(matchesPerson(person, '082 555'), 'finds by formatted mobile partial');
check(matchesPerson(person, '082555'), 'finds by unformatted mobile digits');
check(matchesPerson(person, '5551234'), 'finds by partial phone digits (middle/end)');
check(matchesPerson(person, '1234'), 'finds by last 4 phone digits');

// Address matching
check(matchesPerson(person, 'Kloof'), 'finds by street name in address');
check(matchesPerson(person, 'Gardens'), 'finds by suburb in address');

// Household matching
check(matchesPerson(person, 'Khumalo family'), 'finds by household name');

// International and local ways of writing the same number (the church is in South Africa, +27)
const intlPerson = Object.assign({}, person, { mobile: '+27 82 555 1234' });
check(matchesPerson(intlPerson, '082 555'), 'a number saved as +27 82… is found by typing 082…');
check(matchesPerson(intlPerson, '0825551234'), 'the whole local number finds the +27 one');
check(matchesPerson(person, '+27 82 555'), 'typing +27 82… finds a number saved as 082…');
check(matchesPerson(person, '0027 82 555'), 'typing 0027 82… finds it too');
check(!matchesPerson(person, '083 555'), 'a different number does not match');
const ukPerson = Object.assign({}, person, { mobile: '+44 7700 900123' });
check(matchesPerson(ukPerson, '+44 7700'), 'a number from another country is found as written');
check(matchesPerson(person, 'Lerato 082') && !matchesPerson(person, 'Lerato 083'), 'a name and part of a number must both match');

// Non-matching query
check(!matchesPerson(person, 'NonExistentString'), 'does not match unrelated query');

// Permissions / Consent enforcement
const secretPerson = Object.assign({}, person, { noConsent: true });
check(!matchesPerson(secretPerson, '082555'), 'does not match mobile when sharing is not allowed');
check(!matchesPerson(secretPerson, 'example.com'), 'does not match email when sharing is not allowed');
check(!matchesPerson(secretPerson, 'Kloof'), 'does not match address when sharing is not allowed');
check(matchesPerson(secretPerson, 'Lerato'), 'still matches by name when contact details are not shared');

// Punctuation slip and short name / nickname matching
const dougPerson = { firstName: 'Doug', lastName: 'Pike' };
const douglasPerson = { firstName: 'Douglas', lastName: 'Pike' };
check(matchesPerson(dougPerson, 'dougl;as'), 'dougl;as matches a person named Doug');
check(matchesPerson(douglasPerson, 'dougl;as'), 'dougl;as matches a person named Douglas');
check(matchesPerson(dougPerson, 'douglas'), 'douglas matches Doug');
check(matchesPerson(douglasPerson, 'doug'), 'doug matches Douglas');
const billPerson = { firstName: 'William', lastName: 'Botha' };
check(matchesPerson(billPerson, 'bill;'), 'bill; matches William');
check(matchesPerson(billPerson, 'bill'), 'bill matches William');

if (fails) {
  console.log('\n' + fails + ' directory search test(s) FAILED');
  process.exit(1);
}
console.log('\nAll directory search tests passed');
