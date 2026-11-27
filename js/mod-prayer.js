/* Church & Trellis – Pray for the nations: Operation World's daily prayer for the nations, shown on a page of its own.
 * For everyone, once an Administrator switches it on (Settings → Apps; js/access.js PARTS 'prayer').
 * The prayer itself is Operation World's own web widget (https://operationworld.org/get-involved/web-widget/): we never copy or
 * keep their words, we only show their page. The widget loads from Operation World's website, so that website would see the
 * person's internet address and browser – nothing from Church & Trellis, but a third party all the same. So it loads only when
 * the person taps Show today's prayer (remembered on their own device, with Stop showing to undo it), and never while offline.
 * The widget picks its own language (English, German, Indonesian, Korean, Norwegian) and light or dark by itself.
 * Route: #/prayer. POPIA: docs/POPIA.md "Pray for the nations". Permission to embed: asked of Operation World (docs/ROADMAP.md). */
(function () {
  'use strict';
  var H = Hub, S = Store, T = I18n.t, esc = H.esc;
  var GLOBE = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20';
  var SCRIPT = 'https://widget.operationworld.org/js/widget.js';
  var WEB = 'https://operationworld.org/';

  function shown() { return S.pref('prayerShow') === 'on'; }

  /** (Re)start Operation World's script after the page is drawn: it fills the box with the class ow-web-widget when it loads,
   *  so an old copy is taken away first and a fresh one added each time the page is opened. */
  function load() {
    if (!shown() || S.offline() || !document.querySelector('.ow-web-widget')) return;
    var old = document.getElementById('ow-script'); if (old && old.parentNode) old.parentNode.removeChild(old);
    var s = document.createElement('script');
    s.id = 'ow-script'; s.src = SCRIPT; s.async = true;
    document.body.appendChild(s);
  }

  function render() {
    var head = '<div class="page-head"><div><h1>' + T('Pray for the nations') + '</h1><p class="lead">' +
      T('Pray each day for a different country, with Operation World.') + '</p></div></div>';
    if (S.offline()) {
      return head + '<section class="panel pray-panel"><p class="note">' + T('This needs the internet. Come back when you are online and the day’s prayer will be here.') + '</p></section>';
    }
    var body;
    if (shown()) {
      body = '<div class="ow-web-widget" style="height: 800px;"></div>' +
        '<p class="hint pray-credit">' + T('Prayer content from {name}.', { name: '<a href="' + WEB + '" target="_blank" rel="noopener">Operation World</a>' }) + ' ' +
        '<button class="btn small ghost" data-act="prayer:hide">' + T('Stop showing') + '</button></p>';
    } else {
      body = '<div class="pray-ask"><div class="pray-globe" aria-hidden="true">' + H.icon(GLOBE, 44) + '</div>' +
        '<h2>' + T('Today’s prayer for the nations') + '</h2>' +
        '<p>' + T('Operation World gives a country to pray for every day, with what to thank God for and what to ask Him for.') + '</p>' +
        '<button class="btn primary" data-act="prayer:show">' + T('Show today’s prayer') + '</button>' +
        '<p class="hint">' + T('It is shown by Operation World’s own website, so they will see that your device opened it. Church & Trellis sends them nothing about you.') + '</p></div>';
    }
    return head + '<section class="panel pray-panel">' + body + '</section>';
  }

  H.register({
    id: 'prayer', name: 'Pray for the nations', desc: 'A country to pray for each day, from Operation World', tint: '#2F6FB0', optIn: true, roles: [], perm: 'prayer.view',   // roles: [] – only who js/access.js allows
    icon: GLOBE,
    stat: function () { return T('A country to pray for each day, from Operation World'); },
    render: render,
    after: load,
    actions: {
      show: function () { S.pref('prayerShow', 'on'); H.render(); },
      hide: function () { S.pref('prayerShow', 'off'); H.render(); }
    }
  });
})();
