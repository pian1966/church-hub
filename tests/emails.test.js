/* Tests for js/emails.js (templates, daily event detection, email link generation).
 * Run: node tests/emails.test.js */
'use strict';
const LeaveCore = require('../js/leave-core.js');
global.LeaveCore = LeaveCore;
const Emails = require('../js/emails.js');

let fails = 0;
function check(ok, what) {
  if (!ok) { fails++; console.log('  ✗ ' + what); }
  else console.log('  ✓ ' + what);
}

console.log('Templates and custom settings');
const def = Emails.getTemplates();
check(def.birthday && def.anniversary && def.spouseDeath && def.welcomeFirst && def.welcomeThreeWeeks, 'all 5 default templates present');
check(Emails.getMethod() === 'afrihost', 'default email method is afrihost');
const custom = Emails.getTemplates({
  emailTemplates: {
    birthday: { subject: 'Custom Birthday', body: 'Custom body for {firstName}' }
  },
  emailMethod: 'gmail'
});
check(custom.birthday.subject === 'Custom Birthday' && custom.anniversary.subject === def.anniversary.subject, 'custom templates override defaults');
check(Emails.getMethod({ emailMethod: 'gmail' }) === 'gmail', 'custom method returns gmail');

console.log('Interpolation');
const interpolated = Emails.interpolate('Hello {firstName} {lastName}, from {churchName}! {yearsText}', {
  firstName: 'John',
  lastName: 'Doe',
  churchName: 'Christ Church Howick',
  yearsText: '(5 years)'
});
check(interpolated === 'Hello John Doe, from Christ Church Howick! (5 years)', 'interpolates placeholders correctly');

console.log('Date helpers');
check(Emails.sameMonthDay('1985-06-15', '2026-06-15') === true, 'same month day matches');
check(Emails.sameMonthDay('1985-06-15', '2026-06-16') === false, 'different day fails');
check(Emails.yearsSince('2016-06-15', '2026-06-15') === 10, 'years since calculated correctly');
check(Emails.diffDays('2026-05-01', '2026-05-22') === 21, 'diffDays calculates 21 days');

console.log('Event detection');
const people = [
  {
    id: 'p1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    birthDate: '1990-11-10',
    keyDates: [{ label: 'Wedding anniversary', date: '2015-11-10' }]
  },
  {
    id: 'p2',
    firstName: 'Bob',
    lastName: 'Jones',
    email: 'bob@example.com',
    maritalStatus: 'Widowed',
    lateSpouseId: 'p3'
  },
  {
    id: 'p3',
    firstName: 'Carol',
    lastName: 'Jones',
    deceasedAt: '2020-11-10',
    category: 'Deceased'
  },
  {
    id: 'p4',
    firstName: 'David',
    lastName: 'Miller',
    email: 'david@example.com',
    keyDates: [{ label: 'First visit', date: '2026-11-10' }]
  },
  {
    id: 'p5',
    firstName: 'Emma',
    lastName: 'Taylor',
    email: 'emma@example.com',
    keyDates: [{ label: 'First visit', date: '2026-10-20' }] // 21 days before 2026-11-10
  },
  {
    id: 'p6',
    firstName: 'Frank',
    lastName: 'NoEmail',
    birthDate: '1980-11-10' // no email, should be skipped
  }
];

const today = '2026-11-10';
const evs = Emails.findEvents(people, today);

check(evs.some(e => e.type === 'birthday' && e.person.id === 'p1'), 'detects birthday for Alice');
check(evs.some(e => e.type === 'anniversary' && e.person.id === 'p1'), 'detects wedding anniversary for Alice');
check(evs.some(e => e.type === 'spouseDeath' && e.person.id === 'p2' && e.data.spouseName === 'Carol Jones'), 'detects death anniversary of spouse for Bob');
check(evs.some(e => e.type === 'welcomeFirst' && e.person.id === 'p4'), 'detects 1st visit welcome for David');
check(evs.some(e => e.type === 'welcomeThreeWeeks' && e.person.id === 'p5'), 'detects 3 weeks welcome for Emma');
check(!evs.some(e => e.person.id === 'p6'), 'skips person without email');

const dismissed = {
  ['p1_birthday_' + today]: true
};
const evsWithDismissed = Emails.findEvents(people, today, dismissed);
check(!evsWithDismissed.some(e => e.type === 'birthday' && e.person.id === 'p1'), 'respects dismissed event');
check(evsWithDismissed.some(e => e.type === 'anniversary' && e.person.id === 'p1'), 'non-dismissed event remains');

console.log('Sending URL generation');
const mailtoUrl = Emails.makeSendUrl('afrihost', {
  to: 'alice@example.com',
  subject: 'Happy Birthday!',
  body: 'Dear Alice...'
});
check(mailtoUrl.indexOf('mailto:alice@example.com') === 0 && mailtoUrl.indexOf('subject=Happy%20Birthday!') >= 0, 'generates correct mailto url');

const gmailUrl = Emails.makeSendUrl('gmail', {
  to: 'alice@example.com',
  subject: 'Happy Birthday!',
  body: 'Dear Alice...'
});
check(gmailUrl.indexOf('https://mail.google.com/mail/?view=cm&fs=1') === 0 && gmailUrl.indexOf('to=alice%40example.com') >= 0, 'generates correct gmail web url');

if (fails) {
  console.log('\n' + fails + ' email test(s) FAILED');
  process.exit(1);
}
console.log('\nAll email tests passed');
