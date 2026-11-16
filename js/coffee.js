/*
 * Church Hub – the subscription: "buy us a coffee". Pure (no screen, no Store), tested with node: tests/coffee.test.js.
 * Used by js/mod-support.js (the Subscription page and the Home prayer card).
 *
 * The idea (decided Nov 2026 by Church Hub's owner, replacing the Big Mac a year in docs/architecture/TARGET.md 10.5):
 *   - one café coffee a month, or ten a year when paid yearly (two months free);
 *   - plus, if the church wishes, a gift of whatever it thinks Church Hub is worth to it;
 *   - a church may pay for another, under-resourced church;
 *   - a church that cannot afford even one coffee a month uses Church Hub for free by promising to pray, once a month,
 *     for another church that Church Hub shows it. Every church is welcome; nobody is turned away for being poor.
 *
 * Prices: a Starbucks "Tall" in South Africa, the United States and Australia, as of AS_OF – Starbucks does not publish
 * prices, so these are typical menu prices from price guides (docs/PRICES.md says where from and how to refresh them).
 * Church Hub never takes card details: the Pay button opens the payment company's own page (PAY_URL, empty until the
 * owner chooses one – docs/architecture/tasks/059-billing-decisions.md).
 */
var Coffee = (function () {
  'use strict';
  var AS_OF = '2026-11';
  var PAY_URL = '';   // a card-payment company's page, once chosen (task 059). Until then churches pay by bank transfer (BANK).
  // Church Hub's own bank account (given by the owner, 16 Nov 2026) for bank transfers (EFT). The account number is meant
  // to be shown to paying churches; nothing here can take money out of it. holder: the name on the account as on the
  // owner's ID – Capitec needs it on payments from other countries; while empty, overseas churches are asked to write first.
  var BANK = { bank: 'Capitec Bank', account: '2625071881', branch: '470010', swift: 'CABLZAJJ', type: 'Savings', beneficiary: 'Church Hub', holder: '' };
  var YEAR_COFFEES = 10, MONTH_COFFEES = 1;

  var CURRENCIES = {
    ZAR: { code: 'ZAR', sym: 'R', country: 'ZA', name: 'South Africa', whole: true },
    USD: { code: 'USD', sym: 'US$', country: 'US', name: 'United States', whole: false },
    AUD: { code: 'AUD', sym: 'A$', country: 'AU', name: 'Australia', whole: false }
  };
  var CURRENCY_ORDER = ['ZAR', 'USD', 'AUD'];

  // Starbucks Tall, approximate menu prices, Nov 2026 (docs/PRICES.md). `art` is how the cup is drawn (js/mod-support.js).
  var DRINKS = [
    { id: 'cappuccino', name: 'Cappuccino', note: 'Espresso under a deep cap of foam', art: 'cappuccino', prices: { ZAR: 50, USD: 4.95, AUD: 6.00 } },
    { id: 'flatwhite', name: 'Flat white', note: 'A stronger, velvety coffee with fine milk', art: 'flatwhite', prices: { ZAR: 50, USD: 5.05, AUD: 6.00 } },
    { id: 'latte', name: 'Latte', note: 'Espresso with lots of steamed milk', art: 'latte', prices: { ZAR: 50, USD: 4.95, AUD: 6.00 } },
    { id: 'americano', name: 'Americano (long black)', note: 'Espresso and hot water, no milk', art: 'americano', prices: { ZAR: 42, USD: 3.75, AUD: 5.50 } },
    { id: 'macchiato', name: 'Caramel macchiato', note: 'A sweet treat with caramel on top', art: 'macchiato', prices: { ZAR: 56, USD: 5.25, AUD: 7.30 } }
  ];
  var DEFAULT_DRINK = 'cappuccino';

  // Countries where following Jesus is most dangerous: Open Doors World Watch List 2026, top 50 (January 2026).
  // A church here starts "discreet" (no photo, no church name, no town – only a wide region), and is warned before
  // turning that off. Refresh each January with the new list (docs/PRICES.md, "Countries that start discreet").
  var TAKE_CARE = ['KP', 'SO', 'YE', 'SD', 'ER', 'SY', 'NG', 'PK', 'LY', 'IR', 'AF', 'IN', 'SA', 'MM', 'ML', 'BF', 'CN', 'IQ', 'MV',
    'DZ', 'MR', 'CF', 'MA', 'CU', 'UZ', 'NE', 'TJ', 'LA', 'CD', 'MX', 'TN', 'NI', 'BD', 'BT', 'TM', 'ET', 'CM', 'OM', 'MZ', 'KG',
    'TR', 'EG', 'KM', 'QA', 'KZ', 'NP', 'CO', 'TD', 'JO', 'BN'];
  // The wide region a discreet church is shown as (never the country or town). Countries not listed use their continent.
  var REGION = {
    'North Africa': ['DZ', 'EG', 'LY', 'MA', 'MR', 'TN', 'SD'],
    'West Africa': ['NG', 'ML', 'BF', 'NE', 'GH', 'CM', 'TD'],
    'East Africa': ['SO', 'ER', 'ET', 'KE', 'UG', 'TZ', 'RW', 'KM'],
    'Central Africa': ['CF', 'CD', 'AO'],
    'Southern Africa': ['ZA', 'NA', 'BW', 'ZW', 'ZM', 'MZ', 'LS', 'SZ', 'MW'],
    'the Middle East': ['YE', 'SY', 'IR', 'SA', 'IQ', 'OM', 'TR', 'QA', 'JO'],
    'Central Asia': ['AF', 'UZ', 'TJ', 'TM', 'KG', 'KZ'],
    'South Asia': ['PK', 'IN', 'MV', 'BD', 'BT', 'NP'],
    'East Asia': ['KP', 'CN'],
    'Southeast Asia': ['MM', 'LA', 'BN'],
    'Latin America': ['MX', 'NI', 'CO', 'CU', 'JM', 'BR', 'AR', 'CL', 'PE'],
    'Europe': ['GB', 'IE', 'DE', 'AT', 'CH', 'NL', 'BE', 'FR', 'ES', 'PT', 'IT', 'PL', 'DK', 'NO', 'SE', 'FI'],
    'North America': ['US', 'CA'],
    'Oceania': ['AU', 'NZ']
  };
  var POINT_MAX = 160, POINTS = 2;

  function drink(id) { return DRINKS.filter(function (d) { return d.id === id; })[0] || drink(DEFAULT_DRINK); }
  function currency(code) { return CURRENCIES[code] || CURRENCIES.USD; }
  /** The currency a church in this country sees first: South Africa and its neighbours rand, Australia and New Zealand
   * Australian dollars, everyone else US dollars. They can switch. */
  function currencyFor(countryCode) {
    var c = String(countryCode || '').toUpperCase();
    if (REGION['Southern Africa'].indexOf(c) >= 0) return 'ZAR';
    if (c === 'AU' || c === 'NZ') return 'AUD';
    return 'USD';
  }
  /** Money as people write it: R50, R500, US$4.95, A$60.00. */
  function money(amount, code) {
    var c = currency(code), n = Math.round((+amount || 0) * 100) / 100;
    var whole = c.whole || n % 1 === 0 && n >= 100;
    var s = whole ? String(Math.round(n)) : n.toFixed(2);
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // 1 000 – the South African (and international) way
    return c.sym + s;
  }
  function coffees(plan) { return plan === 'year' ? YEAR_COFFEES : plan === 'month' ? MONTH_COFFEES : 0; }
  /** One coffee, in this currency. */
  function cup(drinkId, code) { var p = drink(drinkId).prices[currency(code).code]; return +p || 0; }
  /**
   * What a choice costs: { coffees, base, gift, total, per, saved } – all in the chosen currency.
   * plan: 'month' | 'year' | 'pray'. gift: an amount the church adds (any number ≥ 0; bad input counts as 0).
   * saved: what paying yearly saves compared with twelve months.
   */
  function quote(o) {
    o = o || {};
    var code = currency(o.currency).code, c = cup(o.drink, code), n = coffees(o.plan);
    var gift = Math.max(0, Math.round((parseFloat(o.gift) || 0) * 100) / 100);
    var base = round(c * n, code), total = round(base + gift, code);
    return { coffees: n, cup: c, base: base, gift: gift, total: total, currency: code, per: o.plan === 'year' ? 'year' : o.plan === 'month' ? 'month' : '',
      saved: o.plan === 'year' ? round(c * (12 - YEAR_COFFEES), code) : 0 };
  }
  function round(x, code) { return currency(code).whole ? Math.round(x) : Math.round(x * 100) / 100; }
  /** A gift as a number of coffees (the little cups on the page): 0–12. */
  function giftOf(n, drinkId, code) { n = Math.max(0, Math.min(12, Math.floor(+n || 0))); return round(cup(drinkId, code) * n, code); }

  /** The address the Pay button opens, or '' while payments aren't open. Only the church's id, the amount and currency go. */
  function payLink(o) {
    if (!PAY_URL || !o || !o.ref || !(o.total > 0)) return '';
    return PAY_URL + (PAY_URL.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(o.ref) + '&amount=' + encodeURIComponent(o.total) +
      '&currency=' + encodeURIComponent(o.currency) + (o.forChurch ? '&for=' + encodeURIComponent(o.forChurch) : '');
  }

  /** The payment reference a church types in its banking app: short, the same every time, and ours alone ("CH-7K2P9Q"). */
  function reference(churchId) { return 'CH-' + ('000000' + hash(churchId || 'church').toString(36).toUpperCase()).slice(-6); }

  /* ---------- the subscription over time: what is due, payment holidays, payments ----------
   * sub (settings.support): { plan: 'month'|'year'|'pray', startedAt, paidUntil: 'yyyy-mm-dd',
   *   payments: [{ at, kind: 'month'|'year'|'gift', amount, currency, gift, forOther }], holidays: [{ at, from, until, plan, reason }] }
   * Payments are recorded when the church says it has paid (a bank transfer, with its reference); Church Hub's office
   * matches them to the bank statement later (TARGET.md section 10). Nothing is ever locked for being late. */
  var WARN_DAYS = { month: 7, year: 30 }, LATE_DAYS = 30;
  // A payment holiday: a free month, no questions asked. Monthly: up to 3 in any 12 months. Yearly: one, which moves the
  // year's payment a month later. A church that needs more is pointed to praying instead (free, for as long as it needs).
  var HOLIDAYS = { month: 3, year: 1 };
  var KEEP = 24;   // payments and holidays kept in settings (the newest)
  function addMonths(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
    var y = +m[1], mo = +m[2] - 1 + n, d = +m[3];
    y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return y + '-' + ('0' + (mo + 1)).slice(-2) + '-' + ('0' + Math.min(d, last)).slice(-2);
  }
  function days(from, to) { return Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 864e5); }
  function paying(sub) { return !!sub && (sub.plan === 'month' || sub.plan === 'year'); }
  /**
   * Where the church stands today: { state, due, daysLeft, holiday }
   *   'none'    – hasn't started paying (or chose to pray: 'pray')
   *   'ok'      – paid, the next payment is a while away
   *   'soon'    – due within 7 days (monthly) or 30 days (yearly)
   *   'holiday' – on a payment holiday (until `holiday.until`)
   *   'due'     – the due date has passed (up to 30 days)
   *   'late'    – more than 30 days past (still nothing locked: a kind reminder, and the offer of a holiday or prayer)
   */
  function status(sub, today) {
    sub = sub || {};
    if (sub.plan === 'pray') return { state: 'pray', due: '', daysLeft: 0 };
    if (!paying(sub) || !sub.paidUntil) return { state: 'none', due: '', daysLeft: 0 };
    var due = sub.paidUntil, left = days(today, due);
    var hol = (sub.holidays || []).filter(function (h) { return h.from <= today && today < h.until; })[0];
    if (hol && left > 0) return { state: 'holiday', due: due, daysLeft: left, holiday: hol };
    var state = left > WARN_DAYS[sub.plan] ? 'ok' : left > 0 ? 'soon' : -left <= LATE_DAYS ? 'due' : 'late';
    return { state: state, due: due, daysLeft: left };
  }
  /** May the church take a payment holiday now? { ok, left, max } – counted over the last 12 months. */
  function holidayAllowed(sub, today) {
    sub = sub || {};
    if (!paying(sub) || !sub.paidUntil) return { ok: false, left: 0, max: 0 };
    var since = addMonths(today, -12), max = HOLIDAYS[sub.plan];
    var used = (sub.holidays || []).filter(function (h) { return h.at > since; }).length;
    return { ok: used < max, left: Math.max(0, max - used), max: max };
  }
  /** A payment holiday: the due date moves a month later, free. → the new sub (the old one is left as it was). */
  function takeHoliday(sub, today, reason) {
    sub = Object.assign({}, sub || {});
    if (!holidayAllowed(sub, today).ok) return null;
    var from = sub.paidUntil < today && addMonths(sub.paidUntil, 1) <= today ? today : sub.paidUntil;
    var until = addMonths(from, 1);
    sub.holidays = (sub.holidays || []).concat([{ at: today, from: from, until: until, plan: sub.plan, reason: String(reason || '').trim().slice(0, 300) }]).slice(-KEEP);
    sub.paidUntil = until;
    return sub;
  }
  /**
   * The church says it has paid. o: { kind: 'month'|'year'|'gift', amount, currency, gift, forOther }.
   * Paying for itself moves the due date on by a month or a year – from the old due date if paid early or on time,
   * from today if it had lapsed for more than a month. A gift, or paying for another church, doesn't change it.
   */
  function recordPayment(sub, today, o) {
    sub = Object.assign({}, sub || {}); o = o || {};
    var kind = o.kind === 'year' || o.kind === 'month' ? o.kind : 'gift';
    sub.payments = (sub.payments || []).concat([{ at: today, kind: kind, amount: +o.amount || 0, currency: o.currency || '', gift: +o.gift || 0, forOther: o.forOther || '' }]).slice(-KEEP);
    if (kind !== 'gift' && !o.forOther) {
      var base = sub.paidUntil && addMonths(sub.paidUntil, 1) > today ? sub.paidUntil : today;
      sub.plan = kind; sub.startedAt = sub.startedAt || today;
      sub.paidUntil = addMonths(base, kind === 'year' ? 12 : 1);
    }
    return sub;
  }
  /** What the next payment is: the plan's coffees, in the church's coffee and currency. */
  function nextAmount(sub) { sub = sub || {}; return quote({ drink: sub.drink, currency: sub.currency, plan: sub.plan }); }

  /* ---------- prayer ---------- */
  function takeCare(countryCode) { return TAKE_CARE.indexOf(String(countryCode || '').toUpperCase()) >= 0; }
  /** The wide region a country is shown as when discreet ("North Africa"); continent if not mapped. */
  function region(countryCode, continent) {
    var c = String(countryCode || '').toUpperCase();
    for (var r in REGION) if (REGION[r].indexOf(c) >= 0) return r;
    return continent === 'Americas' ? 'the Americas' : continent || 'the world';
  }
  /** Is this card discreet? The church's own choice if it has made one; until then, yes in a "take care" country.
   * (The page asks twice before a church in such a country turns it off.) */
  function isDiscreet(card, countryCode) {
    card = card || {};
    return typeof card.discreet === 'boolean' ? card.discreet : takeCare(countryCode);
  }
  /**
   * Things in a prayer point that could put people in danger or that shouldn't be shared with other churches:
   * email addresses, phone numbers, web links, @handles, and (when discreet) words that name the church or its town.
   * → a list of codes: 'email', 'phone', 'link', 'handle', 'name'. Empty when it looks fine.
   */
  function screen(text, names) {
    var s = String(text || ''), out = [];
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(s)) out.push('email');
    if (/(\+?\d[\d\s().-]{7,}\d)/.test(s)) out.push('phone');
    if (/(https?:\/\/|www\.)\S+/i.test(s)) out.push('link');
    if (/(^|\s)@\w{2,}/.test(s)) out.push('handle');
    var low = s.toLowerCase();
    if ((names || []).some(function (n) { n = String(n || '').trim().toLowerCase(); return n.length > 2 && low.indexOf(n) >= 0; })) out.push('name');
    return out;
  }
  /** Tidy prayer points: at most two, each trimmed and at most POINT_MAX characters; empty ones dropped. */
  function points(list) {
    return (list || []).map(function (p) { return String(p || '').replace(/\s+/g, ' ').trim().slice(0, POINT_MAX); }).filter(Boolean).slice(0, POINTS);
  }
  /**
   * How other churches see a church's prayer card – the only thing about a church that is ever shared with others.
   * church: { id, name, town, country (code), continent }. A discreet card has no name, no town, no photo, no country –
   * only a wide region. Nothing about the church's people is ever on it.
   */
  function publicCard(card, church) {
    card = card || {}; church = church || {};
    var discreet = isDiscreet(card, church.country);
    return {
      id: church.id || '', discreet: discreet,
      title: discreet ? '' : String(church.name || '').trim(),
      place: discreet ? '' : [String(card.place || church.town || '').trim(), String(church.countryName || '').trim()].filter(Boolean).join(', '),
      region: region(church.country, church.continent),
      photo: discreet || !card.photoOk ? '' : String(card.photo || ''),
      points: points(card.points),
      needsHelp: !!card.needsHelp
    };
  }
  /** "2026-11" for a date. */
  function monthKey(iso) { return String(iso || '').slice(0, 7); }
  function hash(s) { var h = 2166136261; s = String(s || ''); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /**
   * The church this church prays for this month: a different one each month, the same all month on every phone,
   * never itself, and over the months every church in the list in turn. churches: [{ id, … }] (any order). null if none.
   */
  function partnerFor(selfId, month, churches) {
    var list = (churches || []).filter(function (c) { return c && c.id && c.id !== selfId && (c.points || []).length; })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    if (!list.length) return null;
    var m = /^(\d{4})-(\d{2})$/.exec(month || ''); if (!m) return null;
    var k = (+m[1]) * 12 + (+m[2] - 1);
    return list[(hash(selfId) + k) % list.length];
  }
  /** Churches that have asked for help, for "pay for another church". */
  function needing(churches, selfId) { return (churches || []).filter(function (c) { return c && c.needsHelp && c.id !== selfId; }); }

  return { AS_OF: AS_OF, PAY_URL: PAY_URL, YEAR_COFFEES: YEAR_COFFEES, DRINKS: DRINKS, DEFAULT_DRINK: DEFAULT_DRINK, CURRENCIES: CURRENCIES, CURRENCY_ORDER: CURRENCY_ORDER,
    TAKE_CARE: TAKE_CARE, POINT_MAX: POINT_MAX, POINTS: POINTS,
    BANK: BANK, reference: reference, HOLIDAYS: HOLIDAYS, addMonths: addMonths, status: status, holidayAllowed: holidayAllowed, takeHoliday: takeHoliday, recordPayment: recordPayment, nextAmount: nextAmount, drink: drink, currency: currency, currencyFor: currencyFor, money: money, cup: cup, quote: quote, giftOf: giftOf, payLink: payLink,
    takeCare: takeCare, region: region, isDiscreet: isDiscreet, screen: screen, points: points, publicCard: publicCard, monthKey: monthKey, partnerFor: partnerFor, needing: needing };
})();
if (typeof module !== 'undefined') module.exports = Coffee;
