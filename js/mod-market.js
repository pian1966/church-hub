/* Church & Trellis – Marketplace: buy, sell and give away within the church; every listing checked by a keeper first.
 * Church Partners only (decided 19 Nov 2026). PLACEHOLDER – not built yet. The plan is docs/COMMUNITY-PLAN.md part 3
 * (steps 3.1–3.3); read the matching section of docs/POPIA.md before building it.
 * Ready for it:
 *   - who may do what: js/access.js PARTS 'market' – Hub.can('market.view'), Hub.can('market.post'), Hub.can('market.keep')
 *     (keepers: Access.jobHolders('keepers', 'market', settings, people); chosen in settings.keepers.market)
 *   - the database: firestore.rules "Marketplace" (market/{id}) – closed until built
 *   - words: js/i18n/market.js (and js/lang/st.js)
 *   - Settings → Apps lists it by itself once `soon` is taken off its PARTS entry (off until switched on: optIn)
 * Until then nobody sees it (Hub: a part marked `soon` never opens). */
(function () {
  'use strict';
  var H = Hub, T = I18n.t;
  H.register({
    id: 'market', name: 'Marketplace', desc: 'Buy, sell and give away within the church – a keeper checks each listing first', tint: '#2E7D6B', optIn: true, roles: [], perm: 'market.view',   // roles: [] – only who js/access.js allows (never attendees)
    icon: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
    render: function () { return '<div class="page-head"><h1>' + T('Marketplace') + '</h1></div><p class="empty">' + T('Coming soon') + '</p>'; }
  });
})();
