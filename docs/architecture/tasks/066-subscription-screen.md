# 066 – The Subscription screen and reminders

> **Mostly built (16 Nov 2026)** as its own page, Subscription (`js/mod-support.js`): coffee prices, monthly/yearly,
> gifts, paying for another church, payment holidays, reminders on Home, paying through PayFast (0.97). Still to do here: the licence
> banners (task 061) and card payments once task 059 chooses a company.

**Model:** Middle; translations light.

**Goal:** an Administrator sees what is owed, adds a gift if they wish, and pays.

**Needs:** 061, 065; the payment company from 059 for the Pay button (build the rest first).

**Files:** `js/mod-settings.js` (Settings → Subscription), `js/app.js` (banners per `TARGET.md` 10.4), i18n,
`tests/app/admin.js`, `docs/help/`, `brochure.html` (other-churches panel – the roadmap rule "no prices" changes to
"one Big Mac a year"; check with the owner first).

**Screen:** paid until <date> · this year's price: one Big Mac in <country> = <amount> (as of <index date>) ·
"Would you like to add a gift? Think what Church & Trellis is worth to your church, and what you can afford." [amount box,
may be empty] · **Pay <total>** (opens the payment company's page with the church's id attached) ·
"Someone else is paying for us" (a link to copy) · "We can't afford this" (opens an email to the owner asking for a
free year) · after paying: "Thank you. It can take up to 15 minutes to show here."

**Acceptance:** browser test for each state in 10.4; amounts come only from `js/bigmac.js`.

**Do not:** take card details in Church & Trellis; decide here whether a payment was enough (the robot does).
