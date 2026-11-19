# Billing decisions (task 059)

The owner's answers, as they are made. Anything not answered here is still open (see `tasks/059-billing-decisions.md`).

## Decided
- **The price** (16 Nov 2026): a coffee a month, or ten a year, at a suggested price of what one cup costs where the church
  lives, in its own money (about R50 in South Africa) – per church, not per person. Churches are nudged to give what is honest
  for their circumstances. Optional gifts; paying for an under-resourced church. Details: `docs/PRICES.md`, `js/coffee.js`.
- **Every church is welcome** (16 Nov 2026): a church that can't pay uses Church & Trellis free by promising to pray for
  another church each month. Nothing is ever locked or deleted for late payment.
- **Payment holidays** (19 Nov 2026): a church that gives monthly may take a free month, no questions asked, whenever it
  needs and as often as it needs. A yearly church switches to monthly to use it (what it paid stays paid).
- **Payment company** (19 Nov 2026): **PayFast** – card, Instant EFT and SnapScan, paid out in rand to the owner's South
  African account. One payment at a time (no debit orders). PayFast's merchant details are kept out of the repository and the
  app: they live only in the payment doorway's secret settings on Cloudflare (`docs/PAYFAST-SETUP.md`).
- **No bank or account details in the code or the chat** (19 Nov 2026).

## Still open
- Who receives the money (the owner personally, a company or a non-profit) – ask an accountant; it decides the PayFast
  account type and whether subscription money is taxable income.
- Terms a church accepts at setup; refunds.
