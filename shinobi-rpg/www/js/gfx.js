'use strict';
/* ===== Graphics: procedural sprites, tiles, backgrounds, particles ===== */

function addOutline(c, col) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const d = g.getImageData(0, 0, w, h).data;
  const out = g.createImageData(w, h), o = out.data;
  const [r, gg, b] = hexRGB(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 200) continue;
    let n = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      if (d[(Y * w + X) * 4 + 3] > 200) { n = true; break; }
    }
    if (n) { o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = 255; }
  }
  const t = mkCanvas(w, h); t.getContext('2d').putImageData(out, 0, 0);
  g.drawImage(t, 0, 0);
  return c;
}
function whiteOf(c) {
  const w = mkCanvas(c.width, c.height), g = w.getContext('2d');
  g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return w;
}
function mirror(c) { const m = mkCanvas(c.width, c.height), g = m.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return m; }

/* ----- Humanoid characters ----- */
function drawChar(o, dir, fr) {
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const skin = o.skin || '#d6a77a', cl = o.cloth || '#444', c2 = o.cloth2 || shade(cl, -0.3);
  const belt = o.belt || '#1e1a18', hair = o.hair || '#17151a', eye = o.eye || '#120d0a', feet = o.feet || '#1b1b1f';
  const head = o.hood ? (o.hoodc || cl) : hair;
  const lc = o.legs || c2;
  const side = dir === 'right';
  if (!side) {
    if (o.robe) { P(4, 11, 8, 2, cl); P(5, 13, 2, 1, feet); P(9, 13, 2, 1, feet); }
    else {
      if (fr === 1) { P(5, 11, 2, 1, lc); P(5, 12, 2, 1, feet); } else { P(5, 11, 2, 2, lc); P(5, 13, 2, 1, feet); }
      if (fr === 2) { P(9, 11, 2, 1, lc); P(9, 12, 2, 1, feet); } else { P(9, 11, 2, 2, lc); P(9, 13, 2, 1, feet); }
    }
    P(4, 7, 8, 4, cl);
    if (o.armor) { P(4, 7, 8, 3, o.armor); P(4, 8, 8, 1, shade(o.armor, -0.3)); }
    P(4, 10, 8, 1, belt);
    const ay = fr === 1 ? 0 : fr === 2 ? 0 : 0;
    P(3, 7 + ay, 1, 3, c2); P(12, 7, 1, 3, c2);
    P(3, 10, 1, 1, skin); P(12, 10, 1, 1, skin);
    P(5, 1, 6, 6, head);
    if (dir === 'down') {
      if (o.hood) {
        P(6, 3, 4, 2, skin);
        P(6, 4, 1, 1, o.mask ? '#a01818' : eye); P(9, 4, 1, 1, o.mask ? '#a01818' : eye);
        if (o.maskc) P(6, 3, 4, 1, o.maskc);
      } else {
        P(6, 3, 4, 4, skin);
        if (o.female) { P(4, 2, 1, 7, hair); P(11, 2, 1, 7, hair); } else { P(5, 5, 1, 2, skin); P(10, 5, 1, 2, skin); }
        P(6, 4, 1, 1, eye); P(9, 4, 1, 1, eye);
        if (o.beard) P(6, 6, 4, 1, o.beard);
        if (o.scar) P(7, 2, 1, 4, '#9a4040');
      }
    } else {
      if (o.female && !o.hood) { P(5, 1, 6, 8, hair); }
    }
    if (o.topknot && !o.hood && !o.hat) P(7, 0, 2, 1, hair);
    if (o.band) P(5, 2, 6, 1, o.band);
    if (o.bandage) P(5, 3, 6, 1, '#d8d0c0');
  } else {
    if (o.robe) { P(5, 11, 6, 2, cl); P(5, 13, 2, 1, feet); P(9, 13, 2, 1, feet); }
    else if (fr === 1) { P(5, 11, 2, 2, lc); P(4, 13, 3, 1, feet); P(9, 11, 2, 2, lc); P(9, 13, 3, 1, feet); }
    else if (fr === 2) { P(6, 11, 2, 2, lc); P(6, 13, 3, 1, feet); P(8, 11, 2, 2, lc); P(8, 13, 2, 1, feet); }
    else { P(6, 11, 2, 2, lc); P(6, 13, 2, 1, feet); P(8, 11, 2, 2, lc); P(8, 13, 3, 1, feet); }
    P(5, 7, 6, 4, cl);
    if (o.armor) { P(5, 7, 6, 3, o.armor); P(5, 8, 6, 1, shade(o.armor, -0.3)); }
    P(5, 10, 6, 1, belt);
    const ax = fr === 1 ? 1 : fr === 2 ? -1 : 0;
    P(7 + ax, 7, 2, 3, c2); P(7 + ax, 10, 2, 1, skin);
    P(5, 1, 6, 6, head);
    if (o.hood) { P(8, 3, 3, 2, skin); P(9, 4, 1, 1, o.mask ? '#a01818' : eye); if (o.maskc) P(8, 3, 3, 1, o.maskc); }
    else {
      P(8, 3, 3, 4, skin); P(9, 4, 1, 1, eye);
      if (o.female) P(4, 2, 2, 7, hair);
      if (o.beard) P(8, 6, 3, 1, o.beard);
    }
    if (o.topknot && !o.hood && !o.hat) P(6, 0, 2, 1, hair);
    if (o.band) { P(5, 2, 6, 1, o.band); P(3, 2, 2, 1, o.band); P(2, 3, 2, 1, o.band); }
    if (o.bandage) P(5, 3, 6, 1, '#d8d0c0');
  }
  if (o.hat === 'jingasa') { const h = o.hatc || '#26262c'; P(3, 2, 10, 1, h); P(4, 1, 8, 1, h); P(6, 0, 4, 1, shade(h, 0.25)); }
  if (o.hat === 'kasa') { P(2, 2, 12, 2, '#a8854f'); P(4, 1, 8, 1, '#bb9862'); P(6, 0, 4, 1, '#cfae78'); }
  if (o.hat === 'eboshi') { P(6, -1, 4, 3, '#151515'); P(5, 1, 6, 1, '#151515'); }
  // weapons
  if (o.sword) {
    if (dir === 'down') { P(11, 3, 1, 4, '#3b2a1e'); P(11, 3, 1, 1, '#9a8a6a'); }
    else if (dir === 'up') { for (let i = 0; i < 8; i++) P(4 + i, 11 - i, 1, 1, '#2a1f17'); P(11, 3, 2, 2, '#5a4030'); }
    else { P(3, 4, 2, 2, '#4a3528'); }
  }
  if (o.spear) { const x = side ? 11 : 13; P(x, 0, 1, 13, '#6b4a2a'); P(x, 0, 1, 2, o.naginata ? '#e0e0e0' : '#c8c8c8'); if (o.naginata) P(x + 1, 0, 1, 3, '#e0e0e0'); }
  if (o.gun) { if (side) { P(6, 8, 10, 1, '#3a2a1a'); P(13, 8, 3, 1, '#555'); } else { P(1, 9, 13, 1, '#3a2a1a'); P(1, 9, 4, 1, '#555'); } }
  if (o.staff) { const x = side ? 11 : 13; P(x, 1, 1, 13, '#7a5a3a'); }
  // shadow under
  const s = mkCanvas(16, 16), sg = s.getContext('2d');
  sg.fillStyle = 'rgba(0,0,0,0.32)'; sg.beginPath(); sg.ellipse(8, 14.5, 5, 1.6, 0, 0, Math.PI * 2); sg.fill();
  addOutline(c, o.outline || '#0b0b10');
  sg.drawImage(c, 0, 0);
  return s;
}

function drawAnimal(type, fr) {
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const L = (xs, y, h, col) => xs.forEach(x => P(x, y, 1, h, col));
  if (type === 'boar') {
    const col = '#4b3a2b', dk = '#33271d';
    P(2, 6, 11, 6, col); P(3, 5, 8, 1, dk); P(12, 6, 3, 5, col); P(15, 8, 1, 2, '#7a5a4a'); P(14, 10, 1, 1, '#eee'); P(13, 7, 1, 1, '#111'); P(12, 5, 1, 1, dk);
    L(fr ? [3, 7, 10] : [4, 6, 11], 12, 2, dk); L(fr ? [5, 12] : [3, 9], 12, 2, dk);
  } else {
    const col = type === 'dog' ? '#7d5f3c' : '#66625e', bl = type === 'dog' ? '#a38660' : '#8a857f';
    P(3, 7, 9, 4, col); P(4, 10, 7, 1, bl); P(11, 5, 4, 4, col); P(14, 7, 2, 2, col); P(15, 7, 1, 1, '#111'); P(12, 4, 1, 1, col); P(14, 4, 1, 1, col);
    P(13, 6, 1, 1, type === 'dog' ? '#111' : '#e0c020'); P(1, 6, 2, 2, col); P(0, 5, 1, 1, col);
    if (fr) L([3, 7, 10], 11, 3, col), L([5, 12], 11, 2, col); else L([4, 6, 9, 11], 11, 3, col);
  }
  const s = mkCanvas(16, 16), sg = s.getContext('2d');
  sg.fillStyle = 'rgba(0,0,0,0.32)'; sg.beginPath(); sg.ellipse(8, 14.5, 6, 1.6, 0, 0, Math.PI * 2); sg.fill();
  addOutline(c, '#0b0b10'); sg.drawImage(c, 0, 0);
  return s;
}

const CHAR_DEFS = {
  ren: { hood: true, cloth: '#262d40', cloth2: '#1b2030', belt: '#6a2424', sword: true, legs: '#1f2433' },
  yuki_mask: { hood: true, cloth: '#3a2436', cloth2: '#2a1828', belt: '#b0b0b8', maskc: '#e8e4dc', legs: '#2a1828' },
  yuki: { female: true, cloth: '#3a2436', cloth2: '#2a1828', belt: '#b02a3a', hair: '#141218', legs: '#2a1828' },
  sota: { cloth: '#34405e', cloth2: '#242c44', band: '#e8e4dc', hair: '#1a1714', legs: '#242c44' },
  gonbei: { cloth: '#6b604f', cloth2: '#524838', hair: '#9a9690', topknot: true, beard: '#b8b4ac', bandage: true, skin: '#c99c72' },
  villager: { cloth: '#7a6a4a', cloth2: '#5a4c34', topknot: true },
  villager2: { cloth: '#4e6a6a', cloth2: '#3a5050', hair: '#2a2420', topknot: true },
  woman: { female: true, cloth: '#8a4a4a', cloth2: '#6a3434', belt: '#d8c890' },
  woman2: { female: true, cloth: '#4a5a7a', cloth2: '#36445e', belt: '#c8a060' },
  oldwoman: { female: true, cloth: '#5a5048', cloth2: '#463e36', hair: '#a8a49c' },
  child: { cloth: '#a07040', cloth2: '#7a5430', hair: '#1a1714' },
  merchant: { cloth: '#5a6a3a', cloth2: '#44522a', topknot: true, belt: '#3a2a1a' },
  smith: { cloth: '#6a4a3a', cloth2: '#c99c72', band: '#e0d8c8', topknot: true, skin: '#c48e62' },
  innkeep: { female: true, cloth: '#6a3a5a', cloth2: '#4e2a44', belt: '#e8d8a0' },
  priest: { cloth: '#e8e4dc', cloth2: '#c8c4bc', legs: '#8a2a2a', hat: 'eboshi', robe: true },
  monk_npc: { cloth: '#4a4038', cloth2: '#3a322a', hat: 'kasa', robe: true, staff: true },
  magistrate: { cloth: '#2a3048', cloth2: '#1e2236', topknot: true, belt: '#a08040', robe: true },
  informant: { cloth: '#5a5a6a', cloth2: '#44444e', hair: '#2a2420', topknot: true, belt: '#8a3a2a' },
  ashigaru: { cloth: '#3a4866', cloth2: '#2c3650', hat: 'jingasa', spear: true, armor: '#2e2e36' },
  gate_guard: { cloth: '#3a4866', cloth2: '#2c3650', hat: 'jingasa', spear: true, armor: '#2e2e36' },
  gunner: { cloth: '#3a4866', cloth2: '#2c3650', hat: 'jingasa', gun: true },
  bandit: { cloth: '#6a5a3a', cloth2: '#4a3e28', band: '#8a2a2a', hair: '#231d18', sword: true, skin: '#c48e62' },
  looter: { cloth: '#5e5a4a', cloth2: '#444032', hair: '#231d18', skin: '#c48e62' },
  tozo: { cloth: '#7a3020', cloth2: '#5a2014', band: '#d8c8a0', hair: '#1a1410', beard: '#1a1410', sword: true, armor: '#4a3a2a', skin: '#b8805a' },
  ronin: { cloth: '#4a4a5a', cloth2: '#363644', hat: 'kasa', sword: true },
  crow: { hood: true, cloth: '#17171d', cloth2: '#101014', belt: '#7a1a1a', sword: true },
  crow2: { hood: true, cloth: '#121216', cloth2: '#0a0a0e', belt: '#9a1a1a', sword: true, mask: true, maskc: '#7a1a1a' },
  samurai: { cloth: '#5a2a2a', cloth2: '#3a1c1c', armor: '#2a2a30', topknot: true, sword: true, hair: '#141210' },
  monk: { hood: true, hoodc: '#e8e2d4', cloth: '#d8d0c0', cloth2: '#b8b0a0', legs: '#3a3a3a', spear: true, naginata: true },
  shadow: { hood: true, cloth: '#0b0b10', cloth2: '#07070a', belt: '#2a2a34', sword: true, mask: true, outline: '#3a3a52' },
  hanzaki: { hood: true, cloth: '#2a2a30', cloth2: '#1a1a20', armor: '#6a6a74', belt: '#8a1a1a', mask: true, maskc: '#4a4a52', sword: true },
  gensai: { cloth: '#1a1418', cloth2: '#3a1018', armor: '#3a1018', hair: '#7e7a78', topknot: true, scar: true, sword: true, belt: '#9a8040' },
  oda_officer: { cloth: '#3a2a4a', cloth2: '#2a1e36', armor: '#1e1e24', hat: 'jingasa', hatc: '#5a4a1a', sword: true },
};

const SPR = {};
function buildSprites() {
  for (const k in CHAR_DEFS) {
    const o = CHAR_DEFS[k], s = { down: [], up: [], left: [], right: [] };
    for (let f = 0; f < 3; f++) {
      s.down.push(drawChar(o, 'down', f)); s.up.push(drawChar(o, 'up', f));
      const r = drawChar(o, 'right', f); s.right.push(r); s.left.push(mirror(r));
    }
    s.white = whiteOf(s.down[0]);
    SPR[k] = s;
  }
  for (const k of ['wolf', 'dog', 'boar']) {
    const s = { down: [], up: [], left: [], right: [] };
    for (let f = 0; f < 3; f++) { const r = drawAnimal(k, f === 1 ? 1 : 0); s.right.push(r); s.left.push(mirror(r)); s.down.push(mirror(r)); s.up.push(r); }
    s.white = whiteOf(s.down[0]); s.animal = true;
    SPR[k] = s;
  }
}

/* ----- Tiles ----- */
const TD = {};
function T(ch, solid, draw, opt = {}) { TD[ch] = Object.assign({ ch, solid, draw, frames: 1, variants: 3, base: null, light: 0 }, opt); }
function dots(g, r, cols, n) { for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); } }
function fill(g, col) { g.fillStyle = col; g.fillRect(0, 0, 16, 16); }
const PX = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

T('.', 0, (g, r) => { fill(g, '#4a6b3a'); dots(g, r, ['#3f5d31', '#567a43', '#43633a'], 24); for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 13); PX(g, x, y, 1, 2, '#5f8a4a'); PX(g, x + 1, y + 1, 1, 2, '#5f8a4a'); } });
T(',', 0, (g, r) => { fill(g, '#8a7352'); dots(g, r, ['#7a6444', '#9a8362', '#836c4b'], 30); if (r() < 0.5) PX(g, Math.floor(r() * 13), Math.floor(r() * 13), 2, 1, '#a69070'); });
T('a', 0, (g, r) => { fill(g, '#463e39'); dots(g, r, ['#3a332f', '#544a44', '#2e2826', '#5c514a'], 40); });
T('z', 0, (g, r) => { fill(g, '#b8b0a0'); for (let y = 1; y < 16; y += 3) PX(g, 0, y, 16, 1, '#a49c8c'); dots(g, r, ['#c8c0b0', '#a09888'], 12); });
T('S', 0, (g, r) => { fill(g, '#5e5a54'); PX(g, 0, 0, 16, 1, '#4a4642'); PX(g, 0, 8, 16, 1, '#4a4642'); PX(g, r() < .5 ? 5 : 9, 1, 1, 7, '#4a4642'); PX(g, r() < .5 ? 3 : 12, 9, 1, 7, '#4a4642'); dots(g, r, ['#68645e', '#56524c'], 14); });
T('F', 0, (g, r) => { fill(g, '#5e4430'); for (let x = 0; x < 16; x += 4) PX(g, x, 0, 1, 16, '#4a3424'); PX(g, Math.floor(r() * 4) * 4 + 1, Math.floor(r() * 12), 3, 1, '#4a3424'); dots(g, r, ['#6a4e38', '#563e2a'], 10); });
T('e', 0, (g, r) => { fill(g, '#5e4430'); PX(g, 2, 0, 12, 16, '#6a1c1c'); PX(g, 3, 0, 1, 16, '#8a2a24'); PX(g, 12, 0, 1, 16, '#8a2a24'); });
T('q', 0, (g) => { fill(g, '#3a2a1e'); for (let y = 0; y < 16; y += 4) { PX(g, 0, y, 16, 3, '#5e4430'); PX(g, 0, y + 3, 16, 1, '#221810'); } });
T('f', 0, (g, r) => { TD['.'].draw(g, r); for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13); const c = ['#c03040', '#e8e0d0', '#d8a830', '#b04870'][Math.floor(r() * 4)]; PX(g, x, y, 2, 2, c); PX(g, x, y + 2, 1, 1, '#2e4a24'); } });
T('~', 1, (g, r, f) => { fill(g, '#2c4c6a'); dots(g, r, ['#284660', '#30526f'], 16); for (let i = 0; i < 3; i++) { const y = (i * 5 + f * 2 + Math.floor(r() * 2)) % 16, x = Math.floor(r() * 10); PX(g, x, y, 4, 1, '#4a7090'); PX(g, x + 1, y - 1 < 0 ? 0 : y - 1, 2, 1, '#5c84a4'); } }, { frames: 2 });
T('=', 0, (g) => { fill(g, '#2c4c6a'); PX(g, 0, 1, 16, 14, '#7a5a38'); for (let x = 0; x < 16; x += 4) PX(g, x, 1, 1, 14, '#5a4028'); PX(g, 0, 1, 16, 1, '#4a3420'); PX(g, 0, 14, 16, 1, '#4a3420'); }, { variants: 1 });
T('T', 1, (g, r) => { PX(g, 7, 11, 3, 5, '#4a3420'); g.fillStyle = '#284626'; g.beginPath(); g.arc(8, 7, 7.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#335a2f'; g.beginPath(); g.arc(7, 6, 5, 0, Math.PI * 2); g.fill(); dots(g, r, ['#3e6a38', '#22401f', '#2c4e29'], 16); PX(g, 4, 3, 2, 2, '#4a7a42'); }, { base: '.' });
T('P', 1, (g, r) => { PX(g, 7, 12, 2, 4, '#3a2618'); g.fillStyle = '#1e3a2a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8, 1 + i * 3); g.lineTo(1 + i, 8 + i * 2); g.lineTo(15 - i, 8 + i * 2); g.fill(); } g.fillStyle = '#2a4c36'; g.beginPath(); g.moveTo(8, 2); g.lineTo(4, 8); g.lineTo(9, 8); g.fill(); dots(g, r, ['#163024'], 6); }, { base: '.' });
T('h', 1, (g, r) => { PX(g, 7, 11, 2, 5, '#3a2a24'); g.fillStyle = '#c87a94'; g.beginPath(); g.arc(8, 7, 7, 0, Math.PI * 2); g.fill(); dots(g, r, ['#e8a8bc', '#b0607a', '#f0c8d4'], 26); }, { base: '.' });
T('v', 1, (g, r) => { PX(g, 7, 4, 2, 12, '#1e1814'); PX(g, 4, 6, 3, 1, '#1e1814'); PX(g, 9, 3, 4, 1, '#1e1814'); PX(g, 3, 5, 1, 1, '#1e1814'); PX(g, 12, 2, 1, 1, '#1e1814'); }, { base: 'a' });
T('b', 1, (g, r) => { fill(g, '#3a5428'); for (let i = 0; i < 3; i++) { const x = 1 + i * 5 + Math.floor(r() * 2); PX(g, x, 0, 2, 16, '#6e9a4a'); PX(g, x, 0, 1, 16, '#8ab060'); PX(g, x, 4 + i * 2, 2, 1, '#4a7032'); PX(g, x, 11 + i, 2, 1, '#4a7032'); PX(g, x + 2, 3 + i * 3, 2, 1, '#5a8a3a'); } });
T('#', 1, (g, r) => { fill(g, '#6a6870'); for (let y = 0; y < 16; y += 5) { PX(g, 0, y, 16, 1, '#48464e'); const o = (y / 5) % 2 ? 4 : 0; for (let x = o; x < 16; x += 8) PX(g, x, y, 1, 5, '#48464e'); } dots(g, r, ['#7a7880', '#5a5860'], 8); });
T('c', 1, (g, r) => { fill(g, '#2a2a32'); for (let y = 0; y < 16; y += 4) { PX(g, 0, y, 16, 1, '#1c1c22'); const o = (y / 4) % 2 ? 3 : 7; PX(g, o, y, 1, 4, '#1c1c22'); PX(g, o + 8 > 15 ? o - 6 : o + 8, y, 1, 4, '#1c1c22'); } PX(g, 0, 0, 16, 1, '#3c3c46'); dots(g, r, ['#34343e', '#222228'], 8); });
T('H', 1, (g) => { fill(g, '#d6cdb6'); PX(g, 0, 0, 1, 16, '#4a3622'); PX(g, 15, 0, 1, 16, '#4a3622'); PX(g, 0, 0, 16, 2, '#4a3622'); PX(g, 0, 10, 16, 6, '#5a4028'); PX(g, 0, 10, 16, 1, '#3a2a18'); PX(g, 5, 4, 6, 4, '#3a2a1a'); PX(g, 6, 4, 1, 4, '#a89a80'); PX(g, 9, 4, 1, 4, '#a89a80'); PX(g, 5, 6, 6, 1, '#a89a80'); }, { variants: 1 });
T('R', 1, (g, r) => { fill(g, '#3a4250'); for (let y = 0; y < 16; y += 4) { PX(g, 0, y + 3, 16, 1, '#262c36'); for (let x = (y / 4) % 2 ? 2 : 0; x < 16; x += 4) PX(g, x, y, 1, 3, '#2e3540'); } PX(g, 0, 0, 16, 1, '#4c5464'); }, { variants: 1 });
T('D', 1, (g) => { fill(g, '#5a4028'); PX(g, 0, 0, 16, 2, '#4a3622'); PX(g, 2, 2, 12, 6, '#2a3a6a'); PX(g, 7, 2, 2, 6, '#1e2a50'); PX(g, 3, 3, 3, 3, '#e8e4dc'); PX(g, 2, 8, 12, 8, '#2a1e14'); PX(g, 7, 8, 2, 8, '#3a2a1c'); }, { variants: 1 });
T('G', 0, (g) => { fill(g, '#2a1c12'); PX(g, 0, 0, 7, 16, '#4a3020'); PX(g, 9, 0, 7, 16, '#4a3020'); for (const x of [2, 5, 11, 14]) for (const y of [3, 8, 13]) PX(g, x - 1, y, 2, 2, '#1a1a1e'); PX(g, 0, 0, 16, 1, '#1a120c'); }, { variants: 1 });
T('x', 1, (g, r, f) => { TD.a.draw(g, r); g.strokeStyle = '#151110'; g.lineWidth = 2; g.beginPath(); g.moveTo(1, 3 + r() * 4); g.lineTo(15, 9 + r() * 5); g.moveTo(3, 15); g.lineTo(9 + r() * 4, 1); g.stroke(); PX(g, 2, 11, 5, 3, '#221a16'); for (let i = 0; i < 4; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); PX(g, x, y, 1, 1, (f + i) % 2 ? '#e0602a' : '#7a2a10'); } }, { frames: 2, light: 0.35, lightCol: 'fire' });
T('g', 1, (g) => { PX(g, 4, 2, 8, 11, '#8a8a8e'); PX(g, 4, 2, 8, 1, '#a4a4a8'); PX(g, 5, 4, 1, 7, '#6a6a70'); PX(g, 3, 12, 10, 3, '#6a6a70'); PX(g, 7, 4, 2, 6, '#5a5a60'); }, { base: '.', variants: 1 });
T('j', 1, (g) => { PX(g, 5, 2, 6, 5, '#8c8a86'); PX(g, 4, 6, 8, 8, '#7c7a76'); PX(g, 4, 7, 8, 3, '#b0302a'); PX(g, 6, 4, 1, 1, '#5a5856'); PX(g, 9, 4, 1, 1, '#5a5856'); PX(g, 3, 13, 10, 2, '#5a5856'); }, { base: '.', variants: 1 });
T('r', 1, (g, r) => { g.fillStyle = '#6e6a66'; g.beginPath(); g.ellipse(8, 9, 7, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#86827c'; g.beginPath(); g.ellipse(6, 7, 4, 3, 0, 0, Math.PI * 2); g.fill(); dots(g, r, ['#5a5652'], 5); PX(g, 2, 14, 12, 1, 'rgba(0,0,0,.25)'); }, { base: '.' });
T('m', 1, (g, r) => { fill(g, '#5a5048'); for (let y = 0; y < 16; y += 4) { PX(g, 0, y, 16, 1, '#433a34'); PX(g, Math.floor(r() * 12), y + 1, 4, 1, '#6c6258'); } dots(g, r, ['#4a423c', '#665c52'], 14); });
T('W', 1, (g, r, f) => { fill(g, '#5a84a8'); for (let x = 0; x < 16; x += 2) { const o = (x * 3 + f * 5) % 16; PX(g, x, o, 1, 6, '#dce8f0'); PX(g, x + 1, (o + 8) % 16, 1, 5, '#a8c4dc'); } }, { frames: 3, variants: 1 });
T('t', 1, (g, r, f) => { PX(g, 6, 9, 4, 6, '#2a2a2e'); PX(g, 4, 7, 8, 3, '#3a3a40'); const fl = ['#ffb030', '#ff7020', '#ffd060']; PX(g, 5, 4 - f % 2, 6, 4, fl[1]); PX(g, 6, 2 + (f % 3 === 1 ? 1 : 0), 4, 4, fl[0]); PX(g, 7, 2, 2, 3, fl[2]); }, { base: 'S', frames: 3, variants: 1, light: 1, lightCol: 'fire' });
T('l', 1, (g) => { PX(g, 6, 12, 4, 3, '#7a7874'); PX(g, 7, 8, 2, 4, '#7a7874'); PX(g, 4, 6, 8, 3, '#8a8884'); PX(g, 6, 7, 4, 1, '#ffcc66'); PX(g, 3, 4, 10, 2, '#8a8884'); PX(g, 7, 2, 2, 2, '#8a8884'); }, { base: '.', variants: 1, light: 0.5, lightCol: 'warm' });
T('o', 1, (g) => { for (let x = 1; x < 16; x += 3) PX(g, x, 4, 2, 10, '#a89060'); PX(g, 0, 6, 16, 1, '#6a5a3a'); PX(g, 0, 10, 16, 1, '#6a5a3a'); }, { base: '.', variants: 1 });
T('C', 1, (g) => { PX(g, 2, 5, 12, 9, '#6a4426'); PX(g, 2, 5, 12, 3, '#82552f'); PX(g, 2, 8, 12, 1, '#3a2414'); PX(g, 7, 7, 2, 3, '#c8a040'); PX(g, 2, 13, 12, 1, '#3a2414'); }, { base: '.', variants: 1 });
T('k', 1, (g) => { PX(g, 7, 4, 2, 12, '#4a3626'); g.fillStyle = '#2a201c'; g.beginPath(); g.arc(8, 4, 3.2, 0, Math.PI * 2); g.fill(); PX(g, 5, 2, 6, 2, '#141010'); }, { base: ',', variants: 1 });
T('I', 1, (g) => { PX(g, 5, 0, 6, 16, '#b0281e'); PX(g, 5, 0, 2, 16, '#c8402e'); PX(g, 4, 13, 8, 3, '#1a1a1a'); }, { base: 'z', variants: 1 });
T('i', 0, (g, r) => { TD.z.draw(g, r); PX(g, 0, 4, 16, 3, '#b0281e'); PX(g, 0, 1, 16, 2, '#1a1a1a'); }, { variants: 1 });
T('p', 1, (g, r) => { fill(g, '#4a6a5a'); dots(g, r, ['#5a7a6a', '#3e5c4e'], 10); for (let y = 2; y < 16; y += 4) for (let x = 2; x < 16; x += 4) PX(g, x, y, 1, 2, '#8aa84a'); });
T('u', 1, (g) => { PX(g, 3, 3, 10, 10, '#6a6a70'); PX(g, 5, 5, 6, 6, '#1a2a3a'); PX(g, 2, 2, 12, 1, '#5a4028'); PX(g, 2, 2, 1, 12, '#5a4028'); PX(g, 13, 2, 1, 12, '#5a4028'); }, { base: '.', variants: 1 });
T('w', 1, (g) => { fill(g, '#d6cdb6'); PX(g, 0, 0, 16, 4, '#3a4250'); PX(g, 0, 3, 16, 1, '#262c36'); PX(g, 0, 12, 16, 4, '#6a6870'); PX(g, 0, 12, 16, 1, '#48464e'); }, { variants: 1 });
T('n', 0, (g) => { fill(g, '#b8a868'); PX(g, 0, 0, 16, 1, '#2a2418'); PX(g, 0, 0, 1, 16, '#2a2418'); dots(g, seeded(5), ['#a89858', '#c4b474'], 20); }, { variants: 1 });

const TILE_CACHE = {};
function tileImg(ch, v, f) {
  const k = ch + v + '_' + f;
  let c = TILE_CACHE[k];
  if (!c) {
    c = mkCanvas(16, 16);
    const d = TD[ch] || TD['.'];
    d.draw(c.getContext('2d'), seeded(ch.charCodeAt(0) * 131 + v * 977 + 7), f);
    TILE_CACHE[k] = c;
  }
  return c;
}
function chestOpenImg() {
  if (TILE_CACHE.__chest) return TILE_CACHE.__chest;
  const c = mkCanvas(16, 16), g = c.getContext('2d');
  PX(g, 2, 7, 12, 7, '#6a4426'); PX(g, 3, 8, 10, 3, '#1a1008'); PX(g, 2, 3, 12, 4, '#82552f'); PX(g, 2, 13, 12, 1, '#3a2414');
  return (TILE_CACHE.__chest = c);
}

/* ----- Battle backgrounds ----- */
const BG_CACHE = {};
function battleBg(type) {
  if (BG_CACHE[type]) return BG_CACHE[type];
  const c = mkCanvas(VW, VH), g = c.getContext('2d'), r = seeded(type.length * 77 + 3);
  const sky = {
    village: ['#1a0a10', '#5a1a14', '#a8401c'], forest: ['#2a1e30', '#7a4a3a', '#d08850'], town: ['#3a5a7a', '#8aa8c0', '#d8d0b8'],
    pass: ['#4a5868', '#8a98a4', '#c0c4c4'], falls: ['#3a5060', '#7a98a8', '#b8ccd0'], fortress: ['#0e0e18', '#2a2238', '#5a3a3a'],
    castle: ['#08080c', '#14121a', '#1e1a22'], throne: ['#0a0608', '#2a0e12', '#4a1818'], spring: ['#6a8ab0', '#b0c8dc', '#f0dce0'],
  }[type] || ['#222', '#444', '#666'];
  const gr = g.createLinearGradient(0, 0, 0, 190); gr.addColorStop(0, sky[0]); gr.addColorStop(0.6, sky[1]); gr.addColorStop(1, sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  const ridge = (y0, amp, col, step) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, VH); let y = y0; for (let x = 0; x <= VW; x += step) { y = clamp(y + (r() - 0.5) * amp, y0 - amp * 2, y0 + amp); g.lineTo(x, y); } g.lineTo(VW, VH); g.fill(); };
  const indoor = type === 'castle' || type === 'throne';
  if (!indoor) {
    if (type === 'fortress' || type === 'village') { g.fillStyle = 'rgba(255,240,200,.85)'; g.beginPath(); g.arc(390, 46, 14, 0, Math.PI * 2); g.fill(); }
    ridge(110, 26, shade(sky[1], -0.35), 12);
    ridge(140, 18, shade(sky[1], -0.55), 8);
  }
  if (type === 'forest' || type === 'pass' || type === 'falls') {
    for (let i = 0; i < 26; i++) { const x = r() * VW, h = 50 + r() * 70, y = 160 - r() * 10; g.fillStyle = shade(sky[0], -0.3 - r() * 0.3); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x - 16 - r() * 10, y); g.lineTo(x + 16 + r() * 10, y); g.fill(); }
  }
  if (type === 'falls') { g.fillStyle = 'rgba(220,235,245,.55)'; g.fillRect(60, 30, 40, 140); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(70, 30, 10, 140); }
  if (type === 'village') {
    for (let i = 0; i < 6; i++) { const x = 30 + i * 80 + r() * 20; g.fillStyle = '#120808'; g.fillRect(x, 120, 50, 40); g.beginPath(); g.moveTo(x - 8, 122); g.lineTo(x + 25, 100); g.lineTo(x + 58, 122); g.fill(); g.fillStyle = 'rgba(255,120,40,.6)'; g.fillRect(x + 10 + r() * 20, 130, 6, 8); }
  }
  if (type === 'town') { for (let i = 0; i < 7; i++) { const x = i * 72 + r() * 10; g.fillStyle = '#2e3440'; g.beginPath(); g.moveTo(x - 6, 130); g.lineTo(x + 30, 112); g.lineTo(x + 66, 130); g.fill(); g.fillStyle = '#c8bea6'; g.fillRect(x, 130, 60, 30); g.fillStyle = '#4a3622'; g.fillRect(x, 130, 60, 3); } }
  if (type === 'fortress') { g.fillStyle = '#16141c'; g.fillRect(0, 100, VW, 70); for (let x = 0; x < VW; x += 24) g.fillRect(x, 92, 14, 10); g.fillStyle = '#1e1a24'; g.beginPath(); g.moveTo(170, 100); g.lineTo(240, 40); g.lineTo(310, 100); g.fill(); }
  if (indoor) {
    for (let x = 20; x < VW; x += 90) { g.fillStyle = '#2a1e18'; g.fillRect(x, 0, 18, 170); g.fillStyle = '#3a2a20'; g.fillRect(x, 0, 4, 170); }
    g.fillStyle = '#1a120e'; g.fillRect(0, 0, VW, 14);
    if (type === 'throne') { g.fillStyle = 'rgba(160,30,30,.25)'; g.fillRect(0, 0, VW, 170); }
  }
  // ground
  const gcol = { village: '#2a1e18', forest: '#2e3a22', town: '#7a6a50', pass: '#4a463e', falls: '#3e4a3a', fortress: '#2a2a2e', castle: '#2a1e16', throne: '#2a1214', spring: '#5a7a4a' }[type] || '#333';
  const gg = g.createLinearGradient(0, 160, 0, VH); gg.addColorStop(0, gcol); gg.addColorStop(1, shade(gcol, -0.6));
  g.fillStyle = gg; g.fillRect(0, 160, VW, VH - 160);
  for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(r() * VW, 162 + r() * 100, 2 + r() * 8, 1); }
  return (BG_CACHE[type] = c);
}

/* ----- Particles (screen space) ----- */
const Parts = {
  list: [], kind: null,
  set(k) { if (this.kind !== k) { this.kind = k; this.list = []; } },
  update(dt) {
    const k = this.kind;
    if (k) {
      const rate = { embers: 22, leaves: 5, petals: 9, mist: 1.2, dust: 4, fireflies: 1.5, rain: 60, snow: 10 }[k] || 0;
      if (Math.random() < rate * dt) this.spawn(k);
    }
    for (const p of this.list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.sway) p.x += Math.sin(p.t * p.sway) * 0.4; }
    this.list = this.list.filter(p => p.t < p.life && p.y < VH + 20 && p.y > -30 && p.x > -40 && p.x < VW + 40);
  },
  spawn(k) {
    const p = { t: 0, x: Math.random() * VW, y: 0, vx: 0, vy: 0, life: 6, k };
    if (k === 'embers') { p.y = VH + 4; p.vx = R.f(-8, 8); p.vy = R.f(-30, -12); p.life = R.f(3, 8); p.sway = 2; }
    else if (k === 'leaves') { p.y = -6; p.vx = R.f(8, 20); p.vy = R.f(14, 24); p.life = 20; p.sway = 2.5; p.c = R.pick(['#b8401c', '#d07020', '#a02a18', '#c89030']); }
    else if (k === 'petals') { p.y = -6; p.vx = R.f(10, 24); p.vy = R.f(10, 20); p.life = 25; p.sway = 3; p.c = R.pick(['#f4c8d4', '#e8a8bc', '#fff0f4']); }
    else if (k === 'mist') { p.x = -40; p.y = R.f(0, VH); p.vx = R.f(6, 12); p.vy = 0; p.life = 60; p.r = R.f(30, 60); }
    else if (k === 'dust') { p.y = R.f(0, VH); p.vx = R.f(-3, 3); p.vy = R.f(-3, 3); p.life = R.f(4, 8); }
    else if (k === 'fireflies') { p.y = R.f(40, VH); p.vx = R.f(-6, 6); p.vy = R.f(-6, 6); p.life = R.f(3, 6); p.sway = 1.5; }
    else if (k === 'rain') { p.y = -10; p.vx = -40; p.vy = 380; p.life = 2; }
    this.list.push(p);
  },
  draw(g) {
    for (const p of this.list) {
      const fade = Math.min(1, p.t, (p.life - p.t));
      if (p.k === 'embers') { g.fillStyle = `rgba(255,${120 + Math.floor(Math.random() * 80)},40,${0.8 * fade})`; g.fillRect(p.x, p.y, 1.5, 1.5); }
      else if (p.k === 'leaves' || p.k === 'petals') { g.fillStyle = p.c; g.globalAlpha = 0.9 * clamp(fade, 0, 1); g.fillRect(p.x, p.y, 2, 1.5); g.fillRect(p.x + Math.sin(p.t * 4), p.y + 1, 1.5, 1); g.globalAlpha = 1; }
      else if (p.k === 'mist') { g.fillStyle = `rgba(230,236,240,${0.08 * clamp(fade, 0, 1)})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      else if (p.k === 'dust') { g.fillStyle = `rgba(200,180,150,${0.35 * clamp(fade, 0, 1)})`; g.fillRect(p.x, p.y, 1, 1); }
      else if (p.k === 'fireflies') { g.fillStyle = `rgba(210,255,120,${(0.5 + 0.5 * Math.sin(p.t * 6)) * clamp(fade, 0, 1)})`; g.fillRect(p.x, p.y, 1.5, 1.5); }
      else if (p.k === 'rain') { g.strokeStyle = 'rgba(180,200,230,.35)'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - 2, p.y + 9); g.stroke(); }
    }
  },
};

/* ----- Lighting ----- */
const lightC = mkCanvas(VW, VH), lgc = lightC.getContext('2d');
function drawLighting(dark, col, lights) {
  lgc.globalCompositeOperation = 'source-over';
  lgc.clearRect(0, 0, VW, VH);
  lgc.globalAlpha = dark; lgc.fillStyle = col || '#050814'; lgc.fillRect(0, 0, VW, VH); lgc.globalAlpha = 1;
  lgc.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const gr = lgc.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    gr.addColorStop(0, 'rgba(0,0,0,' + l.a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    lgc.fillStyle = gr; lgc.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.drawImage(lightC, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (!l.glow) continue;
    const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.7);
    gr.addColorStop(0, l.glow); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ----- Text & windows ----- */
function drawWin(x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(10,12,22,' + (alpha == null ? 0.92 : alpha) + ')';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0a0a0f'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeStyle = '#b8a77a'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = '#b8a77a';
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 4, y + 1], [x + 1, y + h - 4], [x + w - 4, y + h - 4]]) ctx.fillRect(cx, cy, 3, 3);
}
function text(s, x, y, o = {}) {
  ctx.font = font(o.size || 11, o.bold);
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'top';
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillText(s, x + 0.7, y + 0.7); }
  ctx.fillStyle = o.color || '#ece4d0';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
function wrap(s, maxW, size, bold) {
  ctx.font = font(size || 11, bold);
  const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function bar(x, y, w, h, v, max, col, bg) {
  ctx.fillStyle = bg || '#1a1414'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(0, Math.round(w * clamp(v / max, 0, 1))), h);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x, y, Math.max(0, Math.round(w * clamp(v / max, 0, 1))), 1);
}
