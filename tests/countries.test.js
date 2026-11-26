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
ok(C.grouped().map(g => g.continent).join() === 'Africa,Asia,Europe,Americas,Oceania' && C.grouped().reduce((n, g) => n + g.countries.length, 0) === all.length, 'grouped by continent');
ok(C.phoneKey('+27 82 000 1234') === C.phoneKey('082 000 1234') && C.phoneKey('+44 7700 900123') === C.phoneKey('07700 900123') && C.phoneKey('123') === '', 'phone numbers compare across ways of writing them');

ok(C.birthFromId('8001015009087', 'ZA', '2026-11-10') === '1980-01-01' && C.birthFromId('800101 5009 087', 'ZA', '2026-11-10') === '1980-01-01', 'a South African ID number gives the date of birth (spaces are fine)');
ok(C.birthFromId('0505055009086', 'ZA', '2026-11-10') === '2005-05-05', '… born in 2005: this century');
ok(C.birthFromId('8001015009086', 'ZA', '2026-11-10') === '' && C.birthFromId('8002305009087', 'ZA', '2026-11-10') === '' && C.birthFromId('80010150090', 'ZA') === '', 'not when the check digit is wrong, the date doesn’t exist, or it is too short');
ok(C.birthFromId('8001015009087', 'GB', '2026-11-10') === '', 'other countries: not from the number (ask for the birthday)');


console.log('Latitude and longitude');
{
  const g = t => C.parseGps(t);
  ok(g('-29.4833, 30.2333').lat === -29.4833 && g('-29.4833, 30.2333').lng === 30.2333, 'two decimal numbers are read (as copied from Google Maps or Apple Maps)');
  ok(g('-29.4833 30.2333').lat === -29.4833 && g('\u221229.4833,30.2333').lat === -29.4833, 'a space, or a typographic minus sign, works too');
  ok(g('29.4833\u00b0 S, 30.2333\u00b0 E').lat === -29.4833 && g('29.4833 S 30.2333 E').lng === 30.2333, 'S and W make a number negative');
  ok(g('30.2333E 29.4833S').lat === -29.4833 && g('30.2333E 29.4833S').lng === 30.2333, 'longitude first is understood when the letters say so');
  ok(g('-29,4833; 30,2333').lng === 30.2333, 'a comma as the decimal point is understood');
  ok(g('hello').error === 'empty-pair' && g('-29.4833').error === 'empty-pair' && g('1, 2, 3').error === 'empty-pair', 'anything but two numbers is refused');
  ok(g('-29\u00b029\u2032 30\u00b014\u2032').error === 'minutes', 'degrees and minutes are refused with their own message');
  ok(g('95, 30').error === 'swapped' && g('-29, 190').error === 'range' && g('91, 200').error === 'range', 'beyond 90 / 180 is refused (the other way round is named)');
  ok(g('-29.4833, 30.2333').decimals === 4 && g('-29, 30').decimals === 0, 'the number of decimals is counted (too few means only roughly there)');
  ok(C.gpsCheck(-29.4833, 30.2333, 'ZA') === null, 'Howick is in South Africa');
  const f = C.gpsCheck(29.4833, 30.2333, 'ZA');
  ok(f && f.kind === 'flip' && f.lat === -29.4833 && f.lng === 30.2333, 'a missing minus (northern hemisphere) is spotted, with the fix');
  const f2 = C.gpsCheck(30.2333, -29.4833, 'ZA');
  ok(f2 && f2.kind === 'flip' && f2.lat === -29.4833 && f2.lng === 30.2333, 'the two numbers the wrong way round are spotted, with the fix');
  const f3 = C.gpsCheck(-29.4833, -30.2333, 'ZA');
  ok(f3 && f3.kind === 'flip' && f3.lng === 30.2333, 'a minus on the longitude (west) is spotted');
  ok(C.gpsCheck(51.5, -0.12, 'ZA').kind === 'outside' && C.gpsCheck(51.5, -0.12, 'GB') === null, 'London is not in South Africa but is in the United Kingdom');
  ok(C.gpsCheck(-33.87, 151.2, 'AU') === null && C.gpsCheck(33.87, 151.2, 'AU').kind === 'flip' && C.gpsCheck(40.7, -74, 'US') === null && C.gpsCheck(-40.7, -74, 'US').kind === 'flip', 'Sydney needs its minus, New York its minus on the longitude');
  ok(C.all().every(c => C.gpsCheck(0, 0, c.code) !== undefined) && C.all().every(c => { const x = C.gpsCheck(-89, 179.9, c.code); return x === null || x.kind; }), 'every country has a place on the map to check against');
  ok(Math.round(C.metres({ lat: -29.4833, lng: 30.2333 }, { lat: -29.4933, lng: 30.2333 })) > 1000, 'metres between two spots');
}

if (fails) { console.log('\n' + fails + ' country test(s) FAILED'); process.exit(1); }
console.log('\nAll country tests passed');
