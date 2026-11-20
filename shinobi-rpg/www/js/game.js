'use strict';
/* ===== Game state, map scene, rendering, HUD, save/load, title, main loop ===== */
const G = { mode: 'boot', time: 0, playtime: 0, flags: {}, inv: {}, gold: 0, map: null, mapId: null, pl: null, busy: false, inFight: false,
  ents: [], proj: [], fx: [], picks: [], yuki: null, trail: [], cam: { x: 0, y: 0 }, hitstop: 0, banner: null, bossBar: null, fightRes: null };
Object.defineProperty(G, 'dir', { get() { return G.pl ? G.pl.dir : 'down'; }, set(v) { if (G.pl) G.pl.dir = v; } });

function parseMap(id) {
  const m = MAPS[id];
  if (m.grid) return m;
  const W = m.rows[0].length;
  m.id = id; m.w = W; m.h = m.rows.length;
  m.grid = m.rows.map(r => { r = r.slice(0, W); while (r.length < W) r += 'T'; return r.split(''); });
  m.base = m.grid.map((row, y) => row.map((ch, x) => {
    if (OBJS.indexOf(ch) < 0) return null;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const n = (m.grid[y + dy] || [])[x + dx];
      if (n && (SOFT.indexOf(n) >= 0 || 'SFe'.indexOf(n) >= 0) && n !== '~' && n !== 'p') return n;
    }
    return '.';
  }));
  m.npcs = m.npcs || []; m.events = m.events || []; m.exits = m.exits || []; m.chests = m.chests || {};
  for (const n of m.npcs) { n.x0 = n.x; n.y0 = n.y; n.dir0 = n.dir || 'down'; }
  return m;
}
function loadMap(id, tx, ty, dir, px, py) {
  const m = parseMap(id);
  if (!m.canvas) m.canvas = buildMapCanvas(m);
  G.mapId = id; G.map = m;
  G.pl = mkPlayer(px != null ? px : tx * 16 + 8, py != null ? py : ty * 16 + 13, dir || G.dir);
  for (const n of m.npcs) { n.px = n.x0 * 16 + 8; n.py = n.y0 * 16 + 13; n.dir = n.dir0; n.mv = null; n.hidden = false; n.wt = R.f(1, 4); n.af = 0; }
  G.fx = []; G.trail = []; G.trailLast = null; G.hitstop = 0;
  populateMap(m);
  G.yuki = (F('yukiJoined') && !m.noFollower) ? mkYukiF(G.pl.x - DV[G.pl.dir][0] * 14, G.pl.y - DV[G.pl.dir][1] * 14) : null;
  Music.play(m.music); Parts.set(m.parts);
  G.mode = 'map';
  G.banner = { s: m.name, t: 0 };
  G.lastTileKey = Math.floor(G.pl.x / 16) + ',' + Math.floor((G.pl.y - 2) / 16);
  snapCamera();
}
async function warp(id, x, y, dir) {
  Snd.sfx('door');
  await fadeOut(0.3);
  loadMap(id, x, y, dir);
  await fadeIn(0.3);
  if (G.map.onEnter) await G.map.onEnter();
}
async function run(fn) {
  if (G.busy || !fn) return;
  G.busy = true;
  try { await fn(); } catch (e) { console.error(e); }
  finally { G.busy = false; Input.clear(); }
}

const visibleNpc = n => !n.hidden && (!n.cond || n.cond());
function tileAt(x, y) { const m = G.map; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null; return m.grid[y][x]; }
function exitAt(x, y) { return G.map.exits.find(e => x >= e.x && x < e.x + (e.w || 1) && y >= e.y && y < e.y + (e.h || 1)); }
function eventsAt(x, y, type) { return G.map.events.filter(e => e.type === type && x >= e.x && x < e.x + (e.w || 1) && y >= e.y && y < e.y + (e.h || 1) && (!e.cond || e.cond())); }
function boxFree(x, y, hw, top, bot, pl, self) {
  const pts = [[x - hw, y - top], [x + hw, y - top], [x - hw, y + bot], [x + hw, y + bot], [x, y - top], [x, y + bot]];
  for (const [px, py] of pts) {
    const tx = Math.floor(px / 16), ty = Math.floor(py / 16), ch = tileAt(tx, ty);
    if (ch === null || isSolidTile(ch)) return false;
    const ex = exitAt(tx, ty);
    if (ex) { if (!pl) return false; if ((ex.cond && !ex.cond()) || G.inFight) return false; }
  }
  for (const n of G.map.npcs) if (visibleNpc(n) && Math.abs(n.px - x) < (pl ? 10 : 9) && Math.abs(n.py - y) < 7) return false;
  return true;
}

/* ----- NPCs ----- */
function faceTo(n) { n.dir = dirOf(G.pl.x - n.px, G.pl.y - n.py); }
function updateNpcs(dt) {
  for (const n of G.map.npcs) {
    if (!visibleNpc(n)) continue;
    if (n.mv) {
      const dx = n.mv.x - n.px, dy = n.mv.y - n.py, d = Math.hypot(dx, dy), s = (n.mv.speed || 40) * dt;
      n.af += s / 6;
      if (d <= s) { n.px = n.mv.x; n.py = n.mv.y; const r = n.mv.res; n.mv = null; if (r) r(); } else { n.px += dx / d * s; n.py += dy / d * s; n.dir = dirOf(dx, dy); }
      continue;
    }
    if (n.wander && !G.busy && !UI.stack.length) {
      n.wt -= dt;
      if (n.wt <= 0) {
        n.wt = R.f(1.5, 4);
        const d = R.pick(['up', 'down', 'left', 'right']), [dx, dy] = DV[d], nx = n.px + dx * 16, ny = n.py + dy * 16;
        n.dir = d;
        if (Math.abs(nx - (n.x0 * 16 + 8)) <= 32 && Math.abs(ny - (n.y0 * 16 + 13)) <= 32 && Math.hypot(nx - G.pl.x, ny - G.pl.y) > 18) {
          const save = n.hidden; n.hidden = true; const ok = boxFree(nx, ny, 5, 5, 1, false, null); n.hidden = save;
          if (ok) n.mv = { x: nx, y: ny, speed: 30 };
        }
      }
    }
  }
}

/* ----- update ----- */
function checkTileEvents() {
  const p = G.pl, tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 2) / 16), key = tx + ',' + ty;
  if (key === G.lastTileKey) return;
  G.lastTileKey = key;
  const ex = exitAt(tx, ty);
  if (ex && (!ex.cond || ex.cond())) { run(() => warp(ex.to, ex.tx, ex.ty, ex.dir || G.dir)); return; }
  const ev = eventsAt(tx, ty, 'step')[0];
  if (ev) run(ev.run);
}
function mapUpdate(dt) {
  updateNpcs(dt);
  if (UI.stack.length) return;
  updateFx(dt);
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  if (!G.busy || G.inFight || G.pl.state === 'dead') { updatePlayer(dt); updateCombat(dt); }
  else if (G.pl.state !== 'dead') { G.pl.anim = 'idle'; G.pl.state = 'normal'; G.pl.af = 0; }
  if (!G.busy && !G.inFight && G.pl.state !== 'dead') checkTileEvents();
  updateCamera(dt);
}
function camTarget() {
  const m = G.map, p = G.pl;
  let cx = p.x - VW / 2, cy = p.y - 10 - VH / 2;
  cx = m.w * 16 <= VW ? (m.w * 16 - VW) / 2 : clamp(cx, 0, m.w * 16 - VW);
  cy = m.h * 16 <= VH ? (m.h * 16 - VH) / 2 : clamp(cy, 0, m.h * 16 - VH);
  return [cx, cy];
}
function snapCamera() { const [x, y] = camTarget(); G.cam.x = x; G.cam.y = y; }
function updateCamera(dt) { const [x, y] = camTarget(); const k = 1 - Math.pow(0.0001, dt); G.cam.x += (x - G.cam.x) * k; G.cam.y += (y - G.cam.y) * k; }

/* ----- drawing ----- */
function drawMap() {
  const m = G.map;
  const [sx, sy] = Shake.off();
  const cx = Math.round(G.cam.x - sx), cy = Math.round(G.cam.y - sy);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  ctx.drawImage(m.canvas, -cx, -cy);
  const x0 = Math.max(0, Math.floor(cx / 16) - 1), y0 = Math.max(0, Math.floor(cy / 16) - 1);
  const x1 = Math.min(m.w - 1, Math.ceil((cx + VW) / 16) + 1), y1 = Math.min(m.h - 1, Math.ceil((cy + VH) / 16) + 2);
  drawMapAnim(m, cx, cy, x0, y0, x1, y1, G.time);
  drawGroundFx(cx, cy);
  const list = [], lights = [], fr = Math.floor(G.time * 7);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const ch = m.grid[ty][tx];
    if (OBJS.indexOf(ch) >= 0) {
      const v = hash2(tx * 7, ty * 13) * 3 | 0;
      const opened = ch === 'C' && G.flags['chest_' + G.mapId + '_' + tx + '_' + ty];
      const o = objSprite(ch, ch === 'T' || ch === 'h' || ch === 'b' ? v : 0, ch === 't' ? (fr + tx) % 3 : 0, opened);
      const bx = tx * 16 + 8 - cx, by = ty * 16 + 16 - cy;
      list.push({ y: ty * 16 + 15, draw: () => {
        if (ch === 'T' || ch === 'h' || ch === 'P') { const s = shadowImg(20); ctx.drawImage(s, Math.round(bx - 10), Math.round(by - 6)); }
        ctx.drawImage(o.img, Math.round(bx - o.ax), Math.round(by - o.h + (ch === 'T' || ch === 'h' || ch === 'P' ? 1 : 0)));
      } });
    }
    if (m.dark) {
      const fl = 0.92 + Math.sin(G.time * 9 + tx * 3 + ty) * 0.07, lx = tx * 16 + 8 - cx, ly = ty * 16 + 6 - cy;
      if (ch === 't') lights.push({ x: lx, y: ly, r: 82 * fl, a: 1, glow: 'rgba(255,140,50,.24)' });
      else if (ch === 'l') lights.push({ x: lx, y: ly, r: 48, a: 0.75, glow: 'rgba(255,210,120,.18)' });
      else if (ch === 'x' && (tx + ty) % 3 === 0) lights.push({ x: lx, y: ly + 2, r: 42 * fl, a: 0.55, glow: 'rgba(255,80,20,.2)' });
    }
  }
  for (const n of m.npcs) {
    if (!visibleNpc(n)) continue;
    list.push({ y: n.py, draw: () => drawActor(n.spr, n.mv ? 'walk' : 'idle', n.dir || 'down', n.mv ? Math.floor(n.af) % 4 : 0, n.px - cx, n.py - cy) });
  }
  combatDrawables(list, cx, cy);
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();
  drawCombatOverlay(cx, cy);
  Parts.draw(ctx);
  if (m.dark) { lights.push({ x: G.pl.x - cx, y: G.pl.y - cy - 8, r: 78, a: 0.92 }); if (G.yuki) lights.push({ x: G.yuki.x - cx, y: G.yuki.y - cy - 8, r: 40, a: 0.5 }); drawLighting(m.dark, m.darkCol, lights); }
  if (G.pl.blindT > 0) {
    const a = Math.min(1, G.pl.blindT) * 0.9, gx = G.pl.x - cx, gy = G.pl.y - cy - 8;
    const gr = ctx.createRadialGradient(gx, gy, 10, gx, gy, 70); gr.addColorStop(0, 'rgba(10,8,4,0)'); gr.addColorStop(1, 'rgba(10,8,4,' + a + ')');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
  }
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.5, VW / 2, VH / 2, VH * 0.98);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  if (!G.busy || G.inFight) drawHUD();
  if (G.banner && G.banner.t < 3) {
    const a = clamp(Math.min(G.banner.t * 2, (3 - G.banner.t) * 2), 0, 1);
    ctx.globalAlpha = a; ctx.font = font(12, true);
    const w = ctx.measureText(G.banner.s).width + 40;
    ctx.fillStyle = 'rgba(8,8,14,.75)'; ctx.fillRect(VW / 2 - w / 2, 46, w, 24);
    ctx.fillStyle = '#9a2a2a'; ctx.fillRect(VW / 2 - w / 2, 46, w, 1); ctx.fillRect(VW / 2 - w / 2, 69, w, 1);
    text(G.banner.s, VW / 2, 51, { size: 12, bold: true, align: 'center', color: '#efe2c0' });
    ctx.globalAlpha = 1;
  }
  bannerMsgs.forEach((b, i) => {
    const a = clamp(Math.min(b.t * 4, (2.4 - b.t) * 2), 0, 1);
    ctx.globalAlpha = a;
    text(b.s, VW / 2, 80 + i * 16 - Math.min(b.t, 0.25) * 8, { size: 12, bold: true, align: 'center', color: b.col || '#f0e2b0' });
    ctx.globalAlpha = 1;
  });
}
function drawHUD() {
  const p = G.pl;
  drawWin(6, 6, 148, 40, 0.72);
  text('Ren', 13, 10, { size: 10, bold: true, color: '#9fbaf0' });
  text('Lv ' + P.lv + (P.pts ? '  ◆' + P.pts : ''), 40, 10, { size: 9, color: P.pts ? '#f0d070' : '#d8c890' });
  const hpc = P.hp < maxHP() * 0.25 ? (Math.floor(G.time * 4) % 2 ? '#ff5030' : '#c83a2a') : '#d04a36';
  bar(13, 23, 92, 6, P.hp, maxHP(), p.poisonT > 0 ? '#7ab040' : hpc, '#2a1414');
  text(P.hp + '', 108, 20, { size: 9, bold: true });
  bar(13, 32, 92, 4, P.ki, maxKi(), '#4a90e0', '#141c2a');
  text(P.ki + '', 108, 29, { size: 8, color: '#a8c8f0' });
  bar(13, 39, 92, 1, P.xp, xpNext(P.lv), '#d8b050', '#2a2414');
  const tags = []; if (p.poisonT > 0) tags.push(['毒 poison', '#a0e060']); if (p.smokeT > 0) tags.push(['煙 hidden', '#c0c0d0']); if (p.blindT > 0) tags.push(['盲 blind', '#e0d090']);
  tags.forEach((t, i) => text(t[0], 12, 50 + i * 11, { size: 9, color: t[1] }));
  if (G.yuki) { const y = G.yuki; text('Yuki', 12, 50 + tags.length * 11, { size: 9, bold: true, color: '#f09aaa' }); bar(40, 54 + tags.length * 11, 60, 3, y.hp, y.maxhp, y.state === 'down' ? '#6a4a4a' : '#e07a90', '#2a1418'); }
  drawWin(VW - 116, 6, 110, 40, 0.72);
  ctx.drawImage(pickupSprite('coin'), VW - 108, 11);
  text(G.gold + ' mon', VW - 94, 10, { size: 10, color: '#f0d070' });
  const sk = P.active ? SKILLS[P.active] : null;
  text('T', VW - 108, 27, { size: 9, bold: true, color: '#8a7a5a' });
  text(sk ? sk.name : '—', VW - 97, 27, { size: 9, color: sk && P.ki >= sk.ki ? '#ece4d0' : '#8a8070' });
  if (sk) text(sk.ki + '', VW - 14, 27, { size: 9, align: 'right', color: '#8ac0f0' });
  if (G.bossBar && !G.bossBar.dead) {
    const b = G.bossBar;
    drawWin(VW / 2 - 130, VH - 30, 260, 22, 0.8);
    text(b.name, VW / 2 - 122, VH - 26, { size: 9, bold: true, color: '#f0c0a0' });
    bar(VW / 2 - 122, VH - 15, 244, 4, b.hp, b.maxhp, b.enraged ? '#ff4020' : '#c83020', '#2a1010');
  }
}

/* ----- chests, shrines ----- */
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

/* ----- save / load ----- */
const SAVE_KEY = 'kagenuma_save_v2';
function saveGame() {
  const d = { v: 2, P: Object.assign({}, P, { eq: Object.assign({}, P.eq), skills: P.skills.slice() }), inv: G.inv, gold: G.gold, flags: G.flags, mapId: G.mapId, x: G.pl.x, y: G.pl.y, dir: G.dir, playtime: G.playtime, sound: Snd.on };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { toast('Could not save!', '#f08080'); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d) return false;
  newPlayer(); Object.assign(P, d.P);
  G.inv = d.inv || {}; G.gold = d.gold || 0; G.flags = d.flags || {}; G.playtime = d.playtime || 0;
  loadMap(d.mapId, 0, 0, d.dir, d.x, d.y);
  return true;
}
function newGame() { newPlayer(); G.inv = { onigiri: 3 }; G.gold = 30; G.flags = {}; G.playtime = 0; }

/* ----- game over ----- */
async function gameOver() {
  await fadeOut(1.0);
  G.mode = 'black'; Music.play('sorrow'); await fadeIn(0.5);
  await narrate(['Ren has fallen.', 'Somewhere far away, a camellia drops from its branch — whole, and silent.'], {});
  const opts = hasSave() ? ['Load last record', 'Return to title'] : ['Return to title'];
  const c = await ask(null, 'The story is not over yet.', opts);
  try { if (hasSave() && c === 0) sessionStorage.setItem('kagenuma_autoload', '1'); } catch (e) {}
  location.reload();
  await new Promise(() => {});
}

/* ----- title ----- */
const Title = { stars: [] };
for (let i = 0; i < 80; i++) Title.stars.push([Math.random() * VW, Math.random() * 150, Math.random()]);
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#05060e'); g.addColorStop(0.6, '#1c1428'); g.addColorStop(1, '#3e1c20');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (const s of Title.stars) { ctx.fillStyle = 'rgba(255,255,240,' + (0.3 + 0.5 * Math.abs(Math.sin(G.time + s[2] * 9))) + ')'; ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1); }
  ctx.fillStyle = '#efe6cc'; ctx.beginPath(); ctx.arc(370, 70, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c1428'; ctx.beginPath(); ctx.arc(382, 64, 27, 0, Math.PI * 2); ctx.fill();
  const r = seeded(42);
  ctx.fillStyle = '#140e1c'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, 170 - Math.sin(x / 60) * 30 - r() * 12); ctx.lineTo(VW, VH); ctx.fill();
  ctx.fillStyle = '#08060a'; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, 205 - Math.sin(x / 40 + 2) * 14 - r() * 8); ctx.lineTo(VW, VH); ctx.fill();
  ctx.fillStyle = '#08060a'; ctx.fillRect(80, 150, 50, 40); ctx.beginPath(); ctx.moveTo(70, 152); ctx.lineTo(105, 136); ctx.lineTo(140, 152); ctx.fill();
  ctx.fillRect(90, 124, 30, 16); ctx.beginPath(); ctx.moveTo(82, 126); ctx.lineTo(105, 112); ctx.lineTo(128, 126); ctx.fill();
  ctx.drawImage(sprFrame('ren', 'idle', 'right', 0), 290, 146, 80, 80);
  Parts.draw(ctx);
  text('影 沼', VW / 2, 46, { size: 30, align: 'center', color: '#a82828', bold: true });
  text('KAGENUMA', VW / 2, 86, { size: 26, align: 'center', color: '#efe6cc', bold: true });
  text('— Ashes of the Shinobi —', VW / 2, 118, { size: 12, align: 'center', color: '#c8b48a' });
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
    const i = await menu([{ label: 'New Journey' }, { label: 'Continue', disabled: !save }, { label: 'Difficulty', right: G.flags.easy ? 'Easy' : 'Normal' }, { label: 'Sound', right: Snd.on ? 'On' : 'Off' }, { label: 'How to Play' }],
      { x: VW / 2 - 75, y: 148, w: 150, cancel: false, index: save ? 1 : 0 });
    if (i === 0) {
      if (save) { const c = await ask(null, 'Start a new journey? Your recorded progress will be overwritten when you next save.', ['Begin', 'Back']); if (c !== 0) continue; }
      const easy = !!G.flags.easy;
      await fadeOut(1.0); Music.stop(); newGame(); G.flags.easy = easy; G.mode = 'black';
      await run(prologue); return;
    }
    if (i === 1) { await fadeOut(0.6); if (loadGame()) { await fadeIn(0.6); toast('Welcome back.'); return; } }
    if (i === 2) G.flags.easy = !G.flags.easy;
    if (i === 3) Snd.setOn(!Snd.on);
    if (i === 4) await howToPlay();
  }
}
async function howToPlay() {
  await say('Move: arrow keys / WASD, the on-screen stick, or a gamepad. Movement is free in all 8 directions.');
  await say('A (Z / Space): strike with your blade, talk, examine. Press repeatedly for a 3-hit combo. Hold, then release for a spinning slash.');
  await say('B (X / Shift): dodge-roll — you cannot be hurt mid-roll. S (C): throw shuriken (1 Ki). T (V): use your chosen technique. ☰ (Esc / Tab): menu.');
  await say('Watch for tells: enemies flash red before they strike, and gunners show a smoking aim line. Roll away, then punish.');
  await say('Enemies that have not noticed you take double damage — triple from behind. Smoke bombs make them lose you.');
  await say('Defeating foes grants experience. Each level raises your stats and gives 2 training points to spend under Training. Pray at Jizō statues or stay at an inn to recover and save.');
}

/* ----- main loop ----- */
function update(dt) {
  G.time += dt; if (G.mode === 'map') G.playtime += dt;
  Timers.update(dt); Fade.update(dt); Flash.update(dt); Shake.update(dt); Toasts.update(dt); Parts.update(dt);
  if (G.banner) G.banner.t += dt;
  const top = UI.top(); if (top) top.update(dt);
  if (G.mode === 'map') mapUpdate(dt);
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(SCALE, 0, 0, SCALE, OX, OY);
  ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
  if (G.mode === 'map') drawMap();
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
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && d.sound === false) Snd.setOn(false); if (d && d.flags && d.flags.easy) G.flags.easy = true; } catch (e) {}
  requestAnimationFrame(frame);
  let auto = false; try { auto = sessionStorage.getItem('kagenuma_autoload') === '1'; sessionStorage.removeItem('kagenuma_autoload'); } catch (e) {}
  if (auto && loadGame()) { Fade.a = 1; Fade.to(0, 0.8); toast('Your journey continues.'); return; }
  titleScreen();
}
window.G = G;
boot();
