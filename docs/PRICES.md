# Prices and lists the Subscription uses (`js/coffee.js`)

## Coffee prices (refresh twice a year)
A Starbucks "Tall" in South Africa (rand), the United States and Australia, as of `AS_OF` in `js/coffee.js` (Nov 2026).
Starbucks doesn't publish prices, so these are typical menu prices from price guides on the day, rounded:
- **South Africa:** 2024 menu prices (cappuccino and latte R45, Americano R38, caramel macchiato R51) raised about 5% a year;
  the owner's own reference point was "about R50 for a cappuccino or flat white".
- **United States:** national-average menu guides, May 2026 (flat white $5.05, Americano $3.75, caramel macchiato $5.25;
  cappuccino and latte about $4.95 in most guides).
- **Australia:** menu guides 2025 (latte, cappuccino and flat white A$6.00, long black A$5.50, caramel macchiato A$7.30).

To refresh: search each country's current Starbucks menu prices, change only the numbers and `AS_OF`, run
`node tests/coffee.test.js`. Never invent a price; if a figure can't be found, keep the old one and say so here.

## Countries that start "hidden" (refresh each January)
`TAKE_CARE` in `js/coffee.js`: the top 50 of Open Doors' World Watch List (2026 list, published January 2026). A church in
one of these countries starts with "Keep us hidden" on: other churches see only a wide region (`REGION`), never its name,
town, country or photo. The church can turn it off, after a warning.

## Bank details
`BANK` in `js/coffee.js`: Capitec Bank, universal branch code 470010, SWIFT CABLZAJJ (for payments from other countries,
which also need the account holder's name as on their ID – `holder`, still empty).
