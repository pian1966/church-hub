/* Tests for js/church.js (which church a page talks to; TARGET.md section 2). Run: node tests/church.test.js */
'use strict';
const Church = require('../js/church.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

/** A stand-in for the browser's localStorage. */
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => Array.from(m.keys())[i] || null, get length() { return m.size; }, dump: () => Object.fromEntries(m)
  };
}
const HOWICK = { apiKey: 'key-h', authDomain: 'church-hub-7ec02.firebaseapp.com', projectId: 'church-hub-7ec02', appId: 'a' };
const OTHER = { apiKey: 'key-o', authDomain: 'demo-other.firebaseapp.com', projectId: 'demo-other', appId: 'b' };
const THIRD = { apiKey: 'key-t', projectId: 'stmarks-7k2p' };

console.log('Order of precedence');
let s = mem();
Church.save(s, 'demo-other', OTHER);
let r = Church.resolve('?demo', s, HOWICK);
ok(r.mode === 'demo' && !r.config, '1. ?demo wins over everything');
ok(Church.resolve('?c=demo-other&demo', s, HOWICK).mode === 'demo', '   …even with a church in the address');
r = Church.resolve('?c=demo-other', s, HOWICK);
ok(r.mode === 'live' && r.config.projectId === 'demo-other' && r.from === 'link', '2. ?c= with a saved connection uses it');
s = mem({ 'church_hub_church:demo-other': JSON.stringify(OTHER), 'church_hub_church:stmarks-7k2p': JSON.stringify(THIRD), church_hub_current: 'demo-other' });
r = Church.resolve('?c=stmarks-7k2p', s, HOWICK);
ok(r.config.projectId === 'stmarks-7k2p' && s.getItem('church_hub_current') === 'stmarks-7k2p', '   …and it becomes this device’s church');
r = Church.resolve('?c=unknown-church', s, HOWICK);
ok(r.mode === 'pending' && r.projectId === 'unknown-church' && !r.config, '   ?c= not saved yet → pending (to be looked up)');
ok(s.getItem('church_hub_current') === 'stmarks-7k2p', '   …and a pending church doesn’t change this device’s church');
r = Church.resolve('?c=church-hub-7ec02', mem(), HOWICK);
ok(r.mode === 'live' && r.config === HOWICK && r.from === 'built-in', '   ?c= naming the built-in church uses the built-in connection');
r = Church.resolve('', s, HOWICK);
ok(r.mode === 'live' && r.projectId === 'stmarks-7k2p' && r.from === 'device', '3. no ?c= → this device’s church');
r = Church.resolve('', mem(), HOWICK);
ok(r.mode === 'live' && r.config === HOWICK && r.from === 'built-in', '4. nothing saved → the built-in connection (Christ Church Howick today)');
ok(Church.resolve('', mem(), null).mode === 'none' && Church.resolve('', mem(), {}).mode === 'none', '5. nothing at all → none (the landing screen, later)');
ok(Church.resolve('?x=1', mem(), { apiKey: '' , projectId: '' }).mode === 'none', '   an empty built-in connection counts as none');

console.log('Bad ids and bad saved values are ignored');
['A-capital', 'short', '1starts-with-digit', 'ends-with-dash-', 'has_underscore', 'x'.repeat(31), '../etc', '', 'demo other'].forEach(id => {
  ok(!Church.validId(id), '   rejects “' + id + '”');
});
ok(Church.validId('church-hub-7ec02') && Church.validId('demo-other'), 'accepts real project ids');
r = Church.resolve('?c=..%2Fetc', mem(), HOWICK);
ok(r.mode === 'live' && r.from === 'built-in', 'a bad ?c= is ignored (falls to the next rule)');
s = mem({ 'church_hub_church:demo-other': '{not json', church_hub_current: 'demo-other' });
ok(Church.resolve('', s, HOWICK).from === 'built-in' && Church.current(s) === '', 'a broken saved connection is ignored');
s = mem({ 'church_hub_church:demo-other': JSON.stringify(THIRD), church_hub_current: 'demo-other' });
ok(Church.resolve('?c=demo-other', s, HOWICK).mode === 'pending', 'a saved connection for a different project id is ignored');
ok(!Church.save(mem(), 'demo-other', THIRD) && !Church.save(mem(), 'BAD', OTHER) && !Church.save(mem(), 'demo-other', { projectId: 'demo-other' }), 'save refuses mismatched ids, bad ids and connections without a key');

console.log('Saving, forgetting, listing, links');
s = mem();
ok(Church.save(s, 'demo-other', OTHER) && Church.current(s) === 'demo-other', 'save remembers the church and makes it current');
Church.save(s, 'stmarks-7k2p', THIRD);
ok(Church.remembered(s).join() === 'stmarks-7k2p,demo-other', 'remembered lists this device’s church first');
Church.forget(s, 'stmarks-7k2p');
ok(Church.current(s) === '' && Church.remembered(s).join() === 'demo-other' && s.getItem('church_hub_church:stmarks-7k2p') === null, 'forget removes it and stops it opening by itself');
ok(Church.link('https://app.example.org', '/', 'demo-other') === 'https://app.example.org/?c=demo-other', 'a church’s own link');
ok(Church.link('https://pian1966.github.io', '/church-hub/', 'church-hub-7ec02') === 'https://pian1966.github.io/church-hub/?c=church-hub-7ec02', '…on today’s address too');
ok(Church.link('https://x.org', '/', 'Bad id') === '', 'no link for a bad id');
const broken = { getItem() { throw new Error('closed'); }, setItem() { throw new Error('closed'); }, removeItem() { throw new Error('closed'); } };
ok(Church.resolve('?c=demo-other', broken, HOWICK).mode === 'pending' && Church.resolve('', broken, HOWICK).from === 'built-in', 'a private window (storage closed) still works');
ok(Church.param('?a=1&c=demo-other&b', 'c') === 'demo-other' && Church.param('?c', 'c') === '' && Church.param('', 'c') === null, 'reads ?c= from anywhere in the address');

if (fails) { console.log('\n' + fails + ' failed'); process.exit(1); }
console.log('\nAll passed');
