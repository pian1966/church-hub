/* Church & Trellis – Community board: a corkboard of notices and offers of help, each checked by a keeper first.
 * PLACEHOLDER – not built yet. The plan is docs/COMMUNITY-PLAN.md part 2 (steps 2.1–2.3); read the matching section of
 * docs/POPIA.md before building it.
 * Ready for it:
 *   - who may do what: js/access.js PARTS 'board' – Hub.can('board.view'), Hub.can('board.post'), Hub.can('board.keep')
 *     (keepers: Access.jobHolders('keepers', 'board', settings, people); chosen in settings.keepers.board)
 *   - the database: firestore.rules "Community board" (board/{id}) – closed until built
 *   - words: js/i18n/board.js (and js/lang/st.js)
 *   - Settings → Apps lists it by itself once `soon` is taken off its PARTS entry (off until switched on: optIn)
 * Until then nobody sees it (Hub: a part marked `soon` never opens). */
(function () {
  'use strict';
  var H = Hub, T = I18n.t;
  H.register({
    id: 'board', name: 'Community board', desc: 'Pin notices and offers of help – a keeper checks each one first', tint: '#B07A2A', optIn: true, roles: [], perm: 'board.view',   // roles: [] – only who js/access.js allows
    icon: 'M3 4h18v14H3zM7 8h4v4H7zM13 8h4v3h-4zM9 18v3M15 18v3',
    render: function () { return '<div class="page-head"><h1>' + T('Community board') + '</h1></div><p class="empty">' + T('Coming soon') + '</p>'; }
  });
})();
