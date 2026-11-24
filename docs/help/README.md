# Church & Trellis help – questions and answers

These pages answer the questions people are likely to ask about using Church & Trellis. They are written for the
church (not for developers), in plain English, and are meant to be used two ways:

1. **Read as they are** – a searchable help / FAQ page.
2. **By Help in the app** (js/help.js, js/mod-help.js) – a person types or says a question; Church & Trellis finds the
   matching answers here and, if the church has switched on AI (Settings → Apps), an AI writes a reply for that person's question,
   kind of access, language and the church's own words, using **only** these pages, and shows the pages it used. Without AI the
   matching pages are shown as they are. **Help reads these files straight from the website, so a change here is live as soon as it is
   merged; every page must be listed in `Help.PAGES` in js/help.js** (`node tests/help.test.js` checks it).

## Pages
| Page | Covers |
| --- | --- |
| [getting-started.md](getting-started.md) | Signing in, shared email addresses, the phone app, offline, language, light/dark, updates, using Help |
| [me.md](me.md) | The Me page: my details, consent, days away, my serving, taking someone's place, offers to serve, becoming a Church Partner |
| [rosters.md](rosters.md) | Replying to roster turns; for roster coordinators: the roster view, asking who's away, teams, services, communion, reminders, together/apart |
| [leave.md](leave.md) | Staff leave: requesting, changing, cancelling; for Administrators: approving, settings, reports |
| [care-groups.md](care-groups.md) | Care groups for members, carers and staff |
| [midweek-groups.md](midweek-groups.md) | Midweek groups (Bible studies, life groups) for members, leaders and staff |
| [leadership.md](leadership.md) | Leadership groups (the Council, elders, leaders): roles, titles and portfolios |
| [archive.md](archive.md) | Library → Archives: minutes, plans, contracts and other church records, and who can see them |
| [library.md](library.md) | The church Library: finding, borrowing and returning books; for librarians |
| [events.md](events.md) | Events: seeing what's coming up, signing up, reminders; for organisers: putting up an event, the sign-up list, paper sheets from a photo |
| [messages.md](messages.md) | Reading and sending messages inside Church & Trellis |
| [people.md](people.md) | For staff: adding and editing people, households, children, duplicates, searching, a death |
| [events.md](events.md) | Events: signing up, guests, reminders; for organisers: putting up an event, who's coming, the sign-up report, adding people, a photo of a sheet, cancelling |
| [community-board.md](community-board.md) | The Community board: pinning, renewing and reporting notices; for keepers: checking notices, choosing keepers |
| [marketplace.md](marketplace.md) | The Marketplace: listing, the rules, contacting a seller, marking sold; for keepers: checking listings |
| [subscription.md](subscription.md) | For Administrators: the price of a coffee, paying, payment holidays, praying instead, gifts, the prayer circle and prayer card |
| [privacy.md](privacy.md) | Consent, what others can see, and the Privacy pages for Administrators |
| [settings.md](settings.md) | For Administrators: settings, apps, services, wording, roles, View as, imports, setting up Church & Trellis at another church |
| [translations.md](translations.md) | Languages and suggesting better wording |

## How each answer is written
```
## How do I …?            ← the question, as a person would ask it
For: Members              ← who it applies to (Everyone, Members, Staff, Carers, Group leaders,
                            Roster coordinators, Children's ministry, Pastors, Administrators)
Also asked: …             ← other ways people say the same thing (helps search and dictation)

The answer: short steps using the exact words on the screen, in **bold**.
```

Rules for writing and updating answers:
- Use the words the screens use (the buttons are in `T('…')` in the code). If a screen changes, change its answer here
  in the same pull request.
- Never describe something Church & Trellis doesn't do. If it's planned, say "not yet".
- Churches can rename words (Settings → Terminology), e.g. *Church Partner* may show as *Parishioner*, and *Pastor* as
  *Rector*. These pages use the built-in words; the helper should use the church's own words when it answers.
- No real names or church data – the repository is public.
- Menus: on a computer the apps are in the menu on the left; on a phone, the tabs at the bottom and **More** for the rest.
