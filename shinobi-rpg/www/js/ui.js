'use strict';
/* ===== UI: widgets, dialogue, menus, shops ===== */
const UI = {
  stack: [],
  push(w) { Input.clear(); this.stack.push(w); return w.promise; },
  top() { return this.stack[this.stack.length - 1]; },
  remove(w) { const i = this.stack.indexOf(w); if (i >= 0) this.stack.splice(i, 1); },
};
class Widget {
  constructor() { this.promise = new Promise(r => (this._res = r)); this.passive = false; }
  finish(v) { UI.remove(this); Input.clear(); this._res(v); }
  update() {} draw() {}
}

const Timers = {
  list: [],
  wait(s) { return new Promise(r => this.list.push({ t: s, r })); },
  update(dt) { for (const t of this.list) t.t -= dt; const done = this.list.filter(t => t.t <= 0); this.list = this.list.filter(t => t.t > 0); done.forEach(t => t.r()); },
};
const wait = s => Timers.wait(s);

const Fade = {
  a: 0, target: 0, speed: 2, res: null, col: '#000',
  to(a, dur = 0.5, col) { if (col) this.col = col; this.target = a; this.speed = Math.abs(a - this.a) / Math.max(0.01, dur);
    return new Promise(r => { if (this.a === a) { r(); return; } this.res = r; }); },
  update(dt) { if (this.a !== this.target) { const d = this.speed * dt; this.a = this.a < this.target ? Math.min(this.target, this.a + d) : Math.max(this.target, this.a - d); if (this.a === this.target && this.res) { const r = this.res; this.res = null; r(); } } },
  draw() { if (this.a > 0) { ctx.globalAlpha = this.a; ctx.fillStyle = this.col; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; } },
};
const fadeOut = (d = 0.5, c) => Fade.to(1, d, c || '#000');
const fadeIn = (d = 0.5) => Fade.to(0, d);
const Flash = { a: 0, col: '#fff', go(col, a = 0.8) { this.col = col; this.a = a; }, update(dt) { this.a = Math.max(0, this.a - dt * 2.5); }, draw() { if (this.a > 0) { ctx.globalAlpha = this.a; ctx.fillStyle = this.col; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; } } };
const Shake = { t: 0, mag: 0, go(t = 0.3, m = 4) { this.t = t; this.mag = m; }, update(dt) { this.t = Math.max(0, this.t - dt); }, off() { return this.t > 0 ? [R.f(-1, 1) * this.mag, R.f(-1, 1) * this.mag] : [0, 0]; } };

const Toasts = {
  list: [],
  add(s, col) { this.list.push({ s, t: 0, col }); if (this.list.length > 4) this.list.shift(); },
  update(dt) { for (const t of this.list) t.t += dt; this.list = this.list.filter(t => t.t < 2.6); },
  draw() {
    this.list.forEach((t, i) => {
      const a = Math.min(1, t.t * 5, (2.6 - t.t) * 2);
      ctx.globalAlpha = a; ctx.font = font(11);
      const w = ctx.measureText(t.s).width + 20;
      drawWin(VW / 2 - w / 2, 8 + i * 22, w, 19, 0.9);
      text(t.s, VW / 2, 12 + i * 22, { align: 'center', color: t.col || '#f0e2b0' });
      ctx.globalAlpha = 1;
    });
  },
};
const toast = (s, c) => Toasts.add(s, c);

/* ----- Dialogue ----- */
const NAMECOL = { Ren: '#9fbaf0', Gonbei: '#d8c090', Yuki: '#f09aaa', Sota: '#a0d8f0', Gensai: '#e06060', Hanzaki: '#c0a0a0', 'Masked Woman': '#f09aaa', Tōzō: '#e0a060', Sakichi: '#b8e0a0', Mizuno: '#c0c8f0' };
class Dialog extends Widget {
  constructor(name, txt) {
    super(); this.name = name;
    const lines = wrap(txt, 436, 12);
    this.pages = []; for (let i = 0; i < lines.length; i += 3) this.pages.push(lines.slice(i, i + 3));
    this.pi = 0; this.ch = 0; this.tk = 0;
  }
  total() { return this.pages[this.pi].join('').length; }
  update(dt) {
    if (this.ch < this.total()) {
      this.ch += dt * 55; this.tk += dt;
      if (this.tk > 0.07) { this.tk = 0; if (this.name) Snd.tone(this.name === 'Ren' ? 520 : 640, 0.02, { type: 'triangle', v: 0.025 }); }
      if (Input.take('ok') || Input.take('cancel')) this.ch = this.total();
    } else if (Input.take('ok') || Input.take('cancel')) {
      this.pi++; Snd.sfx('cursor');
      if (this.pi >= this.pages.length) this.finish(); else this.ch = 0;
    }
  }
  draw() {
    const x = 12, y = 190, w = VW - 24, h = 72;
    drawWin(x, y, w, h);
    if (this.name) {
      ctx.font = font(11, true); const nw = ctx.measureText(this.name).width + 18;
      drawWin(x + 8, y - 17, nw, 18);
      text(this.name, x + 17, y - 14, { bold: true, color: NAMECOL[this.name] || '#e8d8a8' });
    }
    let left = Math.floor(this.ch);
    this.pages[this.pi].forEach((ln, i) => {
      const s = ln.slice(0, Math.max(0, left)); left -= ln.length;
      text(s, x + 14, y + 10 + i * 18, { size: 12, color: this.name ? '#ece4d0' : '#d8d0c0' });
    });
    if (this.ch >= this.total() && Math.floor(G.time * 3) % 2 === 0) { ctx.fillStyle = '#b8a77a'; ctx.beginPath(); ctx.moveTo(x + w - 18, y + h - 14); ctx.lineTo(x + w - 10, y + h - 14); ctx.lineTo(x + w - 14, y + h - 9); ctx.fill(); }
  }
}
const say = (name, txt) => { if (txt === undefined) { txt = name; name = null; } return UI.push(new Dialog(name, txt)); };

class ListMenu extends Widget {
  constructor(items, o = {}) {
    super(); this.items = items; this.o = o; this.i = clamp(o.index || 0, 0, Math.max(0, items.length - 1)); this.scroll = 0;
    this.rows = o.rows || Math.min(items.length, 9); this.lh = o.lh || 17;
    this.w = o.w || 150; this.h = this.rows * this.lh + 12 + (o.title ? 18 : 0);
    this.x = o.x != null ? o.x : VW - this.w - 12; this.y = o.y != null ? o.y : 190 - this.h - 6;
    while (this.items[this.i] && this.items[this.i].disabled && o.skipDisabled && this.i < items.length - 1) this.i++;
  }
  update() {
    const n = this.items.length; if (!n) { if (Input.take('cancel') || Input.take('ok')) this.finish(-1); return; }
    if (Input.take('up')) { this.i = (this.i + n - 1) % n; Snd.sfx('cursor'); this.o.onMove && this.o.onMove(this.i); }
    if (Input.take('down')) { this.i = (this.i + 1) % n; Snd.sfx('cursor'); this.o.onMove && this.o.onMove(this.i); }
    if (this.o.lr) { if (Input.take('left')) { this.finish({ lr: -1, i: this.i }); return; } if (Input.take('right')) { this.finish({ lr: 1, i: this.i }); return; } }
    if (this.i < this.scroll) this.scroll = this.i;
    if (this.i >= this.scroll + this.rows) this.scroll = this.i - this.rows + 1;
    if (Input.take('ok')) { if (this.items[this.i].disabled) { Snd.sfx('buzz'); } else { Snd.sfx('ok'); this.finish(this.i); } }
    else if ((this.o.cancel !== false) && (Input.take('cancel') || (this.o.menuCloses && Input.take('menu')))) { Snd.sfx('cancel'); this.finish(-1); }
  }
  draw() {
    const { x, y, w, h } = this;
    drawWin(x, y, w, h);
    let yy = y + 7;
    if (this.o.title) { text(this.o.title, x + 10, yy, { bold: true, color: '#d8c48a' }); yy += 18; }
    for (let r = 0; r < this.rows; r++) {
      const k = this.scroll + r, it = this.items[k]; if (!it) break;
      const sel = k === this.i && UI.top() === this;
      if (k === this.i) { ctx.fillStyle = sel ? 'rgba(184,167,122,.22)' : 'rgba(184,167,122,.1)'; ctx.fillRect(x + 5, yy - 1, w - 10, this.lh - 1); }
      if (sel) { ctx.fillStyle = '#e8d49a'; ctx.beginPath(); ctx.moveTo(x + 8, yy + 3); ctx.lineTo(x + 13, yy + 7); ctx.lineTo(x + 8, yy + 11); ctx.fill(); }
      text(it.label, x + 17, yy + 1, { color: it.disabled ? '#77706a' : (it.color || '#ece4d0') });
      if (it.right != null) text(String(it.right), x + w - 10, yy + 1, { align: 'right', color: it.disabled ? '#77706a' : '#c8bc98' });
      yy += this.lh;
    }
    if (this.scroll > 0) text('▲', x + w - 14, y + 2, { size: 8, color: '#b8a77a' });
    if (this.scroll + this.rows < this.items.length) text('▼', x + w - 14, y + h - 11, { size: 8, color: '#b8a77a' });
    if (this.o.desc) { const it = this.items[this.i]; if (it && it.desc) { drawWin(12, 216, VW - 24, 46); wrap(it.desc, VW - 50, 11).slice(0, 2).forEach((l, i) => text(l, 24, 223 + i * 16)); } }
    if (this.o.draw) this.o.draw(this);
  }
}
const menu = (items, o) => UI.push(new ListMenu(items, o));
async function ask(name, txt, options, o = {}) {
  const d = new Dialog(name, txt); d.ch = 9999; d.update = () => {};
  UI.stack.push(d);
  const r = await menu(options.map(s => ({ label: s })), Object.assign({ cancel: false, w: Math.max(90, ...options.map(s => { ctx.font = font(11); return ctx.measureText(s).width + 36; })) }, o));
  UI.remove(d);
  return r;
}

/* ----- Narration (full screen) ----- */
class Narration extends Widget {
  constructor(pages, o = {}) { super(); this.pages = pages; this.pi = 0; this.ch = 0; this.o = o; this.alpha = 0; this.lines = wrap(pages[0], 380, 13); }
  update(dt) {
    this.alpha = Math.min(1, this.alpha + dt * 2);
    const tot = this.lines.join('').length;
    if (this.ch < tot) { this.ch += dt * 40; if (Input.take('ok') || Input.take('cancel')) this.ch = tot; }
    else if (Input.take('ok') || Input.take('cancel')) { this.pi++; Snd.sfx('cursor'); if (this.pi >= this.pages.length) this.finish(); else { this.ch = 0; this.lines = wrap(this.pages[this.pi], 380, 13); } }
  }
  draw() {
    ctx.globalAlpha = this.o.bgAlpha != null ? this.o.bgAlpha : this.alpha; ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
    if (this.o.title) text(this.o.title, VW / 2, 34, { size: 13, align: 'center', color: '#a8946a', bold: true });
    let left = Math.floor(this.ch);
    const y0 = VH / 2 - this.lines.length * 11;
    this.lines.forEach((ln, i) => { const s = ln.slice(0, Math.max(0, left)); left -= ln.length; text(s, VW / 2, y0 + i * 22, { size: 13, align: 'center', color: '#e0d8c4' }); });
    if (this.ch >= this.lines.join('').length && Math.floor(G.time * 2) % 2 === 0) text('▼', VW / 2, VH - 30, { size: 9, align: 'center', color: '#8a7a5a' });
  }
}
const narrate = (pages, o) => UI.push(new Narration(Array.isArray(pages) ? pages : [pages], o));

class ChapterCard extends Widget {
  constructor(num, title) { super(); this.num = num; this.title = title; this.t = 0; }
  update(dt) { this.t += dt; if (this.t > 4.2 || (this.t > 0.8 && Input.take('ok'))) this.finish(); }
  draw() {
    ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, VW, VH);
    const a = clamp(Math.min(this.t * 1.2, (4.2 - this.t) * 1.5), 0, 1);
    ctx.globalAlpha = a;
    text(this.num, VW / 2, 104, { size: 12, align: 'center', color: '#a8946a' });
    ctx.fillStyle = '#7a2020'; ctx.fillRect(VW / 2 - 60, 124, 120, 1);
    text(this.title, VW / 2, 134, { size: 20, align: 'center', color: '#efe6d0', bold: true });
    ctx.globalAlpha = 1;
  }
}
const chapter = (n, t) => { Snd.sfx('bell'); return UI.push(new ChapterCard(n, t)); };

/* ----- Inventory helpers ----- */
const count = id => G.inv[id] || 0;
const has = id => count(id) > 0;
function give(id, n = 1, silent) { G.inv[id] = count(id) + n; if (!silent) { toast('Obtained ' + ITEMS[id].name + (n > 1 ? ' ×' + n : '')); Snd.sfx('item'); } }
function takeItem(id, n = 1) { G.inv[id] = Math.max(0, count(id) - n); if (!G.inv[id]) delete G.inv[id]; }
function addGold(n) { G.gold += n; if (n > 0) { toast('Received ' + n + ' mon'); Snd.sfx('coin'); } }
const TYPE_ORDER = ['use', 'battle', 'weapon', 'armor', 'charm', 'key'];
function invList(filter) {
  return Object.keys(G.inv).filter(id => G.inv[id] > 0 && (!filter || filter(ITEMS[id]))).sort((a, b) => TYPE_ORDER.indexOf(ITEMS[a].type) - TYPE_ORDER.indexOf(ITEMS[b].type));
}

/* ----- Main menu & sub screens ----- */
class InfoPanel extends Widget {
  draw() {
    drawWin(12, 8, 210, 72);
    ctx.drawImage(sprFrame('ren', 'idle', 'down', 0), 12, 2, 60, 60);
    text('Kagenuma Ren', 72, 14, { bold: true });
    text('Level ' + P.lv + (P.pts ? '   ◆ ' + P.pts + ' training pts' : ''), 72, 29, { size: 10, color: P.pts ? '#f0d070' : '#c8bc98' });
    text('HP', 72, 45, { size: 9, color: '#c8bc98' }); bar(88, 47, 80, 5, P.hp, maxHP(), '#c84a3a'); text(P.hp + '/' + maxHP(), 172, 43, { size: 9 });
    text('Ki', 72, 58, { size: 9, color: '#c8bc98' }); bar(88, 60, 80, 5, P.ki, maxKi(), '#4a8ad0'); text(P.ki + '/' + maxKi(), 172, 56, { size: 9 });
    drawWin(12, 84, 210, 40);
    text(G.map.name, 22, 90, { size: 10, color: '#d8c48a' });
    text(G.gold + ' mon     ' + fmtTime(G.playtime), 22, 106, { size: 10 });
  }
}
function fmtTime(t) { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return h + ':' + String(m).padStart(2, '0'); }

async function openMenu() {
  Snd.sfx('ok');
  const info = new InfoPanel(); UI.stack.push(info);
  let idx = 0;
  try {
    while (true) {
      const opts = [
        { label: 'Status' }, { label: 'Training', right: P.pts ? '◆' + P.pts : '', color: P.pts ? '#f0d070' : null },
        { label: 'Techniques' }, { label: 'Items' }, { label: 'Equipment' }, { label: 'Journal' },
        { label: 'Save' }, { label: 'Sound', right: Snd.on ? 'On' : 'Off' }, { label: 'Close' }];
      const i = await menu(opts, { x: VW - 132, y: 8, w: 120, index: idx, menuCloses: true });
      if (i < 0 || i === 8) return;
      idx = i;
      if (i === 0) await UI.push(new StatusScreen());
      else if (i === 1) await UI.push(new TrainingScreen());
      else if (i === 2) await techMenu();
      else if (i === 3) await itemMenu();
      else if (i === 4) await equipMenu();
      else if (i === 5) await UI.push(new JournalScreen());
      else if (i === 6) { if (G.map.noSave) await say('Not here — the enemy is too close. Find a shrine or rest at an inn.'); else { saveGame(); toast('Your journey has been recorded.'); Snd.sfx('ok'); } }
      else if (i === 7) { Snd.setOn(!Snd.on); }
    }
  } finally { UI.remove(info); }
}

class StatusScreen extends Widget {
  update() { if (Input.take('ok') || Input.take('cancel') || Input.take('menu')) { Snd.sfx('cancel'); this.finish(); } }
  draw() {
    drawWin(16, 10, VW - 32, VH - 20);
    ctx.drawImage(sprFrame('ren', 'idle', 'down', 0), 18, 4, 100, 100);
    text('Kagenuma Ren', 120, 24, { size: 15, bold: true });
    text('Shinobi of Iga · age 19', 120, 44, { size: 10, color: '#c8bc98' });
    text('Level ' + P.lv, 120, 62, { bold: true, color: '#e8d49a' });
    text('XP', 180, 63, { size: 9, color: '#c8bc98' }); bar(198, 66, 120, 5, P.xp, xpNext(P.lv), '#d8b050'); text(P.xp + ' / ' + xpNext(P.lv), 324, 62, { size: 9 });
    text('HP', 120, 82, { size: 10, color: '#c8bc98' }); bar(142, 85, 110, 6, P.hp, maxHP(), '#c84a3a'); text(P.hp + ' / ' + maxHP(), 258, 81, { size: 10 });
    text('Ki', 120, 98, { size: 10, color: '#c8bc98' }); bar(142, 101, 110, 6, P.ki, maxKi(), '#4a8ad0'); text(P.ki + ' / ' + maxKi(), 258, 97, { size: 10 });
    let y = 124;
    for (const k of ['str', 'agi', 'end', 'foc']) {
      const b = stat(k) - P[k];
      text(STAT_INFO[k][1], 32, y, { color: '#c8bc98' }); text(String(stat(k)), 120, y, { bold: true });
      if (b) text((b > 0 ? '+' : '') + b, 142, y, { size: 9, color: b > 0 ? '#8ad08a' : '#d08a8a' });
      y += 18;
    }
    text('Attack', 180, 124, { color: '#c8bc98' }); text(String(pAtk()), 260, 124, { bold: true });
    text('Defense', 180, 142, { color: '#c8bc98' }); text(String(pDef()), 260, 142, { bold: true });
    text('Critical', 180, 160, { color: '#c8bc98' }); text(pCrit() + '%', 260, 160, { bold: true });
    text('Mon', 180, 178, { color: '#c8bc98' }); text(String(G.gold), 260, 178, { bold: true });
    text('Weapon', 300, 124, { size: 9, color: '#c8bc98' }); text(ITEMS[P.eq.weapon].name, 300, 136, { size: 10 });
    text('Armor', 300, 154, { size: 9, color: '#c8bc98' }); text(ITEMS[P.eq.armor].name, 300, 166, { size: 10 });
    text('Charm', 300, 184, { size: 9, color: '#c8bc98' }); text(P.eq.charm ? ITEMS[P.eq.charm].name : '—', 300, 196, { size: 10 });
    ctx.fillStyle = '#5a4a30'; ctx.fillRect(32, 216, VW - 64, 1);
    wrap('Objective: ' + objective(), VW - 72, 10).slice(0, 2).forEach((l, i) => text(l, 32, 222 + i * 14, { size: 10, color: '#e8d49a' }));
  }
}

class TrainingScreen extends Widget {
  constructor() { super(); this.i = 0; this.keys = ['str', 'agi', 'end', 'foc']; this.flash = 0; }
  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 3);
    if (Input.take('up')) { this.i = (this.i + 3) % 4; Snd.sfx('cursor'); }
    if (Input.take('down')) { this.i = (this.i + 1) % 4; Snd.sfx('cursor'); }
    if (Input.take('ok')) {
      if (P.pts > 0) {
        const k = this.keys[this.i]; P[k]++; P.pts--;
        if (k === 'end') P.hp = Math.min(maxHP(), P.hp + 5);
        if (k === 'foc') P.ki = Math.min(maxKi(), P.ki + 2);
        Snd.sfx('heal'); this.flash = 1;
      } else Snd.sfx('buzz');
    }
    if (Input.take('cancel') || Input.take('menu')) { Snd.sfx('cancel'); this.finish(); }
  }
  draw() {
    drawWin(40, 20, VW - 80, VH - 40);
    text('Training', VW / 2, 30, { size: 15, bold: true, align: 'center', color: '#e8d49a' });
    text('Hours of practice in the hills harden body and mind.', VW / 2, 50, { size: 10, align: 'center', color: '#c8bc98' });
    text('Points to spend: ' + P.pts, VW / 2, 66, { size: 12, bold: true, align: 'center', color: P.pts ? '#f0d070' : '#8a8070' });
    this.keys.forEach((k, j) => {
      const y = 90 + j * 26, sel = j === this.i;
      if (sel) { ctx.fillStyle = 'rgba(184,167,122,' + (0.18 + this.flash * 0.3) + ')'; ctx.fillRect(56, y - 3, VW - 112, 22); }
      text(STAT_INFO[k][1], 70, y, { size: 12, bold: sel });
      text(String(P[k]), 180, y, { size: 12, bold: true, color: '#e8d49a' });
      text(STAT_INFO[k][2], 210, y + 1, { size: 10, color: '#c8bc98' });
    });
    text('Max HP ' + maxHP() + '    Max Ki ' + maxKi() + '    ATK ' + pAtk() + '    DEF ' + pDef() + '    CRIT ' + pCrit() + '%', VW / 2, 200, { size: 10, align: 'center' });
    text('[A] train   [B] done', VW / 2, 222, { size: 10, align: 'center', color: '#8a8070' });
  }
}

async function techMenu() {
  let idx = Math.max(0, P.skills.indexOf(P.active));
  while (true) {
    const list = P.skills.map(id => ({ id, label: SKILLS[id].name + (P.active === id ? '  ★' : ''), right: SKILLS[id].ki + ' Ki', desc: SKILLS[id].desc + (id === 'shuriken' ? '' : '  [A] Set as T-button technique'), color: P.active === id ? '#f0d070' : null }));
    const i = await menu(list, { x: 130, y: 30, w: 220, rows: 8, title: 'Techniques   Ki ' + P.ki + '/' + maxKi(), desc: true, index: idx });
    if (i < 0) return; idx = i;
    const id = list[i].id;
    if (id === 'shuriken') { toast('Shuriken always use the S button.'); continue; }
    P.active = id; toast(SKILLS[id].name + ' set to the T button.');
  }
}
function useItemField(id) {
  const it = ITEMS[id];
  if (it.heal || it.ki) {
    if ((!it.heal || P.hp >= maxHP()) && (!it.ki || P.ki >= maxKi())) { toast('No need right now.'); return; }
    if (it.heal) P.hp = Math.min(maxHP(), P.hp + it.heal);
    if (it.ki) P.ki = Math.min(maxKi(), P.ki + it.ki);
    takeItem(id); Snd.sfx('heal'); toast('Used ' + it.name, '#a0e0a0');
  } else if (it.cure) toast('You feel fine. Save it for battle.');
  else toast('That can only be used in battle.');
}
async function itemMenu() {
  let idx = 0;
  while (true) {
    const ids = invList();
    if (!ids.length) { await say('Your pack is empty.'); return; }
    const list = ids.map(id => ({ id, label: ITEMS[id].name, right: ITEMS[id].type === 'key' ? '' : '×' + count(id), desc: ITEMS[id].desc, color: ITEMS[id].type === 'key' ? '#d8c48a' : null }));
    const i = await menu(list, { x: 130, y: 20, w: 220, rows: 9, title: 'Items', desc: true, index: Math.min(idx, list.length - 1) });
    if (i < 0) return; idx = i;
    const id = list[i].id, it = ITEMS[id];
    if (it.type === 'use') useItemField(id);
    else if (it.read) await readDoc(it.read);
    else if (['weapon', 'armor', 'charm'].includes(it.type)) toast('Equip it from the Equipment menu.');
    else if (it.type === 'battle') toast('That can only be used in battle.');
  }
}
async function equipMenu() {
  let si = 0;
  const slots = ['weapon', 'armor', 'charm'];
  while (true) {
    const list = slots.map(s => ({ label: s[0].toUpperCase() + s.slice(1), right: P.eq[s] ? ITEMS[P.eq[s]].name : '—' }));
    const i = await menu(list, { x: 110, y: 30, w: 260, title: 'Equipment   ATK ' + pAtk() + '  DEF ' + pDef() + '  AGI ' + stat('agi'), index: si });
    if (i < 0) return; si = i;
    const slot = slots[i];
    const cands = invList(it => it.type === slot);
    const opts = cands.map(id => {
      const old = P.eq[slot]; P.eq[slot] = id; const a = pAtk(), d = pDef(), g = stat('agi'); P.eq[slot] = old;
      const da = a - pAtk(), dd = d - pDef(), dg = g - stat('agi');
      const f = (n, l) => n ? ' ' + l + (n > 0 ? '+' : '') + n : '';
      return { id, label: ITEMS[id].name, right: (f(da, 'ATK') + f(dd, 'DEF') + f(dg, 'AGI')).trim(), desc: ITEMS[id].desc };
    });
    if (slot === 'charm' && P.eq.charm) opts.push({ id: null, label: '(Remove)', desc: 'Go without a charm.' });
    if (!opts.length) { await say('You have nothing else to equip there.'); continue; }
    const j = await menu(opts, { x: 90, y: 40, w: 300, rows: 7, title: 'Equip ' + slot, desc: true });
    if (j < 0) continue;
    const nid = opts[j].id;
    if (P.eq[slot]) give(P.eq[slot], 1, true);
    if (nid) takeItem(nid);
    P.eq[slot] = nid;
    P.hp = Math.min(P.hp, maxHP()); P.ki = Math.min(P.ki, maxKi());
    Snd.sfx('ok');
  }
}
class JournalScreen extends Widget {
  update() { if (Input.take('ok') || Input.take('cancel') || Input.take('menu')) { Snd.sfx('cancel'); this.finish(); } }
  draw() {
    drawWin(30, 16, VW - 60, VH - 32);
    text('Journal', VW / 2, 26, { size: 15, bold: true, align: 'center', color: '#e8d49a' });
    text(CHAPTERS[G.flags.ch || 1] || '', VW / 2, 46, { size: 11, align: 'center', color: '#c8bc98' });
    let y = 70;
    wrap(objective(), VW - 100, 12).forEach(l => { text(l, 50, y, { size: 12 }); y += 18; });
    y += 8; ctx.fillStyle = '#5a4a30'; ctx.fillRect(50, y, VW - 100, 1); y += 8;
    const notes = journalNotes();
    for (const n of notes) { for (const l of wrap('· ' + n, VW - 100, 10)) { if (y > VH - 40) break; text(l, 50, y, { size: 10, color: '#c8bc98' }); y += 14; } }
  }
}

/* ----- Shops & inns ----- */
class GoldPanel extends Widget { draw() { drawWin(12, 8, 130, 24); text(G.gold + ' mon', 77, 13, { align: 'center', color: '#f0d070' }); } }
async function shop(stock, keeper) {
  const gp = new GoldPanel(); UI.stack.push(gp);
  try {
    while (true) {
      const c = await ask(keeper, 'What can I do for you?', ['Buy', 'Sell', 'Leave']);
      if (c === 2 || c < 0) { await say(keeper, 'Safe travels.'); return; }
      if (c === 0) {
        let idx = 0;
        while (true) {
          const list = stock.map(id => ({ id, label: ITEMS[id].name, right: ITEMS[id].price, disabled: G.gold < ITEMS[id].price, desc: ITEMS[id].desc + '  (Owned: ' + (count(id) + Object.values(P.eq).filter(e => e === id).length) + ')' }));
          const i = await menu(list, { x: 150, y: 20, w: 230, rows: 8, title: 'Buy', desc: true, index: idx });
          if (i < 0) break; idx = i;
          const id = list[i].id; G.gold -= ITEMS[id].price; give(id, 1, true); Snd.sfx('coin'); toast('Bought ' + ITEMS[id].name);
        }
      } else {
        let idx = 0;
        while (true) {
          const ids = invList(it => it.type !== 'key' && it.price > 0);
          if (!ids.length) { await say(keeper, "You've nothing I can buy."); break; }
          const list = ids.map(id => ({ id, label: ITEMS[id].name + ' ×' + count(id), right: Math.floor(ITEMS[id].price / 2), desc: ITEMS[id].desc }));
          const i = await menu(list, { x: 150, y: 20, w: 230, rows: 8, title: 'Sell', desc: true, index: Math.min(idx, list.length - 1) });
          if (i < 0) break; idx = i;
          const id = list[i].id; takeItem(id); G.gold += Math.floor(ITEMS[id].price / 2); Snd.sfx('coin');
        }
      }
    }
  } finally { UI.remove(gp); }
}
async function inn(price, keeper) {
  const c = await ask(keeper, 'A warm bath, a hot meal and a quiet room — ' + price + ' mon for the night.', ['Stay (' + price + ' mon)', 'No thanks']);
  if (c !== 0) { await say(keeper, 'Come back any time.'); return; }
  if (G.gold < price) { await say(keeper, "I'm sorry, you don't have enough."); return; }
  G.gold -= price;
  await fadeOut(0.8); Music.stop(); Snd.sfx('bell');
  P.hp = maxHP(); P.ki = maxKi();
  await wait(1.2); Music.play(G.map.music); await fadeIn(0.8);
  await say(keeper, 'Good morning. You look rested.');
  await savePrompt();
}
async function savePrompt() {
  const c = await ask(null, 'Record your journey?', ['Save', 'Not now']);
  if (c === 0) { saveGame(); toast('Your journey has been recorded.'); Snd.sfx('ok'); }
}
