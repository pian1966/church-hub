/*
 * Church Hub – the church's own words for people and roles (Settings → Terminology (Church Words)).
 * Churches call the same things by different names: a Pastor may be a Priest, Minister or Clergy; a Church Partner a
 * Member or Parishioner. An Administrator picks a ready-made set for their kind of church and can rename any word.
 * Only what is shown on the screen changes (in English); what is stored stays the same ("Church Partner" in the database
 * shows as "Parishioner"), so switching sets never changes anyone's records. Tested with node: tests/wording.test.js.
 */
var Wording = (function () {
  'use strict';
  // key: [singular, plural] as Church Hub says it, and what it is
  var TERMS = [
    ['pastor', ['Pastor', 'Pastors'], 'The role that keeps pastoral notes'],
    ['senior', ['Senior Pastor', 'Senior Pastors'], 'The Pastor who leads the church (chosen in Settings → What Pastors can do)'],
    ['assistant', ['Assistant Pastor', 'Assistant Pastors'], 'The other Pastors, who work with the Senior Pastor'],
    ['partner', ['Church Partner', 'Church Partners'], 'A committed member of the church (a category)'],
    ['attender', ['Attender', 'Attenders'], 'Someone who comes regularly but isn’t a member (a category)'],
    ['visiting', ['Visiting Minister', 'Visiting Ministers'], 'A preacher or minister from elsewhere (a category)'],
    ['kids', ['Children’s ministry', 'Children’s ministry'], 'The role that looks after children (and their medical notes)'],
    ['rosters', ['Roster coordinator', 'Roster coordinators'], 'The role that makes the rosters'],
    ['office', ['Church office', 'Church offices'], 'Where the administration is done'],
    ['care', ['Care Group', 'Care Groups'], 'A small group that cares for one another'],
    ['carer', ['Carer', 'Carers'], 'Someone who leads a Care Group'],
    ['life', ['Midweek Group', 'Midweek Groups'], 'A Bible Study, Life Group or Connect Group (etc) that meets during the week for teaching and fellowship'],
    ['groups', ['Groups', 'Groups'], 'The menu entry that holds Care Groups, Midweek Groups and Leadership', 'menu'],
    ['lifeLeader', ['Group leader', 'Group leaders'], 'Someone who leads a Midweek Group'],
    ['worship', ['Worship', 'Worship'], 'Music in services (also teams and positions named after it)'],
    ['worshipTeam', ['Worship team', 'Worship teams'], 'The team that leads music in services'],
    ['worshipLeader', ['Worship leader', 'Worship leaders'], 'Who leads the music in a service']
  ];
  /** Quick choices for what the music in services is called (Settings → Terminology (Church Words)). */
  var MUSIC = {
    Worship: { worship: ['Worship', 'Worship'], worshipTeam: ['Worship team', 'Worship teams'], worshipLeader: ['Worship leader', 'Worship leaders'] },
    Music: { worship: ['Music', 'Music'], worshipTeam: ['Music team', 'Music teams'], worshipLeader: ['Music leader', 'Music leaders'] },
    Praise: { worship: ['Praise', 'Praise'], worshipTeam: ['Praise team', 'Praise teams'], worshipLeader: ['Praise leader', 'Praise leaders'] }
  };
  var SETS = {
    general: { name: 'General (as Church Hub comes)', words: {} },
    anglican: { name: 'Anglican / Episcopal', words: { pastor: ['Clergy', 'Clergy'], senior: ['Rector', 'Rectors'], assistant: ['Assistant Minister', 'Assistant Ministers'], partner: ['Parishioner', 'Parishioners'], visiting: ['Visiting Clergy', 'Visiting Clergy'], rosters: ['Rota coordinator', 'Rota coordinators'], office: ['Parish office', 'Parish offices'], care: ['Home group', 'Home groups'], carer: ['Home group leader', 'Home group leaders'] } },
    catholic: { name: 'Catholic', words: { pastor: ['Priest', 'Priests'], senior: ['Parish Priest', 'Parish Priests'], assistant: ['Assistant Priest', 'Assistant Priests'], partner: ['Parishioner', 'Parishioners'], visiting: ['Visiting Priest', 'Visiting Priests'], kids: ['Children’s catechesis', 'Children’s catechesis'], office: ['Parish office', 'Parish offices'], care: ['Small Christian Community', 'Small Christian Communities'], carer: ['Leader', 'Leaders'] } },
    methodist: { name: 'Methodist', words: { pastor: ['Minister', 'Ministers'], partner: ['Member', 'Members'], visiting: ['Visiting Preacher', 'Visiting Preachers'], care: ['Class', 'Classes'], carer: ['Class leader', 'Class leaders'] } },
    presbyterian: { name: 'Presbyterian / Reformed', words: { pastor: ['Minister', 'Ministers'], assistant: ['Associate Minister', 'Associate Ministers'], partner: ['Communicant Member', 'Communicant Members'], attender: ['Adherent', 'Adherents'], care: ['Elder’s district', 'Elders’ districts'], carer: ['Elder', 'Elders'] } },
    baptist: { name: 'Baptist', words: { assistant: ['Associate Pastor', 'Associate Pastors'], partner: ['Member', 'Members'], visiting: ['Visiting Preacher', 'Visiting Preachers'], care: ['Small group', 'Small groups'], carer: ['Group leader', 'Group leaders'] } },
    pentecostal: { name: 'Pentecostal / Charismatic', words: { assistant: ['Associate Pastor', 'Associate Pastors'], partner: ['Member', 'Members'], visiting: ['Guest Speaker', 'Guest Speakers'], care: ['Cell group', 'Cell groups'], carer: ['Cell leader', 'Cell leaders'] } },
    lutheran: { name: 'Lutheran', words: { assistant: ['Associate Pastor', 'Associate Pastors'], partner: ['Member', 'Members'], visiting: ['Visiting Pastor', 'Visiting Pastors'], office: ['Parish office', 'Parish offices'], care: ['Home group', 'Home groups'], carer: ['Group leader', 'Group leaders'] } }
  };

  /** The words in use: { key: [singular, plural] } from the chosen set and any the Administrator renamed. */
  function words(settings) {
    var w = (settings && settings.wording) || {}, set = SETS[w.set] || SETS.general, out = {};
    TERMS.forEach(function (t) {
      var c = w.custom && w.custom[t[0]], s = set.words[t[0]];
      out[t[0]] = (c && c[0] ? [c[0], c[1] || (c[0] === t[1][0] ? t[1][1] : c[0])] : null) || (s ? s.slice() : t[1].slice());
    });
    // Senior and Assistant Pastor follow the word for Pastor unless they were named themselves ("Minister" → "Senior Minister")
    ['senior', 'assistant'].forEach(function (k) {
      var c = w.custom && w.custom[k];
      if (c && c[0] || set.words[k]) return;
      var base = TERMS.filter(function (t) { return t[0] === k; })[0][1][0].split(' ')[0];
      out[k] = [base + ' ' + out.pastor[0], base + ' ' + out.pastor[1]];
    });
    return out;
  }
  function titleCase(s) { return s.replace(/(^| )([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  // Names of groups are proper nouns – a church's "Home group" shows as "Home Group", like "Care Group" and "Midweek Group"
  var PROPER = { care: 1, life: 1 };
  /** What to change on the screen: [[from, to], …], longest first, with the lower-case forms ("pastor" → "minister") too. */
  function pairs(settings) {
    var w = words(settings), out = [];
    TERMS.forEach(function (t) {
      if (t[3] === 'menu') return;   // only the menu entry uses it (js/mod-groups.js): "Groups" elsewhere stays as it is
      [0, 1].forEach(function (i) {
        var from = t[1][i], to = PROPER[t[0]] ? titleCase(w[t[0]][i]) : w[t[0]][i];
        if (from === to) return;
        out.push([from, to]);
        // "Worship Team" written with capitals (e.g. a team's name) changes too, to "Music Team"
        if (/ [a-z]/.test(from)) out.push([titleCase(from), titleCase(to)]);
        if (lowerFirst(from) !== from) out.push([lowerFirst(from), /^[A-Z][a-z]/.test(to) && !/ [A-Z]/.test(to) ? lowerFirst(to) : to]);
      });
    });
    var seen = {};
    return out.filter(function (p) { if (seen[p[0]]) return false; seen[p[0]] = 1; return true; }).sort(function (a, b) { return b[0].length - a[0].length; });
  }
  function rx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** A function that changes a piece of text to the church's words (whole words only: "Pastoral notes" stays). */
  function changer(settings) {
    var ps = pairs(settings); if (!ps.length) return function (s) { return s; };
    var map = {}; ps.forEach(function (p) { map[p[0]] = p[1]; });
    var re = new RegExp('(^|[^A-Za-z’\'])(' + ps.map(function (p) { return rx(p[0]); }).join('|') + ')(?![A-Za-z])', 'g');
    return function (s) { return typeof s === 'string' && s ? s.replace(re, function (m, pre, w) { return pre + map[w]; }) : s; };
  }
  /** Change the words in what's on the screen: text, and the titles, placeholders and labels of controls. Not what
   *  people type (boxes keep their values) and not inside elements marked data-own-words. */
  function apply(root, change) {
    if (!root || !change || typeof document === 'undefined') return;
    var w = document.createTreeWalker(root, 4 /* text */, { acceptNode: function (n) {
      var p = n.parentNode; return p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || (p.closest && p.closest('[data-own-words]')) ? 2 : 1;
    } });
    var n; while ((n = w.nextNode())) { var t = change(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
    if (root.querySelectorAll) root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(function (e) {
      ['title', 'placeholder', 'aria-label'].forEach(function (a) { var v = e.getAttribute(a); if (v) { var t = change(v); if (t !== v) e.setAttribute(a, t); } });
    });
  }

  return { TERMS: TERMS, SETS: SETS, MUSIC: MUSIC, words: words, pairs: pairs, changer: changer, apply: apply };
})();
if (typeof module !== 'undefined') module.exports = Wording;
