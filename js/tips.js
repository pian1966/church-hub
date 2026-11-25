/* Church & Trellis – "What's new" and "Did you know?" on Home: a sentence on the latest changes, and one tip about a part of
 * Church & Trellis, chosen for the person who signed in. Each tip says who it is for (`who`: any of the tags below), who it is
 * not for (`not`), and which part of Church & Trellis must be switched on and open to them (`app`), so nobody is told about
 * something they can't use: a member hears that there is a library and that their Me page shows what they borrowed; a
 * librarian hears how to lend, repair or take out an item.
 * Tags (worked out in js/app.js, homeTags): everyone; the role (admin, pastor, rosters, kids, member); librarian; carer
 * (leads a Care Group); lifelead (leads a Midweek Group); senior (the Senior Pastor); staffwork (sees the People list: Administrators, Pastors, Roster
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
  var NEWS_FOR = '0.115';
  var NEWS = [
    { date: '2026-11-25', who: ['everyone'], text: TX('Each Help answer now ends with a button that opens the screen it is about, such as Open Me or Open Library.') },
    { date: '2026-11-24', who: ['everyone'], not: ['attendee'], app: 'me', btn: ['Me', 'My details'], text: TX('Church Partners now see 🎂 or 💍 beside someone’s name in the church directory on their birthday or wedding anniversary (the day only). Don’t want yours shown? Turn it off on Me → My details.') },
    { date: '2026-11-24', who: ['pastor', 'admin', 'carer', 'lifelead'], text: TX('Pastors, carers and Midweek Group leaders now see Birthdays this week on Home. Pastors also see who may have a hard day, on the anniversary of a husband’s or wife’s death.') },
    { date: '2026-11-24', who: ['everyone'], text: TX('Birthdays and wedding anniversaries now get a little celebration: on your own day you see a card on Home and Me, and 🎂 or 💍 appears beside a name wherever the church already shows that date.') },
    { date: '2026-11-24', who: ['everyone'], text: TX('Buttons now press down a little when you tap them.') },
    { date: '2026-11-24', who: ['admin', 'rosters'], app: 'rosters', btn: ['Rosters', 'Print'], text: TX('Rosters has a tidier top: Print now has its own button, and the arrows and date for moving between Sundays sit just above the roster.') },
    { date: '2026-11-24', who: ['everyone'], app: 'rosters', btn: ['Rosters'], text: TX('Rosters on a phone: the roster now shows two or three services side by side instead of just one – swipe sideways to see more, or use the arrows either side of the date.') },
    { date: '2026-11-24', who: ['admin', 'rosters'], app: 'rosters', btn: ['Rosters', 'Teams'], text: TX('Rosters: a position can now need a different number of people at each service – on Rosters → Teams choose the service (8am, 10am or 5pm) and tap − or +. The roster, the gaps and the printed roster follow it.') },
    { date: '2026-11-24', who: ['admin', 'rosters'], app: 'rosters', btn: ['Rosters', 'Cancel this service…'], text: TX("Rosters: a service that is cancelled keeps a narrow column on the roster – on screen, on paper and in the PDF – with the note written up its side. Tap ⋯ under its date → Cancel this service…; everyone on it stays on the roster, can be sent a friendly message, and comes back when you put the service back.") },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Me', 'Serving'], text: TX("If a service you were rostered on is cancelled, Me → Serving now says Cancelled (and you may get a friendly message), and the printed roster keeps a narrow column for it.") },
    { date: '2026-11-24', who: ['everyone'], app: 'help', btn: ['Help'], text: TX('New: Help. Type or say a question about using Church & Trellis and get an answer written for you from the help pages – or browse them by topic.') },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Me', 'Themes'], text: TX('New: Me → Themes. Everyone can now choose their own colour and page pictures (soft watercolour, warm line art or plain) – only you see them, on this device – and go back to the church’s theme at any time.') },
    { date: '2026-11-24', who: ['everyone'], text: TX('Every page now has a soft watercolour picture at the top. Administrators and the Rector can choose warm line art instead, or go back to plain, under Settings → Themes → Page pictures.') },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Me', 'Serving'], text: TX('On each of your turns on Me → Serving you can now see who else is serving at that service – names and jobs, your own team first.') },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Can’t make it'], text: TX('Can’t make a turn? Tap Can’t make it and you can ask someone on your team who is free that day to take your place – they answer with one tap, and the roster team is told.') },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Me', 'Serving'], text: TX('Before a new term’s roster is made, you may be asked whether you’ll be away: add your days away, or tap I’m free. And you can now choose to serve once a quarter, or take a break without leaving the team.') },
    { date: '2026-11-24', who: ['admin', 'pastor', 'rosters'], btn: ['Rosters', 'More', 'Ask who’s away…'], text: TX('Before filling a new term: Rosters → More → Ask who’s away… asks every volunteer to add their days away or say they’re free, and the roster shows who has answered, with Remind the others.') },
    { date: '2026-11-24', who: ['everyone'], app: 'me', btn: ['Me', 'Serving'], text: TX('All your serving is now in one place: Me → Serving. It shows your turns to answer, each position you serve in with its services (8am, 10am, 5pm), your days away and who you serve with.') },
    { date: '2026-11-24', who: ['admin', 'pastor', 'rosters'], btn: ['Rosters', 'Teams'], text: TX('Rosters → Teams now shows the services each position is needed at, and how many can serve any week, once a month or as a backup. Tap 8am, 10am or 5pm to see only that service’s teams.') },
    { date: '2026-11-24', who: ['everyone'], text: TX('Easier to read: on your own page your details now come first and your groups last, headings are a little bigger, and the main buttons are a softer orange on every page.') },
    { date: '2026-11-24', who: ['admin', 'archivist'], app: 'library', text: TX('Archives look much friendlier: each folder is a coloured tile, documents show what kind of file they are with Preview and Download beside them, you always see where you are, and the newest documents are on the first page.') },
    { date: '2026-11-23', who: ['everyone'], text: TX('In Did you know? and What’s new, the names of buttons and menu items now look like little buttons, so it is easy to see what to tap.') },
    { date: '2026-11-23', who: ['admin', 'pastor', 'rosters'], btn: ['Rosters', 'Teams'], text: TX('Rosters → Teams: the Administrator, the Rector and the assistant ministers can now write a position’s tooltip, and a new position is added in one box. On a phone, tap the small i beside a position to read its tooltip.') },
    { date: '2026-11-23', who: ['admin', 'pastor', 'rosters'], btn: ['Rosters', 'Teams'], text: TX('Rosters → Teams: a position that was added by mistake, or isn’t used any more, can now be deleted (⋯ beside it). Each position’s names fold away until you tap them, and its tooltip is set from the same ⋯ menu.') },
    { date: '2026-11-24', who: ['everyone'], app: 'rosters', btn: ['Rosters', 'My serving', 'Print or download the roster'], text: TX("Rosters: anyone can now print or download the whole roster as a PDF – portrait or landscape, for a month up to a year, with the positions down the side and every Sunday across the top. A Sunday with no service stays as a column and says so. Rosters → My serving → Print or download the roster (planners: More).") },
    { date: '2026-11-20', who: ['admin', 'pastor', 'rosters', 'kids'], app: 'events', btn: ['Choose a photo'], text: TX('Adding names from a sheet to an event: each person now has their own guests counter (filled in from “+2” on the sheet). Choose a photo also opens Google Photos on Android.') },
    { date: '2026-11-20', who: ['admin', 'pastor', 'rosters', 'kids'], btn: ['People'], text: TX('Say a name instead of typing it: tap the microphone in People’s search, or in any box where you look for someone. Names that sound like what you said come up too – tap the right one.') },
    { date: '2026-11-20', who: ['admin', 'pastor', 'rosters', 'kids'], app: 'events', btn: ['From a sheet'], text: TX('Events: a whole paper sign-up sheet at once – open the event, tap From a sheet and take a photo. Church & Trellis reads the names and finds them in People; you check each one. Pastors and Administrators can register someone who isn’t in People yet.') },
    { date: '2026-11-20', who: ['admin', 'pastor'], btn: ['People', 'From a photo'], text: TX('Visitor cards: People → From a photo reads the names (and any phone numbers and email addresses) and adds the new people as Attenders, after you check each one.') },
    { date: '2026-11-20', who: ['admin', 'pastor', 'rosters', 'kids'], app: 'events', btn: ['Events', 'More', 'Sign-up report', 'Print'], text: TX('Events: print everyone who has signed up, with their cellphone numbers – or save it as a PDF. Events → More → Sign-up report, or Print on an event.') },
    { date: '2026-11-20', who: ['admin', 'pastor', 'rosters', 'kids'], app: 'events', btn: ['Add people'], text: TX('Events: anyone on the staff can now add people to an event – for those who put their name down on a sheet. Open the event and tap Add people under Who’s coming.') },
    { date: '2026-11-20', who: ['admin'], btn: ['Settings', 'Apps'], text: TX('New: Events. Switch it on under Settings → Apps. Put events up, see who’s coming and write to them all; people sign up with one tap and are reminded 3 days and 1 day before – in Messages, and by email if they like.') },
    { date: '2026-11-20', who: ['everyone'], app: 'events', btn: ['I’ll be there'], text: TX('Events are here: see what’s coming up, tap I’ll be there, and we’ll remind you 3 days and 1 day before.') },
    { date: '2026-11-20', who: ['admin', 'pastor'], text: TX('Invite people to Church & Trellis by email or WhatsApp – one person from their page, or a whole Care Group, Midweek Group or serving team from Advanced search. It gives them access, and People → Invitations shows who hasn’t started yet, with Remind.') },
    { date: '2026-11-20', who: ['everyone'], btn: ['Get the app'], text: TX('On an Android phone, Home now offers the Church & Trellis app – tap Get the app.') },
    { date: '2026-11-20', who: ['rosters', 'admin', 'pastor'], text: TX("Print the roster a term at a time on A4: each service gets its own page, showing only the positions with names on them. Rosters → More → Print the roster (Pastors: on My serving). Choose “Save as PDF” to make a PDF.") },
    { date: '2026-11-19', who: ['admin'], btn: ['Access and roles', 'View as'], text: TX('Settings: who can see what, Attendees and What Pastors can do are now one page, Access and roles – a card for each kind of person says what they see and can do, with View as one tap away. Nothing about anyone’s access has changed.') },
    { date: '2026-11-19', who: ['lifelead'], app: 'life', text: TX('Midweek Group leaders: post this week’s meeting link and notes under Groups → Midweek Groups. Your group gets them in Messages, with Join the meeting and Open the notes – now or on the day.') },
    { date: '2026-11-19', who: ['everyone'], app: 'life', text: TX('On the day of your Midweek Group, Home shows a card with Join the meeting and Open the notes – it becomes Join now 15 minutes before.') },
    { date: '2026-11-19', who: ['rosters', 'admin'], text: TX('Names are now listed from A to Z in Rosters (teams and serving groups), Groups, the Librarians, the keepers and Privacy – tap a name to open the person’s page.') },
    { date: '2026-11-19', who: ['admin'], app: 'support', text: TX("Subscription: a church that gives monthly can now take a payment holiday whenever it needs one, no questions asked (a yearly church switches to monthly first), and paying is moving to PayFast – card, Instant EFT or SnapScan – with no bank details shown.") },
    { date: '2026-11-19', who: ['admin'], text: TX('New: the Community board and the Marketplace. Switch them on under Settings → Apps. The pastors, the Administrators and the church secretary check everything before anyone sees it – change who under More → Keepers….') },
    { date: '2026-11-19', who: ['everyone'], app: 'board', text: TX('The Community board is here: pin a sticky note to ask for help, offer it or say thank you. The latest three show on your Home page.') },
    { date: '2026-11-19', who: ['everyone'], app: 'market', text: TX('The Marketplace is here: buy, sell and give away within the church. A keeper checks every listing before anyone sees it.') },
    { date: '2026-11-19', who: ['everyone'], text: TX("Church Hub has a new name: Church & Trellis. Everything works as before, and nothing you have saved has changed.") },
    { date: '2026-11-19', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters now open with as many services as fit your screen. Use − and + to see from 1 to 16 side by side, or choose 1 month or 1 quarter and slide across.') },
    { date: '2026-11-19', who: ['lifelead'], not: ['admin', 'pastor'], app: 'life', text: TX('Midweek Groups: every group leader can now add anyone to their group with “Add someone to the group”, people who only come to church too – they see just each person’s name.') },
    { date: '2026-11-19', who: ['everyone'], app: 'support', text: TX("Every week, Home now shows a different church to pray for – the same one for everyone at your church that week, so you can pray for it together on Sunday.") },
    { date: '2026-11-19', who: ['admin'], app: 'support', text: TX("Administrators: every church now keeps a prayer card and looks at it once a month – Home reminds you. A paying church can turn off the weekly prayer card under Subscription → Churches to pray for.") },
    { date: '2026-11-19', who: ['admin', 'pastor'], app: 'life', text: TX('Midweek Groups: when a Pastor or Administrator who leads a group uses “Add someone to the group”, they can now choose anyone, not only people in the church directory – the same as from a person’s page.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters: choose how many services to see side by side, from 2 to 8, and the top row (date, time and communion) stays in view as you scroll down.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters: six services side by side with a slider to move across, an eye to hide a service for now, and departments can be put in order or joined together (Teams → ↑ ↓ and ⋯).') },
    { date: '2026-11-18', who: ['archivist'], app: 'library', text: TX('Archives: a document you add now shows in its folder straight away, and the Senior Pastor sees staff contracts and appraisals again.') },
    { date: '2026-11-18', who: ['senior'], app: 'about', text: TX('The Senior Pastor can now open the brochures under About, and print them or save them as a PDF.') },
    { date: '2026-11-18', who: ['archivist'], app: 'library', text: TX('Archives now has folders: Council meetings sort themselves into years and months by date, and Church & Trellis shows where a document will go – and asks if its date looks wrong – before saving.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters: choose a date beside Earlier and Later to jump straight to the services that need filling then.') },
    { date: '2026-11-18', who: ['admin', 'pastor'], app: 'people', text: TX('When someone applies to become a Church Partner, Administrators and Pastors now also get a message in Messages.') },
    { date: '2026-11-18', who: ['everyone'], app: 'rosters', text: TX('Services are now shown in time order (8am, 10am, 5pm) and in their own colours on the roster, My serving and Settings.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters → Teams: use − and + to choose how many people a position needs at each service, for example 2 on the sound desk.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters → Teams now offers a Verger, Ushers and Recorded Music, and Collection Servers and Communion Servers as two separate positions – tap Add them.') },
    { date: '2026-11-18', who: ['staffwork'], app: 'people', text: TX('You can now drag the columns in Advanced search to put them in the order you want.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters: tap a name and choose Change person to swap it in one go – the first person is told, and a message they haven’t opened is taken back.') },
    { date: '2026-11-18', who: ['rosters', 'admin'], app: 'rosters', text: TX('Rosters now show only the departments and positions needed at the services you’re looking at.') },
    { date: '2026-11-18', who: ['everyone'], text: TX('The Church & Trellis icon on your phone or computer now has the same thin cross as inside the app.') },
    { date: '2026-11-17', who: ['staffwork'], app: 'people', text: TX('Advanced search looks calmer: each filter has a small × to remove it, and one Add a filter button sits underneath.') },
    { date: '2026-11-17', who: ['everyone'], app: 'library', text: TX("Library: if you have borrowed something, the Library now opens on Items I have borrowed; tap Library for the whole catalogue.") },
    { date: '2026-11-17', who: ['everyone'], app: 'people', text: TX("People: each field on a person’s page and in Edit details now has a small icon, so you can see at a glance what it asks.") },
    { date: '2026-11-17', who: ['everyone'], app: 'library', text: TX('Library: the items you have borrowed now have a tab of their own, before Library and Archives.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Members with no email address can now sign in with their cellphone number and a PIN: the church office gives them a sign-in code once, and with it they choose their PIN.') },
    { date: '2026-11-17', who: ['admin'], text: TX('Administrators: give a member with no email a sign-in code from their page (App access → Give a sign-in code) – by WhatsApp, on a printed slip or on screen. With it they choose a PIN. Switch on Anonymous and Email/Password sign-in in Firebase first.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Edit details now saves as you go, like the rest of Church & Trellis – no Save button, just tap Done when you’re finished.') },
    { date: '2026-11-17', who: ['everyone'], text: TX('Every drop-down list now opens in full as soon as you tap it, and narrows down as you type – handy for finding a name in a long list.') },
    { date: '2026-11-17', who: ['admin', 'pastor'], app: 'people', text: TX('People: in Edit details, choose someone’s Spouse or partner by hand – even when they live apart – and Church & Trellis links them on both records.') },
    { date: '2026-11-17', who: ['admin', 'pastor'], app: 'people', text: TX('People: Edit details now has a Maiden name box for women who are or were married, and People’s search finds them by it. Church office notes now sit near the top of a person’s page, so adding one is easy to find.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Subscription: the page now makes clear that the price is per church, not per person, and that a low price doesn’t mean Church & Trellis does less.') },
    { date: '2026-11-16', who: ['everyone'], text: TX('About now has a link to Church & Trellis’s website, which shows what Church & Trellis offers to every church – handy to share with friends at other churches.') },
    { date: '2026-11-16', who: ['admin', 'pastor'], app: 'messages', text: TX('Messages: Sent now shows only the messages you sent. Administrators and Pastors find everyone’s messages under All messages, and set up groups under Message groups.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Subscription: each church now gives the price of one cup where it lives, in its own money – chai from a stall, a café coffee or a coffee-chain latte, whichever is honest for the church – and the prayer card can use a photo taken there and then.') },
    { date: '2026-11-16', who: ['admin'], app: 'support', text: TX('Administrators: the new Subscription page (one coffee a month, or ten a year) shows when your next payment is due, lets you add a gift in one tap, and offers a free payment holiday when money is tight.') },
    { date: '2026-11-16', who: ['everyone'], text: TX('Church & Trellis is for every church: a church that can’t afford it can pray for another church each month instead, and that church appears on everyone’s Home page.') },
    { date: '2026-11-16', who: ['rosters', 'admin'], app: 'rosters', text: TX("Holy Communion: under Rosters → Services, choose which Sundays of the month each service has communion, and communion servers and providers are only asked for then. For a one-off change, tap “Communion” under that date in the roster.") },
    { date: '2026-11-16', who: ['everyone'], app: 'messages', text: TX('Writing a message is easier: tap the box at the top to choose who it’s for from clear cards and lists, each showing how many people it reaches.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Church & Trellis now moves more gently: pages and windows ease in, new messages glide into the conversation, and a small green tick shows when something is saved.') },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX('In Messages → Sent, you now choose how the delivery signs look from four picture cards, each showing its steps and which apps and countries use that style.') },
    { date: '2026-11-15', who: ['everyone'], app: 'rosters', text: TX('When you’re put on a roster, a message now comes to your Messages inbox, and you can accept or say you can’t make it right there.') },
    { date: '2026-11-15', who: ['rosters', 'admin'], app: 'rosters', text: TX('Roster coordinators: when someone says they can’t make it, you now get a message. Rosters → More → Remind those who haven’t replied sends everyone still to answer a reminder.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Updates are smaller now: a new version of Church & Trellis downloads only the parts that changed, so it uses much less data.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX('Librarians: the Find book covers window now keeps your place while it searches, instead of jumping back to the top after every book.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX("Librarians: covers found online now work for many more books, you can ask for another cover if the first is wrong, and each item’s ⋯ menu and Edit form have “Find a cover online”.") },
    { date: '2026-11-15', who: ['everyone'], text: TX('Dates can now be typed, like 12 Aug 1990 – birthdays, anniversaries and every other date – so there’s no more tapping back through the calendar month by month.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('About now has a round ✕ at the top right that stays there as you scroll, so you can always get back – handy on the Android app.') },
    { date: '2026-11-15', who: ['everyone'], text: TX("Church & Trellis fits phones better: buttons no longer squeeze names and wording (Translations, Leave approvals, Serving together), Terminology and school terms fit the screen, and menus open within it.") },
    { date: '2026-11-15', who: ['admin', 'pastor'], app: 'care', text: TX("When you edit someone on a phone, each Care Group now has its own line, and the “leads it” tick appears only once that group is ticked.") },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX("Tap the ticks by your message’s time to see what they mean – a short note pops up and disappears by itself.") },
    { date: '2026-11-15', who: ['everyone'], app: 'messages', text: TX("Messages can now show what the ticks mean, and you can choose ticks, envelopes, a filling circle or words; the first tick turns blue once some have read a group message.") },
    { date: '2026-11-15', who: ['everyone'], app: 'me', text: TX('Chinese and Japanese can now be chosen as languages; for now only the main screens are translated.') },
    { date: '2026-11-15', who: ['everyone'], app: 'me', text: TX('Your Me page has a new Consent tab: it shows what you’ve agreed to, and what each “No” means for you.') },
    { date: '2026-11-15', who: ['everyone'], not: ['attendee'], app: 'messages', text: TX('You can now reply to a message: tap Reply and your answer goes privately to the person who sent it.') },
    { date: '2026-11-15', who: ['librarian'], app: 'library', text: TX('The Library now shows each item once, with who has it on its own row, and has tabs for overdue, damaged and withdrawn items.') },
    { date: '2026-11-15', who: ['admin', 'senior'], text: TX('Settings → Attendees decides what people who aren’t Church Partners yet may see and do in Church & Trellis.') },
    { date: '2026-11-15', who: ['everyone'], text: TX('Home now shows what’s new in Church & Trellis, and a tip each time you sign in.') },
    { date: '2026-11-14', who: ['everyone'], text: TX('Sesotho can now be chosen as written in South Africa or in Lesotho.') },
    { date: '2026-11-14', who: ['everyone'], app: 'messages', text: TX('Messages now look like a chat: two blue ticks show that everyone has read yours.') },
    { date: '2026-11-14', who: ['librarian'], app: 'library', text: TX('The Library is tidier: one Add button, everything else under More, and repairs in each item’s ⋯ menu.') },
    { date: '2026-11-14', who: ['admin'], text: TX('Settings → Terminology now suggests ministry roles and titles for the church’s administrator.') }
  ];

  var TIPS = [
    // Everyone
    { id: 'help-ask', btn: ['Help'], who: ['everyone'], app: 'help', href: '#/help', text: TX('Not sure how to do something? Open Help, type or say your question, and get an answer written for you.') },
    { id: 'events-cal', btn: ['Add to my calendar'], who: ['everyone'], app: 'events', href: '#/events', text: TX('Signed up for an event? Open it and tap Add to my calendar – your phone reminds you too.') },
    { id: 'study-past', btn: ['Past studies'], who: ['everyone'], app: 'life', href: '#/life', text: TX('Missed a Midweek Group? Its page keeps Past studies, with the notes for each week.') },
    { id: 'board-help', who: ['everyone'], app: 'board', href: '#/board', text: TX('Tap a note on the Community board to see all of it and write privately to the person who pinned it.') },
    { id: 'market-photos', who: ['everyone'], app: 'market', href: '#/market', text: TX('Listing something on the Marketplace? Add up to three photos – Church & Trellis makes them small, so they cost little data.') },
    { id: 'prayer-card', btn: ['Subscription', 'Our prayer card'], who: ['admin'], app: 'support', href: '#/support/card', text: TX('Give your church a prayer card under Subscription → Our prayer card: a photo and two things to pray for, so churches in the prayer circle can pray for you.') },
    { id: 'roster-team', btn: ['Settings', 'Church Services'], who: ['admin'], app: 'rosters', href: '#/settings/services', text: TX('Administrators and Roster coordinators hear when someone can’t make a roster turn. To include someone else, such as the church secretary, add them under Settings → Church Services.') },
    { id: 'me-details', who: ['everyone'], app: 'me', href: '#/me', text: TX('Your Me page has your own details, and you can update your contact details there yourself.') },
    { id: 'me-away', who: ['everyone'], app: 'me', href: '#/me', text: TX('Going away? Add your days away on your Me page, so nobody puts you on a roster while you’re gone.') },
    { id: 'me-serve', btn: ['Me', 'Serving'], who: ['everyone'], app: 'me', href: '#/me', text: TX('When you’re put on a roster, you can accept or decline the turn under Me → Serving.') },
    { id: 'me-offer', btn: ['Me', 'Serving'], who: ['everyone'], app: 'me', href: '#/me', text: TX('Would you like to help? Under Me → Serving you can offer to serve in a team.') },
    { id: 'me-lang', who: ['everyone'], app: 'me', href: '#/me', text: TX('Church & Trellis speaks your language. Choose English, Afrikaans, isiZulu, isiXhosa, Sesotho or another language on your Me page.') },
    { id: 'lib-there', btn: ['Library'], who: ['everyone'], not: ['librarian'], app: 'library', href: '#/library/all', text: TX('The church has a library. Open Library to see what is there – what you have borrowed shows on your Me page.') },
    { id: 'lib-ask', btn: ['Request to borrow'], who: ['everyone'], not: ['librarian'], app: 'library', href: '#/library/all', text: TX('Seen a book you’d like to read? Tap Request to borrow in the Library, and a librarian will get it ready for you.') },
    { id: 'msg-office', who: ['everyone'], app: 'messages', href: '#/messages', text: TX('Messages from the church arrive under Messages. You can write to the church office there too.') },
    { id: 'groups-mine', btn: ['Groups', 'My groups'], who: ['everyone'], app: 'groups', href: '#/groups', text: TX('Groups → My groups shows the groups you belong to.') },
    { id: 'offline', who: ['everyone'], text: TX('No internet? Church & Trellis still shows what you last saw, view only, until you’re back online.') },
    { id: 'say-name', who: ['admin', 'pastor', 'rosters', 'kids'], href: '#/people', text: TX('Looking for someone? Tap the microphone and say their name – even if it’s heard a little wrong, names that sound like it come up.') },
    // Librarians
    { id: 'lib-lend', btn: ['Lend', 'Returned'], who: ['librarian'], app: 'library', href: '#/library/all', text: TX('As a librarian, you lend an item with its Lend button, and tap Returned when it comes back.') },
    { id: 'lib-repair', btn: ['⋯', 'Mark as damaged'], who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Something damaged? In the item’s ⋯ menu, choose Mark as damaged – nobody can borrow it until it is repaired or put back.') },
    { id: 'lib-out', btn: ['⋯', 'Withdraw from circulation', 'Take out of the library'], who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Lost, or no longer needed? In the item’s ⋯ menu choose Withdraw from circulation or Take out of the library – it can be put back later.') },
    { id: 'lib-remind', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Three weeks after a loan Church & Trellis reminds the borrower. You can also send the reminder by WhatsApp or SMS.') },
    { id: 'lib-requests', who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Members can ask to borrow an item. Their requests wait at the top of the Library for you to say yes or no.') },
    { id: 'lib-reports', btn: ['Library', 'More', 'Reports'], who: ['librarian'], app: 'library', href: '#/library/all', text: TX('Library → More → Reports shows what was lent, returned, lost and added in any period.') },
    // Care Group carers
    { id: 'carer-msg', who: ['carer'], app: 'messages', href: '#/messages', text: TX('As a carer, you can send a message to everyone in your Care Group from Messages.') },
    // Roster coordinators
    { id: 'ros-cancel', btn: ['Rosters', 'Cancel this service…'], who: ['rosters', 'admin'], app: 'rosters', href: '#/rosters', text: TX("Service cancelled? Don’t delete it: tap ⋯ under its date on Rosters and choose Cancel this service… – the roster keeps a narrow column for it, and you can tell everyone on it kindly.") },
    { id: 'ros-fill', btn: ['Fill the gaps for me'], who: ['rosters', 'admin'], app: 'rosters', href: '#/rosters', text: TX('Fill the gaps for me (on Rosters) suggests fair turns, keeping everyone’s days away and leave in mind.') },
    { id: 'ros-offers', btn: ['Rosters', 'Teams'], who: ['rosters', 'admin'], app: 'rosters', href: '#/rosters', text: TX('Offers to serve from members wait for you at the top of Rosters → Teams.') },
    // Children's ministry
    { id: 'kids-medical', who: ['kids'], app: 'people', text: TX('Children’s medical notes are seen only by Children’s ministry – not even Administrators see them.') },
    // Pastors
    { id: 'pastor-notes', who: ['pastor'], app: 'people', text: TX('Pastoral notes on a person’s page are seen only by Pastors.') },
    { id: 'senior-viewas', btn: ['View as…'], who: ['senior'], text: TX('As Senior Pastor you can use View as… to see Church & Trellis the way another role sees it.') },
    // Staff who see the People list
    { id: 'people-search', btn: ['Advanced search'], who: ['staffwork'], app: 'people', href: '#/people', text: TX('Advanced search on People finds people by almost anything – their age, a birthday coming up, the service they serve at.') },
    // Administrators and Council members (who open the Archives)
    { id: 'archive-search', who: ['archivist'], app: 'library', href: '#/library/archives', text: TX('Searching the Archives looks through every folder at once, and shows where each document is filed.') },
    // Administrators
    { id: 'admin-viewas', btn: ['View as…'], who: ['admin'], text: TX('Use View as… in the menu to see exactly what a Pastor, a Roster coordinator or a member sees.') },
    { id: 'admin-apps', btn: ['Settings', 'Apps'], who: ['admin'], app: 'settings', href: '#/settings', text: TX('Settings → Apps switches parts of Church & Trellis on and off, such as the Library or Midweek Groups.') },
    { id: 'admin-change', btn: ['Advanced search'], who: ['admin'], app: 'people', href: '#/people', text: TX('In Advanced search you can tick people in the results and change one thing for all of them at once.') },
    { id: 'admin-dupes', btn: ['Find duplicates'], who: ['admin', 'pastor'], app: 'people', href: '#/people', text: TX('Find duplicates (on People) helps you join two records of the same person into one.') },
    { id: 'admin-see', btn: ['Settings', 'Who can see what'], who: ['admin'], app: 'settings', href: '#/settings', text: TX('Settings → Who can see what decides which contact details each role may see.') }
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
