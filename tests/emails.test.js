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
check(Emails.getMethod() === 'mail', 'default: the email program');
check(Emails.getMethod({ emailMethod: 'afrihost' }) === 'mail', 'the first version’s “afrihost” still means the email program');
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

console.log('Couples, marital status, consent and late spouses');
const fam = [
  { id: 'h1', firstName: 'John', lastName: 'Dube', email: 'john@example.com', maritalStatus: 'Married', keyDates: [{ label: 'Wedding anniversary', date: '2000-11-10' }] },
  { id: 'w1', firstName: 'Mary', lastName: 'Dube', email: 'mary@example.com', maritalStatus: 'Married', keyDates: [{ label: 'Wedding anniversary', date: '2000-11-10' }] },
  { id: 'd1', firstName: 'Dan', lastName: 'Ross', email: 'dan@example.com', maritalStatus: 'Divorced', keyDates: [{ label: 'Wedding anniversary', date: '1999-11-10' }] },
  { id: 'n1', firstName: 'Nina', lastName: 'Lee', email: 'nina@example.com', birthDate: '1970-11-10' },
  { id: 'v1', firstName: 'Vera', lastName: 'Khumalo', email: 'vera@example.com', maritalStatus: 'Widowed' },
  { id: 'v2', firstName: 'Sipho', lastName: 'Khumalo', deceasedAt: '2019-11-10', category: 'Deceased' }
];
const spouses = { h1: 'w1', w1: 'h1' };
const fe = Emails.findEvents(fam, today, {}, {
  spouseOf: p => fam.find(x => x.id === spouses[p.id]) || null,
  canEmail: p => p.id !== 'n1',
  lateSpouse: p => p.id === 'v1' ? fam.find(x => x.id === 'v2') : null
});
const ann = fe.filter(e => e.type === 'anniversary');
check(ann.length === 1 && ann[0].data.firstName === 'John and Mary' && ann[0].recipientEmail === 'john@example.com, mary@example.com', 'a married couple gets one anniversary email, to both, “Dear John and Mary”');
check(ann[0].data.fullName === 'John and Mary Dube' && ann[0].data.yearsText === ' (26 years)', 'the couple’s full name and years married');
check(!fe.some(e => e.person.id === 'd1'), 'no anniversary email for someone divorced');
check(!fe.some(e => e.person.id === 'n1'), 'nobody is suggested without their consent to email');
check(fe.some(e => e.type === 'spouseDeath' && e.person.id === 'v1' && e.data.spouseName === 'Sipho Khumalo'), 'the late spouse comes from the People page’s own rule (opts.lateSpouse)');
const one = Emails.findEvents(fam, today, {}, { spouseOf: p => fam.find(x => x.id === spouses[p.id]) || null, canEmail: p => p.id === 'w1' });
check(one.filter(e => e.type === 'anniversary').length === 1 && one.find(e => e.type === 'anniversary').recipientEmail === 'mary@example.com', 'only the spouse who agreed to email is sent the couple’s email');
check(Emails.findEvents(fam, today, { ['h1+w1_anniversary_' + today]: true }, { spouseOf: p => fam.find(x => x.id === spouses[p.id]) || null }).every(e => e.type !== 'anniversary'), 'the couple’s prompt, once done, is gone for both');
check(Emails.stale([{ id: 'a', date: '2026-11-09' }, { id: 'b', date: today }], today).map(r => r.id).join() === 'a', 'yesterday’s prompts are cleared away');

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
const asChurch = Emails.makeSendUrl('gmail', { to: 'a@example.com', subject: 's', body: 'b', from: 'church@gmail.com' });
check(asChurch.indexOf('https://mail.google.com/mail/?authuser=church%40gmail.com&view=cm') === 0, 'Gmail opens in the church’s account when signed in to it');
check(Emails.makeSendUrl('mail', { to: 'john@example.com, mary@example.com', subject: 's', body: 'b' }).indexOf('mailto:john@example.com,mary@example.com?') === 0, 'one email to both of a couple');

const many = Emails.makeSendUrl('mail', { to: 'office@example.com', bcc: 'a@example.com,b@example.com', subject: 's', body: 'b' });
check(many.indexOf('mailto:office@example.com?bcc=a%40example.com,b%40example.com&subject=s') === 0, 'to many people at once: Bcc, so they don’t see each other’s addresses');
check(Emails.makeSendUrl('gmail', { to: '', bcc: 'a@example.com,b@example.com', subject: 's', body: 'b' }).indexOf('&bcc=a%40example.com%2Cb%40example.com&su=s') > 0, '… and in Gmail');

if (fails) {
  console.log('\n' + fails + ' email test(s) FAILED');
  process.exit(1);
}
console.log('\nAll email tests passed');
