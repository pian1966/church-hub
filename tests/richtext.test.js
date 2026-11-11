/* Tests for js/richtext.js (simple formatting for documents shown in the app). Run: node tests/richtext.test.js */
'use strict';
const R = require('../js/richtext.js');
let fails = 0;
function ok(c, what) { if (!c) { fails++; console.log('  ✗ ' + what); } else console.log('  ✓ ' + what); }

ok(R.html('# Library policy\nBooks are lent for **three weeks**.') === '<h3>Library policy</h3><p>Books are lent for <b>three weeks</b>.</p>', 'a heading and bold');
ok(R.html('## Rules\n- Look after the books\n- Return them *on time*\n\n1. Ask a librarian\n2. Sign the book out') ===
  '<h4>Rules</h4><ul><li>Look after the books</li><li>Return them <i>on time</i></li></ul><ol><li>Ask a librarian</li><li>Sign the book out</li></ol>', 'bulleted and numbered lists, italic');
ok(R.html('Line one\nline two\n\nNew paragraph') === '<p>Line one<br>line two</p><p>New paragraph</p>', 'a line break stays; a blank line starts a new paragraph');
ok(R.html('<script>alert(1)</script> & "x"') === '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>', 'nothing typed can run: everything is made safe');
ok(R.html('See https://example.org/policy.pdf.') === '<p>See <a href="https://example.org/policy.pdf" target="_blank" rel="noopener">https://example.org/policy.pdf</a>.</p>', 'web addresses become links');
ok(R.html('__Note__: 2 * 3 = 6 and a*b') === '<p><u>Note</u>: 2 * 3 = 6 and a*b</p>', 'underline; a lone star is left alone');
ok(R.html('javascript:alert(1)').indexOf('<a') < 0 && R.html('**https://a.org/x**') === '<p><b><a href="https://a.org/x" target="_blank" rel="noopener">https://a.org/x</a></b></p>', 'only web addresses become links, even in bold');
ok(R.formatted('# Hi') && R.formatted('a **b**') && R.formatted('- one') && !R.formatted('Just words. 2 * 3.'), 'knows whether text has formatting');
ok(R.html('') === '' && R.html(null) === '', 'nothing in, nothing out');

if (fails) { console.log('\n' + fails + ' formatting test(s) FAILED'); process.exit(1); }
console.log('\nAll formatting tests passed');
