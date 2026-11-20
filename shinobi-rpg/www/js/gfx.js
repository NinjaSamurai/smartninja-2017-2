'use strict';
/* ===== 16-bit style procedural graphics =====
   Sprites are drawn as flat "materials" on a pixel grid, then auto-shaded
   (top/left light rim, bottom/right shadow rim) and outlined, giving the
   3-tone SNES look. Terrain is rendered per pixel with organic blended edges. */

/* ----- noise ----- */
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => vnoise(x, y) * 0.62 + vnoise(x * 2.3 + 17, y * 2.3 + 9) * 0.38;
const rgb = h => hexRGB(h);
const mul = (c, k) => [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ramp(h) { const c = rgb(h); return { c: [mix(mul(c, 0.62), [40, 20, 70], 0.12), c, mix(c, [255, 250, 230], 0.28)] }; }
const flatM = h => ({ flat: true, c: [null, rgb(h), null] });

/* ----- pixel grid ----- */
class PG {
  constructor(w, h, ox = 0, oy = 0) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.ox = ox; this.oy = oy; }
  set(x, y, m) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = m; }
  at(x, y) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  raw(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  rect(x, y, w, h, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m); }
  rectIn(x, y, w, h, m, within) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.at(x + i, y + j) === within) this.set(x + i, y + j, m); }
  ell(cx, cy, rx, ry, m) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, m);
    }
  }
  line(x0, y0, x1, y1, m, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
    for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); this.set(x, y, m); if (t > 1) { if (steep) this.set(x + 1, y, m); else this.set(x, y + 1, m); } }
  }
  tri(x0, y0, x1, y1, x2, y2, m) {
    const minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
    for (let y = minY; y <= maxY; y++) for (let x = Math.floor(Math.min(x0, x1, x2)); x <= Math.max(x0, x1, x2); x++) {
      const px = x + 0.5, py = y + 0.5;
      const s = (x0 - x2) * (py - y2) - (y0 - y2) * (px - x2), t = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0), u = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
      if ((s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0)) this.set(x, y, m);
    }
  }
}
function renderPG(pg, pal, outline) {
  const c = mkCanvas(pg.w, pg.h), g = c.getContext('2d'), id = g.createImageData(pg.w, pg.h), o = id.data;
  const ol = outline ? rgb(outline) : null;
  for (let y = 0; y < pg.h; y++) for (let x = 0; x < pg.w; x++) {
    const i = y * pg.w + x, m = pg.d[i];
    let col = null;
    if (m) {
      const P = pal[m] || { c: [[255, 0, 255], [255, 0, 255], [255, 0, 255]] };
      if (P.flat) col = P.c[1];
      else {
        const up = pg.raw(x, y - 1), dn = pg.raw(x, y + 1), rt = pg.raw(x + 1, y), lf = pg.raw(x - 1, y);
        if (up !== m && !(pal[up] && pal[up].flat && up)) col = P.c[2];
        else if (dn !== m || rt !== m) col = P.c[0];
        else if (lf !== m) col = P.c[2];
        else col = P.c[1];
      }
    } else if (ol && (pg.raw(x - 1, y) || pg.raw(x + 1, y) || pg.raw(x, y - 1) || pg.raw(x, y + 1))) col = ol;
    if (col) { o[i * 4] = col[0]; o[i * 4 + 1] = col[1]; o[i * 4 + 2] = col[2]; o[i * 4 + 3] = 255; }
  }
  g.putImageData(id, 0, 0);
  return c;
}
function whiteOf(c, col) {
  const w = mkCanvas(c.width, c.height), g = w.getContext('2d');
  g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = col || '#fff'; g.fillRect(0, 0, c.width, c.height);
  return w;
}
function mirror(c) { const m = mkCanvas(c.width, c.height), g = m.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return m; }

/* ----- character materials ----- */
const MT = { skin: 1, cloth: 2, cloth2: 3, belt: 4, hair: 5, hood: 6, armor: 7, feet: 8, eye: 9, blade: 10, bladeD: 11, wood: 12, hat: 13, band: 14, mask: 15, beard: 16,
  scab: 17, hilt: 18, white: 19, legs: 20, legsB: 21, gold: 22, fur: 23, fur2: 24, tusk: 25, nose: 26, eyeY: 27, lapel: 28, steel: 29, hat2: 30, eyeW: 31, collar: 32 };
function palFor(o) {
  if (o._pal) return o._pal;
  const p = [];
  const cl = o.cloth || '#555', c2 = o.cloth2 || shade(cl, -0.22), legs = o.legs || c2;
  const hatc = o.hatc || (o.hat === 'kasa' ? '#c49a58' : o.hat === 'eboshi' ? '#18181c' : '#2a2a32');
  const set = (k, v) => (p[MT[k]] = v);
  set('skin', ramp(o.skin || '#e8b088')); set('cloth', ramp(cl)); set('cloth2', ramp(c2)); set('belt', ramp(o.belt || '#2a2224'));
  set('hair', ramp(o.hair || '#1e1a22')); set('hood', ramp(o.hoodc || cl)); set('armor', ramp(o.armor || '#5a5a64')); set('feet', ramp(o.feet || '#26222c'));
  set('eye', flatM(o.eye || '#140c14')); set('blade', flatM('#f0f4f8')); set('bladeD', flatM('#8a96a8')); set('wood', ramp('#7a5232')); set('hat', ramp(hatc)); set('hat2', ramp(shade(hatc, 0.18)));
  set('band', ramp(o.band || '#c83030')); set('mask', ramp(o.maskc || '#8a1a1a')); set('beard', ramp(o.beard || '#2a2420')); set('scab', ramp('#2c1e1a')); set('hilt', ramp('#3c3650'));
  set('white', flatM('#f4f0e8')); set('legs', ramp(legs)); set('legsB', ramp(shade(legs, -0.22))); set('gold', ramp('#d0a844'));
  set('fur', ramp(o.fur || '#6c6862')); set('fur2', ramp(o.fur2 || '#9a948c')); set('tusk', flatM('#f0eadc')); set('nose', flatM('#120e10')); set('eyeY', flatM(o.eyeC || '#f0c838'));
  set('lapel', ramp(o.lapel || (o.hood ? shade(cl, -0.3) : '#ddd4c2'))); set('steel', ramp('#a0a8b4')); set('eyeW', flatM('#f8f8f8')); set('collar', ramp('#b02828'));
  return (o._pal = p);
}

/* ----- humanoid frames (40x40, feet anchor at 20,36; design coords offset 4,7) ----- */
const ANCHOR_X = 20, ANCHOR_Y = 36;
const ATK_POSE = {
  down: [{ sh: [21, 18], h: [22, 14], b: [27, 5] }, { sh: [20, 19], h: [16, 24], b: [16, 34] }, { sh: [11, 19], h: [9, 22], b: [2, 27] }],
  up: [{ sh: [11, 18], h: [9, 15], b: [4, 7], back: 1 }, { sh: [16, 17], h: [16, 13], b: [16, 1], back: 1 }, { sh: [21, 18], h: [23, 16], b: [29, 10], back: 1 }],
  right: [{ sh: [15, 18], h: [12, 15], b: [7, 5] }, { sh: [16, 18], h: [22, 19], b: [34, 19] }, { sh: [16, 19], h: [21, 23], b: [28, 30] }],
};
function humanFrame(o, anim, dir, f) {
  const g = new PG(40, 40, 4, 7);
  const side = dir === 'left' || dir === 'right', d = side ? 'right' : dir;
  const M = MT;
  if (anim === 'dead') { drawDead(g, o); return renderPG(g, palFor(o), o.outline || '#120c16'); }
  if (anim === 'roll') { drawRoll(g, o, d, f); const c = renderPG(g, palFor(o), o.outline || '#120c16'); return dir === 'left' ? mirror(c) : c; }
  const walk = anim === 'walk', atk = anim === 'atk', cast = anim === 'cast';
  let B = 0; if (walk && (f === 1 || f === 3)) B = -1; if (anim === 'idle' && f === 1) B = 1; if (anim === 'hurt') B = 1;
  const head = o.hood ? M.hood : M.hair;
  const pose = atk ? ATK_POSE[d][Math.min(2, f)] : null;
  const weaponAtk = atk && (o.spear || o.gun) ? true : false;
  // --- weapon behind body
  const drawBlade = (h, b) => { g.line(h[0], h[1], b[0], b[1], M.bladeD); g.line(h[0] + (d === 'right' ? 0 : -1), h[1] + (d === 'right' ? -1 : 0), b[0] + (d === 'right' ? 0 : -1), b[1] + (d === 'right' ? -1 : 0), M.blade); g.set(h[0], h[1], M.gold); };
  if (pose && pose.back && !weaponAtk && (o.sword || o.player)) drawBlade(pose.h, pose.b);
  if (d === 'up' && atk && o.spear) { g.line(16, 30, 16, -2, M.wood); g.rect(15, -4, 3, 3, M.steel); }
  if (!side && !atk && o.spear && d === 'up') { g.line(22, 2, 22, 28, M.wood); g.rect(21, 0, 3, 3, M.steel); }
  // long hair behind (front view)
  if (o.female && !o.hood && d === 'down') g.rect(10, 12 + B, 12, 9, M.hair);
  if (o.female && !o.hood && side) g.rect(10, 11 + B, 5, 10, M.hair);
  if (!side) {
    // legs
    if (o.robe) { for (let y = 17; y <= 27; y++) { const w = (y - 17) >> 2; g.rect(11 - w, y + (y < 22 ? B : 0), 10 + 2 * w, 1, M.cloth); } g.rect(12, 28, 3, 1, M.feet); g.rect(17, 28, 3, 1, M.feet); }
    else {
      const lL = walk && f === 1 ? 2 : 0, rL = walk && f === 3 ? 2 : 0;
      g.rect(12, 23, 3, 4 - lL, M.legs); g.rect(12, 27 - lL, 3, 2, M.feet);
      g.rect(17, 23, 3, 4 - rL, M.legs); g.rect(17, 27 - rL, 3, 2, M.feet);
    }
    // torso
    g.ell(16, 17.6 + B, 6, 2.3, M.cloth); g.rect(11, 17 + B, 10, 6 - B, M.cloth);
    if (o.armor) { g.rect(11, 17 + B, 10, 4, M.armor); g.ell(10.4, 17.6 + B, 2.3, 1.7, M.armor); g.ell(21.6, 17.6 + B, 2.3, 1.7, M.armor); }
    else if (!o.robe && d === 'down') { g.line(13, 17 + B, 16, 20 + B, M.lapel); g.line(19, 17 + B, 16, 20 + B, M.lapel); }
    g.rect(11, 21 + B, 10, 2, M.belt);
    if (d === 'up' && (o.sword || o.player) && !atk) { g.line(10, 25 + B, 21, 14 + B, M.scab, 2); g.line(21, 14 + B, 23, 11 + B, M.hilt, 2); }
    // arms
    const aL = walk ? (f === 1 ? 1 : f === 3 ? -1 : 0) : 0;
    if (cast) { g.line(10, 18 + B, 15, 21 + B, M.cloth2, 2); g.line(21, 18 + B, 17, 21 + B, M.cloth2, 2); g.rect(15, 21 + B, 2, 2, M.skin); }
    else {
      g.rect(9, 17 + B + aL, 2, 4, M.cloth2); g.rect(9, 21 + B + aL, 2, 1, M.skin);
      if (!pose) { g.rect(21, 17 + B - aL, 2, 4, M.cloth2); g.rect(21, 21 + B - aL, 2, 1, M.skin); }
    }
    // head
    g.ell(16, 11.5 + B, 6, 5.5, head);
    if (d === 'down') {
      if (o.hood) {
        g.rectIn(12, 10 + B, 8, 3, M.skin, head);
        if (o.maskc) g.rectIn(12, 12 + B, 8, 1, M.mask, M.skin);
        const ec = o.mask ? M.mask : M.eye;
        g.rect(13, 11 + B, 1, 2, ec); g.rect(18, 11 + B, 1, 2, ec);
      } else {
        g.ell(16, 12.6 + B, 4.6, 4.2, M.skin);
        g.rect(11, 7 + B, 10, 2, M.hair); g.rect(11, 9 + B, 1, 3, M.hair); g.rect(20, 9 + B, 1, 3, M.hair);
        if (!o.female) { g.rect(12, 9 + B, 1, 1, M.hair); g.rect(19, 9 + B, 1, 1, M.hair); }
        g.rect(13, 12 + B, 1, 2, M.eye); g.rect(18, 12 + B, 1, 2, M.eye);
        if (o.beard) g.rect(13, 15 + B, 6, 2, M.beard);
        if (o.scar) g.line(14, 10 + B, 15, 14 + B, M.mask);
      }
    } else {
      if (o.hood) g.rect(15, 15 + B, 2, 2, M.hood);
      if (o.female && !o.hood) g.rect(11, 12 + B, 10, 8, M.hair);
    }
    if (o.topknot && !o.hood && !o.hat) { g.ell(16, 5.5 + B, 1.8, 1.6, M.hair); }
    if (o.band) { g.rectIn(10, 8 + B, 12, 1, M.band, head); g.rectIn(10, 8 + B, 12, 1, M.band, M.hair); if (d === 'up') g.line(16, 9 + B, 18, 13 + B, M.band); }
    if (o.bandage) g.rect(11, 9 + B, 10, 1, M.white);
  } else {
    // side view (right)
    const st = walk ? ['pass', 'A', 'pass', 'B'][f] : 'stand';
    if (o.robe) { for (let y = 17; y <= 27; y++) { const w = (y - 17) >> 2; g.rect(13 - w, y + (y < 22 ? B : 0), 7 + w, 1, M.cloth); } g.rect(16, 28, 4, 1, M.feet); }
    else if (st === 'A' || st === 'B') {
      const far = st === 'A' ? [11, M.legsB] : [18, M.legsB], near = st === 'A' ? [18, M.legs] : [11, M.legs];
      g.rect(far[0], 23, 3, 4, far[1]); g.rect(far[0] - (far[0] < 15 ? 1 : 0), 27, 4, 2, M.feet);
      g.rect(near[0], 23, 3, 4, near[1]); g.rect(near[0] - (near[0] < 15 ? 1 : 0), 27, 4, 2, M.feet);
    } else { g.rect(14, 23, 3, 4, M.legsB); g.rect(14, 27, 4, 2, M.feet); g.rect(16, 23, 3, 4, M.legs); g.rect(16, 27, 4, 2, M.feet); }
    if ((o.sword || o.player) && !atk) g.line(12, 14 + B, 10, 11 + B, M.hilt, 2);
    g.ell(16, 17.6 + B, 3.8, 2, M.cloth); g.rect(13, 17 + B, 7, 6 - B, M.cloth);
    if (o.armor) { g.rect(13, 17 + B, 7, 4, M.armor); g.ell(15.5, 17.6 + B, 2.6, 1.7, M.armor); }
    g.rect(13, 21 + B, 7, 2, M.belt);
    g.ell(16, 11.5 + B, 5.6, 5.5, head);
    if (o.hood) {
      g.rectIn(17, 10 + B, 6, 3, M.skin, head);
      if (o.maskc) g.rectIn(17, 12 + B, 6, 1, M.mask, M.skin);
      g.rect(20, 11 + B, 1, 2, o.mask ? M.mask : M.eye);
      g.rect(9, 11 + B, 2, 2, M.hood);
    } else {
      g.ell(18.6, 12.6 + B, 3.5, 4, M.skin);
      g.rect(13, 7 + B, 8, 2, M.hair); g.rect(13, 9 + B, 3, 4, M.hair);
      g.set(16, 12 + B, M.skin);
      g.rect(20, 12 + B, 1, 2, M.eye);
      if (o.beard) g.rect(18, 15 + B, 4, 2, M.beard);
    }
    if (o.topknot && !o.hood && !o.hat) g.ell(14.5, 5.5 + B, 1.8, 1.6, M.hair);
    if (o.band) { g.rectIn(10, 8 + B, 13, 1, M.band, head); g.line(10, 9 + B, 7, 12 + B, M.band); }
    if (o.bandage) g.rect(11, 9 + B, 11, 1, M.white);
    if (cast) { g.line(16, 18 + B, 20, 21 + B, M.cloth2, 2); g.rect(20, 21 + B, 2, 2, M.skin); }
    else if (!pose) {
      if (st === 'A') { g.line(16, 18 + B, 19, 21 + B, M.cloth2, 2); g.rect(19, 22 + B, 2, 1, M.skin); }
      else if (st === 'B') { g.line(16, 18 + B, 13, 21 + B, M.cloth2, 2); g.rect(12, 22 + B, 2, 1, M.skin); }
      else { g.rect(15, 18 + B, 2, 4, M.cloth2); g.rect(15, 22 + B, 2, 1, M.skin); }
    }
  }
  // hats
  if (o.hat === 'jingasa') { g.ell(16, 8.5 + B, 8.5, 2.3, M.hat); g.ell(16, 6.8 + B, 3.4, 2, M.hat2); }
  if (o.hat === 'kasa') { g.ell(16, 9 + B, 9, 2.7, M.hat); g.ell(16, 7.4 + B, 5.2, 2.2, M.hat2); g.set(16, 4 + B, M.hat2); }
  if (o.hat === 'eboshi') { g.ell(16, 5 + B, 3.2, 4, M.hat); }
  // idle weapons in front
  if (!atk) {
    if ((o.sword || o.player) && d === 'down') { g.line(21, 15 + B, 23, 11 + B, M.hilt, 2); g.set(21, 15 + B, M.gold); }
    if (o.spear && d === 'down') { g.line(23, 1, 23, 28, M.wood); g.tri(22, 2, 25, 2, 23.5, -3, M.steel); if (o.naginata) g.ell(24.5, 0, 1.6, 3, M.steel); g.rect(22, 21 + B, 2, 2, M.skin); }
    if (o.spear && side) { g.line(21, 1, 21, 28, M.wood); g.tri(20, 2, 23, 2, 21.5, -3, M.steel); if (o.naginata) g.ell(22.5, 0, 1.6, 3, M.steel); }
    if (o.staff) { const x = side ? 21 : 23; g.line(x, 3, x, 28, M.wood); g.ell(x, 3, 1.5, 1.5, M.wood); }
    if (o.gun) { if (side) { g.line(12, 21 + B, 27, 21 + B, M.wood); g.line(22, 20 + B, 28, 20 + B, M.steel); } else if (d === 'down') { g.line(8, 23 + B, 24, 19 + B, M.wood); g.line(19, 20 + B, 25, 18 + B, M.steel); } }
  } else if (pose) {
    if (o.spear) {
      if (d === 'down') { g.line(16, 12, 16, 36, M.wood); g.tri(14.5, 33, 18.5, 33, 16.5, 39, M.steel); g.rect(15, 22 + B, 3, 2, M.skin); }
      else if (d === 'right') { g.line(4, 20, 32, 20, M.wood); g.tri(31, 18, 31, 22.5, 37, 20, M.steel); g.rect(18, 19 + B, 2, 3, M.skin); }
    } else if (o.gun) {
      if (d === 'down') { g.line(16, 18, 16, 31, M.wood); g.line(16, 26, 16, 33, M.steel); g.rect(15, 20 + B, 3, 2, M.skin); }
      else if (d === 'right') { g.line(12, 20, 30, 20, M.wood); g.line(24, 19, 32, 19, M.steel); g.rect(17, 20 + B, 2, 2, M.skin); }
      else { g.line(16, 18, 16, 6, M.steel); }
    } else {
      g.line(pose.sh[0], pose.sh[1] + B, pose.h[0], pose.h[1], M.cloth2, 2); g.rect(pose.h[0] - 1, pose.h[1] - 1, 2, 2, M.skin);
      if (!pose.back && (o.sword || o.player)) drawBlade(pose.h, pose.b);
    }
  }
  let c = renderPG(g, palFor(o), o.outline || '#120c16');
  if (dir === 'left') c = mirror(c);
  return c;
}
function drawDead(g, o) {
  const M = MT, head = o.hood ? M.hood : M.hair;
  g.rect(13, 23, 11, 5, M.cloth); g.rect(21, 23, 2, 5, M.belt); g.rect(24, 24, 6, 3, M.legs); g.rect(30, 24, 2, 3, M.feet);
  g.rect(14, 21, 6, 2, M.cloth2); g.ell(8.5, 25, 5, 4.5, head);
  if (!o.hood) g.rect(7, 26, 4, 2, M.skin);
}
function drawRoll(g, o, d, f) {
  const M = MT, k = f % 3;
  g.ell(16, 22, 6.5, 6, M.cloth);
  if (k === 0) { g.rect(10, 21, 13, 2, M.belt); g.ell(16, 17, 4.5, 3.5, M.hood); }
  else if (k === 1) { g.line(11, 26, 21, 17, M.belt, 2); g.ell(20.5, 19, 3.5, 3.5, M.hood); }
  else { g.rect(15, 16, 2, 12, M.belt); g.ell(16, 26, 4, 3, M.hood); }
  g.rect(12, 26, 3, 2, M.feet);
}

/* ----- animals (side view) ----- */
function animalFrame(o, anim, dir, f) {
  const g = new PG(40, 40, 4, 7), M = MT;
  const lunge = anim === 'atk', st = anim === 'walk' ? f % 4 : 0;
  const lg = (i) => { if (st === 0) return [0, 0]; const ph = (st === 1) ? (i % 2 ? 1 : -1) : st === 3 ? (i % 2 ? -1 : 1) : 0; return [ph, Math.abs(ph)]; };
  if (anim === 'dead') {
    if (o.animal === 'boar') { g.ell(16, 25, 9, 3.5, M.fur); g.ell(25, 25, 4, 3, M.fur); g.rect(28, 25, 2, 1, M.tusk); }
    else { g.ell(16, 25, 8, 3, M.fur); g.ell(24, 24.5, 3.5, 2.8, M.fur); g.line(8, 25, 4, 27, M.fur, 2); }
    return renderPG(g, palFor(o), '#120c16');
  }
  const dx = lunge ? 3 : 0, dy = lunge ? -2 : 0;
  if (o.animal === 'boar') {
    [9, 12, 19, 22].forEach((x, i) => { const [ox, lift] = lg(i); g.rect(x + ox + (lunge && i > 1 ? 2 : 0), 24 - lift, 2, 4, M.fur); });
    g.ell(15 + dx, 20 + dy, 8.5, 5, M.fur); g.ell(14 + dx, 22.5 + dy, 6, 2, M.fur2);
    g.line(8 + dx, 15 + dy, 19 + dx, 15 + dy, M.fur2);
    g.ell(23.5 + dx, 21 + dy, 4, 3.6, M.fur); g.rect(26 + dx, 21 + dy, 3, 3, M.fur2); g.set(29 + dx, 22 + dy, M.nose);
    g.rect(26 + dx, 24 + dy, 2, 1, M.tusk); g.set(28 + dx, 23 + dy, M.tusk); g.set(24 + dx, 19 + dy, M.eye); g.rect(21 + dx, 16 + dy, 2, 2, M.fur);
  } else {
    [10, 13, 18, 21].forEach((x, i) => { const [ox, lift] = lg(i); g.rect(x + ox + (lunge && i > 1 ? 3 : 0) - (lunge && i < 2 ? 1 : 0), 23 - lift - (lunge && i > 1 ? 2 : 0), 2, 5, M.fur); });
    g.ell(15.5 + dx, 20.5 + dy, 7.5, 3.6, M.fur); g.ell(15 + dx, 22.8 + dy, 5, 1.4, M.fur2);
    g.line(8 + dx, 19 + dy, 4 + dx, 15 + dy + (st % 2), M.fur, 2);
    g.ell(23.5 + dx, 17.5 + dy, 3.6, 3.1, M.fur); g.rect(25 + dx, 17 + dy, 4, 3, M.fur); g.set(29 + dx, 17 + dy, M.nose);
    g.rect(22 + dx, 13 + dy, 1, 2, M.fur); g.rect(24 + dx, 13 + dy, 1, 2, M.fur);
    g.set(24 + dx, 16 + dy, M.eyeY);
    if (o.collar) g.line(21 + dx, 19 + dy, 22 + dx, 21 + dy, M.collar);
    if (lunge) g.rect(26 + dx, 20 + dy, 3, 1, M.white);
  }
  let c = renderPG(g, palFor(o), '#120c16');
  if (dir === 'left') c = mirror(c);
  return c;
}

const CHAR_DEFS = {
  ren: { player: true, hood: true, cloth: '#2a3350', cloth2: '#1e2540', belt: '#8a2a2a', legs: '#222a44', lapel: '#151a2c' },
  yuki_mask: { hood: true, cloth: '#4a2a44', cloth2: '#361e32', belt: '#c0c0c8', maskc: '#ece8e0', legs: '#361e32' },
  yuki: { female: true, cloth: '#4a2a44', cloth2: '#361e32', belt: '#c02a3a', hair: '#1a1620', legs: '#361e32', lapel: '#d8ccd4', sword: true },
  sota: { cloth: '#3a4a70', cloth2: '#2a3456', band: '#eee8e0', hair: '#201a18', legs: '#2a3456', sword: true },
  gonbei: { cloth: '#7a6c58', cloth2: '#5e5242', hair: '#a8a49c', topknot: true, beard: '#c8c4bc', bandage: true, skin: '#d4a07a' },
  villager: { cloth: '#8a7450', cloth2: '#6a5a3c', topknot: true },
  villager2: { cloth: '#56786e', cloth2: '#405a52', hair: '#2a2420', topknot: true },
  woman: { female: true, cloth: '#9a5050', cloth2: '#7a3c3c', belt: '#e0d098' },
  woman2: { female: true, cloth: '#506488', cloth2: '#3c4c6a', belt: '#d0a868' },
  oldwoman: { female: true, cloth: '#665a50', cloth2: '#50463e', hair: '#b8b4ac' },
  child: { cloth: '#b07a44', cloth2: '#8a5e34', hair: '#1e1a18' },
  merchant: { cloth: '#647840', cloth2: '#4c5e30', topknot: true, belt: '#3a2a1a' },
  smith: { cloth: '#7a5440', cloth2: '#d4a07a', band: '#e8e0d0', topknot: true, skin: '#cc9468' },
  innkeep: { female: true, cloth: '#7a426a', cloth2: '#5e3252', belt: '#f0dca8' },
  priest: { cloth: '#ece8e0', cloth2: '#d0ccc4', hat: 'eboshi', robe: true },
  monk_npc: { cloth: '#544840', cloth2: '#423830', hat: 'kasa', robe: true, staff: true },
  magistrate: { cloth: '#2e3654', cloth2: '#22283e', topknot: true, belt: '#b09048', robe: true },
  informant: { cloth: '#62627a', cloth2: '#4a4a5c', hair: '#2a2420', topknot: true, belt: '#9a4030' },
  ashigaru: { cloth: '#3e4e72', cloth2: '#2e3a58', hat: 'jingasa', spear: true, armor: '#34343e' },
  gate_guard: { cloth: '#3e4e72', cloth2: '#2e3a58', hat: 'jingasa', spear: true, armor: '#34343e' },
  gunner: { cloth: '#3e4e72', cloth2: '#2e3a58', hat: 'jingasa', gun: true },
  bandit: { cloth: '#7a6440', cloth2: '#5a4a2e', band: '#a03030', hair: '#2a2018', sword: true, skin: '#cc9468' },
  looter: { cloth: '#6a6450', cloth2: '#4e4a3a', hair: '#2a2018', skin: '#cc9468' },
  tozo: { cloth: '#8a3624', cloth2: '#682818', band: '#e0d0a8', hair: '#1e1610', beard: '#1e1610', sword: true, armor: '#5a4632', skin: '#c48c62' },
  ronin: { cloth: '#52526a', cloth2: '#3e3e52', hat: 'kasa', sword: true },
  crow: { hood: true, cloth: '#1e1e26', cloth2: '#16161c', belt: '#8a1e1e', sword: true, legs: '#18181e' },
  crow2: { hood: true, cloth: '#18181e', cloth2: '#101016', belt: '#a81e1e', sword: true, mask: true, maskc: '#8a1a1a', legs: '#121218' },
  samurai: { cloth: '#6a2e2e', cloth2: '#4a2020', armor: '#30303a', topknot: true, sword: true, hair: '#18161a' },
  monk: { hood: true, hoodc: '#ece6d8', cloth: '#ddd6c6', cloth2: '#c0b8a8', legs: '#444', spear: true, naginata: true },
  shadow: { hood: true, cloth: '#101016', cloth2: '#0a0a0e', belt: '#2e2e3a', sword: true, mask: true, outline: '#4a4a6a', legs: '#0c0c10' },
  hanzaki: { hood: true, cloth: '#2e2e36', cloth2: '#1e1e26', armor: '#74747e', belt: '#9a1e1e', mask: true, maskc: '#52525c', sword: true },
  gensai: { cloth: '#1e181c', cloth2: '#4a141e', armor: '#4a141e', hair: '#8a8684', topknot: true, scar: true, sword: true, belt: '#b09048' },
  oda_officer: { cloth: '#46325a', cloth2: '#342446', armor: '#22222a', hat: 'jingasa', hatc: '#6a5a20', sword: true },
  wolf: { animal: 'wolf', fur: '#6e6a64', fur2: '#a09a90' },
  dog: { animal: 'wolf', fur: '#8c6a44', fur2: '#bc9c72', collar: true, eyeC: '#2a1810' },
  boar: { animal: 'boar', fur: '#523e2e', fur2: '#6e5442' },
};
const SPRC = {};
function sprFrame(key, anim, dir, f) {
  const k = key + '|' + anim + '|' + dir + '|' + f;
  let c = SPRC[k];
  if (!c) { const o = CHAR_DEFS[key]; c = o.animal ? animalFrame(o, anim, dir === 'up' || dir === 'down' ? 'right' : dir, f) : humanFrame(o, anim, dir, f); SPRC[k] = c; }
  return c;
}
function sprTint(key, anim, dir, f, col) {
  const k = 'T' + col + '|' + key + '|' + anim + '|' + dir + '|' + f;
  return SPRC[k] || (SPRC[k] = whiteOf(sprFrame(key, anim, dir, f), col));
}
function buildSprites() { for (const k in CHAR_DEFS) for (const d of ['down', 'up', 'right', 'left']) sprFrame(k, 'idle', d, 0); }

/* ----- object sprites (y-sorted map props) ----- */
const OBJ_MAT = { leaf: 1, leaf2: 2, bark: 3, pine: 4, pine2: 5, pink: 6, pink2: 7, stone: 8, stone2: 9, red: 10, wood: 11, wood2: 12, gold: 13, iron: 14, fire1: 15, fire2: 16, fire3: 17, glow: 18, dark: 19, bamboo: 20, bleaf: 21, straw: 22, black: 23, moss: 24, white: 25, water: 26 };
const OBJ_PAL = (() => {
  const p = [], s = (k, v) => (p[OBJ_MAT[k]] = v);
  s('leaf', ramp('#2f6a34')); s('leaf2', ramp('#3f8440')); s('bark', ramp('#5a3c26')); s('pine', ramp('#24503a')); s('pine2', ramp('#2f6446'));
  s('pink', ramp('#d886a2')); s('pink2', ramp('#f0b0c4')); s('stone', ramp('#8e8c88')); s('stone2', ramp('#6e6c6a')); s('red', ramp('#c03a2c'));
  s('wood', ramp('#7a5232')); s('wood2', ramp('#94683e')); s('gold', ramp('#d0a844')); s('iron', ramp('#3a3a42')); s('fire1', flatM('#ff8a20')); s('fire2', flatM('#ffc840'));
  s('fire3', flatM('#fff0a0')); s('glow', flatM('#ffd878')); s('dark', flatM('#120c0a')); s('bamboo', ramp('#7aa64e')); s('bleaf', ramp('#4c8a36')); s('straw', ramp('#b8a060'));
  s('black', ramp('#22201e')); s('moss', ramp('#5a7a3a')); s('white', ramp('#e8e4dc')); s('water', flatM('#1a3048'));
  return p;
})();
const OBJC = {};
function objSprite(ch, v, fr, opened) {
  const k = ch + v + '_' + fr + (opened ? 'o' : '');
  if (OBJC[k]) return OBJC[k];
  const O = OBJ_MAT, R2 = seeded(v * 131 + ch.charCodeAt(0) * 7 + 3);
  let g, w = 16, h = 32, ol = '#140e10';
  switch (ch) {
    case 'T': {
      w = 28; h = 34; g = new PG(w, h);
      g.rect(12, 25, 4, 8, O.bark); g.set(11, 32, O.bark); g.set(16, 32, O.bark);
      g.ell(14, 14, 12.5, 11, O.leaf);
      const cl = [[8, 9, 5, 4], [19, 8, 5, 4], [14, 4.5, 5, 3.5], [6, 16, 4.5, 4], [22, 16, 4.5, 4], [14, 13, 5, 4]];
      cl.forEach(([x, y, rx, ry]) => g.ell(x + R2() * 2 - 1, y + R2() * 2 - 1, rx, ry, O.leaf2));
      break;
    }
    case 'h': {
      w = 28; h = 34; g = new PG(w, h);
      g.rect(12, 25, 4, 8, O.bark); g.ell(14, 14, 12.5, 11, O.pink);
      [[8, 9, 5, 4], [19, 8, 5, 4], [14, 4.5, 5, 3.5], [6, 16, 4.5, 4], [22, 16, 4.5, 4], [14, 13, 4, 3]].forEach(([x, y, rx, ry]) => g.ell(x + R2() * 2 - 1, y + R2() * 2 - 1, rx, ry, O.pink2));
      break;
    }
    case 'P': {
      w = 24; h = 34; g = new PG(w, h);
      g.rect(11, 27, 2, 6, O.bark);
      for (let i = 0; i < 4; i++) { const ay = 1 + i * 6, by = ay + 10, hw = 5 + i * 2.2; g.tri(12, ay, 12 - hw, by, 12 + hw, by, i % 2 ? O.pine2 : O.pine); }
      break;
    }
    case 'v': {
      w = 22; h = 32; g = new PG(w, h);
      g.line(11, 31, 11, 6, O.black, 2); g.line(11, 14, 5, 8, O.black); g.line(5, 8, 3, 9, O.black); g.line(12, 10, 17, 4, O.black); g.line(17, 4, 19, 5, O.black); g.line(12, 20, 16, 16, O.black);
      break;
    }
    case 'b': {
      g = new PG(16, 32);
      for (let i = 0; i < 3; i++) { const x = 1 + i * 5 + Math.floor(R2() * 2); g.rect(x, 4 + i * 2, 2, 28 - i * 2, O.bamboo); for (let y = 8 + i * 3; y < 32; y += 7) g.rect(x, y, 2, 1, O.bleaf); g.ell(x + 2, 5 + i * 2, 3, 1.5, O.bleaf); }
      break;
    }
    case 'r': { h = 16; g = new PG(16, 16); g.ell(8, 10, 7, 5.2, O.stone2); g.ell(7, 8.5, 5, 3.6, O.stone); g.ell(5, 7, 2, 1.2, O.moss); break; }
    case 'g': { h = 24; g = new PG(16, 24); g.rect(3, 19, 10, 4, O.stone2); g.rect(5, 6, 6, 13, O.stone); g.ell(8, 6.5, 3, 2, O.stone); g.set(8, 10, O.stone2); g.set(8, 12, O.stone2); g.set(8, 14, O.stone2); g.set(12, 17, O.red); break; }
    case 'j': { h = 24; g = new PG(16, 24); g.rect(3, 20, 10, 3, O.stone2); g.ell(8, 15, 5, 6, O.stone); g.ell(8, 7, 3.6, 3.6, O.stone); g.ell(8, 12, 4.5, 2, O.red); g.set(7, 7, O.stone2); g.set(9, 7, O.stone2); break; }
    case 'l': {
      h = 26; g = new PG(16, 26); g.rect(5, 21, 6, 4, O.stone2); g.rect(7, 15, 2, 6, O.stone); g.rect(4, 10, 8, 5, O.stone); g.rect(6, 11, 4, 3, O.glow);
      g.ell(8, 8, 7, 2.2, O.stone); g.ell(8, 5.5, 2, 1.6, O.stone); break;
    }
    case 't': {
      h = 26; g = new PG(16, 26); g.line(4, 25, 7, 15, O.iron); g.line(12, 25, 9, 15, O.iron); g.ell(8, 15, 5.5, 2.2, O.iron);
      const fl = fr % 3; g.ell(8, 11 - (fl === 1 ? 1 : 0), 4.5, 4, O.fire1); g.ell(8 + (fl === 2 ? 1 : 0), 9, 3, 3.5, O.fire2); g.ell(8, 9 - fl * 0.5, 1.6, 2.2, O.fire3);
      if (fl === 0) g.set(6, 5, O.fire2); if (fl === 1) g.set(10, 4, O.fire2);
      break;
    }
    case 'o': { h = 18; g = new PG(16, 18); for (const x of [1, 7, 13]) g.rect(x, 3, 2, 13, O.straw); g.rect(0, 7, 16, 1, O.wood); g.rect(0, 12, 16, 1, O.wood); break; }
    case 'C': {
      h = 16; g = new PG(16, 16);
      if (opened) { g.rect(2, 8, 12, 7, O.wood); g.rect(3, 9, 10, 2, O.dark); g.rect(2, 2, 12, 5, O.wood2); g.rect(2, 4, 12, 1, O.gold); }
      else { g.rect(2, 7, 12, 8, O.wood); g.rect(2, 4, 12, 4, O.wood2); g.rect(2, 7, 12, 1, O.gold); g.rect(7, 7, 2, 3, O.gold); }
      break;
    }
    case 'k': { h = 30; g = new PG(16, 30); g.rect(7, 8, 2, 22, O.wood); g.ell(8, 6, 3.8, 3.8, O.black); g.rect(5, 3, 6, 2, O.dark); break; }
    case 'I': { h = 32; g = new PG(16, 32); g.rect(5, 3, 6, 26, O.red); g.rect(4, 28, 8, 4, O.black); g.rect(3, 6, 10, 2, O.red); break; }
    case 'u': { h = 22; g = new PG(16, 22); g.rect(2, 4, 2, 14, O.wood); g.rect(12, 4, 2, 14, O.wood); g.rect(1, 2, 14, 2, O.wood2); g.ell(8, 16, 6.5, 4.5, O.stone); g.ell(8, 15.5, 4, 2.5, O.water); break; }
    default: { h = 16; g = new PG(16, 16); }
  }
  const img = renderPG(g, OBJ_PAL, ol);
  return (OBJC[k] = { img, ax: Math.floor(img.width / 2), h: img.height });
}

/* ----- tile categories ----- */
const SOLID_TILES = 'TPhvb~#cHRDxgjrmWtloCkIpuw';
const isSolidTile = ch => SOLID_TILES.indexOf(ch) >= 0;
const SOFT = '.,az~fp';
const HARDG = 'SFeqn=Gi';
const STATICS = 'mc#HRDWxw';
const OBJS = 'TPhvbrgjltoCkIu';
const OPAQUE = 'TPhbc#HRDmWw';
const TALL_STATIC = 'mc#HRwD';

/* ----- prerendered map ground + static layer ----- */
const PAL = {
  grass: ['#284a24', '#32592b', '#3c6a32', '#47793a'].map(rgb), tuftL: rgb('#5e9444'), tuftD: rgb('#22401f'),
  dirt: ['#6a4c32', '#78583a', '#866544', '#94724e'].map(rgb), pebL: rgb('#b49470'), pebD: rgb('#54402a'),
  ash: ['#28211e', '#322a26', '#3c322d'].map(rgb), gravel: rgb('#bcb3a2'), gravelD: rgb('#a39a88'),
  deep: rgb('#22507c'), mid: rgb('#2c6292'), shallow: rgb('#4684b2'), foam: rgb('#c4e2f2'), rip: rgb('#3a76a6'),
  paddy: rgb('#4a6a50'), sprout: rgb('#9ab850'),
};
function buildMapCanvas(m) {
  const W = m.w * 16, H = m.h * 16;
  const c = mkCanvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), o = id.data;
  const T = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? null : m.grid[y][x];
  const groundOf = (x, y) => {
    const ch = T(x, y); if (ch == null) return null;
    if (SOFT.indexOf(ch) >= 0) return ch === 'f' ? '.' : ch;
    if (HARDG.indexOf(ch) >= 0) return ch;
    if (OBJS.indexOf(ch) >= 0) { const b = m.base[y][x] || '.'; return b === 'f' ? '.' : b; }
    return null;
  };
  // per-pixel terrain type with jittered soft boundaries
  const tg = new Uint8Array(W * H);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const tx = gx >> 4, ty = gy >> 4;
    let t = groundOf(tx, ty);
    if (t && SOFT.indexOf(t) >= 0) {
      const jx = (vnoise(gx * 0.17, gy * 0.17) - 0.5) * 8, jy = (vnoise(gx * 0.17 + 31, gy * 0.17 + 57) - 0.5) * 8;
      const s = groundOf(Math.floor((gx + jx) / 16), Math.floor((gy + jy) / 16));
      if (s && SOFT.indexOf(s) >= 0) t = s;
    }
    tg[gy * W + gx] = t ? t.charCodeAt(0) : 0;
  }
  const TG = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : tg[y * W + x];
  const C = s => s.charCodeAt(0);
  const cG = C('.'), cD = C(','), cA = C('a'), cZ = C('z'), cW = C('~'), cP = C('p');
  const put = (i, col) => { o[i * 4] = col[0]; o[i * 4 + 1] = col[1]; o[i * 4 + 2] = col[2]; o[i * 4 + 3] = 255; };
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    const i = gy * W + gx, tx = gx >> 4, ty = gy >> 4, lx = gx & 15, ly = gy & 15;
    const ch = T(tx, ty);
    let col;
    if (STATICS.indexOf(ch) >= 0) col = staticPx(m, T, ch, tx, ty, lx, ly, gx, gy);
    else {
      const t = tg[i];
      if (t === cG) {
        const n = fbm(gx * 0.06, gy * 0.06);
        col = PAL.grass[clamp(Math.floor(n * 3.6 + (hash2(gx, gy) - 0.5) * 0.7), 0, 3)];
        const cx = Math.floor(gx / 7), cy = Math.floor(gy / 7), hh = hash2(cx * 3 + 1, cy * 7 + 2);
        if (hh < 0.55) { const ox = cx * 7 + Math.floor(hash2(cx, cy + 99) * 4), oy = cy * 7 + Math.floor(hash2(cx + 55, cy) * 4); const dx = gx - ox, dy = gy - oy;
          if ((dy === 0 && dx === 1) || (dy === 1 && (dx === 0 || dx === 2))) col = PAL.tuftL; else if (dy === 2 && dx >= 0 && dx <= 2) col = PAL.tuftD; }
        if (ch === 'f') { const fx = Math.floor(gx / 5), fy = Math.floor(gy / 5), fh = hash2(fx + 7, fy * 3); if (fh < 0.5) { const cx2 = fx * 5 + 2, cy2 = fy * 5 + 2, ddx = gx - cx2, ddy = gy - cy2;
          const pc = [[220, 60, 80], [244, 240, 228], [236, 196, 60], [214, 110, 170]][Math.floor(fh * 8) % 4];
          if (ddx === 0 && ddy === 0) col = [250, 220, 90]; else if (Math.abs(ddx) + Math.abs(ddy) === 1) col = pc; else if (ddx === 0 && ddy === 2) col = PAL.tuftD; } }
        const dn = TG(gx, gy + 1), rt = TG(gx + 1, gy);
        if (dn === cD || dn === cA || dn === cZ) col = mul(col, 1.18);
        if (dn === cW || rt === cW || TG(gx, gy - 1) === cW || TG(gx - 1, gy) === cW) col = mul(col, 0.72);
      } else if (t === cD || t === cA) {
        const pal = t === cD ? PAL.dirt : PAL.ash;
        const n = fbm(gx * 0.08, gy * 0.08);
        col = pal[clamp(Math.floor(n * pal.length * 0.95 + (hash2(gx, gy) - 0.5) * 0.8), 0, pal.length - 1)];
        const cx = Math.floor(gx / 6), cy = Math.floor(gy / 6), hh = hash2(cx * 5 + 3, cy * 11 + 1);
        if (hh < 0.3) { const ox = cx * 6 + Math.floor(hash2(cx, cy + 9) * 4), oy = cy * 6 + Math.floor(hash2(cx + 5, cy) * 4); const dx = gx - ox, dy = gy - oy;
          if (dy === 0 && (dx === 0 || dx === 1)) col = t === cD ? PAL.pebL : [70, 58, 52]; else if (dy === 1 && (dx === 0 || dx === 1)) col = t === cD ? PAL.pebD : [20, 16, 14]; }
        if (t === cA && hash2(gx * 7, gy * 3) < 0.012) col = [120, 50, 24];
        const up = TG(gx, gy - 1), lf = TG(gx - 1, gy), up2 = TG(gx, gy - 2);
        if (up === cG || lf === cG) col = mul(col, 0.7); else if (up2 === cG) col = mul(col, 0.86);
        if (TG(gx, gy + 1) === cW || TG(gx + 1, gy) === cW || up === cW || lf === cW) col = mul(col, 0.7);
      } else if (t === cZ) {
        col = ((gy + Math.round(Math.sin(gx * 0.4) * 1.5)) % 4 === 0) ? PAL.gravelD : PAL.gravel;
        if (hash2(gx, gy) < 0.08) col = mul(col, 0.88);
      } else if (t === cW) {
        let d = 4;
        for (let k = 1; k <= 4 && d === 4; k++) if (TG(gx + k, gy) !== cW || TG(gx - k, gy) !== cW || TG(gx, gy + k) !== cW || TG(gx, gy - k) !== cW) d = k - 1;
        if (d === 0) col = PAL.foam; else if (d === 1) col = PAL.shallow; else if (d <= 3) col = PAL.mid;
        else { col = mix(PAL.mid, PAL.deep, clamp(fbm(gx * 0.05, gy * 0.05) * 1.6 - 0.3, 0, 1)); if (Math.sin(gx * 0.32 + gy * 0.85 + vnoise(gx * 0.1, gy * 0.1) * 6) > 0.9) col = PAL.rip; }
      } else if (t === cP) {
        col = PAL.paddy; if ((gx % 4 === 1) && (gy % 4 < 2)) col = PAL.sprout; if (gy % 4 === 2 && gx % 4 === 1) col = mul(PAL.paddy, 0.8);
      } else if (t) col = hardPx(m, T, String.fromCharCode(t), tx, ty, lx, ly, gx, gy);
      else col = [0, 0, 0];
      // cast shadows from tall statics above / left
      const above = T(tx, ty - 1), left = T(tx - 1, ty);
      if (above && TALL_STATIC.indexOf(above) >= 0 && ly < 4) col = mul(col, 0.62 + ly * 0.095);
      if (left && TALL_STATIC.indexOf(left) >= 0 && lx < 2) col = mul(col, 0.78 + lx * 0.1);
    }
    put(i, col);
  }
  g.putImageData(id, 0, 0);
  return c;
}
function hardPx(m, T, ch, tx, ty, lx, ly, gx, gy) {
  switch (ch) {
    case 'S': {
      const r = gy >> 3, ox = (r & 1) * 4, sx = (gx + ox) >> 3, l8 = (gx + ox) & 7, y8 = gy & 7;
      if (l8 === 0 || y8 === 0) return [44, 42, 40];
      let c = mul([104, 100, 92], 0.86 + hash2(sx, r) * 0.26 + (vnoise(gx * 0.3, gy * 0.3) - 0.5) * 0.12);
      if (l8 === 1 || y8 === 1) c = mul(c, 1.14); else if (l8 === 7 || y8 === 7) c = mul(c, 0.82);
      return c;
    }
    case 'F': {
      const r = gy >> 2, seam = (gx + Math.floor(hash2(r, 3) * 24)) % 24;
      if ((gy & 3) === 0 || seam === 0) return [52, 34, 22];
      let c = mul([110, 76, 48], 0.9 + hash2(r, Math.floor((gx + Math.floor(hash2(r, 3) * 24)) / 24)) * 0.18);
      if (Math.sin(gx * 0.3 + hash2(r, 7) * 9 + vnoise(gx * 0.08, r) * 5) > 0.75) c = mul(c, 0.86);
      if ((gy & 3) === 1) c = mul(c, 1.12);
      return c;
    }
    case 'e': {
      const l = T(tx - 1, ty) !== 'e', rr = T(tx + 1, ty) !== 'e';
      if ((l && lx < 2) || (rr && lx > 13)) return [196, 160, 70];
      if ((l && lx === 2) || (rr && lx === 13)) return [60, 14, 18];
      let c = [126, 30, 38]; if ((gx + gy) % 8 === 0 || (gx - gy + 800) % 8 === 0) c = [150, 46, 50]; return c;
    }
    case 'q': { const s = ly & 3; return s === 0 ? [132, 98, 66] : s === 3 ? [40, 28, 20] : [96, 70, 48]; }
    case 'n': {
      const bl = T(tx - 1, ty) !== 'n' && lx < 2, br = T(tx + 1, ty) !== 'n' && lx > 13, bt = T(tx, ty - 1) !== 'n' && ly < 2, bb = T(tx, ty + 1) !== 'n' && ly > 13;
      if (bl || br || bt || bb) return [34, 30, 24];
      return (gy & 1) && ((gx & 3) < 2) ? [168, 154, 96] : [186, 172, 110];
    }
    case '=': {
      const horizPlanks = T(tx - 1, ty) === '~' || T(tx + 1, ty) === '~';
      const a = horizPlanks ? lx : ly, b = horizPlanks ? ly : lx;
      if (a < 2 || a > 13) return a === 0 || a === 15 ? [50, 32, 20] : [108, 72, 42];
      if (b % 4 === 0) return [46, 30, 18];
      let c = [140, 100, 60]; if (b % 4 === 1) c = [160, 118, 72]; if (hash2(gx, gy) < 0.1) c = mul(c, 0.9); return c;
    }
    case 'G': {
      if (lx === 7 || lx === 8) return [28, 18, 12];
      if ((lx === 3 || lx === 12) && ly % 5 === 2) return [30, 30, 36];
      let c = [86, 54, 32]; if (lx % 3 === 0) c = [66, 42, 26]; return c;
    }
    case 'i': {
      if (ly >= 3 && ly <= 6) return ly === 3 ? [220, 80, 60] : ly === 6 ? [130, 30, 24] : [190, 54, 40];
      if (ly === 1 || ly === 2) return [30, 28, 28];
      return ((gy + Math.round(Math.sin(gx * 0.4) * 1.5)) % 4 === 0) ? PAL.gravelD : PAL.gravel;
    }
  }
  return [255, 0, 255];
}
function staticPx(m, T, ch, tx, ty, lx, ly, gx, gy) {
  const above = T(tx, ty - 1), below = T(tx, ty + 1), left = T(tx - 1, ty), right = T(tx + 1, ty);
  switch (ch) {
    case 'm': {
      if (below !== 'm') {
        let v = 0.82 + vnoise(gx * 0.55, gy * 0.07) * 0.32 - ly / 16 * 0.3;
        if (ly % 5 === 0) v += 0.1; if (ly % 5 === 4) v -= 0.08;
        if (above !== 'm' && ly < 2) v = 1.3;
        if (left !== 'm' && lx < 1) v *= 0.7; if (right !== 'm' && lx > 14) v *= 0.7;
        return mul([112, 98, 84], v);
      }
      let c = mix([70, 86, 56], [96, 92, 80], fbm(gx * 0.1, gy * 0.1));
      if (hash2(gx, gy) < 0.08) c = mul(c, 1.2);
      if (above !== 'm' && ly < 2) c = mul(c, 1.25);
      if ((left !== 'm' && lx < 1) || (right !== 'm' && lx > 14)) c = mul(c, 0.72);
      return c;
    }
    case 'c': case '#': case 'w': {
      const castle = ch === 'c';
      const sameW = x => x === 'c' || x === '#' || x === 'w';
      if (!sameW(below)) {
        const row = ly >> 2, off = (row & 1) * 4, bx = (lx + off) >> 3;
        if (above && !sameW(above) && ly < 2) return castle ? [74, 74, 86] : [150, 148, 152];
        if ((ly & 3) === 3 || ((lx + off) & 7) === 7) return castle ? [16, 16, 20] : [56, 54, 60];
        let c = castle ? [48, 48, 58] : [112, 110, 118];
        c = mul(c, 0.85 + hash2(tx * 4 + bx, ty * 4 + row) * 0.3 - ly / 16 * 0.15);
        if ((ly & 3) === 0) c = mul(c, 1.15);
        if (ch === 'w' && ly < 6) return ly < 5 ? (ly % 2 ? [58, 66, 80] : [66, 74, 88]) : [34, 38, 48];
        return c;
      }
      let c = castle ? [30, 30, 38] : [84, 82, 90];
      c = mul(c, 0.92 + vnoise(gx * 0.2, gy * 0.2) * 0.16);
      if ((left && !sameW(left) && lx < 1) || (right && !sameW(right) && lx > 14)) c = mul(c, 1.3);
      if (above && !sameW(above) && ly < 1) c = mul(c, 1.35);
      return c;
    }
    case 'R': {
      const ridge = above !== 'R', eave = below !== 'R';
      if (ridge && ly < 4) return ly === 0 ? [90, 98, 112] : ly === 3 ? [20, 22, 28] : [40, 44, 52];
      if (eave && ly > 12) return ly === 15 ? [20, 18, 20] : ly === 13 ? [104, 84, 60] : [70, 54, 38];
      const row = ly >> 2, off = (row & 1) * 2, a = (lx + off) & 3, b = ly & 3;
      let c = [62, 72, 88];
      if (b === 3) c = [26, 30, 38]; else if (a === 0) c = [40, 46, 58]; else if (b === 0 && a !== 0) c = [92, 104, 122];
      if ((left !== 'R' && lx < 1) || (right !== 'R' && lx > 14)) c = mul(c, 0.6);
      return c;
    }
    case 'H': {
      if (ly < 2) return [70, 46, 30];
      if (lx < 1 || lx > 14) return [76, 50, 32];
      if (ly >= 11) { if (ly === 11) return [50, 34, 22]; return (lx % 4 === 0) ? [70, 48, 30] : [98, 68, 42]; }
      if (lx >= 4 && lx <= 11 && ly >= 4 && ly <= 8) { if (lx === 4 || lx === 11 || ly === 4 || ly === 8) return [60, 40, 26]; return (lx % 2 === 0 || ly === 6) ? [80, 60, 42] : [222, 210, 178]; }
      return mul([230, 220, 194], 0.94 + hash2(gx, gy) * 0.06);
    }
    case 'D': {
      if (lx < 1 || lx > 14 || ly < 1) return [66, 44, 28];
      if (ly < 9) { if (lx === 7 || lx === 8) return [26, 34, 64]; const cx = lx - 4.5, cy = ly - 4.5; if (lx < 7 && cx * cx + cy * cy < 3.5) return [236, 232, 220]; return ly === 8 ? [30, 40, 76] : [44, 58, 104]; }
      return ly === 15 ? [70, 52, 34] : [22, 16, 12];
    }
    case 'W': {
      let c = mix([92, 140, 180], [220, 236, 246], vnoise(gx * 0.9, gy * 0.12));
      if (lx < 1 || lx > 14) c = mul(c, 0.75);
      return c;
    }
    case 'x': {
      let c = PAL.ash[clamp(Math.floor(fbm(gx * 0.1, gy * 0.1) * 3), 0, 2)];
      const h1 = hash2(tx, ty), h2 = hash2(ty + 3, tx + 7);
      const d1 = Math.abs((lx - 8) * Math.sin(h1 * 3) - (ly - 8) * Math.cos(h1 * 3));
      const d2 = Math.abs((lx - 8) * Math.sin(h2 * 3 + 1.4) - (ly - 8) * Math.cos(h2 * 3 + 1.4));
      if (d1 < 1.4 || d2 < 1.2) c = (d1 < 0.5 || d2 < 0.4) ? [62, 44, 34] : [18, 14, 12];
      else if (hash2(gx * 3, gy * 5) < 0.03) c = [140, 56, 22];
      return c;
    }
  }
  return [255, 0, 255];
}

/* ----- animated overlays (water, waterfalls, embers) ----- */
function drawMapAnim(m, cx, cy, x0, y0, x1, y1, t) {
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const ch = m.grid[ty][tx], sx = tx * 16 - cx, sy = ty * 16 - cy;
    if (ch === '~') {
      const h = hash2(tx, ty);
      if (h < 0.5) { const p = (t * 0.6 + h * 5) % 3; if (p < 1.6) { ctx.fillStyle = 'rgba(210,236,250,' + (0.55 * Math.sin(p / 1.6 * Math.PI)) + ')'; ctx.fillRect(sx + 3 + Math.floor(h * 8) + Math.floor(p * 2), sy + 4 + Math.floor(h * 9), 3, 1); } }
    } else if (ch === 'W') {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 0; k < 4; k++) { const x = sx + 1 + k * 4 + (k % 2), y = sy + ((t * 70 + k * 23 + tx * 11) % 20) - 4; ctx.fillRect(x, y, 1, 5); }
      if (m.grid[ty + 1] && m.grid[ty + 1][tx] === '~') { ctx.fillStyle = 'rgba(240,250,255,' + (0.5 + 0.3 * Math.sin(t * 9 + tx)) + ')'; ctx.fillRect(sx, sy + 15 + Math.sin(t * 7 + tx) * 1, 16, 3); ctx.fillRect(sx + 3, sy + 18, 10, 2); }
    } else if (ch === 'x') {
      for (let k = 0; k < 3; k++) { const h = hash2(tx * 3 + k, ty * 5); const fl = 0.5 + 0.5 * Math.sin(t * (4 + h * 4) + h * 20); ctx.fillStyle = 'rgba(255,' + Math.floor(100 + fl * 80) + ',30,' + (0.4 + fl * 0.6) + ')'; ctx.fillRect(sx + 2 + Math.floor(h * 12), sy + 2 + Math.floor(hash2(ty, tx * 3 + k) * 12), 1, 1); }
    }
  }
}

/* ----- effect sprites ----- */
const FXC = {};
function slashSprite(dir, phase, big) {
  const k = dir + phase + (big ? 'B' : '');
  if (FXC[k]) return FXC[k];
  const S = big ? 64 : 48, c = mkCanvas(S, S), g = c.getContext('2d'), id = g.createImageData(S, S), o = id.data;
  const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  const sweep = 2.3, start = base - sweep / 2, end = start + sweep * Math.min(1, phase / 2 + 0.34);
  const r0 = big ? 16 : 11, r1 = big ? 28 : 21;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - S / 2, dy = y + 0.5 - S / 2, r = Math.hypot(dx, dy);
    if (r < r0 || r > r1) continue;
    let a = Math.atan2(dy, dx); while (a < start) a += Math.PI * 2; while (a > start + Math.PI * 2) a -= Math.PI * 2;
    if (a > end) continue;
    const rec = (a - start) / Math.max(0.01, end - start);
    const tail = phase === 2 ? rec - 0.45 : rec;
    if (tail < 0) continue;
    const edge = (r - r0) / (r1 - r0);
    let col = edge > 0.72 ? [255, 255, 255] : edge > 0.4 ? [190, 230, 255] : [110, 170, 240];
    const al = clamp(tail * 1.3, 0, 1) * (edge > 0.2 ? 1 : 0.6);
    if (al < 0.18) continue;
    const i = (y * S + x) * 4; o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = Math.round(al * 235);
  }
  g.putImageData(id, 0, 0);
  return (FXC[k] = c);
}
function sparkSprite(f) {
  const k = 'sp' + f; if (FXC[k]) return FXC[k];
  const c = mkCanvas(15, 15), g = c.getContext('2d'); const r = [2, 5, 7, 6][f];
  g.fillStyle = f < 2 ? '#fff' : '#ffe080';
  g.fillRect(7, 7 - r, 1, r * 2 + 1); g.fillRect(7 - r, 7, r * 2 + 1, 1);
  if (f > 0) { g.fillRect(7 - (r >> 1), 7 - (r >> 1), 1, 1); g.fillRect(7 + (r >> 1), 7 - (r >> 1), 1, 1); g.fillRect(7 - (r >> 1), 7 + (r >> 1), 1, 1); g.fillRect(7 + (r >> 1), 7 + (r >> 1), 1, 1); }
  if (f < 3) { g.fillStyle = '#fff'; g.fillRect(6, 6, 3, 3); }
  return (FXC[k] = c);
}
function starSprite(f, col) {
  const k = 'st' + f + (col || ''); if (FXC[k]) return FXC[k];
  const g0 = new PG(9, 9); const M = { a: 1, b: 2 };
  if (f % 2 === 0) { g0.rect(4, 0, 1, 9, M.a); g0.rect(0, 4, 9, 1, M.a); g0.rect(3, 3, 3, 3, M.b); }
  else { g0.line(1, 1, 7, 7, M.a); g0.line(7, 1, 1, 7, M.a); g0.rect(3, 3, 3, 3, M.b); }
  const pal = []; pal[1] = flatM(col || '#d8dce4'); pal[2] = flatM('#6a7080');
  return (FXC[k] = renderPG(g0, pal, '#141018'));
}
function pickupSprite(kind) {
  const k = 'pk' + kind; if (FXC[k]) return FXC[k];
  const g0 = new PG(10, 10); const pal = [];
  if (kind === 'coin') { g0.ell(5, 5, 4, 4, 1); g0.rect(4, 4, 2, 2, 2); pal[1] = ramp('#e0b440'); pal[2] = flatM('#6a4a10'); }
  else if (kind === 'heal') { g0.tri(5, 1, 1, 8, 9, 8, 1); g0.rect(2, 6, 6, 3, 2); pal[1] = ramp('#f4f0e8'); pal[2] = ramp('#2a3a2a'); }
  else { g0.ell(5, 5, 3.5, 3.5, 1); g0.rect(4, 3, 2, 2, 2); pal[1] = ramp('#4a9ae8'); pal[2] = flatM('#e8f6ff'); }
  return (FXC[k] = renderPG(g0, pal, '#140e14'));
}

/* ----- particles (screen space) ----- */
const Parts = {
  list: [], kind: null,
  set(k) { if (this.kind !== k) { this.kind = k; this.list = []; } },
  update(dt) {
    const k = this.kind;
    if (k) { const rate = { embers: 22, leaves: 5, petals: 9, mist: 1.2, dust: 4, fireflies: 1.5, rain: 60 }[k] || 0; if (Math.random() < rate * dt) this.spawn(k); }
    for (const p of this.list) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.sway) p.x += Math.sin(p.t * p.sway) * 0.4; }
    this.list = this.list.filter(p => p.t < p.life && p.y < VH + 20 && p.y > -30 && p.x > -40 && p.x < VW + 40);
  },
  spawn(k) {
    const p = { t: 0, x: Math.random() * VW, y: 0, vx: 0, vy: 0, life: 6, k };
    if (k === 'embers') { p.y = VH + 4; p.vx = R.f(-8, 8); p.vy = R.f(-30, -12); p.life = R.f(3, 8); p.sway = 2; }
    else if (k === 'leaves') { p.y = -6; p.vx = R.f(8, 20); p.vy = R.f(14, 24); p.life = 20; p.sway = 2.5; p.c = R.pick(['#b8401c', '#d07020', '#a02a18', '#c89030']); }
    else if (k === 'petals') { p.y = -6; p.vx = R.f(10, 24); p.vy = R.f(10, 20); p.life = 25; p.sway = 3; p.c = R.pick(['#f4c8d4', '#e8a8bc', '#fff0f4']); }
    else if (k === 'mist') { p.x = -40; p.y = R.f(0, VH); p.vx = R.f(6, 12); p.life = 60; p.r = R.f(30, 60); }
    else if (k === 'dust') { p.y = R.f(0, VH); p.vx = R.f(-3, 3); p.vy = R.f(-3, 3); p.life = R.f(4, 8); }
    else if (k === 'fireflies') { p.y = R.f(40, VH); p.vx = R.f(-6, 6); p.vy = R.f(-6, 6); p.life = R.f(3, 6); p.sway = 1.5; }
    this.list.push(p);
  },
  draw(g) {
    for (const p of this.list) {
      const fade = clamp(Math.min(1, p.t, p.life - p.t), 0, 1);
      if (p.k === 'embers') { g.fillStyle = 'rgba(255,' + (120 + Math.floor(Math.random() * 80)) + ',40,' + 0.8 * fade + ')'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else if (p.k === 'leaves' || p.k === 'petals') { g.fillStyle = p.c; g.globalAlpha = 0.9 * fade; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); g.fillRect(Math.round(p.x + Math.sin(p.t * 4)), Math.round(p.y) + 1, 1, 1); g.globalAlpha = 1; }
      else if (p.k === 'mist') { g.fillStyle = 'rgba(230,236,240,' + 0.07 * fade + ')'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      else if (p.k === 'dust') { g.fillStyle = 'rgba(200,180,150,' + 0.35 * fade + ')'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      else if (p.k === 'fireflies') { g.fillStyle = 'rgba(210,255,120,' + (0.5 + 0.5 * Math.sin(p.t * 6)) * fade + ')'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }
  },
};

/* ----- lighting ----- */
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

/* ----- text & windows ----- */
function drawWin(x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(10,12,30,' + (alpha == null ? 0.93 : alpha) + ')';
  ctx.fillRect(x, y, w, h);
  const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(60,70,130,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#08080c'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.strokeStyle = '#d8c48a'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.strokeStyle = 'rgba(120,100,60,.8)'; ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  ctx.fillStyle = '#d8c48a';
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 4, y + 1], [x + 1, y + h - 4], [x + w - 4, y + h - 4]]) ctx.fillRect(cx, cy, 3, 3);
}
function text(s, x, y, o = {}) {
  ctx.font = font(o.size || 11, o.bold);
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'top';
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillText(s, x + 0.8, y + 0.8); }
  ctx.fillStyle = o.color || '#ece4d0';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}
function wrap(s, maxW, size, bold) {
  ctx.font = font(size || 11, bold);
  const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
function bar(x, y, w, h, v, max, col, bg) {
  ctx.fillStyle = bg || '#1a1414'; ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.round(w * clamp(v / max, 0, 1)));
  ctx.fillStyle = col; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, fw, 1);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + h - 1, fw, 1);
}
