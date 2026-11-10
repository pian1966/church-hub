/* Church Hub – Email templates, placeholders and the day's email prompts (pure, tested: tests/emails.test.js).
 * Birthdays, wedding anniversaries (one email to the couple), the anniversary of a spouse's death, and newcomer welcomes.
 * Only people who agreed to receive email are suggested (the caller says who, with opts.canEmail).
 * Church Hub doesn't send these itself yet: it opens the church's email program or Gmail with the message ready. */
var Emails = (function () {
  'use strict';

  var SIGN = '{signOff}';   // the "Signed by" name from Settings → Email templates (the church's name until set)
  var DEFAULT_TEMPLATES = {
    birthday: {
      name: 'Birthday',
      subject: 'Happy birthday from {churchName}!',
      body: 'Dear {firstName},\n\nWishing you a very happy birthday today! We pray that God blesses you richly in the year ahead.\n\nWarm regards,\n' + SIGN
    },
    anniversary: {
      name: 'Wedding anniversary',
      subject: 'Happy wedding anniversary from {churchName}!',
      body: 'Dear {firstName},\n\nCongratulations on your wedding anniversary today{yearsText}! May God continue to bless your marriage and your journey together.\n\nWarm regards,\n' + SIGN
    },
    spouseDeath: {
      name: 'Death day of spouse',
      subject: 'Thinking of you today',
      body: 'Dear {firstName},\n\nWe are holding you in our thoughts and prayers today as you remember {spouseName}. May God’s comfort and peace surround you.\n\nWith love and prayers,\n' + SIGN
    },
    welcomeFirst: {
      name: 'Welcome (first visit)',
      subject: 'Welcome to {churchName}!',
      body: 'Dear {firstName},\n\nThank you so much for joining us for the first time! It was wonderful to have you with us. Please let us know if there is any way we can help you feel at home.\n\nWarm regards,\n' + SIGN
    },
    welcomeThreeWeeks: {
      name: 'Welcome (3 weeks)',
      subject: 'Thank you for being part of {churchName}',
      body: 'Dear {firstName},\n\nIt has been great seeing you at {churchName} over these past three weeks! We would love to help you get connected or answer any questions you might have. Please feel free to reach out anytime.\n\nWarm regards,\n' + SIGN
    }
  };
  var NOT_MARRIED = /divorc|separat|widow|single|annul/i;   // no anniversary email for these marital statuses

  function getTemplates(settings) {
    var custom = (settings && settings.emailTemplates) || {};
    var out = {};
    Object.keys(DEFAULT_TEMPLATES).forEach(function (k) {
      out[k] = {
        name: DEFAULT_TEMPLATES[k].name,
        subject: (custom[k] && custom[k].subject) || DEFAULT_TEMPLATES[k].subject,
        body: (custom[k] && custom[k].body) || DEFAULT_TEMPLATES[k].body
      };
    });
    return out;
  }

  /** 'mail' (the computer's or phone's own email program) or 'gmail' (Gmail in the browser). */
  function getMethod(settings) {
    var m = settings && settings.emailMethod;
    return m === 'gmail' ? 'gmail' : 'mail';   // 'afrihost' from the first version means the email program
  }

  function interpolate(templateStr, data) {
    var s = String(templateStr || '');
    Object.keys(data || {}).forEach(function (k) {
      s = s.split('{' + k + '}').join(data[k] != null ? data[k] : '');
    });
    return s;
  }

  function sameMonthDay(isoDate, todayStr) {
    if (!isoDate || !todayStr) return false;
    return String(isoDate).slice(5, 10) === todayStr.slice(5, 10);
  }

  function diffDays(isoA, isoB) {
    var da = LeaveCore.parse(isoA), db = LeaveCore.parse(isoB);
    return Math.round((db - da) / 864e5);
  }

  function yearsSince(isoDate, todayStr) {
    if (!isoDate || !todayStr || isoDate > todayStr) return 0;
    var d = +todayStr.slice(0, 4) - +isoDate.slice(0, 4);
    if (todayStr.slice(5, 10) < isoDate.slice(5, 10)) d--;
    return Math.max(0, d);
  }

  function keyDate(p, re) {
    var k = (p.keyDates || []).filter(function (x) { return re.test(x.label || ''); })[0];
    return k ? k.date : '';
  }

  function gone(p) { return !p || p.active === false || p.deceasedAt || p.category === 'Deceased' || p.mergedInto; }
  function first(p) { return p.preferredName || p.firstName || ''; }
  function full(p) { return (first(p) + ' ' + (p.lastName || '')).trim(); }

  /**
   * The emails to suggest today.
   * people: person records · todayStr: 'YYYY-MM-DD'
   * dismissed: a map or function (event id -> true) of prompts already sent or set aside today
   * opts: canEmail(p) – they agreed to receive email (default: yes, for tests);
   *       spouseOf(p) – their living spouse or partner, or null; lateSpouse(p) – the spouse who died, or null
   */
  function findEvents(people, todayStr, dismissed, opts) {
    opts = opts || {};
    if (!todayStr) todayStr = LeaveCore.iso(new Date());
    var isDismissed = typeof dismissed === 'function' ? dismissed : function (key) { return !!(dismissed && dismissed[key]); };
    var byId = {};
    (people || []).forEach(function (p) { byId[p.id] = p; });
    var canEmail = opts.canEmail || function () { return true; };
    var spouseOf = opts.spouseOf || function () { return null; };
    var lateSpouse = opts.lateSpouse || function (p) { return p.lateSpouseId ? byId[p.lateSpouseId] || null : null; };
    var reachable = function (p) { return !gone(p) && !!p.email && canEmail(p); };

    var events = [], seen = {};
    function add(type, ps, data) {
      var key = ps.map(function (x) { return x.id; }).sort().join('+') + '_' + type + '_' + todayStr;
      if (seen[key] || isDismissed(key)) return;
      seen[key] = true;
      var to = ps.filter(reachable);
      if (!to.length) return;
      events.push({ id: key, type: type, person: ps[0], people: ps, recipientEmail: to.map(function (x) { return x.email; }).join(', '), data: data });
    }
    function one(p, extra) {
      return Object.assign({ firstName: first(p), lastName: p.lastName || '', fullName: full(p) }, extra || {});
    }

    (people || []).forEach(function (p) {
      if (!reachable(p)) return;

      // 1. Birthday
      if (p.birthDate && sameMonthDay(p.birthDate, todayStr)) {
        var by = yearsSince(p.birthDate, todayStr);
        add('birthday', [p], one(p, { years: by, yearsText: by ? ' (' + by + ')' : '' }));
      }

      // 2. Wedding anniversary – one email to the couple when both are still together
      var wed = keyDate(p, /wedding|anniversary/i), sp = spouseOf(p);
      if (sp && gone(sp)) sp = null;
      if (!wed && sp) wed = keyDate(sp, /wedding|anniversary/i);
      if (wed && sameMonthDay(wed, todayStr) && p.familyRole !== 'child' && !NOT_MARRIED.test(p.maritalStatus || '') && !(sp && NOT_MARRIED.test(sp.maritalStatus || ''))) {
        var wy = yearsSince(wed, todayStr), ps = sp ? [p, sp] : [p];
        var sameSurname = sp && (sp.lastName || '') === (p.lastName || '');
        add('anniversary', ps, {
          firstName: sp ? first(p) + ' and ' + first(sp) : first(p),
          lastName: sp && !sameSurname ? '' : p.lastName || '',
          fullName: sp ? (sameSurname ? first(p) + ' and ' + first(sp) + ' ' + (p.lastName || '') : full(p) + ' and ' + full(sp)).trim() : full(p),
          years: wy, yearsText: wy ? ' (' + wy + ' years)' : ''
        });
      }

      // 3. The anniversary of a spouse's death
      var ls = lateSpouse(p);
      var died = ls ? (ls.deceasedAt || keyDate(ls, /died|death/i)) : '';
      if (died && sameMonthDay(died, todayStr)) {
        var dy = yearsSince(died, todayStr);
        add('spouseDeath', [p], one(p, { spouseName: full(ls), years: dy, yearsText: dy ? ' ' + dy + ' year' + (dy === 1 ? '' : 's') + ' ago' : '' }));
      }

      // 4. Welcome on the day of a first visit, and 5. three weeks later
      var fv = keyDate(p, /first visit/i);
      if (fv && fv === todayStr) add('welcomeFirst', [p], one(p));
      if (fv && diffDays(fv, todayStr) === 21) add('welcomeThreeWeeks', [p], one(p));
    });

    return events;
  }

  /**
   * The link that opens the email ready to send. method: 'mail' or 'gmail'.
   * opts: { to, bcc, subject, body, from } – bcc: addresses everyone gets without seeing each other's; from: the church's Gmail address, so Gmail opens in that account when signed in to it.
   */
  function makeSendUrl(method, opts) {
    var subject = encodeURIComponent(opts.subject || ''), body = encodeURIComponent(opts.body || '');
    if (method === 'gmail') {
      return 'https://mail.google.com/mail/' + (opts.from ? '?authuser=' + encodeURIComponent(opts.from) + '&' : '?') +
        'view=cm&fs=1&to=' + encodeURIComponent(opts.to || '') + (opts.bcc ? '&bcc=' + encodeURIComponent(opts.bcc) : '') + '&su=' + subject + '&body=' + body;
    }
    return 'mailto:' + String(opts.to || '').split(/\s*,\s*/).filter(Boolean).join(',') + '?' + (opts.bcc ? 'bcc=' + encodeURIComponent(opts.bcc).replace(/%2C/g, ',') + '&' : '') + 'subject=' + subject + '&body=' + body;
  }

  /** Prompts older than today – no longer needed (they are removed so the list never grows). */
  function stale(records, todayStr) { return (records || []).filter(function (r) { return !r.date || r.date < todayStr; }); }

  return {
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    getTemplates: getTemplates,
    getMethod: getMethod,
    interpolate: interpolate,
    findEvents: findEvents,
    makeSendUrl: makeSendUrl,
    sameMonthDay: sameMonthDay,
    yearsSince: yearsSince,
    diffDays: diffDays,
    stale: stale
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Emails;
}
