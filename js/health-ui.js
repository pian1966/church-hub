/* Church & Trellis – the Church health card on Administrators' Home (rules: js/health.js; words: js/i18n/health.js; test: tests/app/health.js).
 * It shows what is worth a look – each check with something to look at, with how often it is worth looking (every week,
 * every 2 weeks, every month) – and how many others are all clear. It is worked out when Home is shown (kept until anything
 * changes), only on the Administrator's own device, and shows counts: names stay on the pages it links to. */
(function () {
  'use strict';
  var H = Hub, esc = H.esc, S = Store, T = I18n.t, TN = I18n.tn;
  var TINT = '#0F766E';
  var CADENCE = { weekly: 'Weekly', fortnightly: 'Every 2 weeks', monthly: 'Monthly' };
  var memo = { v: null, value: null };

  function results() {
    var v = S.version ? S.version() : '';
    if (memo.value && memo.v === v) return memo.value;
    var adr = 0; try { adr = window.PeopleParts ? PeopleParts.addressMismatches().length : 0; } catch (e) { adr = 0; }
    var value = Health.run({ today: H.today(), people: S.list('people'), services: S.list('services'), assignments: S.list('assignments'),
      careGroups: S.list('careGroups'), retentionMonths: (S.settings() || {}).retentionMonths, addressMismatches: adr });
    memo = { v: v, value: value }; return value;
  }
  /** The words of one check that has something to look at. */
  function line(c) {
    var n = c.count;
    return {
      rosterGone: function () { return TN('{n} upcoming roster turn is held by someone who is no longer at the church', '{n} upcoming roster turns are held by people who are no longer at the church', n); },
      addresses: function () { return TN('{n} couple with different home addresses', '{n} couples with different home addresses', n); },
      marriage: function () { return TN('{n} person has marriage records that don’t agree', '{n} people have marriage records that don’t agree', n); },
      unreachable: function () { return TN('{n} adult has no email address or mobile number', '{n} adults have no email address or mobile number', n); },
      noLeader: function () { return TN('{n} group has no leader', '{n} groups have no leader', n); },
      retention: function () { return TN('{n} person who left is due for review under Privacy', '{n} people who left are due for review under Privacy', n); }
    }[c.id]();
  }
  function link(c) { return c.first && /^(marriage|unreachable)$/.test(c.id) ? '#/people/p/' + c.first : c.href; }

  function card() {
    if (!H.can('*') || typeof Health === 'undefined') return '';
    var list = results(), look = list.filter(function (c) { return c.count > 0; }), clear = list.length - look.length;
    return '<section class="panel health-card" id="health-card"><h2>' + T('Church health tests') + '</h2>' +
      (look.length ? '<ul class="todo">' + look.map(function (c) {
        return '<li><a href="' + esc(link(c)) + '"><span class="dot" style="--c:' + TINT + '"></span><span class="grow">' + esc(line(c)) + '</span><span class="tag" style="--c:' + TINT + '">' + esc(T(CADENCE[c.cadence])) + '</span></a></li>';
      }).join('') + '</ul>' + (clear ? '<p class="hint" style="margin:8px 0 0">' + esc(TN('{n} other check is all clear.', '{n} other checks are all clear.', clear)) + '</p>' : '')
        : '<p class="empty" style="margin:0">' + T('All clear – nothing to look at right now.') + '</p>') +
      '<p class="hint" style="margin:8px 0 0">' + T('Worth looking at every week, every 2 weeks or every month, as marked. Only Administrators see this.') + '</p></section>';
  }
  window.HealthUI = { card: card };
})();
