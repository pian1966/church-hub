/* Tests for js/serving.js (services, special services). Run: node tests/serving.test.js */
'use strict';
const S = require('../js/serving.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

ok(['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2038-04-25'].join() === [2024, 2025, 2026, 2027, 2028, 2038].map(S.easter).join(), 'Easter Sunday is worked out for any year');
const x = Object.fromEntries(S.specials(2027).map(s => [s.name, s.date]));
ok(x['Ash Wednesday'] === '2027-02-10' && x['Palm Sunday'] === '2027-03-21' && x['Maundy Thursday'] === '2027-03-25' && x['Tenebrae'] === '2027-03-25' && x['Good Friday'] === '2027-03-26', 'Lent and Holy Week follow Easter (2027)');
ok(x['Ascension Day'] === '2027-05-06' && x['Pentecost (Whitsunday)'] === '2027-05-16' && x['Trinity Sunday'] === '2027-05-23', 'Ascension and Pentecost follow Easter');
ok(x['Advent Sunday'] === '2027-11-28' && S.specials(2026).find(s => s.name === 'Advent Sunday').date === '2026-11-29' && x['Christmas Day'] === '2027-12-25', 'Advent Sunday and Christmas');
ok(x['Remembrance Sunday'] === '2027-11-14' && x['Mother’s Day'] === '2027-05-09' && x['Christ the King'] === '2027-11-21', 'Sundays fixed by the calendar (Remembrance, Mother’s Day, Christ the King)');
ok(x['Wedding'] === '' && S.specials(2027).every(s => s.name && s.when), 'occasions have no fixed date');
ok(S.specialDate('good friday', '2026-10-29') === '2027-03-26' && S.specialDate('Christmas Day', '2026-10-29') === '2026-12-25' && S.specialDate('Funeral', '2026-10-29') === '', 'the next date for a suggestion (this year, or next year once it has passed)');

console.log('Services: look, mood, and what runs where');
ok(S.slots({}).map(x => x.id).join() === '08:00,10:00,17:00' && S.allSlots({}).map(x => x.id).join() === '08:00,10:00,17:00,memorial', 'Memorial is offered with the three Sunday services, but isn’t a weekly service');
const saved = { serviceSlots: [{ id: '08:00', label: '8am', day: 0, time: '08:00' }, { id: '09:30@hall', label: '9:30am', day: 0, time: '09:30', venue: 'Hall' }] };
ok(S.allSlots(saved).map(x => x.id).join() === '08:00,09:30@hall,memorial', 'a church’s own services keep Memorial too');
const gone = { serviceSlots: S.updateSlot({}, 'memorial', { removed: true }) };
ok(S.allSlots(gone).length === 3 && S.savedSlots(gone).length === 4, 'a church that holds no memorials can remove it (and it isn’t added back)');
ok(S.themeOf(S.allSlots({})[0]).id === 'sunrise' && S.themeOf(S.allSlots({})[1]).id === 'morning' && S.themeOf(S.allSlots({})[2]).id === 'sunset' && S.themeOf(S.allSlots({})[3]).id === 'candlelight', '8am sunrise, 10am morning, 5pm sunset, Memorial candlelight');
ok(S.themeOf({ id: 'x', time: '12:30' }).id === 'midday' && S.themeOf({ id: 'y', time: '19:00' }).id === 'evening' && S.themeOf({ id: 'z', time: '18:00', theme: 'sunrise' }).id === 'sunrise', 'a new service gets a look from its time, unless one is chosen');
ok(S.moodsOf(S.allSlots({})[0]).includes('Sunday school') && S.moodsOf(S.allSlots({})[1]).includes('Hymns') && S.moodsOf(S.allSlots({})[2]).includes('Band'), 'the usual moods: children at 8am, hymns at 10am, a band at 5pm');
ok(S.moodsOf({ id: '08:00', moods: [] }).length === 0 && S.updateSlot({}, '10:00', { moods: ['Quiet'] }).find(x => x.id === '10:00').moods.join() === 'Quiet', 'a church can change the moods (even to none)');
const [eight, ten, five, mem] = S.allSlots({});
const host = { id: 'h', teamId: 't', times: [] }, creche = { id: 'c', teamId: 't', times: ['08:00'] }, teas = { id: 'm', teamId: 'u', times: ['memorial'] };
ok(S.runsAtSlot(host, eight) && S.runsAtSlot(host, five) && !S.runsAtSlot(host, mem) && S.runsAtSlot(teas, mem) && !S.runsAtSlot(teas, ten) && !S.runsAtSlot(creche, ten), 'every regular service unless narrowed down; Memorial only when named');
ok(S.toggleTimes(host, '17:00', {}).join() === '08:00,10:00', 'switching a position off at 5pm keeps it at 8am and 10am');
ok(S.toggleTimes({ times: ['08:00', '10:00'] }, '17:00', {}).join() === '', 'switching it back on at 5pm means every service again');
ok(S.toggleTimes(host, 'memorial', {}).join() === '08:00,10:00,17:00,memorial', 'adding Memorial names every service it runs at');
ok(S.toggleTimes(teas, 'memorial', {}).join() === 'none' && S.allSlots({}).every(x => !S.runsAtSlot({ times: ['none'] }, x)), 'switched off everywhere is not the same as every service');
const st = S.structure(ten, [{ id: 't', name: 'A' }, { id: 'u', name: 'B' }], [host, creche, teas]);
ok(st.length === 1 && st[0].positions.map(p => p.id).join() === 'h', 'what a volunteer sees at 10am: only departments with positions there');
ok(S.structure(mem, [{ id: 't' }, { id: 'u' }], [host, creche, teas]).map(x => x.team.id).join() === 'u', 'and at a memorial only memorial teas');
const m = S.missing([{ id: 'old', name: 'Operational' }], []);
ok(!m.teams.some(t => t.name === 'Service Leading') && m.positions.filter(p => p.teamId === 'old').length === 4, 'the department once called Operational (Elvanto: Service) is now Service Leading – not added twice');

if (fails) { console.log('\n' + fails + ' serving test(s) FAILED'); process.exit(1); }
console.log('\nAll serving tests passed');
