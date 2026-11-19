'use strict';
/* ===== Game state, map scene, save/load, title, main loop ===== */
const G = { mode: 'boot', time: 0, playtime: 0, flags: {}, inv: {}, gold: 0, map: null, mapId: null, px: 0, py: 0, dir: 'up', mv: null, walkT: 0,
  busy: false, encCount: 20, encGrace: 0, banner: null };
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function parseMap(id) {
  const m = MAPS[id];
  if (m.grid) return m;
  const W = m.rows[0].length;
  m.id = id; m.w = W; m.h = m.rows.length;
  m.grid = m.rows.map(r => { r = r.slice(0, W); while (r.length < W) r += 'T'; return r.split(''); });
  m.base = m.grid.map((row, y) => row.map((ch, x) => {
    const d = TD[ch]; if (!d || !d.base) return null;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const n = (m.grid[y + dy] || [])[x + dx]; const nd = n && TD[n];
      if (nd && !nd.base && !nd.solid && n !== '=' && n !== 'G') return n;
    }
    return d.base;
  }));
  m.npcs = m.npcs || []; m.events = m.events || []; m.exits = m.exits || []; m.chests = m.chests || {};
  for (const n of m.npcs) { n.x0 = n.x; n.y0 = n.y; n.dir0 = n.dir || 'down'; }
  return m;
}
function loadMap(id, x, y, dir) {
  const m = parseMap(id);
  G.mapId = id; G.map = m; G.px = x; G.py = y; G.dir = dir || G.dir; G.mv = null;
  for (const n of m.npcs) { n.x = n.x0; n.y = n.y0; n.dir = n.dir0; n.mv = null; n.hidden = false; n.wt = R.f(1, 4); }
  G.encCount = R.i(16, 30); G.encGrace = 4;
  Music.play(m.music); Parts.set(m.parts);
  G.mode = 'map';
  G.banner = { s: m.name, t: 0 };
}
async function warp(id, x, y, dir) {
  Snd.sfx('door');
  await fadeOut(0.3);
  loadMap(id, x, y, dir);
  await fadeIn(0.3);
  if (G.map.onEnter) await G.map.onEnter();
}
async function run(fn) {
  if (G.busy) return;
  G.busy = true;
  try { await fn(); } catch (e) { console.error(e); }
  finally { G.busy = false; Input.clear(); }
}

const visible = n => !n.hidden && (!n.cond || n.cond());
function npcAt(x, y) { return G.map.npcs.find(n => visible(n) && ((n.x === x && n.y === y) || (n.mv && n.mv.x === x && n.mv.y === y))); }
function tileAt(x, y) { const m = G.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null; return m.grid[y][x]; }
function solidAt(x, y) { const ch = tileAt(x, y); if (ch === null) return true; const d = TD[ch]; if (d && d.solid) return true; return !!npcAt(x, y); }
function exitAt(x, y) { return G.map.exits.find(e => x >= e.x && x < e.x + (e.w || 1) && y >= e.y && y < e.y + (e.h || 1)); }
function eventsAt(x, y, type) { return G.map.events.filter(e => e.type === type && x >= e.x && x < e.x + (e.w || 1) && y >= e.y && y < e.y + (e.h || 1) && (!e.cond || e.cond())); }

function tryMove(d) {
  G.dir = d;
  const [dx, dy] = DIRV[d], nx = G.px + dx, ny = G.py + dy;
  const ex = exitAt(nx, ny);
  if (ex && ex.cond && !ex.cond()) { run(ex.blocked); return; }
  if (solidAt(nx, ny)) {
    const ev = eventsAt(nx, ny, 'door')[0];
    if (ev) run(ev.run);
    return;
  }
  G.mv = { x: nx, y: ny, t: 0 };
}
function onStep() {
  const m = G.map;
  if ((G.stepN = (G.stepN || 0) + 1) % 2 === 0) Snd.sfx('step');
  const ex = exitAt(G.px, G.py);
  if (ex) { run(() => warp(ex.to, ex.tx, ex.ty, ex.dir || G.dir)); return; }
  const ev = eventsAt(G.px, G.py, 'step')[0];
  if (ev) { run(ev.run); return; }
  if (m.enc && !G.flags.noEnc && (m.encTiles || '.,').includes(tileAt(G.px, G.py))) {
    if (G.encGrace > 0) { G.encGrace--; return; }
    G.encCount -= tileAt(G.px, G.py) === ',' ? 0.6 : 1;
    if (G.encCount <= 0) { G.encCount = R.i(16, 32); const grp = R.pick(ENC[m.enc]); run(() => battle(grp)); }
  }
}
function interact() {
  const [dx, dy] = DIRV[G.dir], fx = G.px + dx, fy = G.py + dy;
  const n = npcAt(fx, fy);
  if (n) { if (n.talk) { if (!n.fixedDir) faceTo(n); run(n.talk); } return; }
  const ev = eventsAt(fx, fy, 'touch')[0] || eventsAt(fx, fy, 'door')[0];
  if (ev) { run(ev.run); return; }
  const ch = tileAt(fx, fy);
  const chest = G.map.chests[fx + ',' + fy];
  if (ch === 'C' && chest) { run(() => openChest(fx, fy, chest)); return; }
  if (ch === 'j') { run(shrine); return; }
  if (G.map.touchTiles && G.map.touchTiles[ch]) { run(G.map.touchTiles[ch]); return; }
  const generic = { g: 'A weathered gravestone. The name has worn away.', l: 'A stone lantern. A candle flickers inside.', t: 'A brazier of burning pine. The heat stings your face.', r: 'A mossy boulder.', W: 'The waterfall roars. Cold spray beads on your skin.', I: 'A vermilion torii gate, marking sacred ground.', k: 'A pike.', b: 'Dense bamboo, creaking in the wind.' };
  if (generic[ch]) run(() => say(generic[ch]));
}
async function openChest(x, y, c) {
  const k = 'chest_' + G.mapId + '_' + x + '_' + y;
  if (G.flags[k]) { await say('The chest is empty.'); return; }
  setF(k); Snd.sfx('door');
  if (c.gold) { await say('Inside: a pouch of coins.'); addGold(c.gold); }
  else { give(c.item, c.n || 1); await say('Inside: ' + ITEMS[c.item].name + (c.n > 1 ? ' ×' + c.n : '') + '.'); if (['weapon', 'armor', 'charm'].includes(ITEMS[c.item].type)) await say('Tip: Equip it from the menu — Equipment.'); }
}
async function shrine() {
  await say('A stone Jizō, guardian of travelers and lost children. Someone has tied a fresh red bib around its neck.');
  await say('You kneel and pray. A calm settles over you.');
  P.hp = maxHP(); P.ki = maxKi(); Snd.sfx('heal'); toast('HP and Ki fully restored', '#a0e0a0');
  await savePrompt();
}

function updateEntityMove(e, dt, isPlayer) {
  if (!e.mv) return;
  e.mv.t += dt * (e.mv.speed || 5.2);
  if (e.mv.t >= 1) {
    const mv = e.mv;
    if (isPlayer) { G.px = mv.x; G.py = mv.y; } else { e.x = mv.x; e.y = mv.y; }
    e.mv = null;
    if (mv.res) mv.res(); else if (isPlayer) onStep();
  }
}
function mapUpdate(dt) {
  const m = G.map;
  for (const n of m.npcs) {
    if (!visible(n)) continue;
    if (n.mv) { n.mv.t += dt * (n.mv.speed || 3); if (n.mv.t >= 1) { const mv = n.mv; n.x = mv.x; n.y = mv.y; n.mv = null; if (mv.res) mv.res(); } continue; }
    if (n.wander && !G.busy) {
      n.wt -= dt;
      if (n.wt <= 0) {
        n.wt = R.f(1.5, 4);
        const d = R.pick(['up', 'down', 'left', 'right']), [dx, dy] = DIRV[d], nx = n.x + dx, ny = n.y + dy;
        n.dir = d;
        if (Math.abs(nx - n.x0) <= 2 && Math.abs(ny - n.y0) <= 2 && !solidAt(nx, ny) && !(nx === G.px && ny === G.py) && !(G.mv && G.mv.x === nx && G.mv.y === ny) && !exitAt(nx, ny))
          n.mv = { x: nx, y: ny, t: 0, speed: 2.5 };
      }
    }
  }
  if (G.mv) { G.walkT += dt; updateEntityMove({ get mv() { return G.mv; }, set mv(v) { G.mv = v; } }, dt, true); }
  if (!G.mv && !G.busy && !UI.stack.length) {
    if (Input.take('ok')) { interact(); return; }
    if (Input.take('menu') || Input.take('cancel')) { run(openMenu); return; }
    const d = Input.dir(); if (d) tryMove(d);
  }
}

function camera() {
  const m = G.map;
  const ppx = G.mv ? lerp(G.px, G.mv.x, Math.min(1, G.mv.t)) : G.px, ppy = G.mv ? lerp(G.py, G.mv.y, Math.min(1, G.mv.t)) : G.py;
  let cx = ppx * TS + 8 - VW / 2, cy = ppy * TS + 8 - VH / 2;
  cx = m.w * TS <= VW ? (m.w * TS - VW) / 2 : clamp(cx, 0, m.w * TS - VW);
  cy = m.h * TS <= VH ? (m.h * TS - VH) / 2 : clamp(cy, 0, m.h * TS - VH);
  return [Math.round(cx), Math.round(cy), ppx, ppy];
}
function drawMap() {
  const m = G.map;
  const [cx, cy, ppx, ppy] = camera();
  const [sx, sy] = Shake.off();
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  const x0 = Math.max(0, Math.floor(cx / TS)), y0 = Math.max(0, Math.floor(cy / TS));
  const x1 = Math.min(m.w - 1, Math.ceil((cx + VW) / TS)), y1 = Math.min(m.h - 1, Math.ceil((cy + VH) / TS));
  const fr = Math.floor(G.time * 3);
  const lights = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = m.grid[y][x], d = TD[ch] || TD['.'];
    const dx = x * TS - cx, dy = y * TS - cy;
    const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (d.base) { const b = m.base[y][x]; const bd = TD[b]; ctx.drawImage(tileImg(b, v % bd.variants, fr % bd.frames), dx, dy); }
    if (ch === 'C' && G.flags['chest_' + G.mapId + '_' + x + '_' + y]) ctx.drawImage(chestOpenImg(), dx, dy);
    else ctx.drawImage(tileImg(ch, v % d.variants, (fr + (d.frames > 1 ? v % d.frames : 0)) % d.frames), dx, dy);
    if (d.light && m.dark) {
      const fl = d.lightCol === 'fire' ? 0.9 + Math.sin(G.time * 9 + x * 3 + y) * 0.08 : 1;
      if (ch === 'x') { if ((x + y) % 3 === 0) lights.push({ x: dx + 8, y: dy + 8, r: 42 * fl, a: 0.55, glow: 'rgba(255,80,20,.22)' }); }
      else lights.push({ x: dx + 8, y: dy + 6, r: (ch === 't' ? 78 : 46) * fl, a: ch === 't' ? 1 : 0.75, glow: d.lightCol === 'fire' ? 'rgba(255,140,50,.22)' : 'rgba(255,210,120,.18)' });
    }
  }
  const ents = [];
  for (const n of m.npcs) {
    if (!visible(n)) continue;
    const nx = n.mv ? lerp(n.x, n.mv.x, Math.min(1, n.mv.t)) : n.x, ny = n.mv ? lerp(n.y, n.mv.y, Math.min(1, n.mv.t)) : n.y;
    const f = n.mv ? [1, 0, 2, 0][Math.floor(n.mv.t * 4) % 4] : 0;
    ents.push({ y: ny, img: SPR[n.spr][n.dir || 'down'][f], x: nx });
  }
  const pf = G.mv ? [1, 0, 2, 0][Math.floor(G.walkT * 7) % 4] : 0;
  ents.push({ y: ppy, img: SPR.ren[G.dir][pf], x: ppx, p: true });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) ctx.drawImage(e.img, Math.round(e.x * TS - cx), Math.round(e.y * TS - cy - 3));
  if (m.dark) lights.push({ x: ppx * TS - cx + 8, y: ppy * TS - cy + 6, r: 72, a: 0.9 });
  ctx.restore();
  Parts.draw(ctx);
  if (m.dark) drawLighting(m.dark, m.darkCol, lights);
  // vignette
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (G.banner && G.banner.t < 3) {
    const a = clamp(Math.min(G.banner.t * 2, (3 - G.banner.t) * 2), 0, 1);
    ctx.globalAlpha = a; ctx.font = font(12, true);
    const w = ctx.measureText(G.banner.s).width + 40;
    ctx.fillStyle = 'rgba(8,8,14,.75)'; ctx.fillRect(VW / 2 - w / 2, 22, w, 24);
    ctx.fillStyle = '#7a2020'; ctx.fillRect(VW / 2 - w / 2, 22, w, 1); ctx.fillRect(VW / 2 - w / 2, 45, w, 1);
    text(G.banner.s, VW / 2, 27, { size: 12, bold: true, align: 'center', color: '#efe2c0' });
    ctx.globalAlpha = 1;
  }
}

/* ----- Save / load ----- */
const SAVE_KEY = 'kagenuma_save_v1';
function saveGame() {
  const d = { v: 1, P: Object.assign({}, P, { eq: Object.assign({}, P.eq), skills: P.skills.slice() }), inv: G.inv, gold: G.gold, flags: G.flags, mapId: G.mapId, x: G.px, y: G.py, dir: G.dir, playtime: G.playtime, sound: Snd.on };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { toast('Could not save!', '#f08080'); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d) return false;
  newPlayer(); Object.assign(P, d.P);
  G.inv = d.inv || {}; G.gold = d.gold || 0; G.flags = d.flags || {}; G.playtime = d.playtime || 0;
  loadMap(d.mapId, d.x, d.y, d.dir);
  return true;
}
function newGame() {
  newPlayer();
  G.inv = { onigiri: 3 }; G.gold = 30; G.flags = {}; G.playtime = 0;
}

/* ----- Game over ----- */
async function gameOver() {
  G.mode = 'black'; Music.play('sorrow'); await fadeIn(0.5);
  await narrate(['Ren has fallen.', 'Somewhere far away, a camellia drops from its branch — whole, and silent.'], {});
  const opts = hasSave() ? ['Load last record', 'Return to title'] : ['Return to title'];
  const c = await ask(null, 'The story is not over yet.', opts);
  try { if (hasSave() && c === 0) sessionStorage.setItem('kagenuma_autoload', '1'); } catch (e) {}
  location.reload();
  await new Promise(() => {});
}

/* ----- Title ----- */
const Title = { stars: [] };
for (let i = 0; i < 70; i++) Title.stars.push([Math.random() * VW, Math.random() * 140, Math.random()]);
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#05060e'); g.addColorStop(0.6, '#1a1424'); g.addColorStop(1, '#3a1c1c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (const s of Title.stars) { ctx.fillStyle = 'rgba(255,255,240,' + (0.3 + 0.5 * Math.abs(Math.sin(G.time + s[2] * 9))) + ')'; ctx.fillRect(s[0], s[1], 1, 1); }
  ctx.fillStyle = '#efe6cc'; ctx.beginPath(); ctx.arc(370, 70, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1424'; ctx.beginPath(); ctx.arc(382, 64, 27, 0, Math.PI * 2); ctx.fill();
  const r = seeded(42);
  ctx.fillStyle = '#120e18'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, 170 - Math.sin(x / 60) * 30 - r() * 12); ctx.lineTo(VW, VH); ctx.fill();
  ctx.fillStyle = '#08060a'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, 205 - Math.sin(x / 40 + 2) * 14 - r() * 8); ctx.lineTo(VW, VH); ctx.fill();
  // castle silhouette
  ctx.fillStyle = '#08060a'; ctx.fillRect(80, 150, 50, 40); ctx.beginPath(); ctx.moveTo(70, 152); ctx.lineTo(105, 136); ctx.lineTo(140, 152); ctx.fill();
  ctx.fillRect(90, 124, 30, 16); ctx.beginPath(); ctx.moveTo(82, 126); ctx.lineTo(105, 112); ctx.lineTo(128, 126); ctx.fill();
  // ninja on ridge
  ctx.drawImage(SPR.ren.right[0], 300, 166, 32, 32);
  Parts.draw(ctx);
  text('影 沼', VW / 2, 52, { size: 30, align: 'center', color: '#a02828', bold: true });
  text('KAGENUMA', VW / 2, 92, { size: 26, align: 'center', color: '#efe6cc', bold: true });
  text('— Ashes of the Shinobi —', VW / 2, 124, { size: 12, align: 'center', color: '#c8b48a' });
}
class PressStart extends Widget {
  update() { if (Input.take('ok') || Input.take('menu') || Input.take('cancel')) { Snd.unlock(); this.finish(); } }
  draw() { if (Math.floor(G.time * 1.5) % 2 === 0) text('Press A  /  Enter', VW / 2, 200, { size: 12, align: 'center', color: '#e8d8a8' }); }
}
async function titleScreen() {
  G.mode = 'title'; Parts.set('petals'); Fade.a = 1; Fade.to(0, 1.2);
  await UI.push(new PressStart());
  Music.play('title');
  while (true) {
    const save = hasSave();
    const i = await menu([{ label: 'New Journey' }, { label: 'Continue', disabled: !save }, { label: 'Sound', right: Snd.on ? 'On' : 'Off' }, { label: 'How to Play' }],
      { x: VW / 2 - 70, y: 160, w: 140, cancel: false, index: save ? 1 : 0 });
    if (i === 0) {
      if (save) { const c = await ask(null, 'Start a new journey? Your recorded progress will be overwritten when you next save.', ['Begin', 'Back']); if (c !== 0) continue; }
      await fadeOut(1.0); Music.stop(); newGame(); G.mode = 'black';
      await run(prologue); return;
    }
    if (i === 1) { await fadeOut(0.6); if (loadGame()) { await fadeIn(0.6); toast('Welcome back.'); return; } }
    if (i === 2) Snd.setOn(!Snd.on);
    if (i === 3) {
      await say('Move with the arrow keys or WASD (or the on-screen pad on a phone). A / Z / Enter confirms, talks and examines. B / X / Esc cancels and opens the menu.');
      await say('Defeating enemies grants experience. Each level raises your stats and gives 2 training points to spend in the Training menu. New techniques unlock as you grow.');
      await say('Pray at Jizō statues or stay at an inn to recover and record your journey.');
    }
  }
}

/* ----- Main loop ----- */
function update(dt) {
  G.time += dt; if (G.mode === 'map' || G.mode === 'battle') G.playtime += dt;
  Timers.update(dt); Fade.update(dt); Flash.update(dt); Shake.update(dt); Toasts.update(dt); Parts.update(dt);
  if (G.banner) G.banner.t += dt;
  const top = UI.top(); if (top) top.update(dt);
  if (G.mode === 'map') mapUpdate(dt);
  else if (G.mode === 'battle') Battle.update(dt);
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(SCALE, 0, 0, SCALE, OX, OY);
  ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
  if (G.mode === 'map') drawMap();
  else if (G.mode === 'battle') { const [sx, sy] = Shake.off(); ctx.save(); ctx.translate(sx, sy); Battle.draw(); ctx.restore(); }
  else if (G.mode === 'title') drawTitle();
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); }
  Flash.draw(); Fade.draw();
  for (const w of UI.stack) w.draw();
  Toasts.draw();
  ctx.restore();
}
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  try { Input.update(dt); update(dt); draw(); } catch (e) { console.error(e); }
  Input.clear();
  requestAnimationFrame(frame);
}

function boot() {
  buildSprites();
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && d.sound === false) Snd.setOn(false); } catch (e) {}
  requestAnimationFrame(frame);
  let auto = false; try { auto = sessionStorage.getItem('kagenuma_autoload') === '1'; sessionStorage.removeItem('kagenuma_autoload'); } catch (e) {}
  if (auto && loadGame()) { Fade.a = 1; Fade.to(0, 0.8); toast('Your journey continues.'); return; }
  titleScreen();
}
window.G = G;
boot();
