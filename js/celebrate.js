/* Church & Trellis – birthdays and wedding anniversaries worth celebrating today (pure rules, no screens; tested in tests/celebrate.test.js).
 * The screens are js/celebrate-ui.js. These rules only say WHETHER a day is special for a person – who may SEE it is decided
 * where it is shown (the Me page and Home: the person's own; a person's page and Care Groups: wherever their birthday is
 * already shown). They follow js/emails.js: no celebration for someone who has died, left or been merged, and a wedding
 * anniversary is never celebrated for someone who is widowed, separated, divorced or single, or whose spouse has died.
 */
var Celebrate = (function () {
  'use strict';
  var NOT_MARRIED = /divorc|separat|widow|single|annul/i;
  var WEDDING = /wedding|anniversary/i;

  function gone(p) { return !p || p.active === false || !!p.deceasedAt || p.category === 'Deceased' || !!p.mergedInto || !!p.binnedAt; }

  /** 'MM-DD' of a date written yyyy-mm-dd, or of a birthday kept without its year ('MM-DD'); '' if it isn't a date. */
  function monthDay(d) {
    var s = String(d || '');
    var m = /^\d{4}-(\d\d)-(\d\d)/.exec(s) || /^(\d\d)-(\d\d)$/.exec(s);
    return m ? m[1] + '-' + m[2] : '';
  }
  function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  /** Is a birthday or anniversary ('MM-DD' or yyyy-mm-dd) on this day (yyyy-mm-dd)? 29 February is kept on 28 February in other years. */
  function isOn(d, today) {
    var md = monthDay(d), t = monthDay(today);
    if (!md || !t) return false;
    if (md === t) return true;
    return md === '02-29' && t === '02-28' && !leap(+String(today).slice(0, 4));
  }
  /** Whole years from a yyyy-mm-dd date to today (0 when there is no year or it isn't in the past). */
  function years(d, today) {
    if (!/^\d{4}-\d\d-\d\d/.test(String(d || '')) || !/^\d{4}-\d\d-\d\d/.test(String(today || ''))) return 0;
    var n = +String(today).slice(0, 4) - +String(d).slice(0, 4);
    return n > 0 ? n : 0;
  }
  function keyDate(p, re) {
    var k = ((p && p.keyDates) || []).filter(function (x) { return re.test(x.label || ''); })[0];
    return k ? k.date : '';
  }

  /** { years } if today is this person's birthday (years is 0 when only the day and month are known), otherwise null. */
  function birthday(p, today) {
    if (gone(p)) return null;
    var d = p.birthDate || p.birthDay;
    if (!isOn(d, today)) return null;
    return { years: years(p.birthDate, today) };
  }

  /**
   * { years } if today is this person's wedding anniversary, otherwise null.
   * spouse: the person they are married to (or null); lateSpouse: a spouse who has died (or null).
   */
  function anniversary(p, spouse, today, lateSpouse) {
    if (gone(p) || p.familyRole === 'child' || lateSpouse) return null;
    if (NOT_MARRIED.test(p.maritalStatus || '')) return null;
    if (spouse) {
      if (gone(spouse) || NOT_MARRIED.test(spouse.maritalStatus || '')) return null;
    }
    var wed = keyDate(p, WEDDING) || (spouse ? keyDate(spouse, WEDDING) : '');
    if (!isOn(wed, today)) return null;
    return { years: years(wed, today) };
  }

  /** What is special for this person today: { birthday: {years}|null, anniversary: {years}|null, any: boolean }. */
  function today(p, spouse, todayStr, lateSpouse) {
    var b = birthday(p, todayStr), a = anniversary(p, spouse, todayStr, lateSpouse);
    return { birthday: b, anniversary: a, any: !!(b || a) };
  }

  var Celebrate = { gone: gone, monthDay: monthDay, isOn: isOn, years: years, birthday: birthday, anniversary: anniversary, today: today };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Celebrate; }
  return Celebrate;
})();
