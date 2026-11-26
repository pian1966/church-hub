// Church & Trellis – conference presentation. Builds church-and-trellis-presentation.pptx (16:9) from the screenshots and clips in img/.
// Run: node build.js   (needs pptxgenjs, react-icons, react, react-dom, sharp). See README.md; img/ comes from capture.py.
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const Lu = require('react-icons/lu');
const SKILL = process.env.PPTX_SKILL || '';
const IMG = p => path.join(__dirname, 'img', p);

const THEME = {
  name: 'Church & Trellis',
  headFontFace: 'Inter', bodyFontFace: 'Inter',
  colors: { dk1: '1D1B19', lt1: 'FFFFFF', dk2: '231E1A', lt2: 'F6F4F1', accent1: 'E8590C', accent2: 'B8430A', accent3: '1F6B3A', accent4: '4A8AD4', accent5: 'F59E0B', accent6: '6D5BD0', hlink: 'B8430A', folHlink: '9A3F06' }
};
/** The name as rich text: Church & Trellis with its "&" in the brand orange. */
const NAME = () => [{ text: 'Church ' }, { text: '&', options: { color: 'E8590C' } }, { text: ' Trellis' }];
const HEX = { ink: '1D1B19', dark: '231E1A', warm: 'F6F4F1', orange: 'E8590C', orangeDk: 'B8430A', soft: 'FFE8D9', muted: '645B53', line: 'E7E1DA', white: 'FFFFFF', night2: '3A322C', nightInk: 'E9E2DB', nightMuted: 'B7ADA4', green: '1F6B3A' };

async function icon(Comp, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: px, strokeWidth: 1.75 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';   // 13.333 x 7.5 in
  pres.title = 'Church & Trellis – every church, however small, deserves great church software';
  pres.author = 'Church & Trellis';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333, H = 7.5;

  // ---------- layouts ----------
  pres.defineSlideMaster({
    title: 'Dark', background: { color: HEX.dark },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.3, w: 7.2, h: 1.4, fontSize: 54, bold: true, color: C.background1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 3.85, w: 7.0, h: 1.4, fontSize: 24, color: C.background2, valign: 'top', align: 'left', margin: 0 }, text: '' } }
    ]
  });
  pres.defineSlideMaster({
    title: 'Content', background: { color: HEX.white },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 36, bold: true, color: C.text1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: 'Church & Trellis', options: { x: 0.6, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } }
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.muted, align: 'right' }
  });
  pres.defineSlideMaster({
    title: 'Warm', background: { color: HEX.warm },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 36, bold: true, color: C.text1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { text: { text: 'Church & Trellis', options: { x: 0.6, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: HEX.muted, margin: 0 } } }
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.muted, align: 'right' }
  });

  // ---------- helpers ----------
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 16, color: HEX.ink, valign: 'top' }, o));
  // A screenshot on a white card with a soft shadow
  function shot(s, file, x, y, w, h, name) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.08, y: y - 0.08, w: w + 0.16, h: h + 0.16, rectRadius: 0.12, fill: { color: HEX.white }, line: { color: HEX.line, width: 0.75 },
      shadow: { type: 'outer', color: '000000', opacity: 0.16, blur: 14, offset: 4, angle: 90 }, objectName: (name || file) + ' card' });
    s.addImage({ path: IMG(file), x, y, w, h, objectName: name || file, altText: name || file });
  }
  // A phone: the screen in a dark rounded frame (390 x 844 screens)
  function phone(s, file, x, y, h, name) {
    const w = h * 390 / 844;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.1, y: y - 0.1, w: w + 0.2, h: h + 0.2, rectRadius: 0.28, fill: { color: HEX.dark }, line: { color: HEX.dark },
      shadow: { type: 'outer', color: '000000', opacity: 0.22, blur: 16, offset: 5, angle: 90 }, objectName: (name || file) + ' frame' });
    s.addImage({ path: IMG(file), x, y, w, h, objectName: name || file, altText: name || file });
    return w;
  }
  // An icon in a soft orange circle
  async function badge(s, Comp, x, y, d, bg, fg) {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg || HEX.soft }, line: { color: bg || HEX.soft } });
    s.addImage({ data: await icon(Comp, fg || HEX.orangeDk), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
  }
  // The Church & Trellis mark: an orange rounded square with a thin white cross
  function mark(s, x, y, d) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: d, h: d, rectRadius: d * 0.22, fill: { color: HEX.orange }, line: { color: HEX.orange }, objectName: 'Church & Trellis mark' });
    // the app's mark (M12 3v18 M6 9h12, stroke 2, on a 24 grid drawn half the tile wide)
    const g = d / 2, gx = x + d / 4, gy = y + d / 4, u = g / 24, lw = 2 * u * 72;
    s.addShape(pres.shapes.LINE, { x: gx + 12 * u, y: gy + 3 * u, w: 0, h: 18 * u, line: { color: HEX.white, width: lw, cap: 'round' }, objectName: 'cross upright' });
    s.addShape(pres.shapes.LINE, { x: gx + 6 * u, y: gy + 9 * u, w: 12 * u, h: 0, line: { color: HEX.white, width: lw, cap: 'round' }, objectName: 'cross beam' });
  }
  const content = (sec, title, warm) => { const s = pres.addSlide({ masterName: warm ? 'Warm' : 'Content', sectionTitle: sec }); s.addText(title, { placeholder: 'title' }); return s; };

  // ========== 1. Title ==========
  pres.addSection({ title: 'Opening' });
  let s = pres.addSlide({ masterName: 'Dark', sectionTitle: 'Opening' });
  mark(s, 0.8, 1.1, 0.95);
  s.addText(NAME(), { placeholder: 'title' });
  s.addText('Every church, however small, deserves great church software.', { placeholder: 'body' });
  T(s, 'Made for every church, in every nation, in (nearly) every language', { x: 0.8, y: 5.9, w: 7, h: 0.5, fontSize: 14, color: HEX.nightMuted });
  phone(s, 'm-home.jpg', 9.35, 0.75, 6.0, 'Church & Trellis Home on a phone');
  s.addNotes('Welcome. Church & Trellis is church management software built by a church, for every church – however small, wherever it is, whatever it can afford. In the next few minutes: what a church management system is, why your church needs one, why we built our own, and what it can do for you.');

  // ========== 2. What is a church management system? ==========
  pres.addSection({ title: 'What and why' });
  s = content('What and why', 'What is a church management system?');
  T(s, 'The software a church uses to keep its people and its work in one safe place – instead of in spreadsheets, notebooks, WhatsApp groups and one person’s memory.', { x: 0.6, y: 1.5, w: 5.2, h: 1.6, fontSize: 20, color: HEX.ink });
  T(s, [
    { text: 'Who belongs to the church, and how to reach them', options: { bullet: true, breakLine: true } },
    { text: 'Who serves where, and when', options: { bullet: true, breakLine: true } },
    { text: 'Groups, care and communication', options: { bullet: true, breakLine: true } },
    { text: 'Essential Church Records: Securely Stored and Legally Compliant', options: { bullet: true } }
  ], { x: 0.6, y: 3.35, w: 5.2, h: 2.4, fontSize: 16, color: HEX.muted, paraSpaceAfter: 10 });
  // hub diagram: the church in the middle, the work around it
  {
    const cx = 9.35, cy = 4.05, r = 2.15, d = 1.25;
    const spokes = [[Lu.LuUsers, 'People'], [Lu.LuCalendarCheck, 'Rosters'], [Lu.LuMessageCircle, 'Messages'], [Lu.LuUsersRound, 'Groups'], [Lu.LuShieldCheck, 'Privacy'], [Lu.LuLibrary, 'Records']];
    s.addShape(pres.shapes.OVAL, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { type: 'none' }, line: { color: HEX.line, width: 1.5, dashType: 'dash' }, objectName: 'ring' });
    s.addShape(pres.shapes.OVAL, { x: cx - 0.95, y: cy - 0.95, w: 1.9, h: 1.9, fill: { color: HEX.orange }, line: { color: HEX.orange }, objectName: 'Your church' });
    s.addImage({ data: await icon(Lu.LuChurch, HEX.white), x: cx - 0.32, y: cy - 0.62, w: 0.64, h: 0.64 });
    T(s, 'Your church', { x: cx - 0.95, y: cy + 0.08, w: 1.9, h: 0.4, fontSize: 15, bold: true, color: HEX.white, align: 'center' });
    for (let i = 0; i < spokes.length; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / spokes.length, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      s.addShape(pres.shapes.OVAL, { x: x - d / 2, y: y - d / 2, w: d, h: d, fill: { color: HEX.white }, line: { color: HEX.line, width: 1 }, shadow: { type: 'outer', color: '000000', opacity: 0.1, blur: 8, offset: 2, angle: 90 } });
      s.addImage({ data: await icon(spokes[i][0], HEX.orangeDk), x: x - 0.22, y: y - 0.42, w: 0.44, h: 0.44 });
      T(s, spokes[i][1], { x: x - 0.7, y: y + 0.08, w: 1.4, h: 0.32, fontSize: 13, bold: true, color: HEX.ink, align: 'center' });
    }
  }
  s.addNotes('A church management system – a ChMS – is simply the software a church uses to keep its people and its work in one place. Who belongs, how to reach them, who is serving on Sunday, which groups people are in, the messages the church sends, and the records it has to keep. Most churches do this today with spreadsheets, notebooks, WhatsApp groups and the memory of one faithful volunteer.');

  // ========== 3. Why you need one ==========
  s = content('What and why', 'Why your church needs one', true);
  {
    const cards = [
      [Lu.LuDatabase, 'Records everywhere', 'One place everyone trusts', 'Lists in spreadsheets, notebooks and phones go out of date – and leave with the person who kept them.'],
      [Lu.LuPhone, 'Rosters by phone call', 'Volunteers reply in the app', 'Hours of calls and messages every month, and still a gap on Sunday morning.'],
      [Lu.LuShieldCheck, 'Privacy law', 'Consent and access built in', 'POPIA, GDPR and others: churches must protect personal information and show who has seen it.'],
      [Lu.LuHeartHandshake, 'People slip through', 'No one is forgotten', 'Newcomers, the sick, the bereaved: care works best when the right people know.']
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 6.15, y = 1.55 + Math.floor(i / 2) * 2.7, w = 5.95, h = 2.45;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: HEX.white }, line: { color: HEX.line, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 10, offset: 2, angle: 90 } });
      await badge(s, cards[i][0], x + 0.35, y + 0.35, 0.75);
      T(s, cards[i][1], { x: x + 1.3, y: y + 0.32, w: w - 1.6, h: 0.4, fontSize: 15, color: HEX.muted });
      T(s, cards[i][2], { x: x + 1.3, y: y + 0.7, w: w - 1.6, h: 0.5, fontSize: 21, bold: true, color: HEX.ink });
      T(s, cards[i][3], { x: x + 0.35, y: y + 1.35, w: w - 0.7, h: 0.95, fontSize: 15, color: HEX.muted });
    }
  }
  s.addNotes('Why you need one. Records spread over spreadsheets and phones go out of date, and leave with the person who kept them. Rosters cost hours of phone calls. Privacy law – POPIA here, GDPR in Europe – requires churches to protect personal information and know who has looked at it. And without one shared place, people slip through the cracks. A good church management system fixes all four.');

  // ========== 4. Why I built Church & Trellis ==========
  pres.addSection({ title: 'Our story' });
  s = content('Our story', 'Why we built Church & Trellis');
  {
    const rows = [
      [Lu.LuCircleDollarSign, 'First-world prices, third-world church', 'Every month we paid for church software in dollars and pounds, out of rands.'],
      [Lu.LuLock, 'Small churches got less', 'Paid tiers, charges per member, features locked away from the churches that need them most.'],
      [Lu.LuChurch, 'So we built our own', 'At Christ Church Howick, run by the church office – and now offered to every church.']
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.6 + i * 1.65;
      await badge(s, rows[i][0], 0.6, y, 0.9);
      T(s, rows[i][1], { x: 1.75, y: y, w: 5.6, h: 0.5, fontSize: 21, bold: true });
      T(s, rows[i][2], { x: 1.75, y: y + 0.52, w: 5.6, h: 0.9, fontSize: 16, color: HEX.muted });
    }
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.85, y: 1.6, w: 4.85, h: 4.6, rectRadius: 0.2, fill: { color: HEX.dark }, line: { color: HEX.dark } });
    T(s, '“', { x: 8.25, y: 1.75, w: 1, h: 1, fontSize: 80, bold: true, color: HEX.orange });
    T(s, 'Why should a poor church pay more – or get less?', { x: 8.25, y: 2.75, w: 4.1, h: 2.0, fontSize: 30, bold: true, color: HEX.white });
    T(s, 'Church & Trellis competes with the best church software in the world – at a price every church can afford.', { x: 8.25, y: 4.75, w: 4.1, h: 1.2, fontSize: 15, color: HEX.nightInk });
  }
  s.addNotes('Why did we build it? We were tired of paying for church software in first-world currency as a third-world church. Small churches pay more per person and get less – tiers, per-member charges, features locked away. So at Christ Church Howick we built Church & Trellis to replace what we used, run by our church office. And we decided no church should pay more or get less because it is poor.');

  // ========== 5. Who it's for ==========
  s = content('Our story', 'Who it’s for: every church', true);
  {
    const stats = [['Any size', 'From forty people in a village hall to suburban and city churches with multiple services and teams of volunteers'], ['20+', 'languages – and each person chooses their own'], ['Offline', 'still opens with no signal, and updates use very little data']];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 3.85, h: 3.0, rectRadius: 0.16, fill: { color: HEX.white }, line: { color: HEX.line, width: 0.75 } });
      T(s, stats[i][0], { x: x + 0.35, y: 1.9, w: 3.2, h: 1.1, fontSize: 54, bold: true, color: HEX.orange });
      T(s, stats[i][1], { x: x + 0.35, y: 3.1, w: 3.2, h: 1.3, fontSize: 17, color: HEX.ink });
    }
    T(s, [
      { text: 'Anglican, Catholic, Methodist, Presbyterian, Baptist, Pentecostal, Lutheran', options: { bold: true, breakLine: true } },
      { text: 'Church & Trellis speaks your tradition: Rector or Senior Pastor, Parishioner or Member, Home group or Cell group – and you can rename any word.', options: { breakLine: true } },
      { text: 'Using it also helps put great software into the hands of pastors and missionaries in churches with few resources, and links churches across the world in prayer.', options: { italic: true, color: HEX.orangeDk } }
    ], { x: 0.6, y: 4.85, w: 12.1, h: 1.95, fontSize: 17, color: HEX.ink, paraSpaceAfter: 6 });
  }
  s.addNotes('Who is it for? Every church. The same Church & Trellis runs a congregation of forty in a rural village and suburban and city churches with several services and teams of volunteers. More than twenty languages, and each person picks their own. It works with a weak signal, and it uses very little data. And it speaks your tradition’s words. And there is a bigger reason to choose it: every church that uses Church & Trellis helps provide excellent software to churches that could never afford anything like it on their own – a practical tool for a pastor or missionary working with few resources, to do the work more effectively. And it is more than a church management system: it links churches around the world, so yours is prayed for and you pray for others.');

  // ========== 6. Everything in one place ==========
  pres.addSection({ title: 'What it does' });
  s = content('What it does', 'Everything your church runs on, in one place');
  shot(s, 'd-home.jpg', 4.55, 1.5, 8.15, 8.15 * 900 / 1440, 'Home for an Administrator');
  s.addImage({ data: await icon(Lu.LuHouse, HEX.orange), x: 0.6, y: 1.62, w: 0.36, h: 0.36 });
  T(s, 'Home', { x: 1.08, y: 1.55, w: 3.1, h: 0.5, fontSize: 24, bold: true, valign: 'middle' });
  T(s, [
    { text: 'Shows each person what needs them today', options: { bullet: true, breakLine: true } },
    { text: 'A to-do list for each role', options: { bullet: true, breakLine: true } },
    { text: 'What’s new, and tips for the parts they can use', options: { bullet: true, breakLine: true } },
    { text: 'On any computer, tablet or phone – nothing to install', options: { bullet: true } }
  ], { x: 0.6, y: 2.3, w: 3.6, h: 3.4, fontSize: 18, color: HEX.muted, paraSpaceAfter: 12 });
  s.addNotes('This is Home for an Administrator. Everyone sees what needs them today: the office sees consent to record and leave to approve, a roster coordinator sees gaps on Sunday, a member sees their serving requests. It runs in any web browser, and there is an Android app.');

  // ========== 7. Built in parts ==========
  s = content('What it does', 'Built in parts – use only what you need', true);
  shot(s, 'd-apps-c.jpg', 0.68, 1.58, 6.2, 6.2 * 1800 / 2416, 'Settings, Apps: switching parts on and off');
  T(s, 'Start with People and Rosters. Switch on the rest when your church is ready – one switch each in Settings.', { x: 7.4, y: 1.6, w: 5.3, h: 1.5, fontSize: 20, bold: true });
  {
    const parts = ['People', 'Rosters', 'Groups', 'Messages', 'Staff leave', 'Library', 'Archives', 'Leadership', 'Events', 'Community board', 'Marketplace', 'Privacy', 'Ask in your own words'];
    let x = 7.4, y = 3.35;
    for (const p of parts) {
      const w = 0.35 + p.length * 0.105;
      if (x + w > 12.75) { x = 7.4; y += 0.62; }
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.46, rectRadius: 0.23, fill: { color: HEX.soft }, line: { color: HEX.soft } });
      T(s, p, { x, y, w, h: 0.46, fontSize: 14, bold: true, color: HEX.orangeDk, align: 'center', valign: 'middle' });
      x += w + 0.14;
    }
    T(s, 'What you don’t use stays out of the way – a small church sees a small, simple app.', { x: 7.4, y: y + 0.85, w: 5.3, h: 0.9, fontSize: 16, color: HEX.muted });
  }
  s.addNotes('Church & Trellis is built in parts. A small church might use only People and Rosters. Switch on Groups, Messages, staff Leave, the Library or Archives when you are ready – one switch each in Settings. New: Events – people tap I’ll be there and are reminded 3 days and 1 day before, in Messages and by email if they like. And a Community board, like a corkboard of sticky notes where people ask for or offer help, and a Marketplace to buy, sell and give away within the church – a keeper checks everything before anyone sees it. What you don’t use disappears from the menus.');

  // ========== 8. The essential modules ==========
  s = content('What it does', 'The essential parts');
  {
    const mods = [
      [Lu.LuUsers, 'People', 'Households, consent, name badges, membership applications'],
      [Lu.LuCalendarCheck, 'Rosters', 'Fills the gaps fairly, keeps families together'],
      [Lu.LuMessageCircle, 'Messages', 'Chat-style news and replies, with read ticks'],
      [Lu.LuUsersRound, 'Groups', 'Care Groups, Midweek Groups and leadership'],
      [Lu.LuPlane, 'Staff leave', 'Allowances, approvals, public holidays'],
      [Lu.LuLibrary, 'Library & Archives', 'Loans; church records filed by year and month'],
      [Lu.LuSmartphone, 'Me', 'Members update their own details and days away'],
      [Lu.LuShieldCheck, 'Privacy', 'Access by role, consent, privacy law tools']
    ];
    for (let i = 0; i < mods.length; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = 0.6 + col * 3.07, y = 1.6 + row * 2.6, w = 2.85, h = 2.35;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.14, fill: { color: HEX.warm }, line: { color: HEX.warm } });
      await badge(s, mods[i][0], x + 0.3, y + 0.3, 0.75, HEX.white);
      T(s, mods[i][1], { x: x + 0.3, y: y + 1.2, w: w - 0.5, h: 0.4, fontSize: 18, bold: true });
      T(s, mods[i][2], { x: x + 0.3, y: y + 1.6, w: w - 0.5, h: 0.7, fontSize: 14, color: HEX.muted });
    }
  }
  s.addNotes('These are the essential parts. People with households and consent. Rosters. Messages inside the app. Groups. Staff leave. A library, and protected archives for minutes and contracts – meeting papers file themselves into the right year and month, and Church & Trellis asks before saving anything under a date that looks wrong. Me – where members look after their own details. And privacy, built into everything. Church & Trellis also works with no signal – you can still look things up, and changes wait until you are back online – and it is written with the cost of data in mind: updates download only what changed, and photos on the Marketplace are made small.');

  // ========== 9. People ==========
  s = content('What it does', 'Know and care for your people', true);
  shot(s, 'd-people-c.jpg', 5.2, 1.55, 7.5, 7.5 * 1500 / 2416, 'The People list');
  T(s, [
    { text: 'Households kept together', options: { bold: true, breakLine: true } },
    { text: 'Couples, children and guardians in one place', options: { color: HEX.muted, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: 'Consent for each person', options: { bold: true, breakLine: true } },
    { text: 'Recorded, with a clear history', options: { color: HEX.muted, breakLine: true } },
    { text: ' ', options: { fontSize: 8, breakLine: true } },
    { text: 'Duplicates spotted as you type', options: { bold: true, breakLine: true } },
    { text: 'And name badges printed on your own labels', options: { color: HEX.muted } }
  ], { x: 0.6, y: 1.6, w: 4.2, h: 4.6, fontSize: 18 });
  s.addNotes('People: households kept together – a couple shares one home address, so when one changes it the other is offered the same, and any couple whose addresses differ is listed with just the differing part in bold – consent recorded for each person, duplicates spotted as you type, and name badges printed on your own labels. Administrators also get Church health tests on Home – a short list of what is worth a look, such as people who cannot be reached or groups without a leader. Made a mistake? Tap Undo straight after it – and Version history on a person’s page puts back an earlier version, much like Google Docs. Looking for someone? Tap the microphone and say their name – names that sound like it come up too. And a paper sign-up sheet or a pile of visitor cards? Take a photo: Church & Trellis reads the names, finds them, and you check each one before anyone is added. Pastoral notes stay with the pastors, children’s medical notes with the children’s ministry. To get everyone started, invite people by email or WhatsApp – one person, or a whole Care Group or serving team – and see who hasn’t begun yet. And a small celebration: on someone’s birthday or wedding anniversary a little cake or ring symbol shows beside their name, the day only – never the year or age – and only for people who agreed, and each person can switch it off. Administrators and Pastors also have a Usage page: how many people are on the app, who is on right now, which Church Partners have not started yet, and which parts are used most – counts only, with names shown just to those who care for the church.');

  // ========== 10. Ask in your own words (clip) ==========
  s = content('What it does', 'Ask in your own words');
  shot(s, 'ask.gif', 0.6, 1.5, 8.6, 8.6 * 619 / 1100, 'Asking a question in everyday words');
  T(s, 'Type – or say – what you’re looking for.', { x: 9.6, y: 1.6, w: 3.1, h: 1.4, fontSize: 22, bold: true });
  T(s, 'Church & Trellis turns it into a search, shows what it understood, and finds the people.', { x: 9.6, y: 3.1, w: 3.1, h: 1.6, fontSize: 16, color: HEX.muted });
  T(s, '“Church Partners who serve on the welcome team”', { x: 9.6, y: 4.85, w: 3.1, h: 1.2, fontSize: 16, italic: true, color: HEX.orangeDk });
  s.addNotes('[Clip plays] No more building filters. Type or speak a question in everyday words – here, Church Partners who serve on the welcome team – and Church & Trellis turns it into a search and finds them. You only ever search what your role is allowed to see.');

  // ========== 11. Rosters (clip) ==========
  s = content('What it does', 'Rosters that fill the gaps for you', true);
  shot(s, 'fill.gif', 4.1, 1.5, 8.6, 8.6 * 619 / 1100, 'Fill the gaps for me');
  T(s, [
    { text: 'One tap fills the gaps – fairly', options: { bullet: true, breakLine: true } },
    { text: 'Families and friends serve together', options: { bullet: true, breakLine: true } },
    { text: 'Ask who’s away before each term – days away and leave are skipped', options: { bullet: true, breakLine: true } },
    { text: 'Communion roles only on communion Sundays', options: { bullet: true, breakLine: true } },
    { text: 'Change a name in one tap – they’re told', options: { bullet: true, breakLine: true } },
    { text: 'Print or download it – cancelled services stay marked', options: { bullet: true } }
  ], { x: 0.6, y: 1.6, w: 3.2, h: 4.8, fontSize: 16, paraSpaceAfter: 10 });
  s.addNotes('[Clip plays] Fill the gaps for me. Church & Trellis suggests who serves where, shares the turns fairly, keeps families together, skips people who are away (before planning a term, one tap asks every volunteer whether they’ll be away), and only asks for communion roles when there is communion. Keep the suggestions, and everyone is asked in Messages. For the noticeboard, anyone can print or download the roster as a PDF – a month up to a year, portrait or landscape, every Sunday across the top in each service’s colours, and a Sunday with no service – or a cancelled one – stays as a narrow column that says so instead of disappearing.');

  // ========== 12. Volunteers reply (clip) ==========
  s = content('What it does', 'Volunteers reply from their phone');
  {
    const h = 5.3; phone(s, 'accept.gif', 6.0, 1.5, h, 'Accepting a serving turn from Messages');
    phone(s, 'm-serving.jpg', 9.35, 1.5, h, 'My serving');
    T(s, 'No more phone calls.', { x: 0.6, y: 1.6, w: 4.8, h: 0.7, fontSize: 26, bold: true });
    T(s, [
      { text: 'Requests arrive in Messages', options: { bullet: true, breakLine: true } },
      { text: 'Accept or say you can’t make it – one tap', options: { bullet: true, breakLine: true } },
      { text: 'Can’t make it? Ask someone free that day to take your place', options: { bullet: true, breakLine: true } },
      { text: 'See who’s serving with you that Sunday', options: { bullet: true } }
    ], { x: 0.6, y: 2.5, w: 4.8, h: 3.5, fontSize: 17, color: HEX.ink, paraSpaceAfter: 12 });
  }
  s.addNotes('[Clip plays] The volunteer sees the request in Messages and taps Accept. If they can’t make it, they can ask someone on the same team who is free that day to take their place – that person says yes with one tap and the turn is theirs – and the roster team hears about it at once. Under each turn they can see who else is serving at that service – names and jobs only – and coordinators can send a gentle reminder to anyone who hasn’t replied.');

  // ========== 13. Members help themselves ==========
  s = content('What it does', 'Members help themselves', true);
  {
    const h = 4.6, labels = [['m-me.jpg', 'Their own details'], ['m-zulu.jpg', 'In their own language'], ['m-dark.jpg', 'Light or dark']];
    for (let i = 0; i < 3; i++) {
      const x = 1.2 + i * 4.0;
      phone(s, labels[i][0], x, 1.5, h, labels[i][1]);
      T(s, labels[i][1], { x: x - 0.4, y: 1.5 + h + 0.25, w: h * 390 / 844 + 0.8, h: 0.45, fontSize: 17, bold: true, align: 'center' });
    }
  }
  s.addNotes('Members look after their own details, privacy choices, days away and serving – here in isiZulu, and in dark mode in the evening. There is also a Help page: they type or say a question about using Church & Trellis and get an answer written for them, in their own language, from the church’s help pages. Fewer requests for the church office, and records that stay up to date. Each person can also choose their own colour and page pictures, and on their own birthday or anniversary Home greets them with a warm card – or they can turn that off.');

  // ========== 14. Privacy ==========
  pres.addSection({ title: 'Trust' });
  s = content('Trust', 'Safe, private and yours');
  shot(s, 'd-privacy.jpg', 6.0, 1.55, 6.7, 6.7 * 900 / 1440, 'Privacy tools');
  {
    const rows = [[Lu.LuUserCheck, 'Access by role', 'Each person sees only what their job needs'], [Lu.LuShieldCheck, 'Your country’s privacy law', 'From POPIA to GDPR, with a record of who looked'], [Lu.LuDatabase, 'Your data stays yours', 'Kept in your church’s own Google account'], [Lu.LuWifiOff, 'Works offline', 'Still opens with no signal; easy on data']];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.6 + i * 1.2;
      await badge(s, rows[i][0], 0.6, y, 0.75);
      T(s, rows[i][1], { x: 1.6, y: y, w: 4.1, h: 0.4, fontSize: 18, bold: true });
      T(s, rows[i][2], { x: 1.6, y: y + 0.42, w: 4.1, h: 0.5, fontSize: 15, color: HEX.muted });
    }
  }
  s.addNotes('Privacy is built in, not added on. Access follows each person’s role. Consent is recorded, there are privacy pages for your country’s law, and sensitive views are logged. Your records live in your own church’s Google account – not ours. And it keeps working when the signal drops.');

  // ========== 15. Price (dark, impact) ==========
  s = pres.addSlide({ masterName: 'Dark', sectionTitle: 'Trust' });
  await badge(s, Lu.LuCoffee, 0.8, 0.8, 1.0, HEX.night2, HEX.orange);
  T(s, 'The price of one cup of coffee a month', { x: 0.8, y: 2.0, w: 7.4, h: 1.6, fontSize: 40, bold: true, color: HEX.white });
  T(s, 'For your whole church – not per person. A suggested price, in your own money: whatever a cup costs where you live.', { x: 0.8, y: 3.7, w: 7.2, h: 1.2, fontSize: 18, color: HEX.nightInk });
  {
    const cards = [['Every feature, for everyone', 'No paid tiers or add-ons. No charge per member, group or language.'], ['A hard month?', 'Take a payment holiday. Nothing is ever locked or deleted.'], ['Can’t pay at all?', 'Pray for another church instead. Every week, Home shows one to pray for.']];
    for (let i = 0; i < 3; i++) {
      const y = 1.0 + i * 1.95;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.75, y, w: 3.95, h: 1.7, rectRadius: 0.14, fill: { color: HEX.night2 }, line: { color: HEX.night2 } });
      T(s, cards[i][0], { x: 9.05, y: y + 0.25, w: 3.4, h: 0.45, fontSize: 17, bold: true, color: HEX.white });
      T(s, cards[i][1], { x: 9.05, y: y + 0.72, w: 3.4, h: 0.85, fontSize: 14, color: HEX.nightInk });
    }
  }
  T(s, 'Not free to build, but cheap for you: every church gets all of Church & Trellis. Pay or pray.', { x: 0.8, y: 5.6, w: 7.2, h: 0.8, fontSize: 16, italic: true, color: HEX.orange });
  s.addNotes('And the price: one cup of coffee a month, for your whole church – not per person – at whatever a cup costs where you live. It is a suggested price; choose what is honest for your church. Every church gets every feature. A hard month? A church that gives monthly can take a payment holiday – a free month, no questions asked – whenever it needs one. Paying is through PayFast: card, Instant EFT or SnapScan. A church that can’t pay at all can pledge to pray for another church each month instead. No church is turned away. And every church is in the prayer circle: each church shares a prayer card – a photo and two things to pray for – and looks at it once a month, and every week Home shows everyone another church to pray for. So Church & Trellis doesn’t only run your church: it makes sure your church is prayed for. If someone asks why it isn’t free: it isn’t free to build or to run. There is hardware, the AI tools used to build it, website and database hosting, and the Apple and Google app stores, which all charge the developer every month. So it is not cheap for us, but it is cheap for you – and it is the whole of Church & Trellis, with no add-ons. The one exception would be a future feature that carries someone else’s licence fee, such as royalties for music; if that ever happens, we will say so and it will be your choice. Paying even a small amount is a partnership rather than charity: it keeps us independent of advertisers, it keeps Church & Trellis going, and it helps keep it open to churches that cannot pay. Pay or pray.');

  // ========== 16. Moving from another system ==========
  s = content('Trust', 'Moving from another system?', true);
  {
    const steps = [['1', 'Import your people', 'Bring your members, households and staff leave across from your current church management system.'], ['2', 'Run both for a while', 'Keep your current system going while everyone settles in.'], ['3', 'Switch over', 'When you’re ready, everyone signs in – the office keeps a list of what’s left to set up.']];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.7, w: 3.85, h: 3.8, rectRadius: 0.16, fill: { color: HEX.white }, line: { color: HEX.line, width: 0.75 } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: 2.0, w: 0.8, h: 0.8, fill: { color: HEX.orange }, line: { color: HEX.orange } });
      T(s, steps[i][0], { x: x + 0.35, y: 2.0, w: 0.8, h: 0.8, fontSize: 26, bold: true, color: HEX.white, align: 'center', valign: 'middle' });
      T(s, steps[i][1], { x: x + 0.35, y: 3.05, w: 3.2, h: 0.5, fontSize: 20, bold: true });
      T(s, steps[i][2], { x: x + 0.35, y: 3.6, w: 3.2, h: 1.6, fontSize: 15, color: HEX.muted });
      if (i < 2) s.addImage({ data: await icon(Lu.LuArrowRight, HEX.orange), x: x + 3.88, y: 3.4, w: 0.2, h: 0.2 });
    }
    T(s, 'A step-by-step setup guide takes a church from nothing to its first sign-in – about an hour, no technical knowledge needed.', { x: 0.6, y: 5.85, w: 12.1, h: 0.8, fontSize: 16, color: HEX.ink });
  }
  s.addNotes('Moving from another church management system? Import your people, households and staff leave, run both systems side by side while everyone settles in, then switch over. The setup guide takes a church office volunteer from nothing to the first sign-in in about an hour. If someone asks why they would switch from what they use now: they do not have to if they are happy. But by choosing Church & Trellis a church helps provide excellent software to churches that could never afford it, puts a practical tool in the hands of pastors and missionaries in hard places, and joins a worldwide church family in prayer. For the technically curious there is a third brochure, For administrators, under About: plain HTML, CSS and JavaScript with no build step, Google Firebase owned by the church, tested on every change.');

  // ========== 17. Try it ==========
  pres.addSection({ title: 'Close' });
  s = pres.addSlide({ masterName: 'Dark', sectionTitle: 'Close' });
  mark(s, 0.8, 0.9, 0.8);
  T(s, 'See your church in Church & Trellis', { x: 0.8, y: 2.0, w: 6.8, h: 1.6, fontSize: 44, bold: true, color: HEX.white });
  T(s, 'Try the demo – a whole church of made-up people. Nothing to install, nothing you change is kept.', { x: 0.8, y: 3.75, w: 6.6, h: 1.1, fontSize: 18, color: HEX.nightInk });
  T(s, 'Every church, however small, deserves great church software.', { x: 0.8, y: 5.6, w: 6.8, h: 0.8, fontSize: 18, italic: true, color: HEX.orange });
  {
    const qr = [['qr-demo.png', 'Try the demo', 'pian1966.github.io/church-hub/?demo'], ['qr-site.png', 'The website', 'pian1966.github.io/church-hub/site']];
    for (let i = 0; i < 2; i++) {
      const x = 8.0 + i * 2.55;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.3, h: 3.6, rectRadius: 0.16, fill: { color: HEX.white }, line: { color: HEX.white } });
      s.addImage({ path: IMG(qr[i][0]), x: x + 0.25, y: 1.85, w: 1.8, h: 1.8, altText: 'QR code: ' + qr[i][2] });
      T(s, qr[i][1], { x: x + 0.15, y: 3.8, w: 2.0, h: 0.4, fontSize: 16, bold: true, align: 'center' });
      T(s, qr[i][2], { x: x + 0.1, y: 4.25, w: 2.1, h: 0.8, fontSize: 11, color: HEX.muted, align: 'center' });
    }
  }
  {   // which version of Church & Trellis these slides describe, so a copy can be checked against About in the app
    const v = (fs.readFileSync(path.join(__dirname, '../../js/version.js'), 'utf8').match(/version:\s*'([\d.]+)'/) || [])[1] || '';
    const when = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' });
    T(s, 'Slides for Church & Trellis ' + v + ' · ' + when, { x: 8.0, y: 6.85, w: 4.9, h: 0.35, fontSize: 9, color: '5E554E', align: 'right' });   // dark grey on the dark slide: discreet
  }
  s.addNotes('Thank you. Scan the code to try the demo now – a whole church of made-up people, nothing to install. The website has the price, the setup guide and the answers to the questions churches ask. Every church, however small, deserves great church software.');

  const out = path.join(__dirname, 'church-and-trellis-presentation.pptx');
  await pres.writeFile({ fileName: out });
  if (SKILL) { const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js')); await applyTheme(out, THEME); }
  console.log('written', out);
})().catch(e => { console.error(e); process.exit(1); });
