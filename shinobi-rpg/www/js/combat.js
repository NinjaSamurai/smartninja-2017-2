'use strict';
/* ===== Real-time action combat: player controller, enemies, projectiles, companion ===== */
const SPEED = 90;
const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mkPlayer(x, y, dir) {
  return { x, y, dir: dir || 'down', anim: 'idle', af: 0, state: 'normal', t: 0, inv: 0, kbx: 0, kby: 0, z: 0, combo: 0, comboT: 0, queued: false, hits: null,
    charge: 0, charged: false, flash: 0, pushT: 0, smokeT: 0, blindT: 0, poisonT: 0, poisonTick: 0, kiT: 0, hw: 5, top: 6, bot: 1, idleT: 0, castT: 0 };
}

/* ---------- small helpers ---------- */
const SHADOW = {};
function shadowImg(w) {
  if (SHADOW[w]) return SHADOW[w];
  const h = Math.max(3, Math.round(w * 0.36)), c = mkCanvas(w, h), g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2); if (dx * dx + dy * dy <= 1) { g.fillStyle = 'rgba(0,0,0,' + (dx * dx + dy * dy < 0.45 ? 0.32 : 0.2) + ')'; g.fillRect(x, y, 1, 1); } }
  return (SHADOW[w] = c);
}
function drawActor(key, anim, dir, f, sx, sy, o = {}) {
  const sc = o.scale || 1;
  const sh = shadowImg(Math.round(12 * sc));
  ctx.drawImage(sh, Math.round(sx - sh.width / 2), Math.round(sy - sh.height / 2));
  const img = o.tint ? sprTint(key, anim, dir, f, o.tint) : sprFrame(key, anim, dir, f);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(sx - ANCHOR_X * sc), Math.round(sy - ANCHOR_Y * sc - (o.z || 0)), 40 * sc, 40 * sc);
  ctx.globalAlpha = 1;
}
function fxAdd(type, o) { G.fx.push(Object.assign({ type, t: 0, life: 0.3 }, o)); }
function num(x, y, s, col, big) { G.fx.push({ type: 'num', x: x + R.f(-4, 4), y, s: String(s), col, big, t: 0, life: 0.9 }); }
function puff(x, y, n = 8, col) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = R.f(10, 40); G.fx.push({ type: 'puff', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, r: R.f(2, 5), col: col || '#c8c8d0', t: 0, life: R.f(0.4, 0.8) }); } }
const bannerMsgs = [];
function banner(s, col) { bannerMsgs.push({ s, col, t: 0 }); if (bannerMsgs.length > 3) bannerMsgs.shift(); }

/* ---------- collision ---------- */
function substepMove(e, dx, dy, pl) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  let bx = false, by = false;
  for (let i = 0; i < n; i++) {
    if (dx) { const nx = e.x + dx / n; if (boxFree(nx, e.y, e.hw || 5, e.top || 6, e.bot || 1, pl, e)) e.x = nx; else bx = true; }
    if (dy) { const ny = e.y + dy / n; if (boxFree(e.x, ny, e.hw || 5, e.top || 6, e.bot || 1, pl, e)) e.y = ny; else by = true; }
  }
  return [bx, by];
}
function losClear(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y - 8 + (b.y - a.y) * i / n; const ch = tileAt(Math.floor(x / 16), Math.floor(y / 16)); if (ch && OPAQUE.indexOf(ch) >= 0) return false; }
  return true;
}

/* ---------- player ---------- */
function faceFromAxis(p, ax, ay) {
  const hx = ax > 0.35 ? 'right' : ax < -0.35 ? 'left' : null, vy = ay > 0.35 ? 'down' : ay < -0.35 ? 'up' : null;
  if (hx && vy) { if (p.dir !== hx && p.dir !== vy) p.dir = Math.abs(ax) > Math.abs(ay) ? hx : vy; }
  else if (hx) p.dir = hx; else if (vy) p.dir = vy;
}
function worldInput() { return G.mode === 'map' && !UI.stack.length && (!G.busy || G.inFight) && G.pl.state !== 'dead'; }

function updatePlayer(dt) {
  const p = G.pl;
  p.inv = Math.max(0, p.inv - dt); p.flash = Math.max(0, p.flash - dt); p.comboT += dt;
  p.smokeT = Math.max(0, p.smokeT - dt); p.blindT = Math.max(0, p.blindT - dt);
  if (p.poisonT > 0) { p.poisonT -= dt; p.poisonTick += dt; if (p.poisonTick >= 1) { p.poisonTick = 0; const d = Math.max(1, Math.round(maxHP() * 0.025)); if (P.hp > 1) { P.hp = Math.max(1, P.hp - d); num(p.x, p.y - 26, d, '#a0e060'); } } }
  p.kiT += dt; if (p.kiT >= 1.8) { p.kiT = 0; P.ki = Math.min(maxKi(), P.ki + 1); }
  if (Math.abs(p.kbx) + Math.abs(p.kby) > 1) { substepMove(p, p.kbx * dt, p.kby * dt, true); const k = Math.pow(0.0006, dt); p.kbx *= k; p.kby *= k; } else p.kbx = p.kby = 0;
  const can = worldInput();
  p.t += dt;
  switch (p.state) {
    case 'dead':
      p.anim = 'dead';
      if (p.t > 1.8 && !p.goneOver) { p.goneOver = true; run(gameOver); }
      return;
    case 'hurt': p.anim = 'hurt'; if (p.t > 0.22) p.state = 'normal'; return;
    case 'roll': {
      p.anim = 'roll'; p.af = Math.floor(p.t * 14) % 3;
      const [dx, dy] = p.rollV, sp = 200 * (1 - p.t / 0.36 * 0.5);
      substepMove(p, dx * sp * dt, dy * sp * dt, true);
      if (Math.random() < 0.5) G.fx.push({ type: 'puff', x: p.x + R.f(-3, 3), y: p.y, vx: 0, vy: -8, r: 2, col: '#b8a888', t: 0, life: 0.35 });
      if (p.t > 0.36) { p.state = 'normal'; p.af = 0; }
      return;
    }
    case 'dash': {
      p.anim = 'atk'; p.af = 1;
      const [dx, dy] = DV[p.dir];
      const [bx, by] = substepMove(p, dx * 430 * dt, dy * 430 * dt, true);
      G.fx.push({ type: 'ghost', x: p.x, y: p.y, dir: p.dir, t: 0, life: 0.25 });
      for (const e of G.ents) if (!e.dead && !p.hits.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < 18 + e.rad) { p.hits.add(e); damageEnemy(e, 1.9, { critBonus: 0.3, heavy: true }); }
      if (p.t > 0.17 || bx || by) { p.state = 'attack'; p.t = 0.17; p.combo = 3; }
      return;
    }
    case 'cast':
      p.anim = 'cast'; p.af = 0;
      if (p.t > 0.7) { p.state = 'normal'; const h = Math.round(maxHP() * 0.35); P.hp = Math.min(maxHP(), P.hp + h); num(p.x, p.y - 28, '+' + h, '#8af08a'); Snd.sfx('heal'); fxAdd('heal', { x: p.x, y: p.y, life: 0.8 }); }
      return;
    case 'spin': {
      p.anim = 'atk'; p.af = 1; p.dir = ['down', 'left', 'up', 'right'][Math.floor(p.t * 16) % 4];
      for (const e of G.ents) if (!e.dead && !p.hits.has(e) && Math.hypot(e.x - p.x, (e.y - 6) - (p.y - 6)) < 34 + e.rad) { p.hits.add(e); damageEnemy(e, p.spinMult || 1.6, { heavy: true }); }
      deflect(p, 36, null);
      if (p.t > 0.36) { p.state = 'normal'; p.dir = p.spinDir; }
      return;
    }
    case 'attack': {
      p.anim = 'atk';
      const T1 = 0.06, T2 = 0.16, T3 = 0.28;
      p.af = p.t < T1 ? 0 : p.t < T2 ? 1 : 2;
      if (p.t >= T1 && !p.swung) { p.swung = true; Snd.sfx('swing'); fxAdd('slash', { x: p.x, y: p.y - 9, dir: p.dir, life: 0.18, big: p.combo === 3 }); const [dx, dy] = DV[p.dir]; substepMove(p, dx * (p.combo === 3 ? 7 : 3), dy * (p.combo === 3 ? 7 : 3), true); }
      if (p.t >= T1 && p.t < T2 + 0.02) {
        const reach = p.combo === 3 ? 28 : 23;
        for (const e of G.ents) if (!e.dead && !p.hits.has(e) && inArc(p.x, p.y - 9, p.dir, e.x, e.y - 8 * (e.scale || 1), reach + e.rad, 1.25)) { p.hits.add(e); damageEnemy(e, p.combo === 3 ? 1.4 : 1, { melee: true }); }
        deflect(p, reach + 4, p.dir);
      }
      if (can && p.t > 0.08 && Input.take('ok')) p.queued = true;
      if (p.t >= T3) {
        if (p.queued && p.combo < 3) startAttack(p, p.combo + 1);
        else if (p.combo === 3 && p.t < T3 + 0.22) { p.af = 2; }
        else { p.state = 'normal'; p.comboT = p.combo === 3 ? 1 : 0; p.charge = Input.held.ok ? 0.0001 : 0; }
      }
      return;
    }
  }
  // normal
  if (p.charge > 0) {
    if (Input.held.ok) { p.charge += dt; if (p.charge > 0.7 && !p.charged) { p.charged = true; Snd.sfx('charge'); } }
    else { if (p.charged && can) startSpin(p, 1.6); p.charge = 0; p.charged = false; }
  }
  let [ax, ay] = can ? Input.axis() : [0, 0];
  const mag = Math.hypot(ax, ay);
  if (mag > 0.12) {
    faceFromAxis(p, ax, ay);
    const sp = SPEED * Math.min(1, mag * 1.15) * (p.charge > 0 ? 0.55 : 1) * (p.smokeT > 0 ? 1.1 : 1);
    const dx = ax / Math.max(1, mag) * sp * dt, dy = ay / Math.max(1, mag) * sp * dt;
    const ox = p.x, oy = p.y;
    const [bx, by] = substepMove(p, dx, dy, true);
    // corner sliding (ALttP-style nudge)
    if (bx && Math.abs(ay) < 0.3) nudge(p, Math.sign(dx), 0, sp * dt);
    if (by && Math.abs(ax) < 0.3) nudge(p, 0, Math.sign(dy), sp * dt);
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.af += moved / 6.5; p.anim = moved > 0.05 ? 'walk' : 'idle';
    if (moved > 0.05) { G.stepAcc = (G.stepAcc || 0) + moved; if (G.stepAcc > 22) { G.stepAcc = 0; Snd.sfx('step'); } }
    // pushing into doors / blocked exits
    if ((bx || by) && can && !G.inFight) pushInto(p, dt); else p.pushT = 0;
  } else { p.anim = 'idle'; p.idleT += dt; p.af = Math.floor(p.idleT / 0.7) % 2; p.pushT = 0; }
  if (!can) return;
  if (Input.take('ok')) { if (G.inFight || !tryInteract()) startAttack(p, p.comboT < 0.35 && p.combo < 3 ? p.combo + 1 : 1); return; }
  if (Input.take('cancel')) { startRoll(p, ax, ay, mag); return; }
  if (Input.take('shuriken')) { throwShuriken(p); return; }
  if (Input.take('tech')) { useTech(p); return; }
  if (Input.take('menu')) { run(openMenu); return; }
}
function nudge(p, sx, sy, amt) {
  for (let k = 1; k <= 8; k++) {
    if (sx) { if (boxFree(p.x + sx * 2, p.y - k, p.hw, p.top, p.bot, true, p)) { substepMove(p, 0, -Math.min(k, amt), true); return; } if (boxFree(p.x + sx * 2, p.y + k, p.hw, p.top, p.bot, true, p)) { substepMove(p, 0, Math.min(k, amt), true); return; } }
    if (sy) { if (boxFree(p.x - k, p.y + sy * 2, p.hw, p.top, p.bot, true, p)) { substepMove(p, -Math.min(k, amt), 0, true); return; } if (boxFree(p.x + k, p.y + sy * 2, p.hw, p.top, p.bot, true, p)) { substepMove(p, Math.min(k, amt), 0, true); return; } }
  }
}
function inArc(ox, oy, dir, tx, ty, r, halfAng) {
  const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy);
  if (d > r) return false; if (d < 8) return true;
  const [fx, fy] = DV[dir]; return (dx * fx + dy * fy) / d > Math.cos(halfAng);
}
function startAttack(p, combo) {
  p.state = 'attack'; p.t = 0; p.combo = combo; p.queued = false; p.swung = false; p.hits = new Set(); p.charge = 0; p.charged = false;
}
function startSpin(p, mult) { p.state = 'spin'; p.t = 0; p.hits = new Set(); p.spinMult = mult; p.spinDir = p.dir; Snd.sfx('spin'); fxAdd('spin', { x: p.x, y: p.y - 8, life: 0.36 }); }
function startRoll(p, ax, ay, mag) {
  let v = mag > 0.2 ? [ax / mag, ay / mag] : DV[p.dir];
  p.state = 'roll'; p.t = 0; p.rollV = v; p.inv = Math.max(p.inv, 0.3); Snd.sfx('roll');
  if (mag > 0.2) faceFromAxis(p, ax, ay);
}
function deflect(p, r, dir) {
  for (const pr of G.proj) if (pr.owner === 'enemy' && !pr.dead && (dir ? inArc(p.x, p.y - 9, dir, pr.x, pr.y, r, 1.3) : Math.hypot(pr.x - p.x, pr.y - p.y + 8) < r)) {
    pr.dead = true; Snd.sfx('block'); fxAdd('spark', { x: pr.x, y: pr.y, life: 0.25 });
  }
}
function throwShuriken(p) {
  if (P.ki < 1) { Snd.sfx('buzz'); num(p.x, p.y - 30, 'No Ki', '#8ab0e0'); return; }
  P.ki -= 1; Snd.sfx('throw');
  const [dx, dy] = DV[p.dir];
  G.proj.push({ x: p.x + dx * 6, y: p.y - 9 + dy * 4, vx: dx * 260, vy: dy * 260, owner: 'player', kind: 'star', mult: 0.6, life: 0.9, t: 0 });
  p.state = 'attack'; p.t = 0.16; p.combo = 1; p.swung = true; p.hits = new Set(); p.queued = false;
}
function tryInteract() {
  const p = G.pl, [dx, dy] = DV[p.dir];
  const qx = p.x + dx * 13, qy = p.y - 4 + dy * 12;
  const n = (G.map.npcs || []).find(n => visibleNpc(n) && Math.hypot(n.px - qx, n.py - 4 - qy) < 12);
  if (n) { if (n.talk) { faceTo(n); run(n.talk); return true; } return false; }
  const tx = Math.floor(qx / 16), ty = Math.floor(qy / 16);
  const ev = eventsAt(tx, ty, 'touch')[0] || eventsAt(tx, ty, 'door')[0];
  if (ev) { run(ev.run); return true; }
  const ch = tileAt(tx, ty);
  const chest = G.map.chests[tx + ',' + ty];
  if (ch === 'C' && chest) { run(() => openChest(tx, ty, chest)); return true; }
  if (ch === 'j') { run(shrine); return true; }
  if (G.map.touchTiles && G.map.touchTiles[ch]) { run(G.map.touchTiles[ch]); return true; }
  const generic = { g: 'A weathered gravestone. The name has worn away.', l: 'A stone lantern. A candle flickers inside.', t: 'A brazier of burning pine. The heat stings your face.', W: 'The waterfall roars. Cold spray beads on your skin.', I: 'A vermilion torii gate, marking sacred ground.' };
  if (generic[ch]) { run(() => say(generic[ch])); return true; }
  return false;
}
function pushInto(p, dt) {
  const [dx, dy] = DV[p.dir];
  const tx = Math.floor((p.x + dx * 8) / 16), ty = Math.floor((p.y - 3 + dy * 8) / 16);
  const door = eventsAt(tx, ty, 'door')[0];
  const ex = exitAt(tx, ty);
  if (door || (ex && ex.cond && !ex.cond())) {
    p.pushT += dt;
    if (p.pushT > 0.12) { p.pushT = -0.6; if (door) run(door.run); else run(ex.blocked); }
  }
}

/* ---------- techniques ---------- */
function useTech(p) {
  const id = P.active;
  if (!id) { toast('No technique set — choose one under Techniques.'); return; }
  const sk = SKILLS[id];
  if (P.ki < sk.ki) { Snd.sfx('buzz'); num(p.x, p.y - 30, 'Not enough Ki', '#8ab0e0'); return; }
  P.ki -= sk.ki;
  const [dx, dy] = DV[p.dir];
  switch (id) {
    case 'breath': p.state = 'cast'; p.t = 0; break;
    case 'smoke':
      Snd.sfx('smoke'); puff(p.x, p.y - 8, 26, '#b4b4bc'); p.smokeT = 4.5;
      for (const e of G.ents) if (!e.dead && e.state !== 'idle') { e.state = 'search'; e.t = 0; e.lastSeen = { x: p.x + R.f(-40, 40), y: p.y + R.f(-40, 40) }; e.move = null; }
      banner('You vanish into the smoke.'); break;
    case 'blind':
      Snd.sfx('smoke'); for (let i = 0; i < 14; i++) { const a = Math.atan2(dy, dx) + R.f(-0.6, 0.6), sp = R.f(40, 110); G.fx.push({ type: 'puff', x: p.x, y: p.y - 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R.f(2, 4), col: '#c8b490', t: 0, life: 0.6 }); }
      for (const e of G.ents) if (!e.dead && inArc(p.x, p.y - 9, p.dir, e.x, e.y - 8, 60 + e.rad, 0.7)) { e.st.blind = e.boss ? 2.5 : 5; e.state = 'blind'; e.t = 0; e.move = null; num(e.x, e.y - 30, 'Blinded', '#e0d090'); }
      break;
    case 'iai': p.state = 'dash'; p.t = 0; p.inv = 0.3; p.hits = new Set(); Snd.sfx('slash'); Flash.go('#ffffff', 0.25); break;
    case 'needle': Snd.sfx('throw'); G.proj.push({ x: p.x + dx * 6, y: p.y - 9, vx: dx * 340, vy: dy * 340, owner: 'player', kind: 'needle', mult: 0.6, poison: true, life: 0.8, t: 0 }); break;
    case 'mist': startSpin(p, 1.3); p.inv = 0.4; fxAdd('mist', { x: p.x, y: p.y - 8, life: 0.4 }); break;
    case 'stitch': Snd.sfx('throw'); G.proj.push({ x: p.x + dx * 6, y: p.y - 9, vx: dx * 300, vy: dy * 300, owner: 'player', kind: 'kunai', mult: 1.2, stun: true, life: 0.9, t: 0 }); break;
    case 'camellia': {
      const together = G.yuki && G.yuki.state !== 'down';
      Flash.go('#c02030', 0.7); Shake.go(0.4, 3); Snd.sfx('crit'); G.hitstop = 0.35;
      banner(together ? 'Ren and Yuki strike as one — Tsubaki-otoshi!' : 'Tsubaki-otoshi!', '#f0a0b0');
      for (let i = 0; i < 40; i++) G.fx.push({ type: 'petal', x: R.f(0, VW) + G.cam.x, y: R.f(-20, VH) + G.cam.y, vx: R.f(-20, 20), vy: R.f(30, 70), t: 0, life: R.f(1, 2) });
      for (const e of G.ents) if (!e.dead && Math.abs(e.x - p.x) < VW / 2 + 20 && Math.abs(e.y - p.y) < VH / 2 + 20) damageEnemy(e, together ? 3.6 : 3.0, { heavy: true, critBonus: 0.15, noBlock: true });
      break;
    }
  }
}

/* ---------- enemies ---------- */
function spawnEnemy(id, x, y, o = {}) {
  const d = ENEMIES[id];
  const hpS = Math.round(d.hp * (d.boss ? 4 : 2.2) * (G.flags.easy ? 0.75 : 1));
  const e = Object.assign({}, d, { id, x, y, maxhp: hpS, hp: hpS, st: {}, dir: 'down', state: 'idle', t: 0, cool: R.f(0.4, 1.2), af: 0, flash: 0, inv: 0, kbx: 0, kby: 0, z: 0,
    home: [x, y], wt: R.f(0, 2), alpha: 1, poiseT: 0, fight: !!o.fight, hw: 5, top: 5, bot: 1 });
  e.scale = d.scale || 1; e.rad = 7 * e.scale; e.reach = (d.reach || 20); e.sight = d.beast ? 130 : 115;
  if (e.scale > 1) { e.hw = 8; e.top = 8; }
  G.ents.push(e);
  return e;
}
function alertEnemy(e, spread = true) {
  if (e.dead || e.state === 'blind') return;
  if (e.state === 'idle' || e.state === 'search') {
    e.state = 'alert'; e.t = 0; Snd.sfx('alert');
    if (spread) for (const o of G.ents) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 90) alertEnemy(o, false);
  }
}
function targetFor(e) {
  const p = G.pl, y = G.yuki;
  if (y && y.state !== 'down' && Math.hypot(y.x - e.x, y.y - e.y) < Math.hypot(p.x - e.x, p.y - e.y) * 0.7) return y;
  return p;
}
function perceive(e) {
  const p = G.pl;
  if (p.smokeT > 0 || p.state === 'dead') return false;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
  if (d < 24) return true;
  if (d > e.sight) return false;
  const [fx, fy] = DV[e.dir];
  if ((dx * fx + dy * fy) / d < 0.15) return false;
  return losClear(e, p);
}
function damageEnemy(e, mult, o = {}) {
  if (e.dead) return false;
  const p = G.pl;
  if (e.st.guard > 0 && !o.noBlock) {
    const fx = DV[e.dir][0], fy = DV[e.dir][1];
    if ((p.x - e.x) * fx + (p.y - e.y) * fy > 0) { Snd.sfx('block'); fxAdd('spark', { x: (e.x + p.x) / 2, y: e.y - 10, life: 0.25 }); num(e.x, e.y - 26, 'Blocked', '#a0c8f0'); p.kbx -= fx * -80; p.kby -= fy * -80; mult *= 0.15; }
  }
  if (e.dodge && !e.fight && e.state !== 'idle' && Math.random() < e.dodge && o.melee) { startVanish(e, true); return false; }
  const atk = o.atk || pAtk();
  let m = mult;
  const unaware = (e.state === 'idle' || e.state === 'search' || e.state === 'blind') && !e.boss;
  let stealth = false;
  if (unaware && (o.melee || o.proj)) { const fx = DV[e.dir][0], fy = DV[e.dir][1]; const behind = ((p.x - e.x) * fx + (p.y - e.y) * fy) < 0; m *= behind ? 3 : 2; stealth = true; }
  let dmg = Math.max(1 + atk * 0.15, atk * 2 * m - e.def) * R.f(0.9, 1.1);
  let crit = false;
  if (!o.yuki && Math.random() < pCrit() / 100 + (o.critBonus || 0)) { crit = true; dmg *= 1.6; }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = 0.14;
  num(e.x, e.y - 18 * e.scale - 6, dmg, crit ? '#ffd040' : stealth ? '#c0a0ff' : '#ffffff', crit || stealth);
  fxAdd('spark', { x: e.x + R.f(-3, 3), y: e.y - 8 * e.scale + R.f(-3, 3), life: 0.22 });
  Snd.sfx(crit ? 'crit' : 'hit');
  if (stealth && e.hp <= 0) banner('Silent kill', '#c0a0ff');
  const sx = e.x - (o.fromX != null ? o.fromX : p.x), sy = e.y - (o.fromY != null ? o.fromY : p.y), sd = Math.hypot(sx, sy) || 1;
  const kb = e.boss ? 40 : 150;
  e.kbx = sx / sd * kb; e.kby = sy / sd * kb;
  const canStagger = e.boss ? (o.heavy && Math.random() < 0.3) : (e.poiseT <= 0 && (!e.tough || o.heavy) && e.state !== 'act');
  if (canStagger) { if (e.state !== 'blind') { e.state = 'hurt'; e.t = 0; e.move = null; e.aim = null; e.poiseT = e.tough ? 1.6 : 1.1; } }
  else { e.kbx *= 0.25; e.kby *= 0.25; alertEnemy(e); }
  if (e.state !== 'hurt' && e.state !== 'blind') alertEnemy(e);
  if (o.melee && !o.yuki) P.ki = Math.min(maxKi(), P.ki + 1);
  if (e.boss) {
    e.hitCount = (e.hitCount || 0) + 1; e.hitDecay = 1.4;
    if (e.hitCount >= 4 && (e.state === 'chase' || e.state === 'rec' || e.state === 'hurt') && e.hp > 0) {
      e.hitCount = 0; const cm = e.moves.some(m => m[0] === 'vanish') && Math.random() < 0.5 ? 'vanish' : 'spin';
      beginMove(e, cm, targetFor(e)); if (e.state === 'wind') e.windT = 0.32;
    }
  }
  G.hitstop = Math.max(G.hitstop, crit ? 0.07 : 0.04);
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e) {
  e.dead = true; e.t = 0; e.hp = 0; e.move = null; e.aim = null;
  Snd.sfx('die'); puff(e.x, e.y - 8, 10);
  if (e.xp) gainXP(e.xp, async (t) => banner(t, '#f0d070'));
  let mon = e.mon;
  while (mon > 0) { const v = Math.min(mon, mon > 40 ? 20 : mon > 10 ? 5 : mon); mon -= v; G.picks.push({ kind: 'coin', val: v, x: e.x + R.f(-8, 8), y: e.y + R.f(-6, 6), z: 6, vz: R.f(40, 80), t: 0 }); if (G.picks.length > 60) break; }
  if (!e.boss && Math.random() < 0.18) G.picks.push({ kind: 'heal', val: 0, x: e.x, y: e.y, z: 6, vz: 70, t: 0 });
  else if (!e.boss && Math.random() < 0.2) G.picks.push({ kind: 'ki', val: 0, x: e.x, y: e.y, z: 6, vz: 70, t: 0 });
  if (e.drop && Math.random() < e.drop[1]) { give(e.drop[0], 1, true); toast('Found ' + ITEMS[e.drop[0]].name); }
}
function hurtTarget(e, t, mult, o = {}) {
  if (t === G.yuki) return hurtYuki(e, mult);
  const p = G.pl;
  if (p.state === 'dead' || p.inv > 0) return false;
  if (p.smokeT > 0 && Math.random() < 0.6) { num(p.x, p.y - 28, 'miss', '#a0a0b0'); return false; }
  const atk = e.atk * (e.enraged ? 1.15 : 1);
  let dmg = Math.max(1 + atk * 0.15, atk * 2 * mult - pDef()) * R.f(0.9, 1.1) * (G.flags.easy ? 0.6 : 1);
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg; num(p.x, p.y - 28, dmg, '#ff8070', dmg > maxHP() * 0.25);
  p.inv = 1.0; p.flash = 1.0;
  const sx = p.x - (o.fromX != null ? o.fromX : e.x), sy = p.y - (o.fromY != null ? o.fromY : e.y), sd = Math.hypot(sx, sy) || 1;
  p.kbx = sx / sd * 170; p.kby = sy / sd * 170;
  if (p.state !== 'roll') { p.state = 'hurt'; p.t = 0; p.charge = 0; p.charged = false; }
  Shake.go(0.2, 3); Flash.go('#a01010', 0.2); Snd.sfx('hurt'); G.hitstop = Math.max(G.hitstop, 0.05);
  if (e.poison && Math.random() < e.poison && p.poisonT <= 0) { p.poisonT = 6; banner('Poisoned!', '#a0e060'); Snd.sfx('poison'); }
  if (P.hp <= 0) { P.hp = 0; p.state = 'dead'; p.t = 0; Music.stop(); Snd.sfx('die'); banner('Ren has fallen', '#e06060'); }
  return true;
}

function canStand(x, y, e) { return boxFree(x, y, e.hw, e.top, e.bot, false, e); }
function steer(e, tx, ty, sp, dt, away) {
  let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d; if (away) { dx = -dx; dy = -dy; }
  for (const a of [0, 0.7, -0.7, 1.4, -1.4]) {
    const c = Math.cos(a), s = Math.sin(a), vx = dx * c - dy * s, vy = dx * s + dy * c;
    if (canStand(e.x + vx * 6, e.y + vy * 6, e)) { substepMove(e, vx * sp * dt, vy * sp * dt, false); return [vx, vy]; }
  }
  return [0, 0];
}
function pickMove(e, d) {
  const ok = e.moves.filter(([m]) => {
    switch (m) {
      case 'slash': case 'heavy': return d < e.reach * e.scale + 14;
      case 'thrust': return d < 42;
      case 'pounce': return d > 16 && d < 80;
      case 'charge': return d > 30 && d < 150;
      case 'shoot': return d > 40 && d < 190;
      case 'throw': case 'fan': return d > 30 && d < 160;
      case 'radial': return d < 140;
      case 'vanish': return d > 40;
      case 'leap': return d > 40 && d < 150;
      case 'spin': return d < 44 * e.scale;
      case 'guard': return d < 70 && !(e.st.guard > 0);
      case 'powder': return d < 55;
    }
    return false;
  });
  return ok.length ? weighted(ok) : null;
}
function weighted(list) { const tot = list.reduce((s, x) => s + x[1], 0); let r = Math.random() * tot; for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list[0][0]; }
const MOVE_WIND = { slash: 0, heavy: 0.2, thrust: 0.05, pounce: -0.1, charge: 0.15, shoot: 0.65, throw: -0.12, fan: 0, radial: 0.25, vanish: -0.3, leap: 0.05, spin: 0.15, guard: -1, powder: -0.05 };
function startVanish(e, dodge) {
  const t = targetFor(e), [fx, fy] = DV[t.dir || 'down'];
  puff(e.x, e.y - 8, 10, '#707080'); Snd.sfx('smoke');
  const cand = [[-fx * 22, -fy * 22], [fy * 22, fx * 22], [-fy * 22, -fx * 22], [fx * 26, fy * 26]];
  for (const [ox, oy] of cand) if (canStand(t.x + ox, t.y + oy, e)) { e.x = t.x + ox; e.y = t.y + oy; break; }
  puff(e.x, e.y - 8, 8, '#707080');
  e.dir = dirOf(t.x - e.x, t.y - e.y);
  e.state = 'wind'; e.move = 'slash'; e.t = 0; e.windT = dodge ? 0.3 : 0.26;
}
function beginMove(e, m, t) {
  e.move = m; e.state = 'wind'; e.t = 0; e.tgt = t; e.hitDone = false;
  e.windT = Math.max(0.12, (e.wind || 0.45) + (MOVE_WIND[m] || 0)) * (e.enraged ? 0.82 : 1);
  if (m === 'guard') { e.st.guard = 1.8; e.state = 'chase'; e.cool = 0.2; Snd.sfx('block'); return; }
  if (m === 'vanish') { startVanish(e); return; }
  e.dir = dirOf(t.x - e.x, t.y - e.y);
  if (m === 'leap') e.leapTo = { x: t.x, y: t.y };
  if (m === 'shoot') e.aim = { x: t.x, y: t.y - 8 };
}
function enemyAct(e, dt) {
  const t = e.tgt || G.pl, m = e.move;
  const [fx, fy] = DV[e.dir];
  const ex = e.x, ey = e.y - 8 * e.scale;
  if (!e.hitDone) {
    e.hitDone = true;
    switch (m) {
      case 'slash': case 'heavy': {
        Snd.sfx('swing'); fxAdd('slash', { x: ex, y: ey, dir: e.dir, life: 0.18, big: e.scale > 1, enemy: true });
        substepMove(e, fx * 5, fy * 5, false);
        for (const tg of targetsOf()) if (inArc(ex, ey, e.dir, tg.x, tg.y - 8, e.reach * e.scale + 8, 1.2)) hurtTarget(e, tg, m === 'heavy' ? 1.5 : 1);
        e.actT = 0.16; e.recT = m === 'heavy' ? 0.65 : 0.45; break;
      }
      case 'thrust': {
        Snd.sfx('swing'); fxAdd('thrust', { x: ex, y: ey, dir: e.dir, life: 0.16 });
        for (const tg of targetsOf()) { const dx = tg.x - ex, dy = tg.y - 8 - ey, along = dx * fx + dy * fy, perp = Math.abs(dx * fy - dy * fx); if (along > -4 && along < 40 && perp < 9) hurtTarget(e, tg, 1.3); }
        e.actT = 0.16; e.recT = 0.55; break;
      }
      case 'pounce': { const d = Math.hypot(t.x - e.x, t.y - e.y) || 1; e.lv = [(t.x - e.x) / d, (t.y - e.y) / d]; e.dir = dirOf(e.lv[0], e.lv[1]); e.actT = 0.32; e.recT = 0.5; Snd.sfx('swing'); break; }
      case 'charge': { const d = Math.hypot(t.x - e.x, t.y - e.y) || 1; e.lv = [(t.x - e.x) / d, (t.y - e.y) / d]; e.actT = 1.3; e.recT = 0.4; break; }
      case 'shoot': {
        Snd.sfx('gun'); Flash.go('#fff4d0', 0.35);
        const a = e.aim || { x: t.x, y: t.y - 8 }, d = Math.hypot(a.x - ex, a.y - ey) || 1;
        G.proj.push({ x: ex + fx * 10, y: ey, vx: (a.x - ex) / d * 400, vy: (a.y - ey) / d * 400, owner: 'enemy', kind: 'bullet', mult: 2.0, life: 1, t: 0, src: e });
        puff(ex + fx * 12, ey, 6, '#d8d0c0'); e.aim = null; e.actT = 0.1; e.recT = 1.5; break;
      }
      case 'throw': case 'fan': {
        Snd.sfx('throw');
        const a0 = Math.atan2(t.y - 8 - ey, t.x - ex), angs = m === 'fan' ? [-0.3, 0, 0.3] : [0];
        for (const da of angs) G.proj.push({ x: ex, y: ey, vx: Math.cos(a0 + da) * 220, vy: Math.sin(a0 + da) * 220, owner: 'enemy', kind: 'star', mult: 0.6, life: 1.2, t: 0, src: e, poison: e.poison });
        e.actT = 0.1; e.recT = 0.4; break;
      }
      case 'radial': {
        Snd.sfx('throw'); const n = e.enraged ? 16 : 12, off = Math.random();
        for (let i = 0; i < n; i++) { const a = (i + off) / n * Math.PI * 2; G.proj.push({ x: ex, y: ey, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, owner: 'enemy', kind: 'dart', mult: 0.55, life: 1.6, t: 0, src: e }); }
        e.actT = 0.1; e.recT = 0.6; break;
      }
      case 'leap': e.actT = 0.55; e.recT = 0.6; e.leapFrom = { x: e.x, y: e.y }; Snd.sfx('roll'); break;
      case 'spin': {
        Snd.sfx('spin'); fxAdd('spin', { x: ex, y: ey, life: 0.3, big: e.scale > 1 });
        for (const tg of targetsOf()) if (Math.hypot(tg.x - e.x, tg.y - e.y) < 42 * e.scale) hurtTarget(e, tg, 1.2);
        e.actT = 0.3; e.recT = 0.6; break;
      }
      case 'powder': {
        Snd.sfx('smoke');
        for (let i = 0; i < 12; i++) { const a = Math.atan2(fy, fx) + R.f(-0.6, 0.6), sp = R.f(40, 100); G.fx.push({ type: 'puff', x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: R.f(2, 4), col: '#c8b490', t: 0, life: 0.6 }); }
        const p = G.pl; if (inArc(ex, ey, e.dir, p.x, p.y - 8, 56, 0.7) && p.inv <= 0 && p.smokeT <= 0) { p.blindT = 3; banner('Blinded!', '#e0d090'); }
        e.actT = 0.1; e.recT = 0.4; break;
      }
    }
  }
  // continuous parts
  if (m === 'pounce') {
    const k = e.t / e.actT; e.z = Math.sin(Math.min(1, k) * Math.PI) * 9;
    substepMove(e, e.lv[0] * 210 * dt, e.lv[1] * 210 * dt, false);
    for (const tg of targetsOf()) if (!e.hit2 && Math.hypot(tg.x - e.x, tg.y - e.y) < 12) { e.hit2 = true; hurtTarget(e, tg, 1); }
  } else if (m === 'charge') {
    const [bx, by] = substepMove(e, e.lv[0] * 230 * dt, e.lv[1] * 230 * dt, false);
    e.dir = dirOf(e.lv[0], e.lv[1]);
    if (Math.random() < 0.6) G.fx.push({ type: 'puff', x: e.x, y: e.y, vx: R.f(-10, 10), vy: -6, r: 2, col: '#a89878', t: 0, life: 0.4 });
    for (const tg of targetsOf()) if (!e.hit2 && Math.hypot(tg.x - e.x, tg.y - e.y) < 13) { e.hit2 = true; hurtTarget(e, tg, 1.7); e.t = e.actT; }
    if (bx || by) { e.t = e.actT; e.st.stun = 1.3; Shake.go(0.2, 2); Snd.sfx('hit'); num(e.x, e.y - 22, 'Stunned', '#e0d090'); }
  } else if (m === 'leap') {
    const k = clamp(e.t / e.actT, 0, 1);
    e.x = lerp(e.leapFrom.x, e.leapTo.x, k); e.y = lerp(e.leapFrom.y, e.leapTo.y, k); e.z = Math.sin(k * Math.PI) * 34;
    if (k >= 1 && !e.landed) {
      e.landed = true; e.z = 0; Shake.go(0.35, 4); Snd.sfx('taiko'); fxAdd('ring', { x: e.x, y: e.y, life: 0.4, r: 40 });
      if (!canStand(e.x, e.y, e)) { e.x = e.leapFrom.x; e.y = e.leapFrom.y; }
      for (const tg of targetsOf()) if (Math.hypot(tg.x - e.x, tg.y - e.y) < 38) hurtTarget(e, tg, 1.5);
    }
  }
}
function targetsOf() { const l = [G.pl]; if (G.yuki && G.yuki.state !== 'down') l.push(G.yuki); return l; }

function updateEnemy(e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  if (e.dead) { e.t += dt; e.alpha = clamp(1 - (e.t - 0.35) / 0.4, 0, 1); return; }
  for (const k of ['stun', 'blind', 'guard']) if (e.st[k] > 0) e.st[k] -= dt;
  e.poiseT -= dt; if (e.hitDecay > 0) { e.hitDecay -= dt; if (e.hitDecay <= 0) e.hitCount = 0; }
  if (e.st.poison > 0) { e.st.poison -= dt; e.pt = (e.pt || 0) + dt; if (e.pt >= 1) { e.pt = 0; const d = Math.max(1, Math.min(e.boss ? 40 : 999, Math.round(e.maxhp * 0.06))); e.hp -= d; num(e.x, e.y - 24, d, '#a0e060'); if (e.hp <= 0) { killEnemy(e); return; } } }
  if (Math.abs(e.kbx) + Math.abs(e.kby) > 1) { substepMove(e, e.kbx * dt, e.kby * dt, false); const k = Math.pow(0.0005, dt); e.kbx *= k; e.kby *= k; } else e.kbx = e.kby = 0;
  if (e.boss && !e.enraged && e.hp < e.maxhp * 0.5) {
    e.enraged = true; e.spd *= 1.2; e.cd *= 0.7; Snd.sfx('taiko'); Shake.go(0.4, 3);
    const lines = { tozo: 'Tōzō roars with fury!', hanzaki: 'Hanzaki: "Enough playing."', gensai: 'Gensai: "Isshin taught you well — but he taught ME first."', assassin: 'The assassin\'s eyes narrow.', sota: 'Sota: "Stop looking at me like that!"' };
    banner(lines[e.id] || e.name + ' grows furious!', '#e08060');
  }
  if (e.st.stun > 0) { e.anim = 'hurt'; e.z = 0; return; }
  e.t += dt;
  const p = G.pl, t = e.tgt && e.tgt.state !== 'down' ? e.tgt : targetFor(e);
  const d = Math.hypot(t.x - e.x, t.y - e.y);
  let moving = false;
  switch (e.state) {
    case 'idle': {
      e.wt -= dt;
      if (e.wt <= 0) { e.wt = R.f(1.5, 3.5); const a = Math.random() * Math.PI * 2, r = R.f(0, 30); e.wander = { x: e.home[0] + Math.cos(a) * r, y: e.home[1] + Math.sin(a) * r }; }
      if (e.wander && Math.hypot(e.wander.x - e.x, e.wander.y - e.y) > 3 && e.wt > 0.8) { const v = steer(e, e.wander.x, e.wander.y, e.spd * 0.35, dt); if (v[0] || v[1]) { e.dir = dirOf(v[0], v[1]); moving = true; } }
      if (perceive(e)) alertEnemy(e);
      break;
    }
    case 'alert': e.dir = dirOf(p.x - e.x, p.y - e.y); if (e.t > 0.45) { e.state = 'chase'; e.t = 0; } break;
    case 'search': {
      const ls = e.lastSeen || { x: e.home[0], y: e.home[1] };
      if (Math.hypot(ls.x - e.x, ls.y - e.y) > 6) { const v = steer(e, ls.x, ls.y, e.spd * 0.6, dt); if (v[0] || v[1]) { e.dir = dirOf(v[0], v[1]); moving = true; } }
      if (e.t > 3.5) { e.state = 'idle'; e.t = 0; }
      if (e.t > 0.8 && perceive(e)) alertEnemy(e);
      break;
    }
    case 'blind': {
      if (!e.wander || Math.random() < dt * 1.5) { const a = Math.random() * Math.PI * 2; e.wander = { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 }; }
      const v = steer(e, e.wander.x, e.wander.y, e.spd * 0.3, dt); if (v[0] || v[1]) { e.dir = dirOf(v[0], v[1]); moving = true; }
      if (!(e.st.blind > 0)) { e.state = 'chase'; e.t = 0; }
      break;
    }
    case 'hurt': e.anim = 'hurt'; if (e.t > 0.24) { e.state = 'chase'; e.t = 0; e.cool = Math.max(e.cool, 0.35); } break;
    case 'chase': {
      e.cool -= dt;
      if (p.smokeT > 0 && t === p) { e.state = 'search'; e.t = 0; e.lastSeen = { x: p.x, y: p.y }; break; }
      const pref = e.pref || 0;
      let v = [0, 0];
      const spd = e.spd * (e.st.guard > 0 ? 0.45 : 1);
      if (d > pref + 14) v = chaseTo(e, t, spd, dt);
      else if (pref && d < pref - 16) v = steer(e, t.x, t.y, spd * 0.8, dt, true);
      else if (pref) { const s = Math.sin(G.time * 1.3 + e.home[0]) > 0 ? 1 : -1; const dx = (t.x - e.x) / (d || 1), dy = (t.y - e.y) / (d || 1); v = steer(e, e.x - dy * s * 20, e.y + dx * s * 20, spd * 0.6, dt); }
      if (v[0] || v[1]) moving = true;
      e.dir = dirOf(t.x - e.x, t.y - e.y);
      if (e.cool <= 0) { const m = pickMove(e, d); if (m) beginMove(e, m, t); else e.cool = 0.3; }
      if (d > 320 && !e.fight) { e.state = 'search'; e.t = 0; e.lastSeen = { x: t.x, y: t.y }; }
      break;
    }
    case 'wind': {
      if (e.move === 'shoot') {
        if (p.smokeT > 0) { e.state = 'rec'; e.t = 0; e.recT = 0.6; e.aim = null; break; }
        if (e.t < e.windT - 0.28) { e.aim = { x: t.x, y: t.y - 8 }; e.dir = dirOf(t.x - e.x, t.y - e.y); }
      } else if (e.move === 'slash' || e.move === 'heavy' || e.move === 'thrust' || e.move === 'spin') {
        if (e.t < e.windT * 0.6) e.dir = dirOf(t.x - e.x, t.y - e.y);
      }
      if (e.move === 'leap' && e.leapTo && e.t < e.windT * 0.7) e.leapTo = { x: t.x, y: t.y };
      if (e.t >= e.windT) { e.state = 'act'; e.t = 0; e.hit2 = false; e.landed = false; e.hitDone = false; }
      break;
    }
    case 'act': enemyAct(e, dt); if (e.t >= e.actT) { e.state = 'rec'; e.t = 0; e.z = 0; } break;
    case 'rec': if (e.t >= e.recT) { e.state = 'chase'; e.t = 0; e.cool = (e.cd || 1.3) * R.f(0.7, 1.2); e.move = null; } break;
  }
  if (moving) e.af += dt * 7;
  // separation
  for (const o of G.ents) if (o !== e && !o.dead) { const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy); if (dd > 0 && dd < 12) substepMove(e, dx / dd * 20 * dt, dy / dd * 20 * dt, false); }
  // animation selection
  if (e.state === 'wind') { e.anim = (e.beast || e.move === 'charge') ? 'idle' : 'atk'; e.af = e.move === 'shoot' ? 1 : 0; }
  else if (e.state === 'act') { e.anim = 'atk'; e.af = 1; }
  else if (e.state === 'rec') { e.anim = e.t < 0.15 && !e.beast ? 'atk' : 'idle'; e.af = 2; }
  else if (e.state !== 'hurt') { e.anim = moving ? 'walk' : 'idle'; }
}

/* ---------- projectiles & pickups ---------- */
function updateProj(dt) {
  for (const pr of G.proj) {
    if (pr.dead) continue;
    pr.t += dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.t > pr.life) { pr.dead = true; continue; }
    const ch = tileAt(Math.floor(pr.x / 16), Math.floor((pr.y + 6) / 16));
    if (ch && isSolidTile(ch) && '~p'.indexOf(ch) < 0) { pr.dead = true; fxAdd('spark', { x: pr.x, y: pr.y, life: 0.2 }); continue; }
    if (pr.owner === 'enemy') {
      const p = G.pl;
      if (Math.hypot(pr.x - p.x, pr.y - (p.y - 8)) < 8 && p.state !== 'roll') { pr.dead = true; hurtTarget(pr.src || { atk: 20 }, p, pr.mult, { fromX: pr.x - pr.vx, fromY: pr.y - pr.vy }); }
      else if (G.yuki && G.yuki.state !== 'down' && Math.hypot(pr.x - G.yuki.x, pr.y - (G.yuki.y - 8)) < 8) { pr.dead = true; hurtYuki(pr.src || { atk: 20 }, pr.mult); }
    } else {
      for (const e of G.ents) if (!e.dead && Math.hypot(pr.x - e.x, pr.y - (e.y - 8 * e.scale)) < e.rad + 4) {
        pr.dead = true;
        damageEnemy(e, pr.mult, { proj: true, fromX: pr.x - pr.vx * 0.1, fromY: pr.y - pr.vy * 0.1, atk: pr.atk, yuki: pr.yuki });
        if (pr.poison && !e.dead) { e.st.poison = 5; num(e.x, e.y - 34, 'Poisoned', '#a0e060'); }
        if (pr.stun && !e.dead) { e.st.stun = e.boss ? 1.2 : 2.5; num(e.x, e.y - 34, 'Pinned', '#e0d090'); }
        break;
      }
    }
  }
  G.proj = G.proj.filter(p => !p.dead);
  const p = G.pl;
  for (const k of G.picks) {
    k.t += dt; k.vz -= 260 * dt; k.z = Math.max(0, k.z + k.vz * dt); if (k.z === 0) k.vz = Math.abs(k.vz) > 30 ? -k.vz * 0.4 : 0;
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    if (k.t > 0.4 && d < 30) { k.x += (p.x - k.x) / (d || 1) * 170 * dt; k.y += (p.y - k.y) / (d || 1) * 170 * dt; }
    if (k.t > 0.4 && d < 8) {
      k.dead = true; Snd.sfx('pickup');
      if (k.kind === 'coin') G.gold += k.val;
      else if (k.kind === 'heal') { const h = Math.round(maxHP() * 0.15) + 8; P.hp = Math.min(maxHP(), P.hp + h); num(p.x, p.y - 28, '+' + h, '#8af08a'); }
      else { P.ki = Math.min(maxKi(), P.ki + 5); num(p.x, p.y - 28, '+5 Ki', '#8ac0f0'); }
    }
    if (k.t > 20) k.dead = true;
  }
  G.picks = G.picks.filter(k => !k.dead);
}

/* ---------- Yuki, the companion ---------- */
function mkYukiF(x, y) { const mh = Math.round(maxHP() * 0.8); return { x, y, dir: 'down', anim: 'idle', af: 0, hp: mh, maxhp: mh, state: 'follow', t: 0, cool: 0, starCD: 1, healCD: 5, flash: 0, inv: 0, hw: 5, top: 6, bot: 1, kbx: 0, kby: 0 }; }
function hurtYuki(e, mult) {
  const y = G.yuki; if (!y || y.state === 'down' || y.inv > 0) return false;
  const yd = Math.round(pDef() * 0.8);
  const dmg = Math.max(1, Math.round(Math.max(1 + e.atk * 0.15, e.atk * 2 * mult - yd) * R.f(0.9, 1.1) * 0.8));
  y.hp -= dmg; y.inv = 0.8; y.flash = 0.8; num(y.x, y.y - 28, dmg, '#f0a0a0'); Snd.sfx('hurt');
  if (y.hp <= 0) { y.hp = 0; y.state = 'down'; y.t = 0; banner('Yuki is down!', '#f09aaa'); }
  return true;
}
function updateYuki(dt) {
  const y = G.yuki, p = G.pl; if (!y) return;
  y.inv = Math.max(0, y.inv - dt); y.flash = Math.max(0, y.flash - dt); y.t += dt; y.cool -= dt; y.starCD -= dt; y.healCD -= dt;
  if (y.state === 'down') { y.anim = 'dead'; if (y.t > 6) { y.state = 'follow'; y.hp = Math.round(y.maxhp * 0.5); banner('Yuki is back on her feet.', '#f09aaa'); } return; }
  if (P.hp > 0 && P.hp < maxHP() * 0.35 && y.healCD <= 0) {
    y.healCD = 25; const h = Math.round(maxHP() * 0.3); P.hp = Math.min(maxHP(), P.hp + h); num(p.x, p.y - 28, '+' + h, '#8af08a'); Snd.sfx('heal'); fxAdd('heal', { x: p.x, y: p.y, life: 0.8 });
    banner('Yuki: "Hold on, niisan!"', '#f09aaa');
  }
  let foe = null, fd = 1e9;
  for (const e of G.ents) if (!e.dead && e.state !== 'idle' && e.state !== 'search') { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 150) { const dy2 = Math.hypot(e.x - y.x, e.y - y.y); if (dy2 < fd) { fd = dy2; foe = e; } } }
  const ox = y.x, oy = y.y;
  if (foe) {
    y.state = 'fight';
    if (fd > 18) { const v = steer(y, foe.x, foe.y, 95, dt); if (v[0] || v[1]) y.dir = dirOf(v[0], v[1]); }
    if (fd < 26 && y.cool <= 0) {
      y.cool = 0.85; y.atkT = 0.25; y.dir = dirOf(foe.x - y.x, foe.y - y.y); Snd.sfx('swing');
      fxAdd('slash', { x: y.x, y: y.y - 9, dir: y.dir, life: 0.18 });
      damageEnemy(foe, 1, { atk: Math.round(pAtk() * 0.8) + 2, yuki: true, fromX: y.x, fromY: y.y });
    } else if (fd > 40 && fd < 130 && y.starCD <= 0) {
      y.starCD = 2.4; Snd.sfx('throw'); const a = Math.atan2(foe.y - y.y, foe.x - y.x);
      G.proj.push({ x: y.x, y: y.y - 9, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, owner: 'player', kind: 'star', mult: 0.6, life: 0.9, t: 0, atk: Math.round(pAtk() * 0.8) + 2, yuki: true });
    }
  } else {
    y.state = 'follow';
    const tr = G.trail, tgt = tr.length > 11 ? tr[tr.length - 11] : null;
    if (Math.hypot(p.x - y.x, p.y - y.y) > 200) { y.x = p.x; y.y = p.y; G.trail = []; }
    else if (tgt) { const dx = tgt.x - y.x, dy = tgt.y - y.y, d = Math.hypot(dx, dy); if (d > 1.5) { const s = Math.min(d, 130 * dt); y.x += dx / d * s; y.y += dy / d * s; y.dir = dirOf(dx, dy); } }
  }
  const mv = Math.hypot(y.x - ox, y.y - oy);
  y.af += mv / 6.5;
  if (y.atkT > 0) { y.atkT -= dt; y.anim = 'atk'; } else y.anim = mv > 0.1 ? 'walk' : 'idle';
}


/* ---------- flow-field pathfinding toward the player ---------- */
function updateFlow() {
  const m = G.map, p = G.pl, ptx = Math.floor(p.x / 16), pty = Math.floor((p.y - 3) / 16), key = G.mapId + ptx + ',' + pty;
  if (G.flowKey === key) return;
  G.flowKey = key;
  const W = m.w, H = m.h, d = G.flow && G.flow.length === W * H ? G.flow : new Int16Array(W * H);
  d.fill(-1);
  if (ptx < 0 || pty < 0 || ptx >= W || pty >= H) { G.flow = d; return; }
  const q = [ptx + pty * W]; d[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % W, y = (i / W) | 0, nd = d[i] + 1; if (nd > 40) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = nx + ny * W; if (d[j] >= 0) continue;
      const ch = m.grid[ny][nx]; if (isSolidTile(ch) || exitAt(nx, ny)) continue;
      d[j] = nd; q.push(j);
    }
  }
  G.flow = d;
}
function flowTarget(e) {
  const m = G.map, W = m.w, tx = Math.floor(e.x / 16), ty = Math.floor((e.y - 3) / 16), f = G.flow;
  if (!f) return null;
  const cur = f[tx + ty * W]; let best = null, bv = cur < 0 ? 9999 : cur;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= m.h) continue;
    if (dx && dy && (f[nx + ty * W] < 0 || f[tx + ny * W] < 0)) continue;
    const v = f[nx + ny * W]; if (v >= 0 && v < bv) { bv = v; best = { x: nx * 16 + 8, y: ny * 16 + 12 }; }
  }
  return best;
}
function chaseTo(e, t, sp, dt) {
  if (t === G.pl && (Math.hypot(t.x - e.x, t.y - e.y) > 36 || !losClear(e, t))) { const ft = flowTarget(e); if (ft) return steer(e, ft.x, ft.y, sp, dt); }
  return steer(e, t.x, t.y, sp, dt);
}

/* ---------- world update & drawing ---------- */
function updateCombat(dt) {
  const p = G.pl;
  if (Math.hypot(p.x - (G.trailLast ? G.trailLast.x : 0), p.y - (G.trailLast ? G.trailLast.y : 0)) > 2) { G.trailLast = { x: p.x, y: p.y }; G.trail.push(G.trailLast); if (G.trail.length > 40) G.trail.shift(); }
  updateFlow();
  for (const e of G.ents) updateEnemy(e, dt);
  G.ents = G.ents.filter(e => !(e.dead && e.alpha <= 0));
  updateProj(dt);
  updateYuki(dt);
  if (G.fightRes) {
    const { o, list, r } = G.fightRes;
    if (o.endWhen && o.endWhen({ enemies: list })) { G.fightRes = null; r('special'); }
    else if (list.every(e => e.dead)) { G.fightDone = (G.fightDone || 0) + dt; if (G.fightDone > 1.0) { G.fightDone = 0; G.fightRes = null; r('win'); } }
  }
}
function updateFx(dt) {
  for (const f of G.fx) { f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; if (f.type === 'puff') { f.vx *= 0.92; f.vy *= 0.92; } } }
  G.fx = G.fx.filter(f => f.t < f.life);
  for (const b of bannerMsgs) b.t += dt;
  while (bannerMsgs.length && bannerMsgs[0].t > 2.4) bannerMsgs.shift();
}
function combatDrawables(list, cx, cy) {
  const p = G.pl;
  // player
  let pt = null; if (p.flash > 0 && Math.floor(p.flash * 20) % 2 === 0) pt = '#ffffff';
  const pal = p.smokeT > 0 ? 0.45 : 1;
  list.push({ y: p.y, draw: () => {
    drawActor('ren', p.anim, p.dir, p.anim === 'walk' ? Math.floor(p.af) % 4 : p.af | 0, p.x - cx, p.y - cy, { tint: pt, alpha: pal });
    if (p.charged && Math.floor(G.time * 12) % 2 === 0) { const [dx, dy] = DV[p.dir]; ctx.drawImage(sparkSprite(1), Math.round(p.x - cx + dx * 10 - 7), Math.round(p.y - cy - 12 + dy * 8 - 7)); }
  } });
  if (G.yuki) { const y = G.yuki; const yt = y.flash > 0 && Math.floor(y.flash * 20) % 2 === 0 ? '#ffffff' : null;
    list.push({ y: y.y, draw: () => drawActor('yuki', y.anim, y.dir, y.anim === 'walk' ? Math.floor(y.af) % 4 : y.anim === 'atk' ? 1 : 0, y.x - cx, y.y - cy, { tint: yt }) }); }
  for (const e of G.ents) {
    list.push({ y: e.y, draw: () => {
      let tint = null;
      if (e.flash > 0) tint = '#ffffff';
      else if (e.state === 'wind' && Math.floor(e.t * 16) % 2 === 0 && e.move !== 'shoot') tint = '#ff5040';
      const f = e.anim === 'walk' ? Math.floor(e.af) % 4 : e.af | 0;
      const dir = SPR_ANIMAL(e) ? ((G.pl.x < e.x) ? 'left' : 'right') : e.dir;
      const dead = e.dead;
      drawActor(e.spr, dead ? 'dead' : e.anim, dir, dead ? 0 : f, e.x - cx, e.y - cy, { tint, alpha: e.alpha * (e.st.stun > 0 ? 0.85 : 1), z: e.z, scale: e.scale });
      if (!dead) {
        const top = e.y - cy - 26 * e.scale - (e.z || 0);
        if (e.state === 'alert') text('!', e.x - cx, top - 6, { size: 13, bold: true, align: 'center', color: '#ff4030' });
        else if (e.state === 'search') text('?', e.x - cx, top - 6, { size: 12, bold: true, align: 'center', color: '#e0d090' });
        else if (e.st.blind > 0 || e.st.stun > 0) text('✶', e.x - cx + Math.sin(G.time * 6) * 4, top - 4, { size: 9, align: 'center', color: '#f0e080' });
        if (e.st.guard > 0) { ctx.strokeStyle = 'rgba(140,190,255,.7)'; ctx.beginPath(); const [fx, fy] = DV[e.dir]; ctx.arc(e.x - cx + fx * 8, e.y - cy - 10 + fy * 6, 9, 0, Math.PI * 2); ctx.stroke(); }
        if (!e.boss && e.hp < e.maxhp) bar(Math.round(e.x - cx - 8), Math.round(e.y - cy + 3), 16, 2, e.hp, e.maxhp, '#e05030', 'rgba(0,0,0,.6)');
      }
    } });
  }
  for (const k of G.picks) list.push({ y: k.y, draw: () => { const s = shadowImg(6); ctx.drawImage(s, Math.round(k.x - cx - 3), Math.round(k.y - cy - 1)); if (k.t > 17 && Math.floor(k.t * 8) % 2) return; ctx.drawImage(pickupSprite(k.kind), Math.round(k.x - cx - 5), Math.round(k.y - cy - 9 - k.z)); } });
}
const SPR_ANIMAL = e => !!CHAR_DEFS[e.spr].animal;
function drawGroundFx(cx, cy) {
  for (const e of G.ents) if (!e.dead && e.move === 'leap' && (e.state === 'wind' || e.state === 'act') && e.leapTo) {
    ctx.strokeStyle = 'rgba(255,60,40,' + (0.5 + 0.3 * Math.sin(G.time * 20)) + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(e.leapTo.x - cx, e.leapTo.y - cy, 30, 12, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (const f of G.fx) if (f.type === 'ring') { const k = f.t / f.life; ctx.strokeStyle = 'rgba(220,200,160,' + (1 - k) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x - cx, f.y - cy, f.r * k, f.r * k * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); }
}
function drawCombatOverlay(cx, cy) {
  for (const e of G.ents) if (e.aim && !e.dead && e.state === 'wind') {
    const lock = e.t > e.windT - 0.28; const ex = e.x - cx, ey = e.y - cy - 8;
    ctx.strokeStyle = lock ? 'rgba(255,40,30,' + (0.6 + 0.4 * Math.sin(G.time * 40)) + ')' : 'rgba(255,60,40,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(e.aim.x - cx, e.aim.y - cy); ctx.stroke();
    if (Math.random() < 0.5) G.fx.push({ type: 'puff', x: e.x + R.f(-2, 2), y: e.y - 12, vx: 0, vy: -10, r: 1, col: '#ff9040', t: 0, life: 0.3 });
  }
  for (const pr of G.proj) {
    const x = Math.round(pr.x - cx), y = Math.round(pr.y - cy);
    ctx.drawImage(shadowImg(6), x - 3, y + 8);
    if (pr.kind === 'star') ctx.drawImage(starSprite(Math.floor(pr.t * 20) % 2), x - 4, y - 4);
    else if (pr.kind === 'bullet') { ctx.fillStyle = '#fff2b0'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = 'rgba(255,200,120,.4)'; ctx.fillRect(Math.round(x - pr.vx * 0.02), Math.round(y - pr.vy * 0.02), 2, 2); }
    else if (pr.kind === 'dart') { ctx.fillStyle = '#1a1a20'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#c02030'; ctx.fillRect(x - 1, y - 1, 2, 2); }
    else { ctx.fillStyle = pr.kind === 'needle' ? '#a0f070' : '#d8dce4'; const [dx, dy] = [Math.sign(pr.vx), Math.sign(pr.vy)]; for (let i = 0; i < 5; i++) ctx.fillRect(x - dx * i, y - dy * i, 1, 1); }
  }
  for (const f of G.fx) {
    const k = f.t / f.life, x = f.x - cx, y = f.y - cy;
    switch (f.type) {
      case 'slash': { const ph = Math.min(2, Math.floor(k * 3)); const s = slashSprite(f.dir, ph, f.big); if (f.enemy) ctx.globalAlpha = 0.85; ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2)); ctx.globalAlpha = 1; break; }
      case 'spin': { for (const d of ['down', 'left', 'up', 'right']) { const s = slashSprite(d, 1, f.big); ctx.globalAlpha = 1 - k; ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2)); } ctx.globalAlpha = 1; break; }
      case 'mist': { ctx.fillStyle = 'rgba(200,220,255,' + 0.4 * (1 - k) + ')'; ctx.beginPath(); ctx.arc(x, y, 20 + 30 * k, 0, Math.PI * 2); ctx.fill(); break; }
      case 'thrust': { const [dx, dy] = DV[f.dir]; ctx.fillStyle = 'rgba(255,255,255,' + (1 - k) + ')'; for (let i = 8; i < 40; i += 2) ctx.fillRect(Math.round(x + dx * i), Math.round(y + dy * i), 2, 2); break; }
      case 'spark': ctx.drawImage(sparkSprite(Math.min(3, Math.floor(k * 4))), Math.round(x - 7), Math.round(y - 7)); break;
      case 'puff': ctx.fillStyle = f.col; ctx.globalAlpha = 0.8 * (1 - k); const r = Math.round(f.r * (1 + k)); ctx.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2); ctx.globalAlpha = 1; break;
      case 'heal': for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(160,255,160,' + (1 - k) + ')'; ctx.fillRect(Math.round(x + Math.cos(i * 1.05 + k * 4) * 10), Math.round(y - 6 - k * 22 - i * 2), 2, 2); } break;
      case 'ghost': ctx.globalAlpha = 0.4 * (1 - k); ctx.drawImage(sprTint('ren', 'atk', f.dir, 1, '#80b0ff'), Math.round(x - ANCHOR_X), Math.round(y - ANCHOR_Y)); ctx.globalAlpha = 1; break;
      case 'petal': ctx.fillStyle = k < 0.8 ? '#e8708a' : '#f4b0c0'; ctx.fillRect(Math.round(x + Math.sin(f.t * 5) * 3), Math.round(y), 2, 2); break;
      case 'num': { const yy = y - k * 18 - (k < 0.15 ? 0 : 3); ctx.globalAlpha = clamp(1.6 - k * 1.6, 0, 1); text(f.s, Math.round(x), Math.round(yy), { size: f.big ? 13 : 10, bold: true, align: 'center', color: f.col }); ctx.globalAlpha = 1; break; }
    }
  }
}

/* ---------- map population & scripted fights ---------- */
function populateMap(m) {
  G.ents = []; G.proj = []; G.picks = [];
  if (!m.enc) return;
  const tiles = [];
  const p = G.pl;
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    const ch = m.grid[y][x];
    if ((m.encTiles || '.,').indexOf(ch) < 0) continue;
    if (Math.hypot(x * 16 + 8 - p.x, y * 16 + 8 - p.y) < 120) continue;
    if (exitAt(x, y)) continue;
    if ((m.noSpawn || []).some(r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3])) continue;
    if (m.npcs.some(n => visibleNpc(n) && Math.abs(n.x0 - x) < 4 && Math.abs(n.y0 - y) < 4)) continue;
    tiles.push([x, y]);
  }
  const n = m.spawnN || 8, used = [];
  for (let i = 0; i < n && tiles.length; i++) {
    let pick = null;
    for (let tries = 0; tries < 30; tries++) { const c = R.pick(tiles); if (used.every(u => Math.hypot(u[0] - c[0], u[1] - c[1]) > 6)) { pick = c; break; } }
    if (!pick) break; used.push(pick);
    const grp = R.pick(ENC[m.enc]);
    grp.forEach((id, k) => { const ox = (k % 2) * 18 - 9, oy = Math.floor(k / 2) * 14; const x = pick[0] * 16 + 8 + ox, y = pick[1] * 16 + 13 + oy; const e = spawnEnemy(id, canStandId(x, y) ? x : pick[0] * 16 + 8, canStandId(x, y) ? y : pick[1] * 16 + 13); e.dir = R.pick(['up', 'down', 'left', 'right']); });
  }
}
function canStandId(x, y) { return boxFree(x, y, 5, 5, 1, false, null); }
function spawnSpot(i, n) {
  const p = G.pl, [dx, dy] = DV[p.dir];
  const px = -dy, py = dx;
  for (let r = 56; r > 16; r -= 8) {
    const x = p.x + dx * r + px * (i - (n - 1) / 2) * 28, y = p.y + dy * r + py * (i - (n - 1) / 2) * 28;
    if (canStandId(x, y)) return [x, y];
  }
  return [p.x + R.f(-20, 20), p.y + R.f(-20, 20)];
}
async function battle(ids, o = {}) {
  const spots = [];
  (o.replace || []).forEach(id => { const n = npcById(id); if (n) { spots.push([n.px, n.py, n.dir]); n.hidden = true; } });
  const list = ids.map((id, i) => {
    const s = spots[i] || spawnSpot(i, ids.length);
    const e = spawnEnemy(id, s[0], s[1], { fight: true });
    e.dir = dirOf(G.pl.x - e.x, G.pl.y - e.y); e.state = 'alert'; e.t = 0.1; e.cool = 0.6 + i * 0.4;
    return e;
  });
  const prevMusic = Music.cur;
  Music.play(o.music || (o.boss ? 'boss' : 'battle'));
  if (o.intro) banner(o.intro, '#f0c080');
  G.bossBar = o.boss ? (list.find(e => e.boss) || list[0]) : null;
  const prevBusy = G.busy; G.busy = false; G.inFight = true;
  const res = await new Promise(r => { G.fightRes = { r, o, list }; G.fightDone = 0; });
  G.inFight = false; G.bossBar = null; G.busy = prevBusy;
  if (res === 'special') { for (const e of list) { const i = G.ents.indexOf(e); if (i >= 0) G.ents.splice(i, 1); } }
  G.proj = G.proj.filter(p => p.owner !== 'enemy');
  if (o.restore) (o.replace || []).forEach(id => { const n = npcById(id); if (n) n.hidden = false; });
  if (G.pl.state === 'dead') await new Promise(() => {});
  G.pl.state = 'normal'; G.pl.charge = 0;
  if (!o.keepMusic) Music.play(o.afterMusic || prevMusic || G.map.music);
  return res;
}

async function gainXP(xp, sayFn) {
  sayFn = sayFn || (t => say(t));
  P.xp += xp;
  while (P.xp >= xpNext(P.lv)) {
    P.xp -= xpNext(P.lv); P.lv++;
    P.str++; P.agi++; P.end++; P.foc++; P.pts += 2;
    P.hp = maxHP(); P.ki = maxKi();
    Snd.sfx('level');
    await sayFn('Level ' + P.lv + '!  All stats +1, 2 training points');
    if (G.yuki) { G.yuki.maxhp = Math.round(maxHP() * 0.8); G.yuki.hp = G.yuki.maxhp; }
    for (const id in SKILLS) if (SKILLS[id].lv === P.lv && !P.skills.includes(id)) {
      P.skills.push(id); if (!P.active) P.active = id;
      Snd.sfx('item'); await sayFn('Learned ' + SKILLS[id].name + '!');
    }
  }
}
