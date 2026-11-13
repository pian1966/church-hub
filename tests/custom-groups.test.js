/* Tests for js/custom-groups.js (administrator-created groups and the built-in Staff list). Run: node tests/custom-groups.test.js */
'use strict';
const G = require('../js/custom-groups.js');
let fails = 0;
function ok(value, what) { if (!value) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

const group = G.clean({ name: '  Worship   Team ', description: ' Sundays ', memberIds: ['p1', 'p1', '', 'p2'], visibility: 'church', extra: 'ignored' });
ok(group.name === 'Worship Team' && group.description === 'Sundays' && group.memberIds.join() === 'p1,p2' && !('extra' in group), 'group data is tidied, duplicate members are removed and unrelated data is not kept');
ok(G.sees(group, 'p9', false) && !G.sees(G.clean({ visibility: 'members', memberIds: ['p1'] }), 'p9', false) &&
  G.sees(G.clean({ visibility: 'members', memberIds: ['p1'] }), 'p1', false) && G.sees({}, 'p9', true), 'visibility follows the group setting and Administrators can always see it');
const staff = G.staff([
  { id: 'p1', firstName: 'Ada', lastName: 'Zulu', staff: { category: 'Pastor' } },
  { id: 'p2', firstName: 'Ben', lastName: 'Aardvark', category: 'Staff' },
  { id: 'p3', category: 'Staff', active: false },
  { id: 'p4', category: 'Deceased', staff: { category: 'Caretaker' } },
  { id: 'p5', category: 'Church Partner' }
]);
ok(staff.map(p => p.id).join() === 'p2,p1' && G.name(staff[1]) === 'Ada Zulu', 'the built-in Staff list updates from staff details and legacy Staff categories, excluding inactive people');

if (fails) { console.log('\n' + fails + ' custom group test(s) FAILED'); process.exit(1); }
console.log('\nAll custom group tests passed');
