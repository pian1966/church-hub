/* Church & Trellis – Subscription: "buy us a coffee" (Administrators). The rules (prices, plans, prayer cards, who to pray for)
 * are in js/coffee.js; this is the page and the Home card.
 *   #/support        choose a coffee, how often, a gift, and who it's for (our church or another church)
 *   #/support/pray   the prayer circle: the church we pray for this week, our promise, and the weekly card on/off
 *   #/support/card   our church's prayer card: photo, two prayer points, "keep us hidden"
 * Every church is in the prayer circle (decided Nov 2026): everyone's Home shows a new church's prayer card every week
 * (Coffee.cardForWeek). A paying church's Administrator may turn that off (support.cardsOff); a church that prays instead
 * of paying may not. Every church keeps a prayer card and checks it once a month (Coffee.cardCheck): Home asks the
 * Administrator until it is done ("Keep it as it is" counts).
 * Kept in Settings: settings.support = { cup: { kind, price, currency }, plan, paidUntil, payments, holidays, choice, pledge, prayOn, cardsOff }
 *                   settings.prayerCard = { photo, photoOk, place, points: [2], discreet, needsHelp, updated }
 * Nothing about the church's people is on the prayer card. Until Church & Trellis's office exists (TARGET.md section 10) the
 * card stays in the church's own settings; the demo shows made-up churches (js/sample.js SampleChurches). */
(function () {
  'use strict';
  var H = Hub, S = Store, esc = H.esc, T = I18n.t;
  var C = Coffee;
  var sel = null;   // this visit's choice: { kind, price, currency, plan, cups, other, forWho, otherId }

  function st() { return S.settings() || {}; }
  function sup() { return st().support || {}; }
  function card() { return st().prayerCard || {}; }
  function country() { var c = Countries.church(st()); return c; }
  function selfId() { var cfg = window.CHURCH_HUB_FIREBASE || {}; return st().demo || !S.isLive() ? 'demo-self' : (cfg.projectId || 'church'); }
  function admin() { return H.can('support.manage'); }   // js/access.js: Administrators, and Pastors with the "settings" tick
  function pledged() { return !!(sup().pledge && sup().pledge.at); }
  function inCircle() { return C.showsCards(sup()); }
  function week() { return C.weekKey(H.today()); }
  function cur() { return C.currencyFor(country().code); }
  function myCup() { return C.cupOf(sup(), country().code); }
  function choice() {
    var code = cur();
    if (sel && sel.currency === code) return sel;
    var s = sup(), ch = s.choice || {}, c = myCup();
    sel = { kind: c.kind, price: c.price ? String(c.price) : '', currency: code, plan: ch.plan || 'year', cups: +ch.cups || 0, other: ch.other || '', forWho: 'us', otherId: '' };
    return sel;
  }
  /** Other churches in the prayer circle, as each wants to be seen. The demo: made-up churches. Live: none yet (the office). */
  function circle() {
    var list = st().demo && typeof SampleChurches !== 'undefined' ? SampleChurches : [];
    return list.map(function (c) { return C.publicCard(c.card, c); });
  }
  function ourCard() {
    var c = country();
    return C.publicCard(card(), { id: selfId(), name: st().churchName, town: '', country: c.code, countryName: c.name, continent: c.continent });
  }
  function partner() { return C.cardForWeek(selfId(), week(), circle()); }
  function quote() { var s = choice(); return C.quote({ price: s.price, currency: s.currency, plan: s.plan, gift: s.other !== '' ? s.other : C.giftOf(s.cups, s.price, s.currency) }); }

  /* ---------- pictures ---------- */
  var uid = 0;
  /** A cup seen from above, on its saucer – each coffee drawn as it looks. */
  function cupArt(kind, size) {
    var id = 'cup' + (++uid), s = size || 76, top = '';
    var surface = {
      cappuccino: ['#F1E4D0', '#D9BE98'], flatwhite: ['#B87A45', '#8A5428'], latte: ['#CF9F6E', '#A9713F'],
      americano: ['#4A2C1A', '#24140B'], macchiato: ['#EFDDBF', '#D4B48A']
    }[kind] || ['#CF9F6E', '#A9713F'];
    if (kind === 'glass') {   // a glass of tea or coffee from a stall, seen from above: no saucer
      return '<svg class="cup-art" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true"><defs><radialGradient id="' + id + 'g" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#E9B97A"/><stop offset="1" stop-color="#B9733A"/></radialGradient></defs>' +
        '<circle cx="50" cy="53" r="36" fill="rgba(0,0,0,.08)"/><circle cx="50" cy="50" r="36" fill="#F4FAFB" stroke="#CFDDE2" stroke-width="2"/><circle cx="50" cy="50" r="30" fill="url(#' + id + 'g)"/>' +
        '<path d="M33 40a20 20 0 0 1 14-12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/><circle cx="58" cy="56" r="7" fill="#F6E3C6" opacity=".55"/></svg>';
    }
    if (kind === 'cappuccino') top = '<g fill="#7A4A26" opacity=".55"><circle cx="46" cy="44" r="1.6"/><circle cx="53" cy="41" r="1.2"/><circle cx="50" cy="50" r="2"/><circle cx="57" cy="52" r="1.3"/><circle cx="43" cy="55" r="1.1"/><circle cx="52" cy="58" r="1.5"/><circle cx="60" cy="45" r="1"/></g>';
    else if (kind === 'flatwhite') top = '<path d="M50 61c-9-6-14-10-14-16a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 6-5 10-14 16z" fill="#FBF3E8"/>';
    else if (kind === 'latte') top = '<g fill="none" stroke="#FBF3E8" stroke-width="2.6" stroke-linecap="round"><path d="M50 66V36"/><path d="M42 41q8 4 16 0M40 47q10 5 20 0M39 53q11 5 22 0M41 59q9 4 18 0"/></g><circle cx="50" cy="34" r="3.4" fill="#FBF3E8"/>';
    else if (kind === 'americano') top = '<circle cx="50" cy="50" r="22" fill="none" stroke="#9A6436" stroke-width="3" opacity=".55"/><ellipse cx="44" cy="44" rx="6" ry="3" fill="#fff" opacity=".12"/>';
    else if (kind === 'macchiato') top = '<g stroke="#C07A2A" stroke-width="2" stroke-linecap="round" opacity=".9"><path d="M32 40l36 0M30 48l40 0M31 56l38 0M35 63l30 0"/><path d="M40 30l0 40M50 27l0 46M60 30l0 40"/></g>';
    return '<svg class="cup-art" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + 'l" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="' + surface[0] + '"/><stop offset="1" stop-color="' + surface[1] + '"/></radialGradient>' +
      '<radialGradient id="' + id + 's" cx="50%" cy="45%" r="60%"><stop offset=".7" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E8E1D8"/></radialGradient></defs>' +
      '<circle cx="50" cy="52" r="46" fill="rgba(0,0,0,.08)"/><circle cx="50" cy="50" r="46" fill="url(#' + id + 's)" stroke="#E2D9CE"/>' +
      '<rect x="78" y="44" width="18" height="12" rx="6" fill="#FFFFFF" stroke="#E2D9CE"/>' +
      '<circle cx="50" cy="50" r="33" fill="#FFFFFF" stroke="#E2D9CE"/><circle cx="50" cy="50" r="28" fill="url(#' + id + 'l)"/>' + top + '</svg>';
  }
  /** The big cup at the top of the page, with steam rising (still for people who prefer less movement). */
  function heroArt() {
    return '<svg class="sp-hero-cup" viewBox="0 0 160 150" aria-hidden="true">' +
      '<g class="sp-steam" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".5">' +
        '<path d="M62 42c-8-10 8-14 0-26"/><path d="M80 38c-8-10 8-14 0-26"/><path d="M98 42c-8-10 8-14 0-26"/></g>' +
      '<ellipse cx="80" cy="132" rx="66" ry="12" fill="rgba(0,0,0,.10)"/>' +
      '<ellipse cx="80" cy="126" rx="62" ry="11" fill="#FFFFFF" stroke="#E2D9CE"/>' +
      '<path d="M118 70h8a18 18 0 0 1 0 36h-12" fill="none" stroke="#FFFFFF" stroke-width="9"/><path d="M118 70h8a18 18 0 0 1 0 36h-12" fill="none" stroke="#E2D9CE" stroke-width="1.5"/>' +
      '<path d="M34 56h92l-8 52a22 22 0 0 1-22 18H64a22 22 0 0 1-22-18z" fill="#FFFFFF" stroke="#E2D9CE" stroke-width="1.5"/>' +
      '<path d="M38 74h84l-2 12H40z" fill="var(--accent)"/>' +
      '<path d="M46 92l2 6M114 92l-2 6" stroke="#EFE8DF" stroke-width="2"/>' +
      '<ellipse cx="80" cy="56" rx="46" ry="9" fill="#C9935F"/><ellipse cx="80" cy="55" rx="40" ry="6" fill="#F1E4D0"/>' +
      '<path d="M76 52c-3-2-5-3-5-5a2.5 2.5 0 0 1 5-1 2.5 2.5 0 0 1 5 1c0 2-2 3-5 5z" fill="#C9935F"/></svg>';
  }
  /** A church with no photo (or hidden): a drawing, its colour taken from the church so each looks different. */
  function placeholder(c) {
    var hue = 0, s = String(c.id || 'x'); for (var i = 0; i < s.length; i++) hue = (hue * 31 + s.charCodeAt(i)) % 360;
    var bg = 'linear-gradient(135deg, hsl(' + hue + ' 55% 62%), hsl(' + ((hue + 40) % 360) + ' 60% 42%))';
    var pic = c.discreet
      ? '<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><path d="M32 10c6 8 10 13 10 19a10 10 0 0 1-20 0c0-6 4-11 10-19z" fill="#FFF6DA"/><path d="M32 22c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9z" fill="#F5B53B"/><rect x="24" y="42" width="16" height="12" rx="3" fill="#FFF6DA"/></svg>'
      : '<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" fill="#FFFFFF"><path d="M30 6h4v6h5v4h-5v6l14 10v24H16V32l14-10v-6h-5v-4h5z" opacity=".95"/><path d="M28 56V44a4 4 0 0 1 8 0v12z" fill="rgba(0,0,0,.25)"/><circle cx="32" cy="34" r="3.5" fill="rgba(0,0,0,.2)"/></svg>';
    return '<div class="pc-pic pc-ph" style="background:' + bg + '">' + pic + '</div>';
  }
  function pcTitle(c) { return c.discreet ? T('A church in {region}', { region: T(c.region) }) : (c.title || T('Your church')); }
  /** A prayer card as other churches see it. */
  function prayerCard(c, opts) {
    opts = opts || {};
    return '<article class="pcard' + (opts.big ? ' big' : '') + (opts.pick ? ' pick' + (opts.on ? ' on' : '') : '') + '"' + (opts.pick ? ' role="radio" tabindex="0" aria-checked="' + !!opts.on + '" data-act="support:other" data-id="' + esc(c.id) + '"' : '') + '>' +
      (c.photo ? '<div class="pc-pic"><img src="' + esc(c.photo) + '" alt=""></div>' : placeholder(c)) +
      '<div class="pc-body"><h3>' + esc(pcTitle(c)) + '</h3>' +
      (c.discreet ? '<p class="pc-place">' + H.icon('M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6z', 14) + T('Kept hidden for their safety') + '</p>' : c.place ? '<p class="pc-place">' + esc(c.place) + '</p>' : '') +
      (c.points.length ? '<ul class="pc-points">' + c.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '<p class="muted">' + T('No prayer points yet.') + '</p>') +
      (c.needsHelp && opts.help ? '<span class="pc-help">' + T('Would be grateful for help with their subscription') + '</span>' : '') +
      '</div></article>';
  }

  /* ---------- the page ---------- */
  function tabs(on) {
    return '<nav class="seg sp-tabs">' + [['', 'Choose a plan'], ['pray', 'Churches to pray for'], ['card', 'Prayer card for your church']].map(function (t) {
      return '<a href="#/support' + (t[0] ? '/' + t[0] : '') + '" class="' + (on === t[0] ? 'on' : '') + '"' + (on === t[0] ? ' aria-current="page"' : '') + '>' + T(t[1]) + '</a>';
    }).join('') + '</nav>';
  }
  function head(tab) {
    return '<div class="page-head"><div><h1>' + T('Subscription') + '</h1><p class="lead">' + T('Church & Trellis for the price of a coffee.') + '</p></div></div>' + tabs(tab);
  }
  function hero() {
    return '<section class="sp-hero"><div class="sp-hero-art">' + heroArt() + '</div><div class="sp-hero-text">' +
      '<p class="sp-kicker">' + T('Every church, however small, deserves great church software.') + '</p>' +
      '<h2>' + T('Give us the price of one cup of coffee a month – whatever a cup costs where you live – and Church & Trellis keeps going, for you and for churches that can’t.') + '</h2>' +
      '<p>' + T('Church & Trellis is for every church, in every nation, in (nearly) every language. No church is ever turned away for being poor: a church that can’t afford a coffee pays in prayer instead.') + '</p>' +
      '<p class="sp-hero-more">' + T('The price is per church, not per person: one cup a month covers your whole church, however many people, groups and services you have.') + '</p>' +
      '<p class="sp-hero-more">' + T('Don’t mistake a low price for a lesser product. Church & Trellis competes with the best church management systems in the world. We keep the price low so that every church can have it, not because it does less.') + '</p>' +
      (pledged() ? '<p class="sp-chip">' + H.icon(PRAY, 16) + T('Your church has promised to pray for another church each week') + '</p>' : '') +
      '</div></section>';
  }
  var PRAY = 'M12 2c2.5 3 4 5.2 4 7.5a4 4 0 0 1-8 0C8 7.2 9.5 5 12 2zM9.5 15h5v7h-5z';   // a candle: prayer
  function drinks() {
    var s = choice(), cc = country().code, sym = C.currency(s.currency).sym.trim();
    var known = [];
    Object.keys(C.EXAMPLES).forEach(function (k) { var co = Countries.find(k); C.KINDS.forEach(function (kd) { var p = C.example(k, kd.id); if (p && co) known.push({ co: co, kind: kd, p: p, code: C.currencyFor(k) }); }); });
    return '<section class="sp-step"><div class="sp-step-h"><span class="sp-n">1</span><div><h2>' + T('What does one cup cost where you live?') + '</h2>' +
      '<p>' + T('Choose the cup that is honest for your church. A church with plenty, wherever it is in the world, might choose the coffee-chain price; a church with little, the street stall.') + '</p></div></div>' +
      '<div class="sp-cups sp-kinds" role="radiogroup" aria-label="' + esc(T('What does one cup cost where you live?')) + '">' + C.KINDS.map(function (k) {
        var on = k.id === s.kind, ex = C.example(cc, k.id);
        return '<button type="button" class="sp-cup' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="support:kind" data-k="' + k.id + '">' + cupArt(k.art) +
          '<b>' + esc(T(k.name)) + '</b><small>' + esc(T(k.note)) + '</small><span class="sp-price">' + (ex ? esc(T('About {price}', { price: C.money(ex, s.currency) })) : esc(T('You say how much'))) + '</span></button>';
      }).join('') + '</div>' +
      '<label class="field sp-other sp-cupprice' + (C.parse(s.price) ? '' : ' req') + '"><span>' + esc(T('One cup costs ({currency})', { currency: s.currency })) + '</span><span class="sp-money"><span>' + esc(sym) + '</span><input id="sp-cup" inputmode="decimal" value="' + esc(s.price) + '" autocomplete="off" aria-describedby="sp-cup-h"></span></label>' +
      '<p class="hint" id="sp-cup-h">' + esc(T('In {currency}, the money of {country}. You can change your country in Settings.', { currency: s.currency, country: T(country().name) })) + '</p>' +
      '<details class="sp-world"><summary>' + T('What a cup costs in some countries') + '</summary><div class="sp-table-wrap"><table class="sp-table"><thead><tr><th>' + T('Country') + '</th><th>' + T('Cup') + '</th><th>' + T('Price') + '</th></tr></thead><tbody>' +
        known.map(function (x) { return '<tr' + (x.co.code === cc ? ' class="on"' : '') + '><td>' + esc(T(x.co.name)) + '</td><td>' + esc(T(x.kind.name)) + '</td><td>' + esc(C.money(x.p, x.code)) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">' + T('November 2026, rounded. These are only examples: whatever the cup, give what is honest for your church.') + '</p></details></section>';
  }
  function plans() {
    var s = choice(), m = C.quote({ price: s.price, currency: s.currency, plan: 'month' }), y = C.quote({ price: s.price, currency: s.currency, plan: 'year' });
    var none = !m.cup, dash = '–';
    var plan = function (id, ribbon, big, per, line, sub) {
      var on = s.plan === id;
      return '<button type="button" class="sp-plan sp-plan-' + id + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-act="support:plan" data-p="' + id + '">' +
        (ribbon ? '<span class="sp-ribbon">' + esc(ribbon) + '</span>' : '') +
        '<span class="sp-plan-cups" aria-hidden="true">' + (id === 'pray' ? H.icon(PRAY, 26) : new Array(id === 'year' ? 10 : 1).join('.').split('.').map(function () { return '<i></i>'; }).join('')) + '</span>' +
        '<span class="sp-big">' + esc(big) + (per ? '<small>' + esc(per) + '</small>' : '') + '</span><b>' + esc(line) + '</b><span class="sp-sub">' + esc(sub) + '</span></button>';
    };
    return '<section class="sp-step"><div class="sp-step-h"><span class="sp-n">2</span><div><h2>' + T('How would you like to give?') + '</h2><p>' + T('Every way gives your church all of Church & Trellis.') + '</p></div></div>' +
      '<div class="sp-plans" role="radiogroup" aria-label="' + esc(T('How would you like to give?')) + '">' +
        plan('month', '', none ? dash : C.money(m.total, m.currency), T('a month'), T('One coffee a month'), T('Stop or change whenever you like.')) +
        plan('year', T('Two coffees free'), none ? dash : C.money(y.total, y.currency), T('a year'), T('Ten coffees a year'), none ? T('Two months free when you pay for the year.') : T('You save {amount} by paying for the year.', { amount: C.money(y.saved, y.currency) })) +
        plan('pray', '', T('Free'), '', T('Pray instead'), T('Can’t afford a coffee? Promise to pray, each week, for another church that uses Church & Trellis.')) +
      '</div></section>';
  }
  function gift() {
    var s = choice(), cupPrice = C.parse(s.price);
    return '<section class="sp-step"><div class="sp-step-h"><span class="sp-n">3</span><div><h2>' + T('Add a gift, if you’d like') + '</h2><p>' + T('What is Church & Trellis worth to your church? Think of the time it saves and what you can afford – every extra coffee helps a church that can’t pay.') + '</p></div></div>' +
      '<div class="sp-gift"><div class="sp-gift-cups" role="radiogroup" aria-label="' + esc(T('Extra coffees')) + '">' +
        [0, 1, 2, 3, 4, 5, 6].map(function (n) {
          var on = s.other === '' && s.cups === n;
          return '<button type="button" role="radio" aria-checked="' + on + '" class="sp-gc' + (on ? ' on' : '') + (s.other === '' && n && n <= s.cups ? ' full' : '') + '" data-act="support:cups" data-n="' + n + '" aria-label="' + esc(n ? T('{n} extra coffees', { n: n }) : T('No gift')) + '">' +
            (n ? '<span class="sp-gc-cup" aria-hidden="true"></span><small>+' + n + '</small>' : '<small>' + T('None') + '</small>') + '</button>';
        }).join('') + '</div>' +
        '<label class="field sp-other"><span>' + T('Or any amount') + '</span><span class="sp-money"><span>' + esc(C.currency(s.currency).sym.trim()) + '</span><input id="sp-other" inputmode="decimal" value="' + esc(s.other) + '" placeholder="' + esc(cupPrice ? String(cupPrice * 2) : '') + '" autocomplete="off"></span></label></div></section>';
  }
  function forWho() {
    var s = choice(), need = C.needing(circle(), selfId());
    return '<section class="sp-step"><div class="sp-step-h"><span class="sp-n">4</span><div><h2>' + T('Who are you paying for?') + '</h2><p>' + T('Your own church, or another church that can’t afford it.') + '</p></div></div>' +
      '<div class="sp-who" role="radiogroup" aria-label="' + esc(T('Who are you paying for?')) + '">' +
        '<button type="button" role="radio" aria-checked="' + (s.forWho === 'us') + '" class="sp-whob' + (s.forWho === 'us' ? ' on' : '') + '" data-act="support:who" data-w="us">' + H.icon(H.ICON.home, 22) + '<b>' + T('Your church') + '</b><small>' + esc(st().churchName || '') + '</small></button>' +
        '<button type="button" role="radio" aria-checked="' + (s.forWho === 'other') + '" class="sp-whob' + (s.forWho === 'other' ? ' on' : '') + '" data-act="support:who" data-w="other">' + H.icon('M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z', 22) + '<b>' + T('Another church') + '</b><small>' + T('An under-resourced church') + '</small></button>' +
      '</div>' +
      (s.forWho === 'other' ? '<div class="sp-others"><p class="hint">' + T('Choose a church that has asked for help, or let Church & Trellis give it where it’s needed most.') + '</p><div class="pcards" role="radiogroup">' +
        '<article class="pcard pick any' + (!s.otherId ? ' on' : '') + '" role="radio" tabindex="0" aria-checked="' + !s.otherId + '" data-act="support:other" data-id=""><div class="pc-pic pc-ph pc-any">' + H.icon('M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z', 40) + '</div><div class="pc-body"><h3>' + T('Where it’s needed most') + '</h3><p>' + T('Church & Trellis gives it to the church that has waited longest for help.') + '</p></div></article>' +
        need.map(function (c) { return prayerCard(c, { pick: true, on: s.otherId === c.id }); }).join('') + '</div></div>' : '') + '</section>';
  }
  function summary() {
    var s = choice(), q = quote(), pray = s.plan === 'pray';
    var who = s.forWho === 'other' ? (s.otherId ? pcTitle(circle().filter(function (c) { return c.id === s.otherId; })[0] || {}) : T('Where it’s needed most')) : (st().churchName || T('Your church'));
    return '<section class="sp-total' + (pray ? ' pray' : '') + '"><div>' + (pray
      ? '<b>' + T('Free, with a promise to pray') + '</b><small>' + T('Every week Church & Trellis shows your church another church to pray for.') + '</small>'
      : !q.cup ? '<b>' + T('Type what one cup costs where you live.') + '</b><small>' + T('Then choose how often, and Pay.') + '</small>'
      : '<span class="sp-total-n">' + esc(C.money(q.total, q.currency)) + '<small>' + esc(q.per === 'year' ? T('a year') : T('a month')) + '</small></span>' +
        '<small>' + esc(TN1(q.coffees)) + (q.gift ? ' + ' + esc(T('a gift of {amount}', { amount: C.money(q.gift, q.currency) })) : '') + ' · ' + esc(T('for {who}', { who: who })) + '</small>') + '</div>' +
      (admin() ? (pray
        ? (pledged() ? '<a class="btn primary" href="#/support/pray">' + T('See who we pray for') + '</a>' : '<button class="btn primary" data-act="support:promise">' + T('Make our promise') + '</button>')
        : q.total > 0 ? '<button class="btn primary" data-act="support:pay">' + esc(T('Pay {amount}', { amount: C.money(q.total, q.currency) })) + '</button>'
        : '<button class="btn primary" data-act="support:needprice">' + T('Pay') + '</button>') : '') + '</section>';
  }
  function renderChoose() {
    var s = choice();
    var steps = drinks() + plans() + (s.plan === 'pray' ? '' : gift() + forWho()) + summary(), top = statusPanel();
    if (top) steps = '<details class="sp-more"><summary>' + T('Change your coffee or plan, or pay for another church') + '</summary>' + steps + '</details>';
    return head('') + (top || hero()) + steps +
      '<p class="sp-foot">' + T('You pay by bank transfer from your own banking app. Church & Trellis never sees your card or your bank details.') + '</p>';
  }

  function renderPray() {
    var p = partner(), mine = ourCard(), sub = sup();
    var top = '';
    if (!inCircle()) top = '<section class="sp-circle-intro"><div class="sp-circle-art" aria-hidden="true">' + circleArt() + '</div><div><h2>' + T('The prayer circle') + '</h2>' +
      '<p>' + T('Churches around the world praying for each other. Every week Church & Trellis shows your church another church, with a photo and one or two things to pray for – and other churches pray for you.') + '</p>' +
      '<p>' + T('Your church has turned off the weekly prayer card on Home. Other churches still pray for you.') + '</p>' +
      (admin() ? '<div class="btns"><button class="btn primary" data-act="support:cardson">' + T('Show the weekly prayer card again') + '</button></div>' : '') + '</div></section>';
    var body = '';
    if (inCircle() && p) body = '<section class="sp-month"><p class="sp-kicker">' + esc(T('This week, {church} prays for', { church: st().churchName || T('our church') })) + '</p>' + prayerCard(p, { big: true }) +
      '<div class="sp-month-foot"><p>' + T('Pray for them in a Sunday service, a prayer meeting or a Care Group – or simply on your own this week.') + '</p>' + prayedBtn() + '</div></section>';
    else if (inCircle()) body = '<p class="note info">' + T('The prayer circle starts when Church & Trellis opens to other churches. From then on, a new church to pray for appears here every week – and on everyone’s Home page.') + '</p>';
    var promise = pledged() ? '<section class="panel sp-promise"><h2>' + T('Your church’s promise') + '</h2><p>' + esc(T('Made on {date} by {name}.', { date: H.fmt(sub.pledge.at, true), name: sub.pledge.by || '' })) + '</p>' +
      (admin() && sub.plan === 'pray' ? '' : admin() ? H.menu(T('More'), ['<button data-act="support:leave">' + T('Leave the prayer circle') + '</button>']) : '') + '</section>' : '';
    var onoff = admin() ? '<section class="panel sp-onoff">' +
      '<label class="set-row"><span class="set-l"><b>' + T('A prayer card on Home every week') + '</b><small>' + T('Everyone at your church sees the same church that week, so you can pray for it together on Sunday.') + '</small></span>' +
      '<span class="set-c sw"><input type="checkbox" role="switch" id="sp-cardson"' + (inCircle() ? ' checked' : '') + (C.mayHideCards(sub) ? '' : ' disabled') + ' aria-label="' + esc(T('A prayer card on Home every week')) + '"></span></label>' +
      (C.mayHideCards(sub) ? '' : '<p class="hint">' + T('Your church prays instead of paying, so the weekly prayer card stays on. It can be turned off once your church buys a coffee.') + '</p>') + '</section>' : '';
    var others = circle().filter(function (c) { return !p || c.id !== p.id; });
    var rest = inCircle() && others.length ? '<details class="sp-all"><summary>' + esc(T('All the churches in the circle ({n})', { n: others.length })) + '</summary><div class="pcards">' + others.map(function (c) { return prayerCard(c); }).join('') + '</div></details>' : '';
    return head('pray') + cardNudge() + top + body + '<div class="grid2 sp-pray-grid">' + promise + '<section class="panel"><h2>' + T('Prayer card for your church') + '</h2><p>' + T('This is what other churches in the circle see when they pray for you.') + '</p>' + prayerCard(mine) + '<div class="btns"><a class="btn" href="#/support/card">' + T('Change your prayer card') + '</a></div></section>' + onoff + '</div>' + rest;
  }
  /** Every church keeps a prayer card and checks it once a month: until it does, its Administrators are asked (Home, Pray page). */
  function cardNudge(home) {
    if (!admin() || S.preview()) return '';
    var ck = C.cardCheck(card(), H.today());
    if (ck.state === 'ok') return '';
    var missing = ck.state === 'missing';
    return '<section class="panel sp-nudge' + (home ? ' sp-home' : '') + '"><div class="sp-home-h">' + H.icon(PRAY, 18) + '<h2>' + T(missing ? 'Make your church’s prayer card' : 'Time to look at your prayer card') + '</h2></div>' +
      '<p>' + T(missing ? 'Every church that uses Church & Trellis has a prayer card – a photo and two things to pray for – so that other churches can pray for you. It takes two minutes.' : 'Once a month, every church checks its prayer card, so other churches pray for what matters to you now. Change it, or keep it as it is.') + '</p>' +
      '<div class="btns"><a class="btn primary" href="#/support/card">' + T(missing ? 'Make our prayer card' : 'Update the prayer card') + '</a>' +
      (missing ? '' : '<button class="btn" data-act="support:keepcard">' + T('Keep it as it is') + '</button>') + '</div></section>';
  }
  function circleArt() {
    var dots = ''; for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; dots += '<circle cx="' + (60 + Math.cos(a) * 42).toFixed(1) + '" cy="' + (60 + Math.sin(a) * 42).toFixed(1) + '" r="9" />'; }
    return '<svg viewBox="0 0 120 120" width="120" height="120"><circle cx="60" cy="60" r="42" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 6" opacity=".5"/><g fill="currentColor" class="sp-dots">' + dots + '</g>' +
      '<path d="M60 44c5 7 8 11 8 16a8 8 0 0 1-16 0c0-5 3-9 8-16z" fill="#F5B53B"/><rect x="54" y="68" width="12" height="10" rx="2" fill="currentColor" opacity=".7"/></svg>';
  }
  function prayedBtn() {
    var done = S.pref('prayedFor') === week();
    return done ? '<p class="sp-amen">' + H.icon('M5 12l5 5L20 7', 18) + T('Amen – thank you for praying.') + '</p>'
      : '<button class="btn small save" data-act="support:prayed">' + H.icon(PRAY, 16) + T('We’ve prayed for them') + '</button>';
  }

  function renderCard() {
    var c = card(), co = country(), discreet = C.isDiscreet(c, co.code), pts = (c.points || []).concat(['', '']).slice(0, 2), danger = C.takeCare(co.code);
    var names = [st().churchName, c.place].filter(Boolean);
    var form = '<section class="panel sp-cardform"><h2>' + T('Prayer card for your church') + '</h2>' +
      '<p class="hint">' + T('Other churches pray for you using this card: a photo and one or two things to pray for. It is the only thing about your church that is shared – never anything about your people.') + '</p>' +
      (danger ? '<p class="note warn">' + esc(T('Christians in {country} can face danger for their faith, so your card starts hidden: other churches see only “a church in {region}”.', { country: T(co.name), region: T(C.region(co.code, co.continent)) })) + '</p>' : '') +
      '<label class="set-row sp-hide"><span class="set-l"><b>' + T('Keep us hidden') + '</b><small>' + T('For churches where following Jesus is dangerous. No name, town, country or photo – only a wide region.') + '</small></span><span class="set-c sw"><input type="checkbox" role="switch" id="sp-discreet"' + (discreet ? ' checked' : '') + ' aria-label="' + esc(T('Keep us hidden')) + '"></span></label>' +
      (discreet ? '' :
        '<div class="sp-photo">' + (c.photo ? '<img src="' + esc(c.photo) + '" alt="' + esc(T('Your church')) + '">' : placeholder({ id: selfId() })) +
          '<div><b>' + T('A photo of your church or congregation') + '</b><p class="hint">' + T('Your building, your area, or your people – faces only if everyone in it agrees.') + '</p>' +
          '<div class="btns sp-photo-btns"><label class="btn small">' + H.icon('M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 16) + '<input type="file" class="sp-photo-in" accept="image/*" capture="environment" hidden>' + T('Take a photo') + '</label>' +
          '<label class="btn small">' + H.icon('M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4', 16) + '<input type="file" class="sp-photo-in" accept="image/*" hidden>' + T(c.photo ? 'Change photo' : 'Choose a photo') + '</label>' +
          (c.photo ? '<button class="btn small" data-act="support:nophoto">' + T('Remove') + '</button>' : '') + '</div></div></div>' +
          (c.photo ? '<label class="check"><input type="checkbox" id="sp-photook"' + (c.photoOk ? ' checked' : '') + '><span>' + T('Everyone who can be recognised in this photo has agreed to it being shown to other churches.') + '</span></label>' : '') +
        '<label class="field"><span>' + T('Your town or area') + '</span><input id="sp-place" value="' + esc(c.place || '') + '" maxlength="60" placeholder="' + esc(T('For example: Howick, KwaZulu-Natal')) + '"></label>') +
      pts.map(function (p, i) {
        return '<label class="field sp-point"><span>' + esc(T('Prayer point {n}', { n: i + 1 })) + '</span><textarea id="sp-pt' + i + '" rows="2" maxlength="' + C.POINT_MAX + '" data-names="' + esc(discreet ? names.join('|') : '') + '" placeholder="' + esc(T(i ? 'For example: wisdom as we look for a youth leader' : 'For example: rain for the farmers in our district')) + '">' + esc(p) + '</textarea>' +
          '<small class="sp-count"><span class="sp-warn" id="sp-w' + i + '"></span><span id="sp-c' + i + '">' + p.length + ' / ' + C.POINT_MAX + '</span></small></label>';
      }).join('') +
      '<p class="hint">' + T('Pray for things, not people by name. Don’t include phone numbers, email addresses or anything that could put someone at risk.') + '</p>' +
      '<label class="set-row"><span class="set-l"><b>' + T('We’d be grateful for help paying') + '</b><small>' + T('Churches that pay for another church will see your card.') + '</small></span><span class="set-c sw"><input type="checkbox" role="switch" id="sp-help"' + (c.needsHelp ? ' checked' : '') + ' aria-label="' + esc(T('We’d be grateful for help paying')) + '"></span></label>' +
      (admin() ? '<div class="btns"><button class="btn primary" data-act="support:savecard">' + T('Save the prayer card') + '</button></div>' : '') + '</section>';
    var preview = '<section class="sp-preview"><p class="sp-kicker">' + T('How other churches see it') + '</p><div id="sp-prev">' + prayerCard(ourCard(), { big: true }) + '</div>' +
      (S.isLive() && !st().demo ? '<p class="hint">' + T('Kept in your own church’s settings until Church & Trellis opens to other churches.') + '</p>' : '') + '</section>';
    return head('card') + '<div class="sp-card-grid">' + form + preview + '</div>';
  }

  /** Read the card form as it is now (for saving and the live preview). */
  function readForm() {
    var c = Object.assign({}, card()), g = function (id) { return document.getElementById(id); };
    if (g('sp-discreet')) c.discreet = g('sp-discreet').checked;
    if (g('sp-place')) c.place = g('sp-place').value.trim().slice(0, 60);
    if (g('sp-photook')) c.photoOk = g('sp-photook').checked;
    if (g('sp-help')) c.needsHelp = g('sp-help').checked;
    c.points = [0, 1].map(function (i) { var t = g('sp-pt' + i); return t ? t.value : ''; });
    return c;
  }
  var WARN = { email: 'an email address', phone: 'a phone number', link: 'a web link', handle: 'an @name', name: 'your church’s name or town' };
  function liveCheck() {
    var c = readForm(), names = c.discreet ? [st().churchName, c.place || card().place].filter(Boolean) : [];
    [0, 1].forEach(function (i) {
      var t = document.getElementById('sp-pt' + i), w = document.getElementById('sp-w' + i), n = document.getElementById('sp-c' + i); if (!t) return;
      var found = C.screen(t.value, names);
      if (n) n.textContent = t.value.length + ' / ' + C.POINT_MAX;
      if (w) w.textContent = found.length ? T('Take care: this has {what}', { what: found.map(function (k) { return T(WARN[k]); }).join(', ') }) : '';
      t.classList.toggle('sp-flag', !!found.length);
    });
    var pv = document.getElementById('sp-prev'), co = country();
    if (pv) pv.innerHTML = prayerCard(C.publicCard(c, { id: selfId(), name: st().churchName, country: co.code, countryName: co.name, continent: co.continent }), { big: true });
  }

  /** Turn the weekly prayer card on Home on or off (Administrators; churches that pray instead of paying can't turn it off). */
  function setCards(on) {
    if (!admin() || (!on && !C.mayHideCards(sup()))) { H.render(); return; }
    S.setSettings({ support: Object.assign({}, sup(), { cardsOff: !on }) }, on ? 'Weekly prayer card on Home: on' : 'Weekly prayer card on Home: off');
    H.render(); H.toast(T(on ? 'Everyone’s Home shows a church to pray for each week.' : 'The weekly prayer card is off. You can turn it on again here.'));
  }

  /* ---------- dialogs ---------- */
  function promiseDialog() {
    H.modal(H.dialogHead(T('Your church’s promise'), T('The prayer circle')) + '<div class="dlg-body sp-promise-dlg">' + '<div class="sp-promise-art" aria-hidden="true">' + circleArt() + '</div>' +
      '<p class="sp-vow">' + T('Each week, we will pray for the church Church & Trellis shows us – in a service, a prayer meeting or a Care Group – as part of the worldwide family of God.') + '</p>' +
      '<p class="hint">' + T('“Pray for each other.” – James 5:16') + '</p>' +
      '<label class="check"><input type="checkbox" id="sp-vow-ok"><span>' + T('We promise, on behalf of our church.') + '</span></label>' +
      '<div class="btns"><button class="btn primary" data-act="support:vow">' + T('Make our promise') + '</button><button class="btn" data-act="hub:close">' + T('Not now') + '</button></div></div>', T('Your church’s promise'));
  }
  /** The Pay button on the plan builder: what was chosen on the page. */
  function payChosen() {
    var s = choice(), q = quote();
    S.setSettings({ support: Object.assign({}, sup(), { cup: { kind: s.kind, price: C.parse(s.price), currency: s.currency }, choice: { plan: s.plan, cups: s.cups, other: s.other, forWho: s.forWho, otherId: s.otherId, at: H.today() } }) });
    payDialog({ kind: s.plan, total: q.total, currency: q.currency, gift: q.gift, forOther: s.forWho === 'other' ? (s.otherId || 'any') : '' });
  }
  /** The next payment, from the "Your subscription" card or Home: the plan's coffees plus any gift coffees tapped. */
  function payNext() {
    var sub = sup(), c = myCup(), n = C.nextAmount(sub, country().code), g = C.giftOf(extra, c.price, c.currency);
    payDialog({ kind: sub.plan, total: n.total + g, currency: n.currency, gift: g });
  }
  var prayInstead = false;   // the promise about to be made replaces paying
  var extra = 0;   // gift coffees tapped on the "Your subscription" card or Home
  var paying = null;   // the payment the open window is about
  /**
   * How to pay: Church & Trellis's bank details, the church's own reference, and "We've paid" (which records it).
   * o: { kind: 'month'|'year'|'gift', total, currency, gift, forOther }
   */
  function payDialog(o) {
    var ref = C.reference(selfId()), B = C.BANK; paying = o;
    var link = C.payLink({ ref: ref, total: o.total, currency: o.currency, forChurch: o.forOther });
    if (link) { window.open(link, '_blank', 'noopener'); return; }
    var row = function (label, value, copy) {
      return '<div class="sp-bank-row"><dt>' + esc(label) + '</dt><dd><b>' + esc(value) + '</b>' + (copy ? '<button class="btn small" data-act="support:copy" data-v="' + esc(value) + '">' + T('Copy') + '</button>' : '') + '</dd></div>';
    };
    var abroad = o.currency !== 'ZAR', tag = o.forOther ? (o.forOther === 'any' ? ' GIFT-ANY' : ' GIFT') : o.kind === 'gift' ? ' GIFT' : '';
    var total = C.money(o.total, o.currency) + (o.kind === 'year' ? ' ' + T('a year') : o.kind === 'month' ? ' ' + T('a month') : '');
    H.modal(H.dialogHead(T('Thank you!'), T('Pay by bank transfer')) + '<div class="dlg-body sp-thanks">' + '<div class="sp-thanks-art">' + cupArt(C.kind(myCup().kind).art, 84) + '</div>' +
      '<p class="sp-pay-amt">' + esc(T('Please pay {total} into Church & Trellis’s account:', { total: total })) + '</p>' +
      '<dl class="sp-bank">' + row(T('Bank'), B.bank) + row(T('Account number'), B.account, true) + row(T('Branch code'), B.branch, true) +
        row(T('Account type'), T(B.type)) + row(T('Beneficiary'), B.beneficiary) + row(T('Reference'), ref + tag, true) + '</dl>' +
      '<p class="hint">' + T('Always use this reference: it is how Church & Trellis knows the payment is from your church.') + (tag ? ' ' + T('“GIFT” tells us it is a gift or for another church.') : '') + '</p>' +
      (abroad ? '<p class="note info">' + esc(B.holder
        ? T('From outside South Africa: use SWIFT code {swift} and the account holder’s name {name}. Your bank changes your money into rand.', { swift: B.swift, name: B.holder })
        : T('From outside South Africa: your bank needs Capitec’s SWIFT code ({swift}) and the account holder’s full name. Write to Church & Trellis for these before you pay.', { swift: B.swift })) + '</p>' : '') +
      '<p class="hint">' + T('Church & Trellis never sees your card or your bank details. It can take a few days for a payment to show.') + '</p>' +
      '<div class="btns"><button class="btn primary" data-act="support:paid">' + T('We’ve paid') + '</button><button class="btn" data-act="hub:close">' + T('Pay later') + '</button></div></div>', T('Thank you!'));
  }
  /** One-tap gift coffees: [+1] [+2] [+5] … on the subscription card and Home. */
  function giftChips() {
    var c = myCup();
    return '<div class="sp-quick" role="group" aria-label="' + esc(T('Add a gift')) + '"><span>' + T('Add a gift:') + '</span>' + [1, 2, 5].map(function (n) {
      var on = extra === n;
      return '<button type="button" class="sp-qg' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="support:extra" data-n="' + n + '">' + '<span class="sp-gc-cup" aria-hidden="true"></span>+' + n + ' <small>' + esc(C.money(C.giftOf(n, c.price, c.currency), c.currency)) + '</small></button>';
    }).join('') + '</div>';
  }
  /** "Your subscription": the next payment, gift coffees, Pay, and a payment holiday. Shown once the church pays. */
  function statusLine(stt, sub) {
    var when = stt.due ? H.fmt(stt.due, true) : '';
    if (stt.state === 'holiday') return T('On a payment holiday – the next coffee is due on {date}.', { date: when });
    if (stt.state === 'soon') return stt.daysLeft === 1 ? T('Your next coffee is due tomorrow.') : T('Your next coffee is due in {n} days, on {date}.', { n: stt.daysLeft, date: when });
    if (stt.state === 'due') return stt.daysLeft === 0 ? T('Your coffee is due today.') : T('Your coffee was due on {date}.', { date: when });
    if (stt.state === 'late') return T('Your coffee was due on {date}. Church & Trellis keeps working – pay when you can, or take a payment holiday.', { date: when });
    return T('Paid until {date}. Thank you!', { date: when });
  }
  function statusPanel(compact) {
    var sub = sup(), stt = C.status(sub, H.today()); if (stt.state === 'none' || stt.state === 'pray') return '';
    var c = myCup(), n = C.nextAmount(sub, country().code), g = C.giftOf(extra, c.price, c.currency), hol = C.holidayAllowed(sub, H.today());
    var urgent = stt.state === 'soon' || stt.state === 'due' || stt.state === 'late';
    return '<section class="sp-status sp-st-' + stt.state + (compact ? ' compact' : '') + '"><div class="sp-status-top">' + cupArt(C.kind(c.kind).art, compact ? 52 : 64) +
      '<div class="grow"><p class="sp-kicker">' + esc(sub.plan === 'year' ? T('Ten coffees a year') : T('One coffee a month')) + '</p><h2>' + esc(statusLine(stt, sub)) + '</h2>' +
      '<p class="sp-status-amt">' + esc(T('Next payment: {amount}', { amount: C.money(n.total, n.currency) })) + (g ? ' + ' + esc(T('a gift of {amount}', { amount: C.money(g, n.currency) })) : '') + '</p></div></div>' +
      (admin() ? giftChips() + '<div class="btns">' + '<button class="btn primary" data-act="support:paynext">' + esc(T('Pay {amount}', { amount: C.money(n.total + g, n.currency) })) + '</button>' +
        (urgent || stt.state === 'holiday' ? '<button class="btn" data-act="support:holiday">' + T('Ask for a payment holiday') + '</button>' : '') +
        (compact ? '<a class="btn" href="#/support">' + T('Subscription') + '</a>' : H.menu(T('More'), [(urgent ? '' : '<button data-act="support:holiday">' + T('Ask for a payment holiday') + '</button>'),
          '<button data-act="support:gift">' + T('Give a one-off gift') + '</button>', '<button data-act="support:prayinstead">' + T('Pray instead') + '</button>'].filter(Boolean))) + '</div>' : '') +
      (!compact && hol.max ? '<p class="hint sp-hol-left">' + esc(T('Payment holidays left this year: {n} of {max}', { n: hol.left, max: hol.max })) + '</p>' : '') + '</section>';
  }
  function holidayDialog() {
    var sub = sup(), today = H.today(), ok = C.holidayAllowed(sub, today), stt = C.status(sub, today), yearly = sub.plan === 'year';
    var trial = C.takeHoliday(sub, today, ''), next = trial ? H.fmt(trial.paidUntil, true) : '';
    H.modal(H.dialogHead(T('A payment holiday'), yearly ? T('Ten coffees a year') : T('One coffee a month')) + '<div class="dlg-body sp-hol">' +
      '<div class="sp-hol-art" aria-hidden="true">' + cupArt(C.kind(myCup().kind).art, 72) + '<span class="sp-zz">z<span>z</span><span>z</span></span></div>' +
      (ok.ok ? '<p class="sp-vow">' + esc(yearly ? T('Pay your year a month later, free – no questions asked.') : T('Skip this month’s coffee, free – no questions asked.')) + '</p>' +
        '<p>' + esc(T('Your next payment moves to {date}. Church & Trellis keeps working exactly as before.', { date: next })) + '</p>' +
        '<p class="hint">' + esc(yearly ? T('A yearly plan may take one payment holiday a year.') : T('A monthly plan may take up to three payment holidays a year. You have {n} left.', { n: ok.left })) + '</p>' +
        '<label class="field"><span>' + T('Would you like to tell us why? It helps us pray for you.') + '</span><textarea id="sp-hol-why" rows="2" maxlength="300"></textarea></label>' +
        '<div class="btns"><button class="btn primary" data-act="support:takehol">' + T('Take a payment holiday') + '</button><button class="btn" data-act="hub:close">' + T('Not now') + '</button></div>'
      : '<p class="sp-vow">' + T('You’ve used this year’s payment holidays.') + '</p>' +
        '<p>' + T('If paying is hard for your church right now, you can pray instead: Church & Trellis stays free for as long as you need, while your church prays for another church each week.') + '</p>' +
        '<div class="btns"><button class="btn primary" data-act="support:prayinstead">' + T('Pray instead') + '</button><button class="btn" data-act="hub:close">' + T('Not now') + '</button></div>') +
      (stt.state === 'late' ? '<p class="hint">' + T('Nothing is ever locked or deleted for being late.') + '</p>' : '') + '</div>', T('A payment holiday'));
  }
  function giftDialog() {
    var c = myCup().price ? myCup() : { price: C.parse(choice().price), currency: cur() }, cu = c.currency;
    H.modal(H.dialogHead(T('Give a one-off gift'), T('Thank you for your generosity')) + '<div class="dlg-body sp-thanks">' +
      '<p>' + T('Every gift helps Church & Trellis grow and pays for churches that can’t. How many coffees would you like to give?') + '</p>' +
      '<div class="sp-giftgrid">' + [1, 2, 5, 10, 20].map(function (n) {
        return '<button class="sp-gg" data-act="support:giftn" data-n="' + n + '">' + '<span class="sp-gc-cup" aria-hidden="true"></span><b>' + esc(TN1(n)) + '</b><small>' + esc(C.money(C.giftOf(n, c.price, cu), cu)) + '</small></button>';
      }).join('') + '</div>' +
      '<label class="field sp-other"><span>' + T('Or any amount') + '</span><span class="sp-money"><span>' + esc(C.currency(cu).sym.trim()) + '</span><input id="sp-giftamt" inputmode="decimal" autocomplete="off"></span></label>' +
      '<div class="btns"><button class="btn primary" data-act="support:giftamt">' + T('Give this amount') + '</button><button class="btn" data-act="hub:close">' + T('Not now') + '</button></div></div>', T('Give a one-off gift'));
  }
  function TN1(n) { return n === 1 ? T('1 coffee') : T('{n} coffees', { n: n }); }

  H.register({
    id: 'support', name: 'Subscription', desc: 'A coffee a month keeps Church & Trellis going', tint: '#8A5428', roles: ['admin'], perm: 'support.manage',
    icon: 'M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6zM17 9h1.5a2.5 2.5 0 0 1 0 5H17M7 2v3M11 2v3',
    stat: function () { return pledged() ? T('In the prayer circle') : T('One coffee a month'); },
    render: function (parts) {
      var p = parts && parts[0];
      return p === 'pray' ? renderPray() : p === 'card' ? renderCard() : renderChoose();
    },
    after: function (parts) {
      var cp = document.getElementById('sp-cup');
      if (cp) cp.addEventListener('input', H.pause(function () {
        var v = String(cp.value || '').replace(/[^\d.,]/g, ''); choice().price = v;
        var pos = cp.selectionStart; H.render(); var n = document.getElementById('sp-cup'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      }, 450));
      var o = document.getElementById('sp-other');
      if (o) o.addEventListener('input', H.pause(function () {
        var v = String(o.value || '').replace(',', '.').replace(/[^\d.]/g, ''); choice().other = v; if (v !== '') choice().cups = 0;
        var pos = o.selectionStart; H.render(); var n = document.getElementById('sp-other'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
      }, 450));
      var on = document.getElementById('sp-cardson');
      if (on) on.addEventListener('change', function () { setCards(on.checked); });
      if (parts && parts[0] === 'card') {
        ['sp-place', 'sp-pt0', 'sp-pt1'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', liveCheck); });
        ['sp-photook', 'sp-help'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('change', liveCheck); });
        var d = document.getElementById('sp-discreet');
        if (d) d.addEventListener('change', function () {
          if (!admin()) { d.checked = !d.checked; return; }
          var co = country();
          if (!d.checked && C.takeCare(co.code) && !window.confirm(T('Christians in your country can face danger. Show your church’s name, town and photo to other churches anyway?'))) { d.checked = true; return; }
          var c = readForm(); S.setSettings({ prayerCard: Object.assign(c, { points: C.points(c.points), updated: H.today() }) }, d.checked ? 'Prayer card: kept hidden' : 'Prayer card: shown with the church’s name'); H.render();
        });
        document.querySelectorAll('.sp-photo-in').forEach(function (f) { f.addEventListener('change', function () {
          var file = f.files && f.files[0]; if (!file) return; f.value = '';
          H.cropPhoto(file).then(function (data) {
            if (!data) return;
            var c = readForm(); S.setSettings({ prayerCard: Object.assign(c, { photo: data, photoOk: false, points: C.points(c.points), updated: H.today() }) }, 'Prayer card: photo added'); H.render(); H.toast(T('Photo saved'));
          }).catch(function () { H.toast(T('That file isn’t a picture Church & Trellis can read. Try a JPG or PNG photo.')); });
        }); });
        liveCheck();
      }
    },
    /** Everyone's Home: the church we pray for this week (unless a paying church turned it off), and – for Administrators –
     * the subscription reminder and the monthly "look at your prayer card". */
    homeCard: function () {
      var due = '', stt = C.status(sup(), H.today());
      if (admin() && !S.preview() && (stt.state === 'soon' || stt.state === 'due' || stt.state === 'late')) due = statusPanel(true);
      due += cardNudge(true);
      if (!inCircle()) return due;
      var p = partner(); if (!p) return due;
      return due + '<section class="panel sp-home"><div class="sp-home-h">' + H.icon(PRAY, 18) + '<h2>' + T('This week we pray for') + '</h2></div>' + prayerCard(p) + '<div class="btns">' + prayedBtn() + '</div></section>';
    },
    actions: {
      kind: function (el) {
        var s = choice(), ex = C.example(country().code, el.dataset.k); s.kind = el.dataset.k;
        if (ex) s.price = String(ex);   // a price we know for this cup here; otherwise they keep (or type) their own
        H.render(); if (!ex) { var i = document.getElementById('sp-cup'); if (i) i.focus(); }
      },
      needprice: function () { var i = document.getElementById('sp-cup'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } H.toast(T('Type what one cup costs where you live.'), true); },
      plan: function (el) { choice().plan = el.dataset.p; H.render(); },
      cups: function (el) { choice().cups = +el.dataset.n; choice().other = ''; H.render(); },
      who: function (el) { choice().forWho = el.dataset.w; H.render(); },
      other: function (el) { choice().otherId = el.dataset.id || ''; H.render(); },
      pay: function () { if (admin()) payChosen(); },
      paynext: function () { if (admin()) payNext(); },
      extra: function (el) { var n = +el.dataset.n; extra = extra === n ? 0 : n; H.render(); },
      holiday: function () { if (admin()) holidayDialog(); },
      takehol: function () {
        if (!admin()) return;
        var why = document.getElementById('sp-hol-why'), next = C.takeHoliday(sup(), H.today(), why ? why.value : '');
        if (!next) return;
        S.setSettings({ support: next }, 'Took a payment holiday (until ' + next.paidUntil + ')');
        H.closeModal(); H.render(); H.toast(T('Enjoy your payment holiday. God bless your church.'));
      },
      prayinstead: function () { prayInstead = true; H.closeModal(); promiseDialog(); },
      gift: function () { if (admin()) giftDialog(); },
      giftn: function (el) { var c = myCup().price ? myCup() : { price: C.parse(choice().price), currency: cur() }, a = C.giftOf(+el.dataset.n, c.price, c.currency);
        if (!(a > 0)) { H.toast(T('Type what one cup costs where you live.'), true); return; }
        H.closeModal(); payDialog({ kind: 'gift', total: a, currency: c.currency, gift: a }); },
      giftamt: function () { var i = document.getElementById('sp-giftamt'), cu = cur(), a = C.parse(i && i.value);
        if (!(a > 0)) { H.toast(T('Type an amount first.'), true); return; }
        H.closeModal(); payDialog({ kind: 'gift', total: a, currency: cu, gift: a }); },
      paid: function () {
        if (!admin() || !paying) return;
        var o = paying, cur = sup(), before = cur.paidUntil;
        var base = Object.assign({}, cur, o.kind === 'month' || o.kind === 'year' ? { cup: cur.cup && cur.cup.currency === o.currency ? cur.cup : { kind: choice().kind, price: C.parse(choice().price), currency: o.currency } } : {});
        var next = C.recordPayment(base, H.today(), { kind: o.kind === 'pray' ? 'gift' : o.kind, amount: o.total, currency: o.currency, gift: o.gift, forOther: o.forOther });
        if (next.plan === 'month' || next.plan === 'year') next.pledge = next.pledge || null;
        S.setSettings({ support: next }, 'Recorded a payment to Church & Trellis (' + C.money(o.total, o.currency) + ', ' + (o.forOther ? 'for another church' : o.kind) + ')');
        paying = null; extra = 0; H.closeModal(); H.render();
        H.toast(next.paidUntil !== before && next.paidUntil ? T('Thank you! Paid until {date}.', { date: H.fmt(next.paidUntil, true) }) : T('Thank you for your gift!'));
      },
      promise: function () { if (admin()) promiseDialog(); },
      vow: function () {
        var ok = document.getElementById('sp-vow-ok');
        if (!ok || !ok.checked) { H.toast(T('Tick the promise first.'), true); return; }
        var me = H.user();
        // Praying *instead* of paying (chosen on the plan page, or after the payment holidays ran out) makes prayer the plan;
        // a paying church joining the circle as well keeps paying.
        var instead = prayInstead || choice().plan === 'pray'; prayInstead = false;
        S.setSettings({ support: Object.assign({}, sup(), { pledge: { at: H.today(), by: H.name(S.get('people', me.id) || me) }, prayOn: true, cardsOff: false }, instead ? { plan: 'pray' } : {}) }, instead ? 'Chose to pray instead of paying (prayer circle)' : 'Joined the prayer circle');
        H.closeModal(); if (/^#\/support\/pray/.test(location.hash)) H.render(); else H.go('support/pray'); H.toast(T('Thank you – your church is in the prayer circle.'));
      },
      leave: function (el) {
        if (!admin() || !H.confirmBtn(el, T('Click again: leave the prayer circle'))) return;
        S.setSettings({ support: Object.assign({}, sup(), { pledge: null, prayOn: false }, sup().plan === 'pray' ? { plan: '' } : {}) }, 'Left the prayer circle'); H.render();
      },
      copy: function (el) {
        var v = el.dataset.v || '', done = function () { H.toast(T('Copied')); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { H.toast(v); }); else H.toast(v);
      },
      cardson: function () { if (admin()) setCards(true); },
      prayed: function () { S.pref('prayedFor', week()); H.render(); },
      keepcard: function () {
        if (!admin()) return;
        S.setSettings({ prayerCard: Object.assign({}, card(), { updated: H.today() }) }, 'Checked the church’s prayer card: kept as it is');
        H.render(); H.toast(T('Thank you – your prayer card is up to date.'));
      },
      nophoto: function () { if (!admin()) return; var c = readForm(); S.setSettings({ prayerCard: Object.assign(c, { photo: '', photoOk: false, points: C.points(c.points) }) }, 'Prayer card: photo removed'); H.render(); },
      savecard: function () {
        if (!admin()) return;
        var c = readForm();
        if (c.photo && !c.photoOk) H.toast(T('Saved. The photo isn’t shown until you tick that everyone in it agreed.'));
        else H.toast(T('Saved'));
        S.setSettings({ prayerCard: Object.assign(c, { points: C.points(c.points), updated: H.today() }) }, 'Changed the church’s prayer card');
        H.render();
      }
    }
  });
})();
