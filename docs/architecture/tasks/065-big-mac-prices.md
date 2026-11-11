# 065 – The price table

**Model:** Light.

**Goal:** the minimum price for every country Church Hub knows, from The Economist's Big Mac index.

**Files:** `js/bigmac.js` (new, pure: `{ asOf, prices: { ZA: { amount, currency }, … }, fallback: { XX: 'ZA', … } }`,
`BigMac.minimum(countryCode)`), `tests/bigmac.test.js`, `docs/PRICES.md` (where the numbers come from and how to
refresh them: The Economist publishes the data as a spreadsheet in its public `big-mac-data` repository, twice a year).

**Steps:** take the latest published local prices; for each of the countries in `js/countries.js` not in the index
choose the nearest listed neighbour and record it in `fallback`; otherwise the US price. Test: every country in
`js/countries.js` gets an amount and a currency; no amount is zero.

**Repeat** each time the index is updated: a small pull request changing only the numbers and `asOf`.

**Do not:** invent a price; if a country's figure is missing, use the fallback and say so in `docs/PRICES.md`.
