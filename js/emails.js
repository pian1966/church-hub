/* Church Hub – Email templates, placeholders and daily prompt calculations.
 * Used for birthdays, wedding anniversaries, death days of spouses, and newcomer welcome messages. */
var Emails = (function () {
  'use strict';

  var AFRIHOST_EMAIL = 'office@christchurchhowick.co.za';
  var GMAIL_EMAIL = 'christchurchhowick@gmail.com';

  var DEFAULT_TEMPLATES = {
    birthday: {
      name: 'Birthday',
      subject: 'Happy Birthday from {churchName}!',
      body: 'Dear {firstName},\n\nWishing you a very happy birthday today! We pray that God blesses you richly in the year ahead.\n\nWarm regards,\n{churchName}'
    },
    anniversary: {
      name: 'Wedding anniversary',
      subject: 'Happy Wedding Anniversary from {churchName}!',
      body: 'Dear {firstName},\n\nCongratulations on your wedding anniversary today{yearsText}! May God continue to bless your marriage and journey together.\n\nWarm regards,\n{churchName}'
    },
    spouseDeath: {
      name: 'Death day of spouse',
      subject: 'Thinking of you today – from {churchName}',
      body: 'Dear {firstName},\n\nWe are holding you in our thoughts and prayers today as you remember {spouseName}{yearsText}. May God’s comfort and peace surround you.\n\nWith love and prayers,\n{churchName}'
    },
    welcomeFirst: {
      name: 'Welcome (first visit)',
      subject: 'Welcome to {churchName}!',
      body: 'Dear {firstName},\n\nThank you so much for joining us for the first time! It was wonderful to have you with us. Please let us know if there is any way we can serve you or help you feel at home.\n\nWarm regards,\n{churchName}'
    },
    welcomeThreeWeeks: {
      name: 'Welcome (3 weeks)',
      subject: 'Thank you for being part of {churchName}',
      body: 'Dear {firstName},\n\nIt has been great seeing you at {churchName} over these past three weeks! We would love to help you get connected or answer any questions you might have. Please feel free to reach out anytime.\n\nWarm regards,\n{churchName}'
    }
  };

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

  function getMethod(settings) {
    return (settings && settings.emailMethod) || 'afrihost';
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
    return isoDate.slice(5, 10) === todayStr.slice(5, 10);
  }

  function diffDays(isoA, isoB) {
    var da = LeaveCore.parse(isoA), db = LeaveCore.parse(isoB);
    return Math.round((db - da) / 864e5);
  }

  function yearsSince(isoDate, todayStr) {
    if (!isoDate || !todayStr || isoDate > todayStr) return 0;
    var y1 = +isoDate.slice(0, 4), y2 = +todayStr.slice(0, 4);
    var d = y2 - y1;
    if (todayStr.slice(5, 10) < isoDate.slice(5, 10)) d--;
    return Math.max(0, d);
  }

  function keyDate(p, re) {
    var k = (p.keyDates || []).filter(function (x) { return re.test(x.label || ''); })[0];
    return k ? k.date : '';
  }

  function lateSpouse(p, peopleMap) {
    if (p.lateSpouseId && peopleMap[p.lateSpouseId]) return peopleMap[p.lateSpouseId];
    return null;
  }

  /**
   * Finds events for today:
   *  - birthday
   *  - anniversary
   *  - spouseDeath
   *  - welcomeFirst
   *  - welcomeThreeWeeks
   * people: list of person records
   * todayStr: 'YYYY-MM-DD'
   * dismissed: map or function (id_eventType_date -> true)
   */
  function findEvents(people, todayStr, dismissed) {
    if (!todayStr) todayStr = LeaveCore.iso(new Date());
    var isDismissed = typeof dismissed === 'function' ? dismissed : function (key) { return !!(dismissed && dismissed[key]); };
    var peopleMap = {};
    (people || []).forEach(function (p) { peopleMap[p.id] = p; });

    var events = [];

    (people || []).forEach(function (p) {
      if (p.active === false || p.deceasedAt || p.category === 'Deceased' || p.mergedInto) return;
      if (!p.email) return;

      var fullName = ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim();
      var fName = p.preferredName || p.firstName || '';

      // 1. Birthday
      if (p.birthDate && sameMonthDay(p.birthDate, todayStr)) {
        var bKey = p.id + '_birthday_' + todayStr;
        if (!isDismissed(bKey)) {
          var bYears = yearsSince(p.birthDate, todayStr);
          events.push({
            id: bKey,
            type: 'birthday',
            person: p,
            recipientEmail: p.email,
            data: {
              firstName: fName,
              lastName: p.lastName || '',
              fullName: fullName,
              years: bYears,
              yearsText: bYears ? ' (' + bYears + ')' : ''
            }
          });
        }
      }

      // 2. Wedding anniversary
      var wedDate = keyDate(p, /wedding|anniversary/i);
      if (wedDate && sameMonthDay(wedDate, todayStr) && p.familyRole !== 'child' && p.maritalStatus !== 'Widowed') {
        var anKey = p.id + '_anniversary_' + todayStr;
        if (!isDismissed(anKey)) {
          var wYears = yearsSince(wedDate, todayStr);
          events.push({
            id: anKey,
            type: 'anniversary',
            person: p,
            recipientEmail: p.email,
            data: {
              firstName: fName,
              lastName: p.lastName || '',
              fullName: fullName,
              years: wYears,
              yearsText: wYears ? ' (' + wYears + ' years)' : ''
            }
          });
        }
      }

      // 3. Death day of spouse
      var ls = lateSpouse(p, peopleMap);
      var deathDate = ls ? (ls.deceasedAt || keyDate(ls, /died/i)) : '';
      if (deathDate && sameMonthDay(deathDate, todayStr)) {
        var spKey = p.id + '_spouseDeath_' + todayStr;
        if (!isDismissed(spKey)) {
          var spYears = yearsSince(deathDate, todayStr);
          var sName = ((ls.preferredName || ls.firstName || '') + ' ' + (ls.lastName || '')).trim();
          events.push({
            id: spKey,
            type: 'spouseDeath',
            person: p,
            recipientEmail: p.email,
            data: {
              firstName: fName,
              lastName: p.lastName || '',
              fullName: fullName,
              spouseName: sName,
              years: spYears,
              yearsText: spYears ? ' ' + spYears + ' year' + (spYears === 1 ? '' : 's') + ' ago' : ''
            }
          });
        }
      }

      // 4. Welcome (First visit)
      var fvDate = keyDate(p, /first visit/i);
      if (fvDate && fvDate === todayStr) {
        var wfKey = p.id + '_welcomeFirst_' + todayStr;
        if (!isDismissed(wfKey)) {
          events.push({
            id: wfKey,
            type: 'welcomeFirst',
            person: p,
            recipientEmail: p.email,
            data: {
              firstName: fName,
              lastName: p.lastName || '',
              fullName: fullName
            }
          });
        }
      }

      // 5. Welcome (3 weeks after first visit = 21 days)
      if (fvDate && diffDays(fvDate, todayStr) === 21) {
        var w3Key = p.id + '_welcomeThreeWeeks_' + todayStr;
        if (!isDismissed(w3Key)) {
          events.push({
            id: w3Key,
            type: 'welcomeThreeWeeks',
            person: p,
            recipientEmail: p.email,
            data: {
              firstName: fName,
              lastName: p.lastName || '',
              fullName: fullName
            }
          });
        }
      }
    });

    return events;
  }

  /**
   * Generates link / url to send email.
   * method: 'afrihost' or 'gmail'
   * opts: { to, subject, body, churchName }
   */
  function makeSendUrl(method, opts) {
    var to = encodeURIComponent(opts.to || '');
    var subject = encodeURIComponent(opts.subject || '');
    var body = encodeURIComponent(opts.body || '');

    if (method === 'gmail') {
      // Gmail compose web URL. Christ Church Howick gmail with alias / reply-to notice
      return 'https://mail.google.com/mail/?view=cm&fs=1&to=' + to +
        '&su=' + subject +
        '&body=' + body;
    }

    // Default: Afrihost / standard email client (mailto)
    // We add reply-to and from hint where supported
    return 'mailto:' + (opts.to || '') +
      '?subject=' + subject +
      '&body=' + body;
  }

  return {
    AFRIHOST_EMAIL: AFRIHOST_EMAIL,
    GMAIL_EMAIL: GMAIL_EMAIL,
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    getTemplates: getTemplates,
    getMethod: getMethod,
    interpolate: interpolate,
    findEvents: findEvents,
    makeSendUrl: makeSendUrl,
    sameMonthDay: sameMonthDay,
    yearsSince: yearsSince,
    diffDays: diffDays
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Emails;
}
