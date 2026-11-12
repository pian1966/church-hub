/* Check that the printable brochure stays free of local-church branding. Run: node tests/brochure.test.js */
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'brochure.html'), 'utf8');

if (/Christ Church Howick/i.test(html)) {
  console.error('The printable brochure still contains local church branding.');
  process.exit(1);
}
if (!/data-fill="origin">Made in South Africa/.test(html)) {
  console.error('The other-church brochure must use the generic South African attribution.');
  process.exit(1);
}
console.log('Printable brochure branding is generic.');
