/* Church Hub – browser test, part: Messages (sending to the staff, a care group and a message group; reading them).
 * One part of tests/app.test.js, which starts the browser and runs every part in turn: node tests/app.test.js */
'use strict';
module.exports = async function (ctx) {
  const { check, finish, seedDocs, session } = ctx;
  let docs, s, t, officeMessage, officeDocs;
  console.log('Messages:');

  // An Administrator sets up a message group and writes to the staff
  s = await session('linda.pillay@example.com', seedDocs()); await s.go('messages/groups');
  await s.page.fill('#mg-new', 'Welcome team'); await s.page.click('[data-act="messages:addgroup"]'); await s.settle(); docs = await s.docsNow();
  const mg = Object.keys(docs).find(k => /^msgGroups\//.test(k) && docs[k].name === 'Welcome team').split('/')[1];
  await s.page.fill('.cg-q[data-for="m-' + mg + '"]', 'tim jac'); await s.page.press('.cg-q[data-for="m-' + mg + '"]', 'Enter'); await s.settle(); await s.page.waitForTimeout(200);
  await s.page.click('[data-act="messages:lead"][data-g="' + mg + '"][data-id="p14"]'); await s.settle();
  await s.page.fill('.cg-q[data-for="m-' + mg + '"]', 'clare'); await s.page.press('.cg-q[data-for="m-' + mg + '"]', 'Enter'); await s.settle(); await s.page.waitForTimeout(200); docs = await s.docsNow();
  check(docs['msgGroups/' + mg].memberIds.join() === 'p14,p15' && docs['msgGroups/' + mg].leaderIds.join() === 'p14', 'an Administrator sets up a message group with a leader and members');
  await s.go('messages/send');
  const opts = await s.page.$$eval('#ms-to option', o => o.map(x => x.value));
  check(opts[0] === 'office' && opts.includes('people') && opts.includes('staff') && opts.includes('partners') && opts.includes('group/' + mg), 'they can write to the Office, people they choose, the staff, the Church Partners and every group');
  await s.page.selectOption('#ms-to', 'staff'); await s.page.waitForSelector('#ms-some');
  check((await s.page.textContent('#ms-reach')).includes('Goes to 8 people'), 'it says how many people a message goes to');
  await s.page.click('[data-act="messages:send"]');
  check(!(await s.page.isHidden('#ms-err')) && !(await s.page.$('#modal .overlay')), 'an empty message isn’t sent');
  await s.page.fill('#ms-title', 'Staff meeting'); await s.page.fill('#ms-body', 'Thursday at 9, in the hall. Agenda: https://example.com/agenda');
  await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('It goes to 7 people.'), 'they are asked to confirm, with how many it goes to');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  const sent = Object.keys(docs).filter(k => /^messages\//.test(k)).map(k => docs[k]);
  check(sent.length === 1 && sent[0].kind === 'staff' && sent[0].to.length === 8 && sent[0].to.includes('p01') && !sent[0].to.includes('p14') && sent[0].readBy.join() === 'p01' && sent[0].fromName === 'Linda Pillay', 'the message is saved with everyone on the staff, read by its sender');
  t = await s.text();
  check(t.includes('Staff meeting') && t.includes('Read by 0 of 7') && !!(await s.page.$('.msg-body a[href="https://example.com/agenda"]')), 'Sent shows it, how many have read it, and web addresses as links');
  check(Object.values(docs).some(d => d.action && /Sent a message to the staff \(8 people\)/.test(d.action)), 'sending is in the audit log (not what it says)');
  // To one person, from their page; then to people ticked on a checklist
  await s.go('people/p/p14'); await s.page.click('a[href="#/messages/send/people/p14"]'); await s.page.waitForSelector('.ms-pick');
  check(await s.page.$eval('#ms-to', e => e.value) === 'people' && (await s.page.$$eval('.ms-pick:checked', c => c.map(x => x.value).join())) === 'p14' && (await s.page.textContent('#ms-reach')).includes('Goes to 1 person'), '“Send a message” on a person’s page: a message to them, ticked on the checklist');
  await s.page.fill('#ms-body', 'Thank you for Sunday.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  check((await s.page.textContent('#modal')).includes('Tim Jacobs'), 'the confirmation names the person');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'people' && d.to.join() === 'p14' && d.audience === 'Tim Jacobs'), 'it goes to that one person');
  await s.go('messages/send'); await s.page.selectOption('#ms-to', 'people'); await s.page.waitForSelector('#ms-find');
  await s.page.fill('#ms-body', 'Planning meeting?'); await s.page.click('[data-act="messages:send"]');
  check((await s.page.textContent('#ms-err')).includes('Tick who should get it'), 'nobody ticked: it asks who should get it');
  await s.page.fill('#ms-find', 'jacobs'); await s.page.waitForTimeout(400);
  check(await s.page.$$eval('.ms-row:not([hidden])', r => r.length === 2), 'typing part of a name narrows the checklist');
  await s.page.click('[data-act="messages:tick"][data-on="1"]');
  await s.page.fill('#ms-find', 'megan'); await s.page.waitForTimeout(400); await s.page.check('.ms-row:not([hidden]) .ms-pick');
  check((await s.page.textContent('#ms-reach')).includes('Goes to 3 people'), '“Tick all” ticks the people shown; the count follows');
  await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay'); await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'people' && d.to.slice().sort().join() === 'p14,p15,p17' && d.body === 'Planning meeting?'), 'the message goes to the three people ticked');
  await s.go('messages/sent'); check((await s.text()).includes('To 3 people'), 'Sent says how many people it went to');
  await finish(s);

  // A member: their message group's messages, unread until opened; the leader writes to their own group
  const seed = seedDocs();
  seed['msgGroups/mgW'] = { name: 'Welcome team', leaderIds: ['p14'], memberIds: ['p14', 'p15', 'p17'] };
  seed['careGroups/cgM'] = { name: 'Hilton', leaderIds: ['p15'], memberIds: ['p15', 'p17'], names: { p15: 'Clare Jacobs', p17: 'Megan Smith' } };
  seed['messages/m1'] = { kind: 'staff', groupId: '', audience: 'Staff', title: 'Staff only', body: 'Not for members', fromId: 'p01', fromName: 'Linda Pillay', to: ['p01', 'p03'], readBy: ['p01'], createdAt: '2026-11-01 08:00', updatedAt: '2026-11-01 08:00' };
  seed['messages/m2'] = { kind: 'group', groupId: 'mgW', audience: 'Welcome team', title: 'Sunday', body: 'Please be at the door by 9:15.', fromId: 'p01', fromName: 'Linda Pillay', to: ['p14', 'p15', 'p17'], readBy: ['p01'], createdAt: '2026-11-02 08:00', updatedAt: '2026-11-02 08:00' };
  s = await session('tim.jacobs@example.com', seed); await s.go('home');
  check(await s.page.evaluate(() => Store.list('messages').map(m => m.id).join() === 'm2'), 'a member loads only the messages sent to them');
  check((await s.page.textContent('.tabbar')).includes('Messages') && (await s.page.textContent('.tabbar a[href="#/messages"] .badge')).trim() === '1', 'Messages is on the phone menu, with the number of new messages');
  check((await s.text()).includes('1 new message'), 'and in the Home to-do list');
  await s.go('messages'); await s.page.waitForTimeout(500); await s.settle(); docs = await s.docsNow();
  t = await s.text();
  check(t.includes('Please be at the door by 9:15.') && t.includes('From Linda Pillay') && t.includes('To Welcome team') && !!(await s.page.$('.msg.new')), 'the inbox shows the message, who it is from and to, marked as new');
  check(docs['messages/m2'].readBy.join() === 'p01,p14' && !(await s.page.$('a[href="#/messages"] .badge')), 'opening the inbox marks it read (for the sender to see) and the count goes');
  await s.go('messages/send');
  check(await s.page.$$eval('#ms-to option', o => o.map(x => x.value).join()) === 'office,direct/p03,direct/p02,group/mgW', 'a group leader (a Church Partner) can write to the Office, the ministers and their own group');
  await s.page.selectOption('#ms-to', 'office'); await s.page.fill('#ms-body', 'Could the office please call me?');
  await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay'); await s.page.click('[data-act="messages:sendnow"]'); await s.settle();
  docs = await s.docsNow(); officeMessage = Object.entries(docs).find(([k, d]) => /^messages\//.test(k) && d.kind === 'office');
  check(officeMessage && officeMessage[1].to.length === 0 && officeMessage[1].fromId === 'p14', 'a member can send a message to the Office channel without choosing recipients');
  await s.go('messages/sent');
  check(await s.page.$('.msg-status.sent[aria-label="Sent"]'), 'sent messages show an accessible grey sent tick');
  await s.page.click('.msg-chat .msg-status.sent');
  check((await s.page.textContent('.msg-mark-tip')).includes('Sent: on its way'), 'tapping the ticks shows what they mean in a small note');
  await s.page.waitForSelector('.msg-mark-tip', { state: 'detached', timeout: 6000 });
  check(!(await s.page.$('.msg-mark-tip')), 'the note about the ticks goes away by itself');
  check(await s.page.$$eval('.msg-legend-list li', l => l.length) === 4 && (await s.page.textContent('.msg-legend')).includes('Read by some'), 'Sent explains what the signs mean, including “read by some”');
  await s.page.click('.msg-legend > summary'); await s.page.selectOption('#ms-marks', 'post'); await s.settle();
  check(await s.page.$eval('.msg-legend', d => d.open) && await s.page.$('.msg-chat .msg-status.sent svg rect'), 'choosing envelopes draws envelopes, and the explanation stays open');
  await s.page.selectOption('#ms-marks', 'words'); await s.settle();
  check((await s.page.textContent('.msg-chat .msg-status.sent')).trim() === 'Sent', 'choosing words writes the state in words');
  await s.page.selectOption('#ms-marks', 'ticks'); await s.settle();
  await s.go('messages/send'); await s.page.selectOption('#ms-to', 'group/mgW');
  await s.page.fill('#ms-body', 'Thanks, all!'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  const tm = Object.keys(docs).filter(k => /^messages\//.test(k) && docs[k].fromId === 'p14' && docs[k].kind === 'group').map(k => docs[k]);
  check(tm.length === 1 && tm[0].to.join() === 'p14,p15,p17' && tm[0].kind === 'group', 'their message goes to the group');
  officeDocs = docs;
  const tries = await s.page.evaluate(async () => {
    const fs = firebase.firestore(), base = { groupId: '', audience: 'Staff', title: '', body: 'x', fromId: 'p14', fromName: 'Tim Jacobs', readBy: ['p14'] };
    const r = p => p.then(() => 'saved', e => e.code);
    const out = [await r(fs.doc('messages/x1').set(Object.assign({ kind: 'staff', to: ['p01'] }, base))),
      await r(fs.doc('messages/x2').set(Object.assign({}, base, { kind: 'group', groupId: 'mgW', to: ['p14', 'p01'] }))),
      await r(fs.doc('messages/m2').update({ body: 'changed' }))];
    window.__fake.denied.length = 0; return out.join();
  });
  check(tries === 'permission-denied,permission-denied,permission-denied', 'the database refuses a member writing to the staff, adding people who aren’t in their group, or changing a message they received');
  await finish(s);

  // A carer writes to their care group from the Me page
  s = await session('clare.jacobs@example.com', seed); await s.go('me');
  await s.page.click('#my-care a[href="#/messages/send/care/cgM"]'); await s.page.waitForSelector('#ms-to');
  check(await s.page.$eval('#ms-to', e => e.value) === 'care/cgM' && (await s.page.$$eval('#ms-to option', o => o.length)) === 4, 'a carer: “Send the group a message” on the Me page opens a message to their care group, with the Office and the ministers also available');
  await s.page.fill('#ms-body', 'Prayer meeting moved to Wednesday.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'care' && d.groupId === 'cgM' && d.fromId === 'p15' && d.to.join() === 'p15,p17'), 'their message goes to the care group');
  await s.go('messages/send/care/cgM'); await s.page.check('#ms-some'); await s.page.waitForSelector('.ms-pick');
  check(await s.page.$$eval('.ms-pick', c => c.length === 2 && c.every(x => x.checked)) && (await s.page.textContent('.ms-list')).includes('Megan Smith'), '“Only some of them”: the group’s people, all ticked, named even for a carer who isn’t staff');
  await s.page.uncheck('.ms-pick[value="p15"]');
  await s.page.fill('#ms-body', 'Just for you, Megan.'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'care' && d.some === true && d.to.join() === 'p17' && d.body === 'Just for you, Megan.'), 'only the ticked people get it');
  check(!(await s.page.$('#ms-to option[value="people"]')), 'a carer can’t choose people outside their group');
  await s.go('messages/sent');
  check(!(await s.text()).includes('Not for members') && (await s.text()).includes('Prayer meeting moved'), 'Sent shows only their own messages');
  await finish(s);

  // Office staff see Office messages, mark receipt and reading, and can reply directly to the sender
  s = await session('linda.pillay@example.com', officeDocs); await s.go('messages'); await s.page.waitForTimeout(500); await s.settle(); docs = await s.docsNow();
  const replyBtn = '[data-act="messages:reply"][data-id="' + officeMessage[0].split('/')[1] + '"]';
  check((await s.text()).includes('Could the office please call me?') && !!(await s.page.$(replyBtn)), 'Office staff see member messages and can reply directly');
  check(docs[officeMessage[0]].deliveredBy.includes('p01') && docs[officeMessage[0]].readBy.includes('p01'), 'opening the Office inbox updates delivered and read status');
  await s.page.click(replyBtn); await s.page.waitForSelector('#ms-reply');
  check((await s.page.textContent('#modal')).includes('Only Tim Jacobs will see your reply.') && (await s.page.textContent('#modal .msg-quote')).includes('Could the office please call me?'), 'Reply opens a private reply to the member who contacted the Office, showing their message');
  await s.page.click('[data-act="messages:replysend"]');
  check(!(await s.page.isHidden('#ms-rerr')), 'an empty reply isn’t sent');
  await s.page.fill('#ms-reply', 'We will call you shortly.'); await s.page.click('[data-act="messages:replysend"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'direct' && d.to.join() === 'p14' && d.replyTo === officeMessage[0].split('/')[1] && d.body === 'We will call you shortly.'), 'Office staff can reply to the sender');
  officeDocs = docs;
  await finish(s);

  // A Church Partner replies privately to a message from their group; the reply shows what it answers
  s = await session('tim.jacobs@example.com', officeDocs); await s.go('messages'); await s.page.waitForTimeout(400); await s.settle();
  check((await s.text()).includes('We will call you shortly.') && (await s.text()).includes('Replying to:'), 'the reply reaches them, saying what it answers');
  await s.page.click('[data-act="messages:reply"][data-id="m2"]'); await s.page.waitForSelector('#ms-reply');
  await s.page.fill('#ms-reply', 'I will be there.'); await s.page.click('[data-act="messages:replysend"]'); await s.settle(); docs = await s.docsNow();
  const tr = Object.values(docs).find(d => d.kind === 'direct' && d.fromId === 'p14' && d.replyTo === 'm2');
  check(tr && tr.to.join() === 'p01' && tr.title === 'Re: Sunday' && tr.audience === 'Linda Pillay', 'a Church Partner’s reply goes only to the sender, as “Re: …”');
  await finish(s);

  // An attendee (Basic access, not a Church Partner): reads messages; writes only to the Office, the ministers and their Midweek Group leader
  const aSeed = seedDocs(); aSeed['settings/church'].modules = Object.assign({}, aSeed['settings/church'].modules, { life: true });
  aSeed['careGroups/lgA'] = { type: 'life', name: 'Tuesday study', leaderIds: ['p15'], memberIds: ['p15', 'p10'], names: { p15: 'Clare Jacobs' } };
  aSeed['messages/mA'] = { kind: 'people', groupId: '', audience: '', title: 'Welcome', body: 'Welcome to the church!', fromId: 'p02', fromName: 'Thandi Mokoena', to: ['p10', 'p14'], readBy: ['p02'], createdAt: '2026-11-03 08:00', updatedAt: '2026-11-03 08:00' };
  aSeed['messages/mB'] = { kind: 'people', groupId: '', audience: '', title: 'Rota', body: 'Thanks for helping.', fromId: 'p01', fromName: 'Linda Pillay', to: ['p10'], readBy: ['p01'], createdAt: '2026-11-04 08:00', updatedAt: '2026-11-04 08:00' };
  s = await session('jason.naidoo@example.com', aSeed); await s.go('messages'); await s.page.waitForTimeout(400); await s.settle();
  t = await s.text();
  check(t.includes('Welcome to the church!') && t.includes('Thanks for helping.'), 'an attendee receives messages');
  check(!!(await s.page.$('[data-act="messages:reply"][data-id="mA"]')) && !(await s.page.$('[data-act="messages:reply"][data-id="mB"]')), 'they may reply to a minister, but not to other messages');
  await s.go('messages/send');
  check(await s.page.$$eval('#ms-to option', o => o.map(x => x.value).join()) === 'office,direct/p03,direct/p02,direct/p15/lgA', 'they may write to the Office, the ministers and their Midweek Group leader');
  await s.page.selectOption('#ms-to', 'direct/p15/lgA'); await s.page.waitForTimeout(200);
  check((await s.page.textContent('#ms-reach')).includes('Only Clare Jacobs will see it.'), 'a message to one person says only they will see it');
  await s.page.fill('#ms-body', 'May I join?'); await s.page.click('[data-act="messages:send"]'); await s.page.waitForSelector('#modal .overlay');
  await s.page.click('[data-act="messages:sendnow"]'); await s.settle(); docs = await s.docsNow();
  check(Object.values(docs).some(d => d.kind === 'direct' && d.groupId === 'lgA' && d.to.join() === 'p15' && d.fromId === 'p10'), 'the message goes to the leader only');
  const aTries = await s.page.evaluate(async () => {
    const fs = firebase.firestore(), base = { groupId: '', audience: '', title: '', body: 'x', fromId: 'p10', fromName: 'Jason Naidoo', readBy: ['p10'], deliveredBy: ['p10'] };
    const r = p => p.then(() => 'saved', e => e.code);
    const out = [await r(fs.doc('messages/y1').set(Object.assign({}, base, { kind: 'direct', replyTo: 'mB', to: ['p01'] }))),
      await r(fs.doc('messages/y2').set(Object.assign({}, base, { kind: 'direct', to: ['p14'] }))),
      await r(fs.doc('directory/p14').get())];
    window.__fake.denied.length = 0; return out.join();
  });
  check(aTries === 'permission-denied,permission-denied,permission-denied', 'the database refuses an attendee replying where Settings doesn’t allow, writing to anyone else, or reading the directory');
  await s.go('people'); t = await s.text();
  check(t.includes('The names of the church’s Church Partners.') && t.includes('Jacobs, Tim') && !(await s.page.$('#main a.pp-row[href="#/people/p/p14"]')) && !t.includes('Naidoo, Priya'), 'People shows Church Partners’ names only (no links, no attenders)');
  await s.go('me'); t = await s.text();
  check(t.includes('as your home church') && t.includes('Apply to become a Church Partner') && t.includes('Basic access'), 'Me invites them to become a Church Partner');
  await finish(s);

  // Settings → Attendees: the Senior Pastor lets attendees only receive, and writes what it takes to become a Church Partner
  const rSeed = seedDocs(); rSeed['settings/church'].seniorPastorId = 'p02';
  s = await session('thandi.mokoena@example.com', rSeed); await s.go('settings');
  const links = await s.page.$$eval('.set-link', a => a.map(x => x.getAttribute('href')).join());
  check(links === '#/settings/application,#/settings/attendees', 'the Senior Pastor opens Settings for the membership application and attendees only' + (links ? '' : ': ' + (await s.text()).slice(0, 200)));
  await s.go('settings/attendees');
  check(await s.page.$$eval('.st-att', c => c.map(x => x.value + ':' + x.checked).join()) === 'names:true,directory:false,write:true,reply:false', 'by default attendees see names and may write');
  await s.page.uncheck('.st-att[value="names"]'); await s.page.uncheck('.st-att[value="write"]'); await s.page.click('[data-act="settings:attendees"]'); await s.settle(); docs = await s.docsNow();
  check(JSON.stringify(docs['settings/church'].attendeeCan) === '[]', 'they can change it (saved for the database rules too)');
  await s.go('settings/application'); await s.page.waitForSelector('[data-act="people:reqedit"]');
  await s.page.click('[data-act="people:reqedit"]'); await s.page.waitForSelector('#ap-req-t');
  await s.page.fill('#ap-req-t', '# Becoming a Church Partner\n- Be 18 or older\n- Come to a membership class'); await s.page.fill('#ap-req-l', 'https://example.com/doc');
  await s.page.click('[data-act="people:reqsave"]'); await s.settle(); docs = await s.docsNow();
  check(docs['partnerInfo/requirements'] && docs['partnerInfo/requirements'].text.includes('membership class') && docs['partnerInfo/requirements'].link === 'https://example.com/doc', 'the requirements are saved');
  rSeed['settings/church'].attendeeCan = []; rSeed['partnerInfo/requirements'] = docs['partnerInfo/requirements'];
  rSeed['messages/mA'] = aSeed['messages/mA'];
  await finish(s);
  s = await session('jason.naidoo@example.com', rSeed); await s.go('messages'); await s.page.waitForTimeout(400);
  check(!(await s.page.$('a[href="#/messages/send"]')) && !(await s.page.$('[data-act="messages:reply"]')), 'an attendee the church lets only receive: no Write, no Reply');
  check(!(await s.page.$('nav a[href="#/people"]')), 'and no People page when they may not see names');
  await s.go('me'); await s.page.waitForTimeout(400); t = await s.text();
  check(t.includes('What becoming a Church Partner involves') && !!(await s.page.$('#me-apply a[href="https://example.com/doc"]')), 'Me shows what it takes to become a Church Partner, with the link');
  await finish(s);

  // Rosters → Messages: a reminder to someone who hasn't replied; they say they can't make it from the message; the roster team hears
  console.log('Messages about the roster:');
  const rs = seedDocs();
  s = await session('linda.pillay@example.com', rs); await s.go('settings/services'); await s.page.waitForSelector('#st-rteam');
  check((await s.page.textContent('#st-rteam')).includes('Sipho Dlamini'), 'Settings → Church Services lists who hears about roster replies (Roster coordinators always)');
  await s.page.fill('.cg-q[data-for="st-rteam"]', 'clare'); await s.page.waitForTimeout(250);
  await s.page.click('#st-rteam [data-act="settings:rtadd"][data-id="p15"]'); await s.settle(); docs = await s.docsNow();
  check((docs['settings/church'].rosterExtra || []).join() === 'p15' && docs['settings/church'].rosterTeam.includes('p15') && docs['settings/church'].rosterTeam.includes('p05'), 'an Administrator adds someone else (e.g. the church secretary) to hear about roster replies');
  Object.assign(rs['settings/church'], { rosterExtra: docs['settings/church'].rosterExtra, rosterTeam: docs['settings/church'].rosterTeam });
  await finish(s);
  s = await session('sipho.dlamini@example.com', rs); await s.go('rosters'); await s.page.waitForTimeout(300);
  await s.page.click('.page-head details.menu > summary'); await s.page.click('[data-act="rosters:remind"]'); await s.page.waitForSelector('[data-act="rosters:remindnow"]');
  check((await s.page.textContent('#modal')).includes('Tim Jacobs'), 'they are asked to confirm, with the names of those to remind');
  await s.page.click('[data-act="rosters:remindnow"]'); await s.settle(); docs = await s.docsNow();
  const rem = Object.keys(docs).filter(k => /^messages\//.test(k) && docs[k].kind === 'roster' && docs[k].roster === 'remind').map(k => Object.assign({ id: k.split('/')[1] }, docs[k]));
  const timRem = rem.find(m => m.to.join() === 'p14');
  check(rem.length > 0 && !!timRem && timRem.turns.includes('kTim') && timRem.fromId === 'p05', 'the roster coordinator reminds those who haven’t replied: one message each, about their turns');
  rem.forEach(m => { rs['messages/' + m.id] = Object.assign({}, m); delete rs['messages/' + m.id].id; });
  await finish(s);
  s = await session('tim.jacobs@example.com', rs); await s.go('messages'); await s.page.waitForTimeout(400); t = await s.text();
  check(t.includes('Reminder: please reply about serving') && !!(await s.page.$('.msg-turns [data-act="rosters:reply"][data-id="kTim"][data-s="declined"]')), 'the volunteer sees the reminder with their turn, and can answer it right there');
  await s.page.click('.msg-turns [data-act="rosters:reply"][data-id="kTim"][data-s="declined"]'); await s.settle(); docs = await s.docsNow();
  const dec = Object.keys(docs).filter(k => /^messages\//.test(k) && docs[k].kind === 'roster' && docs[k].roster === 'declined').map(k => docs[k]);
  check(docs['assignments/kTim'].status === 'declined' && dec.length === 1 && dec[0].to.join() === rs['settings/church'].rosterTeam.join() && dec[0].turns.join() === 'kTim', 'saying they can’t make it tells the roster team (Administrators, Roster coordinators and the chosen people)');
  await finish(s);
};
