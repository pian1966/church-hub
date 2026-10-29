/* Tests for js/privacy-law.js. Run: node tests/privacy-law.test.js */
'use strict';
const L = require('../js/privacy-law.js'), C = require('../js/countries.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const za = L.forChurch({});
ok(za.short === 'POPIA' && za.officer === 'Information Officer' && za.regulator === 'Information Regulator' && za.register && za.days === 30, 'South Africa (and a church with no country yet): POPIA, Information Officer, Information Regulator');
const de = L.forCountry('DE'), ie = L.forCountry('IE');
ok(de.short === 'GDPR' && /72 hours/.test(de.breach) && /church data protection law/.test(de.regulator), 'Germany: GDPR, 72 hours, and a note on church data protection law');
ok(ie.regulator === 'Data Protection Commission' && /Data Protection Commission/.test(ie.breach), 'Ireland names its own regulator in the breach advice');
ok(L.forCountry('GB').regulator.includes('ICO') && L.forCountry('GB').short === 'UK GDPR', 'UK: UK GDPR and the ICO');
ok(L.forCountry('KE').regulator.includes('ODPC') && L.forCountry('BR').short === 'LGPD' && /3 working days/.test(L.forCountry('BR').breach) && /24 hours/.test(L.forCountry('ZW').breach), 'Kenya, Brazil and Zimbabwe have their own laws');
ok(L.forCountry('NA').key === 'general' && L.forCountry('NA').officer === 'Privacy lead', 'a country without its own entry gets general wording');
const all = C.all().map(c => L.forCountry(c.code));
ok(all.every(l => l.short && l.name && l.officer && l.regulator && l.breach && l.days > 0 && l.copyRight), 'every country has complete privacy wording');
ok(Object.values(L.LAWS).every(l => l.length === 8), 'every law lists all its parts');

if (fails) { console.log('\n' + fails + ' privacy law test(s) FAILED'); process.exit(1); }
console.log('\nAll privacy law tests passed');
