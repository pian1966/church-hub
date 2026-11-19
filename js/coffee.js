/*
 * Church & Trellis – the subscription: "buy us a coffee". Pure (no screen, no Store), tested with node: tests/coffee.test.js.
 * Used by js/mod-support.js (the Subscription page and the Home prayer card).
 *
 * The idea (decided Nov 2026 by Church & Trellis's owner, replacing the Big Mac a year in docs/architecture/TARGET.md 10.5):
 *   - one café coffee a month, or ten a year when paid yearly (two months free);
 *   - plus, if the church wishes, a gift of whatever it thinks Church & Trellis is worth to it;
 *   - a church may pay for another, under-resourced church;
 *   - a church that cannot afford even one coffee a month uses Church & Trellis for free by promising to pray, every week,
 *     for another church that Church & Trellis shows it. Every church is welcome; nobody is turned away for being poor.
 *   - every church keeps a prayer card (a photo and two prayer points) and checks it once a month; every week each church
 *     is shown another church's card on everyone's Home (cardForWeek). A paying church may turn that off; a praying one may not.
 *
 * Prices: one cup of what the church would buy where it lives, in its own country's money – a street-stall cup, a café
 * coffee or a coffee-chain latte, as is honest for that church. EXAMPLES has the prices we've looked up (docs/PRICES.md);
 * everywhere else the church types its own.
 * Church & Trellis never takes card details: the Pay button opens the payment company's own page (PAY_URL, empty until the
 * owner chooses one – docs/architecture/tasks/059-billing-decisions.md).
 */
var Coffee = (function () {
  'use strict';
  var AS_OF = '2026-11';
  var PAY_URL = '';   // a card-payment company's page, once chosen (task 059). Until then churches pay by bank transfer (BANK).
  // Church & Trellis's own bank account (given by the owner, 16 Nov 2026) for bank transfers (EFT). The account number is meant
  // to be shown to paying churches; nothing here can take money out of it. holder: the name on the account as on the
  // owner's ID – Capitec needs it on payments from other countries; while empty, overseas churches are asked to write first.
  var BANK = { bank: 'Capitec Bank', account: '2625071881', branch: '470010', swift: 'CABLZAJJ', type: 'Savings', beneficiary: 'Church & Trellis', holder: '' };
  var YEAR_COFFEES = 10, MONTH_COFFEES = 1;

  // Each country's own money (ISO 4217), as people write it. whole: no cents shown. Countries not here: US dollars.
  var CURRENCIES = {
    ZAR: ['R', 1], NAD: ['N$', 1], BWP: ['P', 0], ZWG: ['ZiG', 0], ZMW: ['K', 0], MZN: ['MT', 1], LSL: ['M', 1], SZL: ['E', 1],
    MWK: ['MK', 1], AOA: ['Kz', 1], KES: ['KSh', 1], UGX: ['USh', 1], TZS: ['TSh', 1], RWF: ['FRw', 1], ETB: ['Br', 1], NGN: ['₦', 1],
    GHS: ['GH₵', 0], XAF: ['FCFA ', 1], CDF: ['FC', 1], GBP: ['£', 0], EUR: ['€', 0], CHF: ['CHF ', 0], PLN: ['zł ', 0],
    DKK: ['kr ', 0], NOK: ['kr ', 0], SEK: ['kr ', 0], USD: ['US$', 0], CAD: ['CA$', 0], MXN: ['MX$', 1], JMD: ['J$', 1],
    BRL: ['R$', 0], ARS: ['AR$', 1], CLP: ['CLP$', 1], COP: ['COL$', 1], PEN: ['S/ ', 0], AUD: ['A$', 0], NZD: ['NZ$', 0],
    INR: ['₹', 1], KHR: ['៛', 1]
  };
  var COUNTRY_CURRENCY = {
    ZA: 'ZAR', NA: 'NAD', BW: 'BWP', ZW: 'ZWG', ZM: 'ZMW', MZ: 'MZN', LS: 'LSL', SZ: 'SZL', MW: 'MWK', AO: 'AOA', KE: 'KES', UG: 'UGX',
    TZ: 'TZS', RW: 'RWF', ET: 'ETB', NG: 'NGN', GH: 'GHS', CM: 'XAF', CD: 'CDF', GB: 'GBP', IE: 'EUR', DE: 'EUR', AT: 'EUR', CH: 'CHF',
    NL: 'EUR', BE: 'EUR', FR: 'EUR', ES: 'EUR', PT: 'EUR', IT: 'EUR', PL: 'PLN', DK: 'DKK', NO: 'NOK', SE: 'SEK', FI: 'EUR', US: 'USD',
    CA: 'CAD', MX: 'MXN', JM: 'JMD', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', AU: 'AUD', NZ: 'NZD', IN: 'INR', KH: 'KHR'
  };

  // One cup, three ways. The church chooses the one that is honest for it – a church with plenty can choose the coffee
  // chain wherever it is; a church with little, the street stall – and types what it costs where it lives.
  var KINDS = [
    { id: 'street', name: 'A cup from a street stall', note: 'Tea or coffee from a stall, market or kiosk', art: 'glass' },
    { id: 'cafe', name: 'A coffee at a local café', note: 'An ordinary café near you', art: 'cappuccino' },
    { id: 'chain', name: 'A latte at a coffee chain', note: 'Like a Starbucks Tall latte', art: 'latte' }
  ];
  // What one cup costs, where we have looked it up (docs/PRICES.md). Everywhere else the church types its own price.
  var EXAMPLES = {
    ZA: { chain: 50 }, US: { chain: 4.95 }, AU: { chain: 6.00 },   // a Starbucks Tall latte, November 2026
    IN: { street: 15 },   // chai at a Delhi roadside stall, March 2026
    KH: { street: 4000 }  // iced coffee from a Phnom Penh stall, about US$1, 2026
  };
  var DEFAULT_KIND = 'cafe';
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

  function kind(id) { return KINDS.filter(function (k) { return k.id === id; })[0] || kind(DEFAULT_KIND); }
  /** The money of a country ("ZA" → "ZAR"); US dollars for a country not in the list. */
  function currencyFor(countryCode) { return COUNTRY_CURRENCY[String(countryCode || '').toUpperCase()] || 'USD'; }
  function currency(code) { var c = CURRENCIES[code] ? code : 'USD'; return { code: c, sym: CURRENCIES[c][0], whole: !!CURRENCIES[c][1] }; }
  /** Money as people write it: R50, R1 250, ₹15, US$4.95, €3.50, ៛4 000. */
  function money(amount, code) {
    var c = currency(code), n = Math.round((+amount || 0) * 100) / 100;
    var whole = c.whole || n % 1 === 0 && n >= 100;
    var s = whole ? String(Math.round(n)) : n.toFixed(2);
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // 1 000 – the South African (and international) way
    return c.sym + s;
  }
  function coffees(plan) { return plan === 'year' ? YEAR_COFFEES : plan === 'month' ? MONTH_COFFEES : 0; }
  function round(x, code) { return currency(code).whole ? Math.round(x) : Math.round(x * 100) / 100; }
  /** What one cup of this kind costs in this country, where we have looked it up; 0 when we haven't. */
  function example(countryCode, kindId) { var e = EXAMPLES[String(countryCode || '').toUpperCase()]; return e && +e[kindId] || 0; }
  /**
   * The church's cup: { kind, price, currency }. Its own choice while it is in its country's money; otherwise (a new
   * church, or the church changed its country) the first example we have for the country, or a café cup with no price yet.
   */
  function cupOf(sub, countryCode) {
    var code = currencyFor(countryCode), c = sub && sub.cup;
    if (c && c.currency === code && +c.price > 0) return { kind: kind(c.kind).id, price: +c.price, currency: code };
    var e = EXAMPLES[String(countryCode || '').toUpperCase()] || {}, k = ['chain', 'cafe', 'street'].filter(function (x) { return e[x]; })[0];
    return { kind: k || DEFAULT_KIND, price: k ? e[k] : 0, currency: code };
  }
  /** A price as typed ("15", "4,95", "R 50") → a number ≥ 0. */
  function parse(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '')); return n > 0 ? Math.round(n * 100) / 100 : 0; }
  /**
   * What a choice costs: { coffees, cup, base, gift, total, currency, per, saved } – in the church's own money.
   * o: { price (one cup), currency, plan: 'month'|'year'|'pray', gift }. saved: what paying yearly saves over twelve months.
   */
  function quote(o) {
    o = o || {};
    var code = currency(o.currency).code, c = parse(o.price), n = coffees(o.plan), gift = parse(o.gift);
    var base = round(c * n, code), total = round(base + gift, code);
    return { coffees: n, cup: c, base: base, gift: gift, total: total, currency: code, per: o.plan === 'year' ? 'year' : o.plan === 'month' ? 'month' : '',
      saved: o.plan === 'year' ? round(c * (12 - YEAR_COFFEES), code) : 0 };
  }
  /** A gift of n cups (the little cups on the page): 0–20. */
  function giftOf(n, price, code) { n = Math.max(0, Math.min(20, Math.floor(+n || 0))); return round(parse(price) * n, code); }

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
   * Payments are recorded when the church says it has paid (a bank transfer, with its reference); Church & Trellis's office
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
  function nextAmount(sub, countryCode) { var c = cupOf(sub, countryCode); return quote({ price: c.price, currency: c.currency, plan: (sub || {}).plan }); }

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
  function utc(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  var MONDAY0 = Date.UTC(1970, 0, 5), WEEK = 7 * 864e5;
  /** The number of a week (weeks start on Monday), counted from 5 Jan 1970. NaN for a bad date. */
  function weekNo(iso) { var t = utc(iso); return isNaN(t) ? NaN : Math.floor((t - MONDAY0) / WEEK); }
  /** The Monday a date's week starts on, "2026-11-16". Used as the key for "this week" (prayed, the card shown). */
  function weekKey(iso) { var n = weekNo(iso); return isNaN(n) ? '' : new Date(MONDAY0 + n * WEEK).toISOString().slice(0, 10); }
  /** A shuffle of 0..n-1 that is always the same for the same seed. */
  function shuffle(n, seed) {
    var a = [], x = seed >>> 0 || 1;
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; var k = x % (j + 1), t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  /**
   * The prayer card a church sees this week (decided Nov 2026: a new card every week on everyone's Home).
   * Each church goes through all the other churches' cards in its own shuffled order – no card comes back until it has
   * seen every other one – and then starts a fresh shuffle. Never its own card, never the same card two weeks running,
   * the same card all week on every phone, and different churches see different cards in the same week.
   * week: any date in the week. churches: [{ id, points, … }] (any order); churches with no prayer points are left out.
   * Note: when a church joins or leaves, the round is reshuffled, so a card may come back a little early once.
   */
  function cardForWeek(selfId, week, churches) {
    var list = (churches || []).filter(function (c) { return c && c.id && c.id !== selfId && (c.points || []).length; })
      .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    var n = list.length, w = weekNo(week);
    if (!n || isNaN(w)) return null;
    if (n === 1) return list[0];
    w += hash(selfId) % n;   // churches don't all start a new round in the same week
    if (n === 2) return list[w % 2];
    var round = Math.floor(w / n), pos = w % n;
    var order = function (r) { return shuffle(n, hash(selfId + ':' + r)); };
    var now = order(round);
    // A new round never starts with the card the last round ended with (swapping the first two keeps the last in place).
    if (now[0] === order(round - 1)[n - 1]) { var t = now[0]; now[0] = now[1]; now[1] = t; }
    return list[now[pos]];
  }
  /** Kept for older callers: the card for the first week of a month. */
  function partnerFor(selfId, month, churches) { return /^\d{4}-\d{2}$/.test(month || '') ? cardForWeek(selfId, month + '-01', churches) : null; }

  /**
   * Every church keeps a prayer card, and looks at it once a month (decided Nov 2026: not optional). → { state, next }
   *   'missing' – no prayer points yet: the Administrator is asked to make one
   *   'due'     – a month (or more) since it was last made, changed or checked: update it, or keep it as it is
   *   'ok'      – fine until `next`
   * card.updated is the day it was last saved or checked ("Keep it as it is" counts).
   */
  function cardCheck(card, today) {
    card = card || {};
    if (!points(card.points).length) return { state: 'missing', next: '' };
    var next = card.updated ? addMonths(card.updated, 1) : '';
    return { state: !next || next <= today ? 'due' : 'ok', next: next };
  }
  /** May this church turn off the weekly prayer card? Yes if it pays; no while it prays instead of paying. */
  function mayHideCards(sub) { return (sub || {}).plan !== 'pray'; }
  /** Does everyone's Home show the weekly prayer card? Yes, unless a paying church's Administrator turned it off. */
  function showsCards(sub) { sub = sub || {}; return !(sub.cardsOff === true && mayHideCards(sub)); }
  /** Churches that have asked for help, for "pay for another church". */
  function needing(churches, selfId) { return (churches || []).filter(function (c) { return c && c.needsHelp && c.id !== selfId; }); }

  return { AS_OF: AS_OF, PAY_URL: PAY_URL, YEAR_COFFEES: YEAR_COFFEES, KINDS: KINDS, EXAMPLES: EXAMPLES, COUNTRY_CURRENCY: COUNTRY_CURRENCY,
    TAKE_CARE: TAKE_CARE, POINT_MAX: POINT_MAX, POINTS: POINTS,
    BANK: BANK, reference: reference, HOLIDAYS: HOLIDAYS, addMonths: addMonths, status: status, holidayAllowed: holidayAllowed, takeHoliday: takeHoliday, recordPayment: recordPayment, nextAmount: nextAmount, kind: kind, example: example, cupOf: cupOf, parse: parse, currency: currency, currencyFor: currencyFor, money: money, quote: quote, giftOf: giftOf, payLink: payLink,
    takeCare: takeCare, region: region, isDiscreet: isDiscreet, screen: screen, points: points, publicCard: publicCard, monthKey: monthKey, weekNo: weekNo, weekKey: weekKey, cardForWeek: cardForWeek, partnerFor: partnerFor, cardCheck: cardCheck, mayHideCards: mayHideCards, showsCards: showsCards, needing: needing };
})();
if (typeof module !== 'undefined') module.exports = Coffee;
