# Working on Church Hub

- Plain HTML/CSS/JavaScript, no build step. Open `index.html` or the GitHub Pages site.
- Read `docs/ARCHITECTURE.md`, `docs/POPIA.md` and `docs/ROADMAP.md` before changing anything; update ROADMAP.md at the end of each session.
- New features are modules (`js/mod-*.js`) registered with `Hub.register`. Data goes through `Store` only, never localStorage directly.
- Rostering rules live in `js/roster.js` and must stay pure and tested: run `node tests/roster.test.js` before committing.
- `js/leave-core.js` is a copy of `assets/core.js` from the `leave-manager` repository (also used by its Apps Script). Change both together.
- Privacy (POPIA): every new piece of personal information needs a purpose, a consent or lawful basis, an access rule by role, and audit logging for sensitive views. Never commit real church data, names, keys or passwords – the repository is public.
- Talk to the church in plain English; the users are not technical.
