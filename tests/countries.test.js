/* Tests for js/countries.js. Run: node tests/countries.test.js */
'use strict';
const C = require('../js/countries.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const all = C.all();
ok(all.length >= 40 && all.every(c => c.name && c.continent && c.regionLabel && c.postcodeLabel && /^\d+$/.test(c.dial)), 'every country has a name, continent, region and postcode wording, and a dialling code (' + all.length + ')');
ok(all.every(c => !c.regions || (c.regions.length && new Set(c.regions).size === c.regions.length)), 'no region list is empty or has a name twice');
const unsorted = all.filter(c => c.regions && c.regions.join('|') !== c.regions.slice().sort((a, b) => a.localeCompare(b)).join('|'));
ok(!unsorted.length, 'region lists are A–Z' + (unsorted.length ? ': ' + unsorted.map(c => c.code).join(', ') : ''));
const count = code => C.find(code).regions.length;
ok(count('ZA') === 9 && count('US') === 51 && count('CA') === 13 && count('AU') === 8 && count('KE') === 47 && count('NG') === 37 && count('DE') === 16 && count('BR') === 27 && count('IE') === 26 && count('MX') === 32 && count('CH') === 26 && count('IT') === 20,
  'the right number of provinces, states and counties (ZA 9, US 50 + DC, Canada 13, Kenya 47, Nigeria 36 + FCT…)');
ok(C.find('ZA').name === 'South Africa' && C.find('south africa').code === 'ZA' && C.find('RSA').code === 'ZA' && C.find('uk').code === 'GB' && C.find('USA').code === 'US' && C.find('Deutschland').code === 'DE' && C.find('Brasil').code === 'BR', 'found by code, name or the other names people type');
ok(C.find('Atlantis') === null && C.find('') === null, 'an unknown country is null');
ok(C.church({}).code === 'ZA' && C.church({ country: 'KE' }).code === 'KE', 'the church is in South Africa until Settings says otherwise');
ok(C.ofAddress({ country: 'Kenya' }, {}).code === 'KE' && C.ofAddress({ street: '1 Main Rd' }, { country: 'GB' }).code === 'GB' && C.ofAddress({ country: 'Atlantis' }, {}) === null, 'an address uses its own country, or the church’s when it has none');
ok(C.find('US').postcodeLabel === 'ZIP code' && C.find('IE').postcodeLabel === 'Eircode' && C.find('ZA').regionLabel === 'Province' && C.find('US').regionLabel === 'State' && C.find('GB').regionLabel === 'County' && C.find('GB').regions === null, 'the wording follows the country (ZIP code, Eircode, State, County)');
ok(C.region('kzn', 'ZA') === 'KwaZulu-Natal' && C.region('Kwazulu Natal', 'ZA') === 'KwaZulu-Natal' && C.region('NSW', 'AU') === 'New South Wales' && C.region('tx', 'US') === 'Texas' && C.region('quebec', 'CA') === 'Quebec' && C.region('Somewhere', 'ZA') === 'Somewhere', 'regions tidied as typed (KZN, NSW, TX); anything else kept');
ok(C.find('ZA').law === 'popia' && C.find('DE').law === 'gdpr' && C.find('GB').law === 'ukgdpr' && C.find('NA').law === 'general', 'each country names its privacy law');
ok(C.grouped().map(g => g.continent).join() === 'Africa,Europe,Americas,Oceania' && C.grouped().reduce((n, g) => n + g.countries.length, 0) === all.length, 'grouped by continent');
ok(C.phoneKey('+27 82 000 1234') === C.phoneKey('082 000 1234') && C.phoneKey('+44 7700 900123') === C.phoneKey('07700 900123') && C.phoneKey('123') === '', 'phone numbers compare across ways of writing them');

if (fails) { console.log('\n' + fails + ' country test(s) FAILED'); process.exit(1); }
console.log('\nAll country tests passed');
