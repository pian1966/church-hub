/* Church Hub – "What's new" and "Did you know?" on Home: a sentence on the latest changes, and one tip about a part of
 * Church Hub, chosen for the person who signed in. Each tip says who it is for (`who`: any of the tags below), who it is
 * not for (`not`), and which part of Church Hub must be switched on and open to them (`app`), so nobody is told about
 * something they can't use: a member hears that there is a library and that their Me page shows what they borrowed; a
 * librarian hears how to lend, repair or take out an item.
 * Tags (worked out in js/app.js, homeTags): everyone; the role (admin, pastor, rosters, kids, member); librarian; carer
 * (leads a Care Group); senior (the Senior Pastor); staffwork (sees the People list: Administrators, Pastors, Roster
 * coordinators, Children's ministry).
 * Texts are English, marked with TX and translated where they are shown (js/i18n/tips.js, js/lang/st.js).
 * To add news: put the newest line first in NEWS with the day it reached the website. Shown on Home for NEWS_DAYS days.
 * Every release with something people would notice adds a line (one sentence, for those it concerns), then sets NEWS_FOR.
 * Rules only, no screens: tested by tests/tips.test.js. */
(function (global) {
  'use strict';
  var TX = function (x) { return x; };
  var NEWS_DAYS = 14;

  // Every release that changes what people see adds its news here, and NEWS_FOR follows the version's first two numbers
  // (node tests/versions.test.js checks it), so What's new on Home never falls behind.
  var NEWS_FOR = '0.90';
  var NEWS = [
    { date: '2026-11-18', who: ['admin', 'pastor'], app: 'people', text: TX('When someone applies to become a Church Partner, Administrators and Pastors now also get a message in Messages.') },
    { date: '2026-11-18', who: ['everyone'], app: 'rosters', text: TX('Services are now shown in time order (8am, 10am, 5pm) and in their own colours on the roster, My serving and Settings.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters → Teams: use − and + to choose how many people a position needs at each service, for example 2 on the sound desk.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters → Teams now offers a Verger, Ushers and Recorded Music, and Collection Servers and Communion Servers as two separate positions – tap Add them.') },
    { date: '2026-11-18', who: ['staffwork'], app: 'people', text: TX('You can now drag the columns in Advanced search to put them in the order you want.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters: tap a name and choose Change person to swap it in one go – the first person is told, and a message they haven’t opened is taken back.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters now show only the departments and positions needed at the services you’re looking at.') },
    { date: '2026-11-18', who: ['everyone'], text: TX('The Church Hub icon on your phone or computer now has the same thin cross as inside the app.') },
    { date: '2026-11-17', who: ['staffwork'], app: 'people', text: TX('Advanced search looks calmer: each filter has a small × to remove it, and one Add a filter button sits underneath.') },
    { date: '2026-11-17', who: ['everyone'], app: 'library', text: TX("Library: if you have borrowed something, the Library now opens on Items I have borrowed; tap Library for the whole catalogue.") },
    { date: '2026-11-17', who: ['everyone'], app: 'people', text: TX("People: each field on a person’s page and in Edit details now has a small icon, so you can see at a glance what it asks.") },
    { date: '2026-11-17', who: ['everyone'], app: 'library', text: TX('Library: the items you have borrowed now have a tab of their own, before Library and Archives.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Members with no email address can now sign in with their cellphone number and a PIN: the church office gives them a sign-in code once, and with it they choose their PIN.') },
    { date: '2026-11-17', who: ['admin'], text: TX('Administrators: give a member with no email a sign-in code from their page (App access → Give a sign-in code) – by WhatsApp, on a printed slip or on screen. With it they choose a PIN. Switch on Anonymous and Email/Password sign-in in Firebase first.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Edit details now saves as you go, like the rest of Church Hub – no Save button, just tap Done when you’re finished.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Every drop-down list now opens in full as soon as you tap it, and narrows down as you type – handy for finding a name in a long list.') },
    { date: '2026-11-17', who: ['admin', 'pastor'], app: 'people', text: TX('People: in Edit details, choose someone’s Spouse or partner by hand – even when they live apart – and Church Hub links them on both records.') },
    { date: '2026-11-17', who: ['admin', 'pastor'], app: 'people', text: TX('People: Edit details now has a Maiden name box for women who are or were married, and People’s search finds them by it. Church office notes now sit near the top of a person’s page, so adding one is easy to find.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Subscription: the page now makes clear that the price is per church, not per person, and that a low price doesn’t mean Church Hub does less.') },
    { date: '2026-11-16', who: ['everyone'], text: TX('About now has a link to Church Hub’s website, which shows what Church Hub offers to every church – handy to share with friends at other churches.') },
    { date: '2026-11-16', who: ['admin', 'pastor'], app: 'messages', text: TX('Messages: Sent now shows only the messages you sent. Administrators and Pastors find everyone’s messages under All messages, and set up groups under Message groups.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Subscription: each church now gives the price of one cup where it lives, in its own money – chai from a stall, a café coffee or a coffee-chain latte, whichever is honest for the church – and the prayer card can use a photo taken there and then.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Administrators: the new Subscription page (one coffee a month, or ten a year) shows when your next payment is due, lets you add a gift in one tap, and offers a free payment holiday when money is tight.') },
    { date: '2026-11-16', who: ['everyone'], text: TX('Church Hub is for every church: a church that can’t afford it can pray for another church each month instead, and that church appears on everyone’s Home page.') },
    { date: '2026-11-16', who: ['rosters', 'admin'], app: 'rosters', text: TX("Holy Communion: under Rosters → Services, choose which Sundays of the month each service has communion, and communion servers and providers are only asked for then. For a one-off change, tap “Communion” under that date in the roster.") },
    { date: '2026-11-16', who: ['everyone'], app: 'messages', text: TX('Writing a message is easier: tap the box at the top to choose who it’s for from clear cards and lists, each showing how many people it reaches.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Church Hub now moves more gently: pages and windows ease in, new messages glide into the conversation, and a small green tick shows when something is saved.') },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX('In Messages → Sent, you now choose how the delivery signs look from four picture cards, each showing its steps and which apps and countries use that style.') },
    { date: '2026-11-15', who: ['everyone'], app: 'rosters', text: TX('When you’re put on a roster, a message now comes to your Messages inbox, and you can accept or say you can’t make it right there.') },
    { date: '2026-11-15', who: ['rosters', 'admin'], app: 'rosters', text: TX('Roster coordinators: when someone says they can’t make it, you now get a message. Rosters → More → Remind those who haven’t replied sends everyone still to answer a reminder.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Updates are smaller now: a new version of Church Hub downloads only the parts that changed, so it uses much less data.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX('Librarians: the Find book covers window now keeps your place while it searches, instead of jumping back to the top after every book.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX("Librarians: covers found online now work for many more books, you can ask for another cover if the first is wrong, and each item’s ⋯ menu and Edit form have “Find a cover online”.") },
    { date: '2026-11-15', who: ['everyone'], text: TX('Dates can now be typed, like 12 Aug 1990 – birthdays, anniversaries and every other date – so there’s no more tapping back through the calendar month by month.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('About now has a round ✕ at the top right that stays there as you scroll, so you can always get back – handy on the Android app.') },
    { date: '2026-11-15', who: ['everyone'], text: TX("Church Hub fits phones better: buttons no longer squeeze names and wording (Translations, Leave approvals, Serving together), Terminology and school terms fit the screen, and menus open within it.") },
    { date: '2026-11-15', who: ['admin', 'pastor'], app: 'care', text: TX("When you edit someone on a phone, each Care Group now has its own line, and the “leads it” tick appears only once that group is ticked.") },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX("Tap the ticks by your message’s time to see what they mean – a short note pops up and disappears by itself.") },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX("Messages can now show what the ticks mean, and you can choose ticks, envelopes, a filling circle or words; the first tick turns blue once some have read a group message.") },
    { date: '2026-11-15', who: ['everyone'], app: 'me', text: TX('Chinese and Japanese can now be chosen as languages; for now only the main screens are translated.') },
    { date: '2026-11-15', who: ['everyone'], app: 'me', text: TX('Your Me page has a new Consent tab: it shows what you’ve agreed to, and what each “No” means for you.') },
    { date: '2026-11-15', who: ['everyone'], not: ['attendee'], app: 'messages', text: TX('You can now reply to a message: tap Reply and your answer goes privately to the person who sent it.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX('The Library now shows each item once, with who has it on its own row, and has tabs for overdue, damaged and withdrawn items.') },
    { date: '2026-11-15', who: ['admin', 'senior'], text: TX('Settings → Attendees decides what people who aren’t Church Partners yet may see and do in Church Hub.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Home now shows what’s new in Church Hub, and a tip each time you sign in.') },
    { date: '2026-11-14', who: ['everyone'], text: TX('Sesotho can now be chosen as written in South Africa or in Lesotho.') },
    { date: '2026-11-14', who: ['everyone'], app: 'messages', text: TX('Messages now look like a chat: two blue ticks show that everyone has read yours.') },
    { date: '2026-11-14', who: ['librarian'], app: 'library', text: TX('The Library is tidier: one Add button, everything else under More, and repairs in each item’s ⋯ menu.') },
    { date: '2026-11-14', who: ['admin'], text: TX('Settings → Terminology now suggests ministry roles and titles for the church’s administrator.') }
  ];

  var TIPS = [
    // Everyone
    { id: 'prayer-card', who: ['admin'], app: 'support', href: '#/support/card', text: TX('Give your church a prayer card under Subscription → Our prayer card: a photo and two things to pray for, so churches in the prayer circle can pray for you.') },
    { id: 'roster-team', who: ['admin'], app: 'rosters', href: '#/settings/services', text: TX('Administrators and Roster coordinators hear when someone can’t make a roster turn. To include someone else, such as the church secretary, add them under Settings → Church Services.') },
    { id: 'me-details', who: ['everyone'], app: 'me', href: '#/me', text: TX('Your Me page has your own details, and you can update your contact details there yourself.') },
    { id: 'me-away', who: ['everyone'], app: 'me', href: '#/me', text: TX('Going away? Add your days away on your Me page, so nobody puts you on a roster while you’re gone.') },
    { id: 'me-serve', who: ['everyone'], app: 'me', href: '#/me', text: TX('When you’re put on a roster, you can accept or decline the turn under Me → Serving.') },
    { id: 'me-offer', who: ['everyone'], app: 'me', href: '#/me', text: TX('Would you like to help? Under Me → Serving you can offer to serve in a team.') },
    { id: 'me-lang', who: ['everyone'], app: 'me', href: '#/me', text: TX('Church Hub speaks your language. Choose English, Afrikaans, isiZulu, isiXhosa, Sesotho or another language on your Me page.') },
    { id: 'lib-there', who: ['everyone'], not: ['librarian'], app: 'library', href: '#/library/all', text: TX('The church has a library. Open Library to see what is there – what you have borrowed shows on your Me page.') },
    { id: 'lib-ask', who: ['everyone'], not: ['librarian'], app: 'library', href: '#/library/all', text: TX('Seen a book you’d like to read? Tap Request to borrow in the Library, and a librarian will get it ready for you.') },
    { id: 'msg-office', who: ['everyone'], app: 'messages', href: '#/messages', text: TX('Messages from the church arrive under Messages. You can write to the church office there too.') },
    { id: 'groups-mine', who: ['everyone'], app: 'groups', href: '#/groups', text: TX('Groups → My groups shows the groups you belong to.') },
    { id: 'offline', who: ['everyone'], text: TX('No internet? Church Hub still shows what you last saw, view only, until you’re back online.') },
    // Librarians
    { id: 'lib-lend', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('As a librarian, you lend an item with its Lend button, and tap Returned when it comes back.') },
    { id: 'lib-repair', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Something damaged? In the item’s ⋯ menu, choose Mark as damaged – nobody can borrow it until it is repaired or put back.') },
    { id: 'lib-out', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Lost, or no longer needed? In the item’s ⋯ menu choose Withdraw from circulation or Take out of the library – it can be put back later.') },
    { id: 'lib-remind', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Three weeks after a loan Church Hub reminds the borrower. You can also send the reminder by WhatsApp or SMS.') },
    { id: 'lib-requests', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Members can ask to borrow an item. Their requests wait at the top of the Library for you to say yes or no.') },
    { id: 'lib-reports', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Library → More → Reports shows what was lent, returned, lost and added in any period.') },
    // Care Group carers
    { id: 'carer-msg', who: ['carer'], app: 'messages', href: '#/messages', text: TX('As a carer, you can send a message to everyone in your Care Group from Messages.') },
    // Roster coordinators
    { id: 'ros-fill', who: ['rosters', 'admin'], app: 'rosters', href: '#/rosters', text: TX('Fill the gaps for me (on Rosters) suggests fair turns, keeping everyone’s days away and leave in mind.') },
    { id: 'ros-offers', who: ['rosters', 'admin'], app: 'rosters', href: '#/rosters', text: TX('Offers to serve from members wait for you at the top of Rosters → Teams.') },
    // Children's ministry
    { id: 'kids-medical', who: ['kids'], app: 'people', text: TX('Children’s medical notes are seen only by Children’s ministry – not even Administrators see them.') },
    // Pastors
    { id: 'pastor-notes', who: ['pastor'], app: 'people', text: TX('Pastoral notes on a person’s page are seen only by Pastors.') },
    { id: 'senior-viewas', who: ['senior'], text: TX('As Senior Pastor you can use View as… to see Church Hub the way another role sees it.') },
    // Staff who see the People list
    { id: 'people-search', who: ['staffwork'], app: 'people', href: '#/people', text: TX('Advanced search on People finds people by almost anything – their age, a birthday coming up, the service they serve at.') },
    // Administrators
    { id: 'admin-viewas', who: ['admin'], text: TX('Use View as… in the menu to see exactly what a Pastor, a Roster coordinator or a member sees.') },
    { id: 'admin-apps', who: ['admin'], app: 'settings', href: '#/settings', text: TX('Settings → Apps switches parts of Church Hub on and off, such as the Library or Midweek Groups.') },
    { id: 'admin-change', who: ['admin'], app: 'people', href: '#/people', text: TX('In Advanced search you can tick people in the results and change one thing for all of them at once.') },
    { id: 'admin-dupes', who: ['admin', 'pastor'], app: 'people', href: '#/people', text: TX('Find duplicates (on People) helps you join two records of the same person into one.') },
    { id: 'admin-see', who: ['admin'], app: 'settings', href: '#/settings', text: TX('Settings → Who can see what decides which contact details each role may see.') }
  ];

  /** ctx: { tags: ['everyone', 'member', …], on: function (appId) → may this person open that part? } */
  function fits(item, ctx) {
    var tags = (ctx && ctx.tags) || [];
    var has = function (t) { return tags.indexOf(t) >= 0; };
    if (!(item.who || []).some(has)) return false;
    if ((item.not || []).some(has)) return false;
    return !item.app || !ctx.on || !!ctx.on(item.app);
  }
  /** The tips for this person, in the order above. */
  function forPerson(ctx, list) { return (list || TIPS).filter(function (t) { return fits(t, ctx); }); }
  /** The news for this person from the last NEWS_DAYS days (today: 'YYYY-MM-DD'), newest first, at most `max` (2). */
  function news(ctx, today, max, list) {
    var from = addDays(today, -NEWS_DAYS);
    return (list || NEWS).filter(function (n) { return n.date <= today && n.date > from && fits(n, ctx); })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, max || 2);
  }
  /** The next tip to show and the updated list of tips already seen (ids). After the last one it starts again. */
  function next(tips, seen) {
    seen = (seen || []).filter(function (id) { return tips.some(function (t) { return t.id === id; }); });
    if (!tips.length) return { tip: null, seen: seen };
    var fresh = tips.filter(function (t) { return seen.indexOf(t.id) < 0; });
    if (!fresh.length) { seen = []; fresh = tips; }
    return { tip: fresh[0], seen: seen.concat(fresh[0].id) };
  }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  var Tips = { TIPS: TIPS, NEWS: NEWS, NEWS_FOR: NEWS_FOR, NEWS_DAYS: NEWS_DAYS, fits: fits, forPerson: forPerson, news: news, next: next };
  if (typeof module !== 'undefined' && module.exports) module.exports = Tips; else global.Tips = Tips;
})(typeof window !== 'undefined' ? window : this);
