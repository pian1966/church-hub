/* Church & Trellis – the little celebrations on a birthday or wedding anniversary (screens; the rules are js/celebrate.js).
 *  - card(person): a warm card with a few falling petals, on the person's own Home and Me page.
 *  - tag(person): a small "🎂 Birthday today" / "💍 Wedding anniversary today" beside a name – only where the screen already
 *    shows that person's birthday or anniversary (the caller decides: a person's page, a Care Group or Midweek Group card).
 *  - cake(mmdd, quiet): a 🎂 for a Care Group card, where the carer already sees the birthday.
 *  - weekCard(): "Birthdays this week" on Home – Pastors and Administrators: everyone; carers and Midweek Group leaders:
 *    the people in the groups they lead, from the cards they already see; Pastors also "May be a hard day" (a late spouse).
 *  - optOut(p): the switch on Me → My details ("Celebrate my birthday and anniversary").
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
  function cake(mmdd, quiet) {
    return mmdd && !quiet && C.isOn(mmdd, H.today()) ? ' <span class="cel-cake" title="' + esc(T('Birthday today')) + '" role="img" aria-label="' + esc(T('Birthday today')) + '">🎂</span>' : '';
  }

  /* ---------- Birthdays this week (Home) ---------- */
  function live(p) { return p && p.active !== false && !p.binnedAt && !p.mergedInto && !C.gone(p); }
  function seesEveryone() { return H.can('people.view') || H.can('*'); }
  /** The people whose dates this person may see, as { person, spouse, lateSpouse } – never more than they already see. */
  function mine() {
    if (seesEveryone()) {
      return S.find('people', live).map(function (p) { return { person: p, spouse: spouseOf(p), lateSpouse: lateSpouseOf(p) }; });
    }
    // Carers and Midweek Group leaders: the cards of the groups they lead (day and month, only with Care group consent)
    var me = (H.user() || {}).id, out = {}, led = {};
    if (typeof Care === 'undefined' || !me) return [];
    S.list('careGroups').concat(S.list('lifeGroups')).forEach(function (g) { if (Care.isLeader(g, me)) led[g.id] = 1; });
    S.list('careShare').concat(S.list('lifeShare')).forEach(function (c) {
      if (!led[c.groupId] || !c.ok || !c.birthday || out[c.personId] || c.personId === me) return;
      out[c.personId] = { person: { id: c.personId, firstName: c.firstName, lastName: c.lastName, preferredName: c.preferredName, birthDay: c.birthday, noCelebrate: !!c.quiet } };
    });
    return Object.keys(out).map(function (k) { return out[k]; });
  }
  function nameOf(p) { return ((p.preferredName || p.firstName || '') + ' ' + (p.lastName || '')).trim(); }
  function when(x) { return x.inDays === 0 ? T('Today') : x.inDays === 1 ? T('Tomorrow') : H.fmt(x.date); }
  var auditedHard = '';
  function weekCard() {
    var leads = !seesEveryone() && typeof Care !== 'undefined' && S.list('careGroups').concat(S.list('lifeGroups')).some(function (g) { return Care.isLeader(g, (H.user() || {}).id); });
    if (!seesEveryone() && !leads) return '';
    var today = H.today(), list = C.week(mine(), today, 7).slice(0, 12), msg = H.can('*') || H.can('people.edit');
    var rows = list.map(function (x) {
      var who = x.kind === 'anniversary' && x.spouse ? T('{a} and {b}', { a: nameOf(x.person), b: nameOf(x.spouse) }) : nameOf(x.person);
      var what = x.kind === 'birthday' ? '🎂 ' + T('Birthday') : '💍 ' + (x.years > 0 ? TN('Married {n} year', 'Married {n} years', x.years) : T('Wedding anniversary'));
      return '<li><span class="cel-when">' + esc(when(x)) + '</span><span class="grow">' + (seesEveryone() ? '<a href="#/people/p/' + esc(x.id) + '">' + esc(who) + '</a>' : esc(who)) +
        ' <small class="muted">' + esc(what) + '</small></span>' +
        (msg && x.inDays === 0 ? '<a class="btn small" href="#/messages/send/people/' + esc(x.id) + '">' + T('Send a message') + '</a>' : '') + '</li>';
    }).join('');
    // Pastors only: someone whose husband or wife has died, on the anniversary of the death or of their wedding
    var hard = '';
    if (H.can('notes')) {
      var seen = [];
      S.find('people', live).forEach(function (p) {
        var late = lateSpouseOf(p); if (!late) return;
        C.days(today, 7).forEach(function (d, i) {
          var k = C.hardDay(p, late, d); if (!k || seen.length >= 8) return;
          seen.push('<li><span class="cel-when">' + esc(when({ inDays: i, date: d })) + '</span><span class="grow"><a href="#/people/p/' + esc(p.id) + '">' + esc(nameOf(p)) + '</a> <small class="muted">' +
            esc(k === 'death' ? T('The anniversary of {name}’s death', { name: nameOf(late) }) : T('Their wedding anniversary, since {name} died', { name: nameOf(late) })) + '</small></span></li>');
        });
      });
      if (seen.length) {
        hard = '<h3 class="cel-hard-h">' + T('May be a hard day') + '</h3><p class="hint">' + T('Only Pastors see this. A call or a visit may mean a lot.') + '</p><ul class="cel-week">' + seen.join('') + '</ul>';
        if (auditedHard !== today) { auditedHard = today; S.audit('Viewed pastoral reminders (anniversaries of a spouse’s death)', 'home'); }
      }
    }
    if (!rows && !hard) return '';
    return '<section class="panel cel-week-card"><h2>' + T('Birthdays and anniversaries this week') + '</h2>' + (rows ? '<ul class="cel-week">' + rows + '</ul>' : '') + hard + '</section>';
  }

  /* ---------- Me → My details: turning celebrations off ---------- */
  function optOut(p) {
    if (!p || p.familyRole === 'child') return '';
    var on = !p.noCelebrate;
    return '<section class="panel"><h2>' + T('Birthdays and anniversaries') + '</h2>' +
      '<label class="cel-switch"><input type="checkbox" id="me-celebrate" data-act="me:celebrate"' + (on ? ' checked' : '') + '> ' + T('Celebrate my birthday and anniversary') + '</label>' +
      '<p class="hint">' + T(on ? 'On your day you get a card here and on Home, and people who can see the church directory see 🎂 or 💍 beside your name – the day only, never the year.' : 'Nobody sees 🎂 or 💍 beside your name, and your birthday isn’t in the church directory.') + '</p></section>';
  }

  return { card: card, tag: tag, cake: cake, special: special, weekCard: weekCard, optOut: optOut };
})();
