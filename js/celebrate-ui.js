/* Church & Trellis – the little celebrations on a birthday or wedding anniversary (screens; the rules are js/celebrate.js).
 *  - card(person): a warm card with a few falling petals, on the person's own Home and Me page.
 *  - tag(person): a small "🎂 Birthday today" / "💍 Wedding anniversary today" beside a name – only where the screen already
 *    shows that person's birthday or anniversary (the caller decides: a person's page, a Care Group or Midweek Group card).
 *  - cake(mmdd): a 🎂 for a Care Group card, where the carer already sees the birthday.
 * Nothing here decides who may see a date, and nothing is stored. The petals are drawn with CSS (css/celebrate.css): no pictures.
 */
var CelebrateUI = (function () {
  'use strict';
  var H = Hub, S = Store, C = Celebrate, T = I18n.t, TN = I18n.tn, esc = H.esc;

  function spouseOf(p) {
    if (!p) return null;
    if (p.spouseId) { var s = S.get('people', p.spouseId); if (s) return s; }
    return S.find('people', function (x) { return x.spouseId === p.id; })[0] || null;
  }
  function lateSpouseOf(p) { return window.PeopleParts && PeopleParts.lateSpouse ? PeopleParts.lateSpouse(p) : null; }
  function special(p) { return p ? C.today(p, spouseOf(p), H.today(), lateSpouseOf(p)) : { any: false }; }

  var PETALS = 14;
  function petals() {
    var out = '';
    for (var i = 0; i < PETALS; i++) out += '<i style="--i:' + i + '"></i>';
    return '<span class="cel-petals" aria-hidden="true">' + out + '</span>';
  }

  /** The card for the person's own birthday and/or anniversary today ('' when it is neither). */
  function card(p) {
    var s = special(p);
    if (!s.any) return '';
    var html = '';
    if (s.birthday) {
      html += '<div class="cel-item"><span class="cel-ic" aria-hidden="true">🎂</span><div><h2>' + esc(T('Happy birthday, {name}!', { name: p.preferredName || p.firstName })) + '</h2>' +
        '<p>' + esc(T('The church is thankful for you. May God bless you richly in the year ahead.')) + '</p></div></div>';
    }
    if (s.anniversary) {
      var n = s.anniversary.years;
      html += '<div class="cel-item"><span class="cel-ic" aria-hidden="true">💍</span><div><h2>' + esc(T('Happy wedding anniversary!')) + '</h2>' +
        '<p>' + (n > 0 ? esc(TN('Married {n} year', 'Married {n} years', n)) + '. ' : '') + esc(T('Celebrating your marriage today. May God keep blessing it.')) + '</p></div></div>';
    }
    return '<section class="panel cel-card" aria-live="polite">' + petals() + html + '</section>';
  }

  /** A small tag beside someone's name, for the people who already see their birthday or anniversary. */
  function tag(p, opts) {
    opts = opts || {};
    var s = special(p), out = '';
    if (s.birthday && opts.birthday !== false) out += '<span class="tag cel-tag">🎂 ' + esc(T('Birthday today')) + '</span>';
    if (s.anniversary && opts.anniversary !== false) out += '<span class="tag cel-tag">💍 ' + esc(T('Wedding anniversary today')) + '</span>';
    return out;
  }

  /** A 🎂 for a Care Group or Midweek Group card (mmdd = the 'MM-DD' the carer already sees), only on the day. */
  function cake(mmdd) {
    return mmdd && C.isOn(mmdd, H.today()) ? ' <span class="cel-cake" title="' + esc(T('Birthday today')) + '" role="img" aria-label="' + esc(T('Birthday today')) + '">🎂</span>' : '';
  }

  return { card: card, tag: tag, cake: cake, special: special };
})();
