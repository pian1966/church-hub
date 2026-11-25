// Run: node tests/history.test.js – Undo and Version history rules (js/history.js). Made-up data only.
const History = require('../js/history.js');
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };
const who = { id: 'u1', name: 'Test Person' };
const P = (extra) => Object.assign({ id: 'p1', firstName: 'Ann', lastName: 'Example', details: { email: 'ann@example.test', cell: '000' }, updatedAt: '2026-11-01 08:00' }, extra);

console.log('What changed');
{
  ok(History.changed(P(), P({ updatedAt: 'later' })).length === 0, 'updatedAt alone is not a change');
  ok(History.changed(P(), P({ firstName: 'Anne' })).join() === 'firstName', 'a changed field');
  ok(History.changed(P(), P({ details: { email: 'new@example.test', cell: '000' } })).join() === 'details.email', 'one level into details');
  ok(History.changed(P(), P({ medical: 'x' })).length === 0, 'private fields are never compared');
  ok(History.changed(P({ tags: ['a', 'b'] }), P({ tags: ['a', 'b'] })).length === 0, 'equal arrays are equal');
  ok(History.changed(P(), P({ details: { cell: '000', email: 'ann@example.test' } })).length === 0, 'key order does not matter');
}

console.log('Making a version');
{
  const e = History.entry('people', P(), P({ firstName: 'Anne' }), who, '2026-11-25 10:00');
  ok(e && e.kind === 'edit' && e.rid === 'p1' && e.fields.join() === 'firstName' && e.by === 'u1', 'an edit');
  ok(e.before.firstName === 'Ann' && e.after.firstName === 'Anne', 'keeps before and after');
  ok(History.entry('people', P(), P(), who, '2026-11-25 10:00') === null, 'nothing changed, nothing kept');
  ok(History.entry('audit', null, { id: 'x' }, who, '2026-11-25 10:00') === null, 'collections without history are skipped');
  ok(History.entry('people', null, P(), who, '2026-11-25 10:00').kind === 'add', 'an addition');
  ok(History.entry('people', P(), null, who, '2026-11-25 10:00').kind === 'remove', 'a removal');
  const m = History.entry('people', P({ medical: 'secret', photo: 'data:x' }), P({ medical: 'secret', photo: 'data:x', firstName: 'B' }), who, '2026-11-25 10:00');
  ok(!('medical' in m.before) && !('photo' in m.after), 'medical notes and the photo are never copied into a version');
}

console.log('Saving as you type becomes one version');
{
  const a = History.entry('people', P(), P({ firstName: 'An' }), who, '2026-11-25 10:00', 'h1');
  const b = History.entry('people', P({ firstName: 'An' }), P({ firstName: 'Anne' }), who, '2026-11-25 10:04');
  const m = History.merge(a, b);
  ok(m.id === 'h1' && m.before.firstName === 'Ann' && m.after.firstName === 'Anne' && m.at === '2026-11-25 10:04', 'same person, within 10 minutes: one version from the first before to the last after');
  const late = History.entry('people', P({ firstName: 'An' }), P({ firstName: 'Anne' }), who, '2026-11-25 10:30');
  ok(History.merge(a, late) === late, 'later than 10 minutes: kept apart');
  const other = History.entry('people', P({ firstName: 'An' }), P({ firstName: 'Anne' }), { id: 'u2', name: 'Other' }, '2026-11-25 10:02');
  ok(History.merge(a, other) === other, 'a different person: kept apart');
  const back = History.entry('people', P({ firstName: 'An' }), P(), who, '2026-11-25 10:03');
  ok(History.merge(a, back) === null, 'changed and changed back: nothing to keep');
  const rm = History.entry('people', P(), null, who, '2026-11-25 10:01');
  ok(History.merge(a, rm) === rm, 'a removal is never folded into an edit');
}

console.log('Listing and clearing out');
{
  const es = [
    { id: 'a', c: 'people', rid: 'p1', at: '2026-11-20 09:00' }, { id: 'b', c: 'people', rid: 'p1', at: '2026-11-25 09:00' },
    { id: 'c', c: 'families', rid: 'p1', at: '2026-11-26 09:00' }, { id: 'd', c: 'people', rid: 'p2', at: '2026-11-27 09:00' }];
  ok(History.forRecord(es, 'people', 'p1').map(e => e.id).join() === 'b,a', 'one record, newest first, not another collection or record');
  const old = []; for (let i = 0; i < 25; i++) old.push({ id: 'o' + i, c: 'people', rid: 'busy', at: '2026-01-' + String(i + 1).padStart(2, '0') + ' 09:00' });
  ok(History.prune(old, '2026-11-25 10:00').length === 5, 'a busy record keeps its latest 20 and loses the old rest');
  ok(History.prune(old.slice(0, 3), '2026-11-25 10:00').length === 0, 'a rarely changed record keeps even old versions');
  const young = old.map((e, i) => Object.assign({}, e, { at: '2026-11-' + String(i + 1).padStart(2, '0') + ' 09:00' }));
  ok(History.prune(young, '2026-11-25 10:00').length === 0, 'nothing newer than 90 days goes');
}

console.log('Putting a version back');
{
  const edit = History.entry('people', P(), P({ firstName: 'Wrong' }), who, '2026-11-25 10:00');
  let r = History.restore(P({ firstName: 'Wrong' }), edit);
  ok(r.action === 'put' && r.record.firstName === 'Ann' && r.record.id === 'p1' && !r.newer, 'an edit goes back to before');
  r = History.restore(P({ firstName: 'Wrong', details: { email: 'someone@else.test', cell: '000' } }), edit);
  ok(r.newer, 'if the record changed again since, the screen is told');
  const rm = History.entry('people', P(), null, who, '2026-11-25 10:00');
  r = History.restore(null, rm);
  ok(r.action === 'put' && r.record.firstName === 'Ann' && !r.newer, 'a deleted record comes back');
  const add = History.entry('people', null, P(), who, '2026-11-25 10:00');
  ok(History.restore(P(), add).action === 'remove', 'undoing an addition takes it out');
  ok(History.restore(null, add).action === 'none', 'already gone: nothing to do');
  const two = History.entry('people', P(), P({ firstName: 'Zed', details: { email: 'z@example.test', cell: '999' } }), who, '2026-11-25 10:00');
  r = History.restore(P({ firstName: 'Zed', details: { email: 'z@example.test', cell: '999' } }), two, ['details.cell']);
  ok(r.record.details.cell === '000' && r.record.details.email === 'z@example.test' && r.record.firstName === 'Zed', 'just one field goes back');
  r = History.restore(P({ firstName: 'Wrong', medical: 'kept' }), edit);
  ok(r.record.medical === 'kept', 'private parts are left as they are now');
}

console.log('Undo on this device');
{
  History.undoClear();
  const e1 = History.entry('people', P(), P({ firstName: 'B' }), who, '2026-11-25 10:00');
  const e2 = History.entry('people', P(), P({ firstName: 'C' }), who, '2026-11-25 10:05');
  History.undoPush(e1, 1000); History.undoPush(e2, 2000);
  ok(History.undoPeek(3000) === e2 && History.undoSize() === 2, 'the latest change is offered');
  ok(History.undoPop() === e2 && History.undoPeek(3000) === e1, 'then the one before');
  ok(History.undoPeek(1000 + 31 * 60000) === null, 'after 30 minutes it is no longer offered');
  History.undoClear(); for (let i = 0; i < 30; i++) History.undoPush(e1, 1);
  ok(History.undoSize() === 20, 'only the last 20 are kept');
  History.undoClear();
}

console.log('Words');
{
  ok(History.fieldLabel('details.homePhone') === 'Home phone', 'field label');
  ok(History.listFields(['firstName', 'details.email']) === 'First name and Email', 'two fields');
  ok(History.listFields(['a', 'b', 'c', 'd', 'e']) === 'A, B, C and 2 more', 'many fields');
}

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
