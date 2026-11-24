# Making Church & Trellis feel like one app – plan and brief for the Architect

**Status:** ⬜ planned for later (written 24 Nov 2026). Not started – the owner is finishing roster testing first.
Listed on `docs/ROADMAP.md` under "One app, one feel".

## The question that was asked
Would it be worth asking Fable to redesign and rewrite Church & Trellis from scratch, perhaps in a different
language, to make it more cohesive and unified?

## The answer: review and unify, don't rewrite
Church & Trellis is about 31,500 lines of app code in some 75 files, plus 22 language files, a large automated
test suite, the security rules, the robots, the setup tool, the website and the presentation. A rewrite would:

- lose hundreds of small decisions built into the code (communion Sundays, attendees and Church Partners,
  shared household sign-ins, Care Group naming, payment holidays, who sees what…) that would have to be found again;
- stop new features for months, just before the conference;
- throw away the tests that catch breakages today.

The technology is right for the goals: plain HTML/CSS/JavaScript with no build step is light, works offline,
keeps data costs low, and any AI or volunteer can work on it without special setup. A framework or another
language would make it heavier and more dependent on a developer, and would not fix what feels wrong.

What feels "not cohesive" comes from many sessions (Claude, Copilot, Jules, Antigravity) building pages one at a
time. It shows in three places, all fixable without starting again:

1. **Look and feel** – buttons, cards, lists, spacing and headers differ from page to page.
2. **How things work** – the same job (adding a person, choosing people, confirming, empty pages) works
   differently on different pages.
3. **Settings and who-sees-what** – still spread out in places (`js/access.js` has begun gathering them).

## The plan
1. **Architect (Fable): review and design** – the brief below. Output: a findings list, a short design system
   and a task list. No code changes.
2. **Implementer (Opus): move the app over one page at a time**, each page its own pull request, with the tests
   green after each. The app keeps working throughout.
3. **Only where the review finds a genuinely tangled area** (the largest files are `js/store.js` and `js/app.js`):
   rebuild that one part, with its tests – a targeted rewrite, not a whole one.

## Brief for the Architect (paste into a Fable session with the repository attached)

> You are the Architect for Church & Trellis (repository pian1966/church-hub). Read `CLAUDE.md`, then
> `docs/architecture/COHESION-PLAN.md`, `docs/ARCHITECTURE.md` and `docs/architecture/MODELS.md`.
> Do not change any code in this session.
>
> **Goal.** Church & Trellis must feel like one app, made by one hand: elegant, beautiful and a pleasure to
> use – in the spirit of Apple's design philosophy – not merely functional. The owner dislikes boring grey
> lists of radio buttons and checkboxes. It is used on cheap phones, often offline, where data is expensive,
> by people who are not technical, in many languages. The decision has been made **not** to rewrite from
> scratch or change language: plain HTML/CSS/JavaScript, no build step, stays.
>
> **1. Review.** Open the demo (`index.html`) at phone width (390px) and desktop, as Administrator, Rector,
> a Church Partner and an attendee. Go page by page (Home, Me, People, Rosters, Groups, Messages, Events,
> Library and Archives, Leave, Community board, Marketplace, Help, Settings, Subscription, About). List where
> pages disagree: layout, headers and the watercolour themes, buttons, cards, lists, forms, pickers,
> confirmations, empty states, wording, icons, motion, and how the same job is done differently. Note anything
> that is hard to discover or feels clunky. Check the screen-layout rules in `CLAUDE.md` against what is built.
>
> **2. Design system.** Write `docs/DESIGN-SYSTEM.md`: colours (including the orange "&"), type, spacing,
> the standard building blocks (page head, tabs, main button and "More" menu, cards, list rows, person
> chips, pickers for choosing people, forms, confirmations, empty states, toasts, pressed-button feel), how the
> page themes (Soft watercolour, Warm line art, plain) apply, and small touches of delight. Each block should be
> one shared helper or CSS class in `css/hub.css` / `js/app.js`, so a page uses it rather than building its own.
>
> **3. Code health.** Say which parts, if any, are genuinely tangled and worth rebuilding (look especially at
> `js/store.js` and `js/app.js`), and which duplicate one another. Recommend the smallest change that fixes each.
>
> **4. Task list.** Write tasks in `docs/architecture/tasks/` in the existing format, one page or one building
> block per task, each with its Model line (Opus for implementation, cheaper tiers where they will do), in an
> order that keeps the app working and the tests green after every pull request. Add a short entry to
> `docs/ROADMAP.md` pointing to them.
>
> Write for an owner who is not technical: plain English in anything he will read.
