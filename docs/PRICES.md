# Prices and lists the Subscription uses (`js/coffee.js`)

## One cup where you live (`EXAMPLES` and `COUNTRY_CURRENCY` in `js/coffee.js`)
Changed 16 Nov 2026: each church pays the price of **one cup of what it would buy where it lives, in its own country's
money** – a cup from a street stall, a coffee at a local café, or a latte at a coffee chain – choosing the one that is honest
for it (a church with plenty can choose the coffee-chain price wherever it is). The church types the price; we only show
examples where we have looked them up:
- South Africa R50, United States US$4.95, Australia A$6.00: a Starbucks Tall latte, menu price guides, November 2026.
- India ₹15: chai at a Delhi roadside stall (Business Today, March 2026: up from ₹10 when gas prices rose).
- Cambodia ៛4 000: iced coffee from a Phnom Penh stall, about US$1 (2026 menu prices).

To add or refresh an example: look it up on the day, change only the number, run `node tests/coffee.test.js`. Never invent
a price. Every country Church & Trellis knows must have a currency in `COUNTRY_CURRENCY` (the test checks); the public website
(`site/index.html`) carries a copy of the countries, currencies and examples – regenerate it when these change.

## Countries that start "hidden" (refresh each January)
`TAKE_CARE` in `js/coffee.js`: the top 50 of Open Doors' World Watch List (2026 list, published January 2026). A church in
one of these countries starts with "Keep us hidden" on: other churches see only a wide region (`REGION`), never its name,
town, country or photo. The church can turn it off, after a warning.

## Bank details
`BANK` in `js/coffee.js`: Capitec Bank, universal branch code 470010, SWIFT CABLZAJJ (for payments from other countries,
which also need the account holder's name as on their ID – `holder`, still empty).
