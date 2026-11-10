/*
 * Church Hub – search in your own words ("Ask"): plain English, typed or spoken, turned into the same filters as Advanced
 * search (people) or into a search of the roster (services). No outside service: a set of rules that understands the
 * usual ways of asking, and says what it understood and what it didn't, so nothing is guessed silently.
 * Pure functions, tested with node: tests/ask.test.js.
 *
 *   Ask.parse(question, ctx) → { kind: 'people', filters, match, logic, said: [...], unknown: [...], refused: [...] }
 *                             or { kind: 'services', q: { from, to, slots, part, gaps, personId, sameDay, missingPos }, said, unknown, refused }
 *   Ask.services(data, q)   → the services that match, each with its gaps and the person's places
 *
 * ctx (what this person may search on, and the church's own words and data):
 *   fields: { key: true } – Advanced search fields this role has (people/search.js searchFields)
 *   services: true when they may see the roster
 *   words: Wording.words(settings) – e.g. partner: ['Parishioner', 'Parishioners']
 *   slots: [{ id, label, time }] – the church's services; positions, teams: [names]; towns: [names]
 *   people: [{ id, names: ['Andy Pike', 'Andrew Pike'] }] – for "where Andy Pike is serving"
 *   careGroups, midweekGroups: [names] – for "in the Hilton care group"
 *   today: 'yyyy-mm-dd'
 * said: what was understood, as [text, values] pairs for the screen (translated there); refused: fields this role can't use.
 */
var Ask = (function () {
  'use strict';
  var TX = function (s) { return s; };   // a text shown to people, translated where it is shown (the language test checks it)
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  var MON_RX = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  var NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  var NUM_RX = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  function num(w) { return /^\d+$/.test(w) ? +w : NUM[w] || 0; }
  function monthOf(w) { w = String(w || '').toLowerCase().slice(0, 3); for (var i = 0; i < 12; i++) if (MONTHS[i].slice(0, 3) === w) return i + 1; return 0; }
  function rx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function parseIso(s) { var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : new Date(); }
  function toIso(d) { return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function addDays(s, n) { var d = parseIso(s); d.setDate(d.getDate() + n); return toIso(d); }
  function addMonths(s, n) { var d = parseIso(s); d.setDate(1); d.setMonth(d.getMonth() + n); return toIso(d); }
  function monthEnd(y, m) { return iso(y, m, new Date(y, m, 0).getDate()); }

  /** The question, tidied: lower case, plain quotes and spaces, "10 am" → "10am", "10:30" kept. Padded with spaces. */
  function tidy(q) {
    var s = ' ' + String(q || '').toLowerCase().replace(/[’‘`]/g, '\'').replace(/[“”„"]/g, '').replace(/[?!;]+/g, ' ')
      .replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?=\s|,|\.|$)/g, function (m, h, ap) { return h + ap.replace(/\./g, ''); })
      .replace(/,/g, ' , ').replace(/\.(\s|$)/g, ' ').replace(/\s+/g, ' ') + ' ';
    return s;
  }

  /* ---------- a small engine: each rule finds a phrase, notes what it means, and blanks it out ---------- */
  function Run(q) { this.s = tidy(q); this.hits = []; }
  /** Find re in what is left; for each match call fn(match) → true when used. The text matched is blanked. */
  Run.prototype.take = function (re, fn) {
    var self = this, out = false;
    this.s = this.s.replace(re, function () {
      var a = [].slice.call(arguments), off = a[a.length - 2], ok = fn(a, off);
      if (ok === false) return a[0];
      out = true; return a[0].replace(/[^ ]/g, '\u0001');   // keep the length: places stay the same for the "or" check
    });
    return out;
  };
  /** Words left over that matter (not "show me all the …"). */
  var STOP = ('show me all the people persons person everyone everybody anyone anybody who whom that which are is was were be with and , a an of find list give ' +
    'please i want to see get for in on at do does did have has having their there them those these whose any some can you could would like ' +
    'church members member\'s just only also both same day days kindly search look up display let know what where whom whos who\'s this that\'s it its by from as ' +
    'or our my me us we services service rostered roster rosters on sundays sunday serving serve').split(' ');
  Run.prototype.left = function () {
    return this.s.replace(/\u0001+/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w) < 0 && !/^[\-–—&+.:]+$/.test(w); });
  };

  /* ---------- dates in a question ---------- */
  /** A date written as "12 November", "Nov 12", "12 Nov 2026", "12/11", "2026-11-12" → 'yyyy-mm-dd' (year worked out if missing). */
  var DATE_RX = '(\\d{4}-\\d\\d-\\d\\d|\\d{1,2}\\s+(?:of\\s+)?' + MON_RX + '(?:\\s+\\d{4})?|' + MON_RX + '\\s+\\d{1,2}(?:\\s*,?\\s*\\d{4})?|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?)';
  function readDate(t, today, after) {
    var m, y = null, mo, d;
    t = t.trim();
    if ((m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(t))) return t;
    if ((m = /^(\d{1,2})\s+(?:of\s+)?([a-z]+)(?:\s+(\d{4}))?$/.exec(t))) { d = +m[1]; mo = monthOf(m[2]); y = m[3] ? +m[3] : null; }
    else if ((m = /^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/.exec(t))) { mo = monthOf(m[1]); d = +m[2]; y = m[3] ? +m[3] : null; }
    else if ((m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t))) { d = +m[1]; mo = +m[2]; y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null; }   // day/month, as in South Africa
    if (!mo || !d || mo > 12 || d > 31) return '';
    if (y) return iso(y, mo, d);
    // No year: this year – or next year if that date is long gone, or comes before the start of the range
    y = +today.slice(0, 4); var v = iso(y, mo, d);
    if (after ? v < after : v < addDays(today, -60)) v = iso(y + 1, mo, d);
    return v;
  }
  function fmtDate(s) { var d = parseIso(s); return d.getDate() + ' ' + MONTHS[d.getMonth()].charAt(0).toUpperCase() + MONTHS[d.getMonth()].slice(1, 3) + ' ' + d.getFullYear(); }

  /* ---------- people ---------- */
  var HAS_THING = '(id numbers?|identity numbers?|identity documents?|id|ids|e-?mail addresses|e-?mail address|e-?mails?|mobile numbers?|mobiles?|mobile phones?|cell ?phone numbers?|cell ?phones?|cell numbers?|cells?|phone numbers?|phones?|home address(?:es)?|street address(?:es)?|address(?:es)?|households?|families|dates? of birth|birth ?dates?|genders?|middle names?|post ?codes?|towns?)';
  var THING_FIELD = [[/^(id|ids|identity)/, 'idNumber'], [/^e-?mail/, 'email'], [/^(mobile|cell|phone)/, 'mobile'], [/address/, 'address'], [/^(household|families)/, 'household'],
    [/birth/, 'birthDate'], [/^gender/, 'gender'], [/^middle/, 'middleName'], [/^post/, 'postcode'], [/^town/, 'town']];
  var THING_LABEL = { idNumber: 'ID number', email: 'Email', mobile: 'Mobile', address: 'Home address', household: 'Household', birthDate: 'Date of birth', gender: 'Gender', middleName: 'Middle name', postcode: 'Postcode', town: 'Town or city' };
  var NOT = '(not |non[- ]?|aren\'t |are not |isn\'t |is not |who are not |who aren\'t |that are not |excluding |except |but not |no )?';

  /** The categories and the words people use for them, the church's own words first: [[category, [regex parts]]]. */
  function catWords(ctx) {
    var cats = [['Former member', ['former members?', 'ex-?members?', 'past members?']], ['Visiting Minister', ['visiting ministers?', 'guest speakers?', 'visiting preachers?']],
      ['Church Partner', ['official (?:church )?partners?', 'church partners?', 'partners?', 'members?', 'official members?']], ['Attender', ['attenders?', 'regular attenders?', 'regulars?', 'visitors?']]];
    var W = ctx.words || {}, own = { 'Church Partner': W.partner, Attender: W.attender, 'Visiting Minister': W.visiting };
    return cats.map(function (c) {
      var o = own[c[0]], list = c[1].slice();
      if (o) o.forEach(function (x) { if (x) list.unshift(rx(x.toLowerCase())); });
      return [c[0], list];
    });
  }
  function people(R, ctx, out) {
    var F = ctx.fields || {}, add = function (field, op, value, off, extra) {
      if (!F[field]) { if (out.refused.indexOf(field) < 0) out.refused.push(field); return; }
      out.filters.push(Object.assign({ field: field, op: op, value: value == null ? '' : value, at: off }, extra || {}));
    };
    // Their spouse or partner: "whose wives' names begin with A", "whose spouse's first name starts with the letter J",
    // "married to Megan", "whose husband is called David" (before the categories, so "partner's name" isn't read as Church Partner)
    var MATE = '(?:wives|wife|husbands?|spouses?|partners?)';
    R.take(new RegExp('\\b(?:(?:whose|with|who have|that have|having)\\s+)?(?:their\\s+|a\\s+)?' + MATE + '(?:\'s|s\'|\')?\\s+(?:first\\s*|given\\s+|christian\\s+)?names?\\s+' +
      '(?:that\\s+|which\\s+|is\\s+|are\\s+)?(?:begins?|beginning|starts?|starting|start)\\s+with\\s+(?:the\\s+letters?\\s+|letters?\\s+)?([a-z\'\\-]+)\\b', 'g'),
      function (a, off) { add('spouse', 'starts', a[1], off); });
    R.take(new RegExp('\\b(?:(?:whose|with a|with|who have a|that have a)\\s+' + MATE + '(?:\\s+is)?\\s+(?:called|named)|married to|(?:whose|with a)\\s+' + MATE + '\\s+is)\\s+([a-z\'\\-]+(?:\\s+[a-z\'\\-]+)?)\\b', 'g'),
      function (a, off) { if (/^(a|an|the|not|in|over|under)$/.test(a[1].split(' ')[0])) return false; add('spouse', 'has', a[1].replace(/\s+(who|that|and|with|in|on)$/, ''), off); });
    // What their spouse or partner is: "whose wives are not Church Partners", "married to an Attender", "whose husbands are over 60"
    var MATE_IS = '\\b(?:(?:whose|with|with a|who have a|that have a)\\s+' + MATE + '(?:\\s+(?:who|that))?\\s+(?:is|are)|married to)\\s+';
    catWords(ctx).forEach(function (c) {
      R.take(new RegExp(MATE_IS + '(not\\s+|also\\s+not\\s+|also\\s+)?(?:an?\\s+|a\\s+fellow\\s+)?(?:' + c[1].join('|') + ')\\b', 'g'), function (a, off) {
        var not = !!(a[1] && /not/.test(a[1]));
        if (not) add('spouse', 'nempty', '', off);   // "wives are not Church Partners": only people who have a wife
        add('spouseCategory', not ? 'ne' : 'eq', c[0], off + 1);
      });
    });
    R.take(new RegExp(MATE_IS + '(over|older than|above|under|younger than|below)\\s+(\\d{1,3})\\b', 'g'), function (a, off) { add('spouseAge', /over|older|above/.test(a[1]) ? 'gt' : 'lt', a[2], off); });
    R.take(new RegExp(MATE_IS + '(?:an?\\s+)?(men|man|males?|women|woman|females?)\\b', 'g'), function (a, off) { add('spouseGender', 'eq', /^(men|man|male)/.test(a[1]) ? 'Male' : 'Female', off); });
    // Care groups and midweek groups: "who don't belong to a care group", "in a Bible study", "in the Hilton care group"
    [['careGroup', '(?:care\\s*groups?)', ctx.careGroups], ['midweekGroup', '(?:midweek\\s+groups?|bible\\s+stud(?:y|ies)(?:\\s+groups?)?|life\\s*groups?|connect\\s+groups?|small\\s+groups?|home\\s+groups?|cell\\s+groups?)', ctx.midweekGroups]].forEach(function (x) {
      var f = x[0], w = x[1];
      (x[2] || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (n) {
        R.take(new RegExp('\\b' + NOT + '(?:in|belong(?:s|ing)? to|part of|members? of|attend(?:s|ing)?|go(?:es)? to)\\s+(?:the\\s+)?' + rx(String(n).toLowerCase()) + '(?:\\s+' + w + ')?\\b', 'g'), function (a, off) { add(f, a[1] ? 'ninc' : 'inc', n, off); });
      });
      R.take(new RegExp('\\b(?:(?:don\'t|do not|doesn\'t|does not|who don\'t|who do not|that don\'t|that do not|not|aren\'t|are not|isn\'t|is not|without|with no|have no|has no|never)\\s+(?:yet\\s+)?(?:belong(?:ing|s)?\\s+to|in|part of|members? of|attend(?:ing)?|go(?:ing)? to|have|has|got)?\\s*(?:an?\\s+|any\\s+)?' + w + '|(?:no|not in a|not in any)\\s+' + w + ')\\b', 'g'), function (a, off) { add(f, 'empty', '', off); });
      R.take(new RegExp('\\b(?:(?:who|that)\\s+)?(?:are\\s+|is\\s+)?(?:belong(?:ing|s)?\\s+to|in|part of|members? of|attend(?:s|ing)?|go(?:es|ing)? to|with|have|has)\\s+(?:an?\\s+|any\\s+)' + w + '\\b', 'g'), function (a, off) { add(f, 'nempty', '', off); });
    });
    // Has / hasn't got something: "without an ID number", "do have a home address", "no email"
    R.take(new RegExp('\\b(?:(without|with no|with out|not having|don\'t have|do not have|does not have|doesn\'t have|dont have|have no|has no|missing|lacking|lack|no)|(with|having|who have|that have|do have|does have|have|has|who has|that has))\\s+(?:an?\\s+|any\\s+|their\\s+|a valid\\s+|valid\\s+)?' + HAS_THING + '\\b(?!\\s+(?:in|on|this|next|during|coming|between|before|after|later|of)\\b)', 'g'), function (a, off) {
      var thing = a[3], f = (THING_FIELD.filter(function (x) { return x[0].test(thing); })[0] || [])[1]; if (!f) return false;
      add(f, a[1] ? 'empty' : 'nempty', '', off); return true;
    });
    // Birthdays and wedding anniversaries: "with birthdays in April", "born in May", "April birthdays", "birthday in the next 2 weeks"
    [['birthday', '(?:birthdays?|born)'], ['wedding', '(?:wedding anniversar(?:y|ies)|anniversar(?:y|ies)|married)']].forEach(function (x) {
      var f = x[0], w = x[1];
      R.take(new RegExp('\\b' + w + '\\s+(?:is\\s+|are\\s+|falls?\\s+|fall\\s+)?(?:in|during)\\s+(?:the\\s+month\\s+of\\s+)?' + MON_RX + '\\b', 'g'), function (a, off) { add(f, 'month', String(monthOf(a[1])), off); });
      R.take(new RegExp('\\b' + MON_RX + '\\s+' + w + '\\b', 'g'), function (a, off) { add(f, 'month', String(monthOf(a[1])), off); });
      R.take(new RegExp('\\b' + w + '\\s+(?:is\\s+|are\\s+)?(?:in\\s+|within\\s+)?(?:the\\s+)?(?:next|coming)\\s+' + NUM_RX + '?\\s*(days?|weeks?|months?)\\b', 'g'), function (a, off) {
        add(f, 'next', String(a[1] ? num(a[1]) : 1), off, { unit: a[2].replace(/s?$/, 's') });
      });
      R.take(new RegExp('\\b' + w + '\\s+(?:is\\s+|are\\s+)?this\\s+(week|month)\\b', 'g'), function (a, off) {
        if (a[1] === 'month') add(f, 'month', String(+ctx.today.slice(5, 7)), off); else add(f, 'next', '7', off, { unit: 'days' });
      });
      R.take(new RegExp('\\b' + w + '\\s+(?:is\\s+)?today\\b', 'g'), function (a, off) { add(f, 'eq', ctx.today, off); });
    });
    R.take(/\bborn\s+in\s+(\d{4})\b/g, function (a, off) { add('birthDate', 'between', a[1] + '-01-01', off, { value2: a[1] + '-12-31' }); });
    R.take(/\bborn\s+(before|after)\s+(\d{4})\b/g, function (a, off) { add('birthDate', a[1], a[1] === 'before' ? a[2] + '-01-01' : a[2] + '-12-31', off); });
    // Age: "over 60", "younger than 18", "aged 20 to 30", "in their twenties", "40 years old"
    var DEC = { twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90 };
    R.take(/\bin their (twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties)\b/g, function (a, off) { add('age', 'between', String(DEC[a[1]]), off, { value2: String(DEC[a[1]] + 9) }); });
    R.take(/\b(?:aged?|ages|between the ages of|between)\s+(\d{1,3})\s*(?:-|to|and|–)\s*(\d{1,3})(?:\s*(?:years?(?:\s+old)?|yrs?))?(?!\s*(?:days?|weeks?|months?))/g, function (a, off) {
      if (!/^\s*(aged?|ages|between the ages)/.test(a[0]) && !/years?|yrs?/.test(a[0])) return false;
      add('age', 'between', a[1], off, { value2: a[2] });
    });
    R.take(/\b(?:aged?\s+|who are\s+|that are\s+|are\s+)?(over|older than|above|more than|at least|under|younger than|below|less than|at most)\s+(\d{1,3})(?:\s*(?:years?(?:\s+of\s+age|\s+old)?|yrs?))?\b(?!\s*(?:days?|weeks?|months?|services?|times?|people))/g, function (a, off) {
      var n = +a[2], w = a[1];
      if (/over|older|above|more/.test(w)) add('age', 'gt', String(n), off); else if (w === 'at least') add('age', 'gt', String(n - 1), off);
      else if (w === 'at most') add('age', 'lt', String(n + 1), off); else add('age', 'lt', String(n), off);
    });
    R.take(/\b(?:aged?\s+)?(\d{1,3})\s+years?\s+old\b/g, function (a, off) { add('age', 'eq', a[1], off); });
    // Staff, directory, status, away, new
    R.take(new RegExp('\\b' + NOT + '(?:church\\s+)?staff(?:\\s+members?)?\\b', 'g'), function (a, off) { add('staff', a[1] ? 'no' : 'yes', '', off); });
    R.take(/\b(?:who\s+|that\s+)?(?:share|shares|sharing)\s+(?:their\s+)?contact details\b|\bin the (?:church )?directory\b/g, function (a, off) { add('directory', 'yes', '', off); });
    R.take(/\b(?:who\s+(?:have\s+)?|that\s+(?:have\s+)?)?left(?:\s+the\s+church)?\b/g, function (a, off) { add('status', 'eq', 'Left', off); });
    R.take(/\b(?:deceased|who\s+(?:have\s+)?died|that\s+(?:have\s+)?died|passed away|who\s+have\s+passed)\b/g, function (a, off) { add('status', 'eq', 'Deceased', off); });
    R.take(/\baway\s+(?:soon|in the (?:next|coming) (?:few|8|eight) weeks|in the coming weeks)\b/g, function (a, off) { add('awaySoon', 'yes', '', off); });
    R.take(new RegExp('\\badded\\s+(?:in\\s+)?(?:the\\s+)?(?:last|past)\\s+' + NUM_RX + '?\\s*(days?|weeks?|months?|years?)\\b', 'g'), function (a, off) { add('added', 'last', String(a[1] ? num(a[1]) : 1), off, { unit: a[2].replace(/s?$/, 's') }); });
    R.take(/\b(?:new people|newcomers|new members|new arrivals)\b/g, function (a, off) { add('added', 'last', '3', off, { unit: 'months' }); });
    // Marital status
    R.take(new RegExp('\\b' + NOT + '(single|engaged|married|separated|divorced|widowed|widows?|widowers?)\\b(?!\\s+(?:in|on|anniversar))', 'g'), function (a, off) {
      var v = /^wid/.test(a[2]) ? 'Widowed' : a[2].charAt(0).toUpperCase() + a[2].slice(1); add('marital', a[1] ? 'ne' : 'eq', v, off);
    });
    // Serving: at a service, in a position or team, or at all
    (ctx.slots || []).forEach(function (sl) {
      var names = slotWords(sl).map(rx).join('|'); if (!names) return;
      R.take(new RegExp('\\b(?:volunteers?|volunteering|serv(?:e|es|ing)|helps?|helping|who\\s+serve|on\\s+the\\s+roster)\\s+(?:at|in|for)\\s+(?:the\\s+)?(?:' + names + ')(?:\\s+services?)?\\b', 'g'), function (a, off) { add('serviceTimes', 'inc', sl.label, off); });
    });
    // A team or position counts only when it reads like one ("on the sound desk", "worship team"), so a team called Kids isn't
    // mistaken for children
    var named = function (list, field) {
      (list || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (n) {
        var w = rx(String(n).toLowerCase()).replace(/&/g, '(?:&|and)');
        R.take(new RegExp('\\b' + NOT + '(?:(?:on|in|for|who do|who does|who are on|serving (?:on|in|as)|serve (?:on|in|as)|serves (?:on|in|as)|volunteers? (?:on|in|for)|helps? (?:on|in|with)|helping (?:on|in|with))\\s+(?:the\\s+)?' + w +
          '(?:\\s+(?:team|rota|roster|ministry))?|' + w + '\\s+(?:team|volunteers?|people|rota|roster|ministry))\\b', 'g'), function (a, off) { add(field, a[1] ? 'ninc' : 'inc', n, off); });
      });
    };
    named(ctx.teams, 'teams'); named(ctx.positions, 'positions');
    R.take(new RegExp('\\b' + NOT + '(volunteers?|volunteering|volunteer|serving|who\\s+serve|that\\s+serve|who\\s+volunteer|on\\s+a\\s+(?:serving\\s+)?team|on\\s+the\\s+roster)(?:\\s+in\\s+(?:any|some)\\s+(?:capacity|way|role|position|form))?\\b', 'g'), function (a, off) {
      add('volunteer', a[1] ? 'no' : 'yes', '', off);
    });
    R.take(/\b(?:who\s+(?:do\s+not|don't|never)\s+(?:serve|volunteer)|not\s+serving|non-?volunteers)\b/g, function (a, off) { add('volunteer', 'no', '', off); });
    // Where they live: a town the church has people in
    (ctx.towns || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (t) {
      R.take(new RegExp('\\b(?:who\\s+)?(?:live|lives|living|staying|stay|from|based)\\s+(?:in\\s+)?' + rx(t.toLowerCase()) + '\\b', 'g'), function (a, off) { add('town', 'has', t, off); });
    });
    // Category, with the church's own words ("Parishioners") and the usual ones ("official partners", "members")
    catWords(ctx).forEach(function (c) {
      var list = c[1];
      R.take(new RegExp('\\b' + NOT + '(?:' + list.join('|') + ')\\b', 'g'), function (a, off) { add('category', a[1] ? 'ne' : 'eq', c[0], off); });
    });
    // Gender, and adults or children
    R.take(new RegExp('\\b' + NOT + '(males?|men|man|gentlemen|boys?|brothers)\\b', 'g'), function (a, off) { add('gender', a[1] ? 'ne' : 'eq', 'Male', off); if (/^boy/.test(a[2])) add('adultChild', 'eq', 'Child', off); });
    R.take(new RegExp('\\b' + NOT + '(females?|women|woman|ladies|lady|girls?|sisters)\\b', 'g'), function (a, off) { add('gender', a[1] ? 'ne' : 'eq', 'Female', off); if (/^girl/.test(a[2])) add('adultChild', 'eq', 'Child', off); });
    R.take(/\b(teenagers?|teens?)\b/g, function (a, off) { add('adultChild', 'eq', 'Child', off); add('age', 'between', '13', off, { value2: '19' }); });
    R.take(/\b(children|child|kids?|youth|young people)\b/g, function (a, off) { add('adultChild', 'eq', 'Child', off); });
    R.take(/\badults?\b/g, function (a, off) { add('adultChild', 'eq', 'Adult', off); });
    // How a name starts: "first names beginning with M", "surname starts with van", "names starting with the letter J"
    var NAME_PART = '(first\\s*names?|forenames?|given names?|christian names?|sur\\s*names?|last\\s*names?|family names?|names?)';
    var partField = function (w) { return /^(sur|last|family)/.test(w) ? 'lastName' : 'firstName'; };
    R.take(new RegExp('\\b(?:(?:whose|with|with a|with the|that have|who have|having|has a|have a)\\s+)?' + NAME_PART +
      '\\s+(?:that\\s+|which\\s+|is\\s+|are\\s+)?(?:begins?|beginning|starts?|starting|start)\\s+with\\s+(?:the\\s+letters?\\s+|letters?\\s+)?([a-z\'\\-]+(?:\\s+(?:der|den|de|la|le))?)\\b', 'g'),
      function (a, off) { add(partField(a[1]), 'starts', a[2], off); });
    // "whose surname is Pike", "with the first name Andy"
    R.take(new RegExp('\\b(?:whose|with the|with a|with)\\s+' + NAME_PART.replace('|names?)', ')') + '\\s+(?:is\\s+)?([a-z\'\\-]+)\\b', 'g'),
      function (a, off) { add(partField(a[1]), 'eq', a[2], off); });
    // A name: "called Andy", "named Pike", "with the surname Pike"
    R.take(/\b(?:called|named|with the (?:sur|last |first )?name|whose (?:sur|last |first )?name is)\s+([a-z'\-]+(?:\s+[a-z'\-]+)?)\b/g, function (a, off) { add('name', 'has', a[1], off); });

    // "and" between filters unless "or" joins two of the same kind: "partners or attenders" → (1 OR 2) AND 3
    out.filters.sort(function (a, b) { return a.at - b.at; });
    var join = [], src = tidy(out.q);
    out.filters.forEach(function (f, i) {
      if (!i) return;
      var prev = out.filters[i - 1], between = src.slice(prev.at, f.at).replace(/^\S*\s/, '');
      join.push(/\bor\b/.test(between) && prev.field === f.field ? 'or' : 'and');
    });
    if (join.indexOf('or') >= 0) {
      var parts = [], cur = ['1'];
      join.forEach(function (j, i) { if (j === 'or') cur.push(String(i + 2)); else { parts.push(cur); cur = [String(i + 2)]; } });
      parts.push(cur);
      out.match = 'logic'; out.logic = parts.map(function (p) { return p.length > 1 ? '(' + p.join(' OR ') + ')' : p[0]; }).join(' AND ');
    }
    out.filters.forEach(function (f) { delete f.at; });
  }

  /** The ways a service can be named: its label ("10am"), its time ("10:00", "10 o'clock"), and for specials their name. */
  function slotWords(sl) {
    var out = [], l = String(sl.label || '').toLowerCase().trim();
    if (l) { out.push(l); out.push(l.replace(/\s+/g, '')); }
    var m = /^(\d\d):(\d\d)$/.exec(sl.time || '');
    if (m) {
      var h = +m[1], h12 = h % 12 || 12, ap = h < 12 ? 'am' : 'pm';
      out.push(m[1] + ':' + m[2]); out.push(h + ':' + m[2]);
      if (m[2] === '00') { out.push(h12 + ap); out.push(h12 + ' o\'clock'); }
      else { out.push(h12 + ':' + m[2] + ap); out.push(h12 + '.' + m[2] + ap); }
    }
    return out.filter(function (x, i) { return x && out.indexOf(x) === i; }).sort(function (a, b) { return b.length - a.length; });
  }
  function partOf(time) { if (!time) return ''; return time < '12:00' ? 'morning' : time < '17:00' ? 'afternoon' : 'evening'; }

  /* ---------- services ---------- */
  function servicesQ(R, ctx, out) {
    var q = { from: '', to: '', slots: [], part: '', gaps: '', personId: '', personName: '', sameDay: '', missingPos: [] }, today = ctx.today;
    out.q = q;
    if (!ctx.services) { out.refused.push('services'); return; }
    // A person: the longest name of anyone in the church that appears in the question
    var best = null;
    (ctx.people || []).forEach(function (p) {
      (p.names || []).forEach(function (n) {
        n = String(n).toLowerCase().trim(); if (!n || n.indexOf(' ') < 0) return;
        if (R.s.indexOf(' ' + n + ' ') >= 0 && (!best || n.length > best.n.length)) best = { id: p.id, n: n, name: p.names[0] };
      });
    });
    if (best) { q.personId = best.id; q.personName = best.name; R.take(new RegExp('\\b' + rx(best.n) + '(?:\'s)?\\b', 'g'), function () {}); }
    else {
      var who = /\b(?:where|when|that)\s+([a-z'\-]+(?:\s+[a-z'\-]+)?)\s+(?:is|are|was)\s+(?:serving|rostered|on the roster|helping|on duty)\b/.exec(R.s);
      if (who) out.noPerson = who[1].replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    // The same person twice in a day
    R.take(/\b(?:in|at|on)?\s*both\s+(?:an?\s+|the\s+)?morning\s+and\s+(?:an?\s+|the\s+)?(?:evening|night)\s+services?(?:\s+on\s+the\s+same\s+day)?\b/g, function () { q.sameDay = 'morning-evening'; });
    R.take(/\b(?:twice|two services|more than one service|two times|2 services)\s+(?:on|in)\s+(?:the\s+)?(?:same\s+)?(?:day|sunday)\b|\bon\s+the\s+same\s+day\b/g, function () { if (!q.sameDay) q.sameDay = 'twice'; });
    // Which services
    (ctx.slots || []).forEach(function (sl) {
      var names = slotWords(sl).map(rx).join('|'); if (!names) return;
      R.take(new RegExp('\\b(?:the\\s+)?(?:' + names + ')(?:\\s+services?)?\\b', 'g'), function () { if (q.slots.indexOf(sl.id) < 0) q.slots.push(sl.id); });
    });
    R.take(/\b(morning|afternoon|evening|night)\s+services?\b/g, function (a) { q.part = a[1] === 'night' ? 'evening' : a[1]; });
    // Gaps: "do not have all necessary volunteer positions filled", "with gaps", "short of volunteers"
    R.take(/\b(?:that\s+|which\s+|who\s+)?(?:do not|don't|does not|doesn't|dont)\s+have\s+(?:all\s+)?(?:the\s+|their\s+)?(?:necessary\s+|needed\s+|required\s+)?(?:volunteers?\s+|serving\s+)?(?:positions?|roles?|spots?|slots?|places?|volunteers?|people)?\s*(?:filled|covered|in place|filled in)\b/g, function () { q.gaps = 'some'; });
    R.take(/\b(?:with\s+|that\s+have\s+|having\s+|have\s+)?(?:unfilled|empty|open|vacant|missing)\s+(?:volunteer\s+|serving\s+)?(?:positions?|roles?|spots?|slots?|places?)\b|\b(?:with\s+|that\s+have\s+|have\s+|any\s+)?gaps\b|\bnot\s+(?:fully|completely|all)\s+(?:staffed|filled|covered|rostered)\b|\bunder-?staffed\b|\bshort-?staffed\b|\bshort\s+of\s+(?:volunteers|people|helpers)\b|\bneed(?:s|ing)?\s+(?:more\s+)?(?:volunteers|people|helpers)\b|\bincomplete\b|\bunfilled\b/g, function () { q.gaps = 'some'; });
    R.take(/\b(?:fully|completely)\s+(?:staffed|filled|covered|rostered)\b|\b(?:with\s+)?(?:all|every)\s+(?:the\s+)?(?:volunteer\s+)?positions?\s+filled\b|\bno\s+gaps\b|\ball\s+filled\b/g, function () { q.gaps = 'none'; });
    // No one in a position: "without a sound desk", "no projection"
    (ctx.positions || []).slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (n) {
      R.take(new RegExp('\\b(?:without|with no|no|missing|needing|need)\\s+(?:an?\\s+|anyone\\s+(?:on|for|doing)\\s+(?:the\\s+)?)?' + rx(n.toLowerCase()) + '\\b', 'g'), function () { q.missingPos.push(n); });
    });
    // Dates
    var d1, d2;
    R.take(new RegExp('\\b(?:between|from)\\s+' + DATE_RX + '\\s+(?:and|to|until|till|through|-|–)\\s+' + DATE_RX + '\\b', 'g'), function (a) {
      d1 = readDate(a[1], today); d2 = readDate(a[4], today, d1);   // a[4]: DATE_RX holds 3 groups
      if (!d1 || !d2) return false; q.from = d1; q.to = d2;
    });
    R.take(new RegExp('\\b(?:after|from|since|starting)\\s+' + DATE_RX + '\\b', 'g'), function (a) { var d = readDate(a[1], today); if (!d) return false; q.from = a[0].indexOf('after') >= 0 ? addDays(d, 1) : d; });
    R.take(new RegExp('\\b(?:before|until|till|up to|by)\\s+' + DATE_RX + '\\b', 'g'), function (a) { var d = readDate(a[1], today); if (!d) return false; q.to = a[0].indexOf('before') >= 0 ? addDays(d, -1) : d; });
    R.take(new RegExp('\\bon\\s+' + DATE_RX + '\\b', 'g'), function (a) { var d = readDate(a[1], today); if (!d) return false; q.from = q.to = d; });
    R.take(new RegExp('\\b(?:in|during)\\s+' + MON_RX + '(?:\\s+(\\d{4}))?\\b', 'g'), function (a) {
      var m = monthOf(a[1]), y = a[2] ? +a[2] : +today.slice(0, 4); if (!a[2] && monthEnd(y, m) < today) y++;
      q.from = iso(y, m, 1); q.to = monthEnd(y, m);
    });
    R.take(/\b(this|next)\s+(week|month|year)\b/g, function (a) {
      var t = parseIso(today);
      if (a[2] === 'week') { var start = addDays(today, -((t.getDay() + 6) % 7) + (a[1] === 'next' ? 7 : 0)); q.from = start; q.to = addDays(start, 6); }
      else if (a[2] === 'month') { var f = addMonths(today, a[1] === 'next' ? 1 : 0); q.from = f; q.to = monthEnd(+f.slice(0, 4), +f.slice(5, 7)); }
      else { var y = +today.slice(0, 4) + (a[1] === 'next' ? 1 : 0); q.from = iso(y, 1, 1); q.to = iso(y, 12, 31); }
    });
    R.take(new RegExp('\\b(?:in\\s+)?(?:the\\s+)?(next|coming|last|past)\\s+' + NUM_RX + '?\\s*(days?|weeks?|months?)\\b', 'g'), function (a) {
      var n = a[2] ? num(a[2]) : 1, u = a[3], fwd = a[1] === 'next' || a[1] === 'coming';
      var other = /^month/.test(u) ? addMonths(today, fwd ? n : -n).slice(0, 8) + today.slice(8) : addDays(today, (fwd ? 1 : -1) * n * (/^week/.test(u) ? 7 : 1));
      if (fwd) { q.from = today; q.to = other; } else { q.from = other; q.to = today; }
    });
    R.take(/\b(?:today|this sunday|this coming sunday)\b/g, function () { q.from = today; q.to = addDays(today, 6 - ((parseIso(today).getDay() + 6) % 7)); });
    R.take(/\b(?:upcoming|coming|future|from now on|ahead)\b/g, function () { if (!q.from) q.from = today; });
    R.take(/\b(?:past|previous|earlier|already held)\b/g, function () { if (!q.to) q.to = addDays(today, -1); });
    if (!q.from && !q.to) q.from = today;   // nothing said: the services still to come
    R.take(/\b(?:services?|sundays?|rosters?|rotas?|is\s+serving|are\s+serving|serving|rostered|on\s+the\s+roster)\b/g, function () {});
  }

  /** What was understood, for the screen: [text, values] pairs, translated where they are shown. */
  function sayServices(q, slotLabel) {
    var s = [];
    if (q.from && q.to && q.from === q.to) s.push([TX('On {date}'), { date: fmtDate(q.from) }]);
    else if (q.from && q.to) s.push([TX('{from} to {to}'), { from: fmtDate(q.from), to: fmtDate(q.to) }]);
    else if (q.from) s.push([TX('From {date}'), { date: fmtDate(q.from) }]);
    else if (q.to) s.push([TX('Until {date}'), { date: fmtDate(q.to) }]);
    if (q.slots.length) s.push([TX('At {services}'), { services: q.slots.map(slotLabel).join(', ') }]);
    if (q.part) s.push([q.part === 'morning' ? TX('Morning services') : q.part === 'evening' ? TX('Evening services') : TX('Afternoon services'), null]);
    if (q.gaps === 'some') s.push([TX('Not all positions filled'), null]);
    if (q.gaps === 'none') s.push([TX('All positions filled'), null]);
    q.missingPos.forEach(function (p) { s.push([TX('No one on {position}'), { position: p }]); });
    if (q.personId) s.push([q.sameDay === 'morning-evening' ? TX('{name} serving at a morning and an evening service on the same day') : q.sameDay === 'twice' ? TX('{name} serving more than once on the same day') : TX('{name} serving'), { name: q.personName }]);
    else if (q.sameDay) s.push([q.sameDay === 'morning-evening' ? TX('Someone serving at a morning and an evening service on the same day') : TX('Someone serving more than once on the same day'), null]);
    return s;
  }

  /** Which kind of question: services ("all 10am services …") or people ("men who …"), by whichever comes first. */
  function kindOf(s) {
    var sv = s.search(/\b(?:services?|rosters?|rotas?|sundays)\b/), pp = s.search(/\b(?:people|persons?|everyone|everybody|anyone|men|women|males?|females?|ladies|partners?|parishioners?|attenders?|volunteers?|members?|children|kids|adults|staff|teenagers?|boys|girls|who\s+(?:are|have|has|is|do|does|live|serve|volunteer))\b/);
    if (sv < 0) return 'people';
    if (pp < 0) return 'services';
    // "services where Andy Pike is serving" – the service word comes first; "volunteers at the 10am service" – people first
    return sv < pp ? 'services' : 'people';
  }

  function parse(question, ctx) {
    ctx = ctx || {}; ctx.today = ctx.today || toIso(new Date());
    var R = new Run(question), out = { q: question, filters: [], match: 'all', logic: '', refused: [], unknown: [] };
    out.kind = kindOf(R.s);
    if (out.kind === 'services') { servicesQ(R, ctx, out); out.said = sayServices(out.q, ctx.slotLabel || function (id) { return id; }); out.q.text = question; }
    else { people(R, ctx, out); delete out.q; }
    out.unknown = R.left();
    return out;
  }

  /**
   * The services that match. data: { services, assignments, positions, runsAt(pos, svc), timeOf(svc) }.
   * Returns [{ service, gaps: [{ position, missing }], missing, mine: [positions] }], by date and time.
   */
  function services(data, q) {
    var pos = {}; (data.positions || []).forEach(function (p) { pos[p.id] = p; });
    var live = (data.assignments || []).filter(function (a) { return a.status !== 'declined'; });
    var by = {}; live.forEach(function (a) { (by[a.serviceId] = by[a.serviceId] || []).push(a); });
    var timeOf = data.timeOf || function (s) { return s.time || ''; };
    var mineOn = {};   // date → parts of the day the person serves at
    if (q.personId) live.forEach(function (a) {
      if (a.personId !== q.personId) return;
      var s = (data.services || []).filter(function (x) { return x.id === a.serviceId; })[0]; if (!s) return;
      (mineOn[s.date] = mineOn[s.date] || []).push(s.id + '|' + partOf(timeOf(s)));
    });
    var rows = (data.services || []).filter(function (s) {
      if (q.from && s.date < q.from) return false;
      if (q.to && s.date > q.to) return false;
      if (q.slots.length && q.slots.indexOf(s.slot || s.time) < 0) return false;
      if (q.part && partOf(timeOf(s)) !== q.part) return false;
      return true;
    }).map(function (s) {
      var here = by[s.id] || [], gaps = [];
      (data.positions || []).forEach(function (p) {
        if (data.runsAt && !data.runsAt(p, s)) return;
        var n = Math.max(0, (p.needed || 1) - here.filter(function (a) { return a.positionId === p.id; }).length);
        if (n) gaps.push({ position: p, missing: n });
      });
      return { service: s, gaps: gaps, missing: gaps.reduce(function (t, g) { return t + g.missing; }, 0),
        mine: q.personId ? here.filter(function (a) { return a.personId === q.personId; }).map(function (a) { return pos[a.positionId]; }).filter(Boolean) : [] };
    }).filter(function (r) {
      if (q.gaps === 'some' && !r.missing) return false;
      if (q.gaps === 'none' && r.missing) return false;
      if (q.missingPos.length && !q.missingPos.every(function (n) { return r.gaps.some(function (g) { return g.position.name.toLowerCase() === n.toLowerCase(); }); })) return false;
      if (q.personId && !r.mine.length) return false;
      if (q.sameDay && q.personId) {
        var parts = (mineOn[r.service.date] || []).map(function (x) { return x.split('|')[1]; });
        if (q.sameDay === 'morning-evening') return parts.indexOf('morning') >= 0 && parts.indexOf('evening') >= 0;
        return parts.length > 1;
      }
      if (q.sameDay && !q.personId) {   // anyone serving twice that day: keep services where such a person serves
        var day = r.service.date, twice = {};
        (data.services || []).filter(function (x) { return x.date === day; }).forEach(function (x) {
          (by[x.id] || []).forEach(function (a) { (twice[a.personId] = twice[a.personId] || []).push(partOf(timeOf(x))); });
        });
        return (by[r.service.id] || []).some(function (a) { var p = twice[a.personId]; return q.sameDay === 'morning-evening' ? p.indexOf('morning') >= 0 && p.indexOf('evening') >= 0 : p.length > 1; });
      }
      return true;
    });
    rows.sort(function (a, b) { return a.service.date < b.service.date ? -1 : a.service.date > b.service.date ? 1 : timeOf(a.service) < timeOf(b.service) ? -1 : 1; });
    return rows;
  }

  return { sayServices: sayServices, parse: parse, services: services, tidy: tidy, readDate: readDate, slotWords: slotWords, partOf: partOf, THING_LABEL: THING_LABEL };
})();
if (typeof module !== 'undefined') module.exports = Ask;
