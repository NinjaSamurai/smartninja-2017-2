'use strict';
/* ===== Core: canvas, utilities, input, audio, music ===== */
const VW = 480, VH = 270, TS = 16;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let SCALE = 1, OX = 0, OY = 0;

function resize() {
  const d = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  SCALE = Math.min(cv.width / VW, cv.height / VH);
  OX = Math.round((cv.width - VW * SCALE) / 2);
  OY = Math.round((cv.height - VH * SCALE) / 2);
}
window.addEventListener('resize', resize);
resize();

const FONT = "'Noto Serif','Noto Serif JP','Yu Mincho','Hiragino Mincho ProN',Georgia,'Times New Roman',serif";
const font = (sz, b) => (b ? 'bold ' : '') + sz + 'px ' + FONT;

const R = {
  i: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  f: (a, b) => a + Math.random() * (b - a),
  pick: a => a[Math.floor(Math.random() * a.length)],
  chance: p => Math.random() < p,
};
function seeded(s) { s = (s * 9301 + 49297) % 233280 || 1; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRGB(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, amt) { const [r, g, b] = hexRGB(h); const f = v => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255); return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }

/* ----- Input ----- */
const Input = {
  held: {}, pr: {}, hold: {},
  press(a) { if (!this.held[a]) { this.pr[a] = true; this.hold[a] = 0; } this.held[a] = true; Snd.unlock(); },
  release(a) { this.held[a] = false; },
  take(a) { if (this.pr[a]) { this.pr[a] = false; return true; } return false; },
  update(dt) {
    for (const a of ['up', 'down', 'left', 'right']) {
      if (this.held[a]) { this.hold[a] += dt; if (this.hold[a] > 0.38) { this.hold[a] -= 0.085; this.pr[a] = true; } }
    }
  },
  clear() { this.pr = {}; },
  dir() { for (const d of ['up', 'down', 'left', 'right']) if (this.held[d]) return d; return null; },
};
const KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyJ: 'ok', KeyX: 'cancel', Escape: 'cancel', Backspace: 'cancel', KeyK: 'cancel', KeyC: 'menu', KeyM: 'menu', Tab: 'menu' };
window.addEventListener('keydown', e => { const a = KEYS[e.code]; if (a) { e.preventDefault(); if (!e.repeat) Input.press(a); } });
window.addEventListener('keyup', e => { const a = KEYS[e.code]; if (a) { e.preventDefault(); Input.release(a); } });
window.addEventListener('blur', () => { Input.held = {}; });

(function setupTouch() {
  const t = document.getElementById('touch');
  const coarse = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window);
  if (!coarse) { t.style.display = 'none'; return; }
  const dpad = document.getElementById('dpad'), knob = dpad.querySelector('.knob');
  let pid = null;
  const setDir = d => { for (const k of ['up', 'down', 'left', 'right']) { if (k === d) Input.press(k); else Input.release(k); } };
  const move = e => {
    const r = dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    let d = null;
    if (dist > r.width * 0.12) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    setDir(d);
    const lim = r.width * 0.3, s = Math.min(dist, lim) / (dist || 1);
    knob.style.transform = 'translate(' + dx * s + 'px,' + dy * s + 'px)';
  };
  dpad.addEventListener('pointerdown', e => { pid = e.pointerId; try { dpad.setPointerCapture(pid); } catch (_) {} move(e); e.preventDefault(); });
  dpad.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
  const up = e => { if (e.pointerId === pid) { pid = null; setDir(null); knob.style.transform = ''; } };
  dpad.addEventListener('pointerup', up); dpad.addEventListener('pointercancel', up);
  for (const [id, a] of [['btnA', 'ok'], ['btnB', 'cancel'], ['btnM', 'menu']]) {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); Input.press(a); b.classList.add('on'); });
    const r = () => { Input.release(a); b.classList.remove('on'); };
    b.addEventListener('pointerup', r); b.addEventListener('pointercancel', r); b.addEventListener('pointerleave', r);
  }
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
cv.addEventListener('pointerdown', () => Snd.unlock());

/* ----- Sound effects (synthesized, no assets) ----- */
const Snd = {
  ac: null, on: true,
  unlock() {
    if (!this.ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ac = new AC();
        this.out = this.ac.createGain(); this.out.gain.value = this.on ? 0.55 : 0; this.out.connect(this.ac.destination);
        this.mus = this.ac.createGain(); this.mus.gain.value = 0.3; this.mus.connect(this.out);
        this.fx = this.ac.createGain(); this.fx.gain.value = 0.7; this.fx.connect(this.out);
        const n = this.ac.sampleRate, b = this.ac.createBuffer(1, n, n), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.nb = b;
      } catch (e) { this.ac = null; }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  setOn(v) { this.on = v; if (this.out) this.out.gain.value = v ? 0.55 : 0; },
  tone(f, d, o = {}) {
    if (!this.ac) return;
    const ac = this.ac, t = o.t || ac.currentTime;
    const os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'square';
    os.frequency.setValueAtTime(f, t);
    if (o.slide) os.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + d);
    const v = o.v || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let node = os;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; os.connect(fl); node = fl; }
    node.connect(g); g.connect(o.dest || this.fx);
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(os.frequency); l.start(t + 0.12); l.stop(t + d); }
    os.start(t); os.stop(t + d + 0.03);
  },
  noise(d, o = {}) {
    if (!this.ac) return;
    const ac = this.ac, t = o.t || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = this.nb;
    const f = ac.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.value = o.f || 2000;
    const g = ac.createGain(); g.gain.setValueAtTime(o.v || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(o.dest || this.fx);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.03);
  },
  sfx(n) {
    if (!this.ac) return;
    const T = this.ac.currentTime;
    switch (n) {
      case 'cursor': this.tone(900, 0.04, { v: 0.04 }); break;
      case 'ok': this.tone(660, 0.06, { v: 0.06 }); this.tone(990, 0.08, { v: 0.05, t: T + 0.05 }); break;
      case 'cancel': this.tone(440, 0.08, { v: 0.05, slide: 0.6 }); break;
      case 'buzz': this.tone(110, 0.15, { type: 'sawtooth', v: 0.06 }); break;
      case 'slash': this.noise(0.15, { f: 3500, ft: 'highpass', v: 0.35 }); this.tone(1400, 0.1, { type: 'sawtooth', v: 0.035, slide: 0.3 }); break;
      case 'hit': this.noise(0.12, { f: 900, v: 0.5 }); this.tone(170, 0.12, { v: 0.1, slide: 0.5 }); break;
      case 'crit': this.noise(0.2, { f: 2500, v: 0.6 }); this.tone(260, 0.2, { type: 'sawtooth', v: 0.12, slide: 0.3 }); break;
      case 'hurt': this.noise(0.22, { f: 600, v: 0.55 }); this.tone(120, 0.25, { type: 'sawtooth', v: 0.1, slide: 0.4 }); break;
      case 'miss': this.noise(0.12, { f: 5000, ft: 'highpass', v: 0.15 }); break;
      case 'throw': this.tone(2200, 0.14, { type: 'triangle', v: 0.05, slide: 0.35 }); break;
      case 'smoke': this.noise(0.7, { f: 450, v: 0.35 }); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, { type: 'triangle', v: 0.07, t: T + i * 0.07 })); break;
      case 'level': [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.32, { v: 0.05, lp: 2800, t: T + i * 0.09 })); break;
      case 'enc': this.tone(180, 0.45, { type: 'sawtooth', v: 0.09, slide: 2.5 }); this.noise(0.4, { f: 1500, v: 0.2 }); break;
      case 'gun': this.noise(0.6, { f: 1400, v: 0.9 }); this.tone(70, 0.45, { v: 0.2, slide: 0.3 }); break;
      case 'item': this.tone(784, 0.1, { type: 'triangle', v: 0.08 }); this.tone(1175, 0.2, { type: 'triangle', v: 0.08, t: T + 0.08 }); break;
      case 'door': this.tone(220, 0.15, { type: 'triangle', v: 0.1, slide: 0.7 }); this.noise(0.1, { f: 500, v: 0.1 }); break;
      case 'taiko': this.tone(85, 0.5, { type: 'sine', v: 0.6, slide: 0.5 }); this.noise(0.08, { f: 300, v: 0.3 }); break;
      case 'die': this.tone(300, 0.6, { type: 'sawtooth', v: 0.07, slide: 0.2, lp: 1200 }); break;
      case 'coin': this.tone(1320, 0.06, { v: 0.05 }); this.tone(1760, 0.12, { v: 0.05, t: T + 0.06 }); break;
      case 'bell': this.tone(523, 2.2, { type: 'sine', v: 0.2 }); this.tone(1046 * 1.01, 1.4, { type: 'sine', v: 0.06 }); break;
      case 'poison': this.tone(300, 0.2, { type: 'sine', v: 0.08, slide: 0.5 }); break;
    }
  },
};

/* ----- Procedural music in Japanese scales ----- */
const SCALES = { in: [0, 1, 5, 7, 8], yo: [0, 2, 5, 7, 9], min: [0, 3, 5, 7, 10], hira: [0, 2, 3, 7, 8] };
const Music = {
  cur: null, step: 0, next: 0, timer: null,
  play(n) {
    if (this.cur === n) return;
    this.cur = n; this.step = 0; this.next = 0;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 40);
  },
  stop() { this.cur = null; },
  tick() {
    const ac = Snd.ac; if (!ac || !this.cur || !Snd.on) return;
    const T = TRACKS[this.cur]; if (!T) return;
    if (!T._p) T._p = T.voices.map(v => v.seq.trim().split(/\s+/));
    const sp = 60 / T.bpm / 2;
    if (this.next < ac.currentTime) this.next = ac.currentTime + 0.05;
    while (this.next < ac.currentTime + 0.25) { this.note(T, this.step, this.next, sp); this.step++; this.next += sp; }
  },
  freq(T, d, oct) {
    const sc = SCALES[T.scale]; const o = Math.floor(d / 5);
    const s = sc[((d % 5) + 5) % 5] + 12 * o;
    return 440 * Math.pow(2, (T.root + s + 12 * (oct || 0) - 69) / 12);
  },
  note(T, i, t, sp) {
    T.voices.forEach((v, vi) => {
      const seq = T._p[vi]; const tok = seq[i % seq.length];
      if (tok === '.' || tok === '-' || tok === undefined) return;
      const vol = v.vol || 1, dest = Snd.mus;
      if (v.inst === 'drum') {
        if (tok === 'K') { Snd.tone(78, 0.4, { type: 'sine', v: 0.55 * vol, slide: 0.5, t, dest }); Snd.noise(0.07, { f: 380, v: 0.25 * vol, t, dest }); }
        else if (tok === 'k') Snd.tone(140, 0.16, { type: 'sine', v: 0.32 * vol, slide: 0.6, t, dest });
        else if (tok === 'h') Snd.noise(0.04, { f: 7000, ft: 'highpass', v: 0.1 * vol, t, dest });
        else if (tok === 'c') Snd.noise(0.15, { f: 2600, ft: 'bandpass', v: 0.22 * vol, t, dest });
        return;
      }
      const d = parseInt(tok, 36);
      let len = 1; for (let j = 1; j < 16; j++) { if (seq[(i + j) % seq.length] === '-') len++; else break; }
      const f = this.freq(T, d, v.oct);
      const dur = sp * len;
      if (v.inst === 'pluck') { Snd.tone(f, Math.max(dur * 1.5, 0.6), { type: 'triangle', v: 0.2 * vol, t, dest }); Snd.tone(f * 2, 0.22, { type: 'sine', v: 0.05 * vol, t, dest }); }
      else if (v.inst === 'flute') Snd.tone(f, dur * 0.95, { type: 'sine', v: 0.16 * vol, a: 0.07, t, dest, vib: 1 });
      else if (v.inst === 'bass') Snd.tone(f, dur * 0.9, { type: 'triangle', v: 0.24 * vol, t, dest });
      else if (v.inst === 'shami') Snd.tone(f, 0.28, { type: 'sawtooth', v: 0.06 * vol, lp: 1800, t, dest });
      else if (v.inst === 'pad') Snd.tone(f, dur, { type: 'sine', v: 0.07 * vol, a: 0.4, t, dest });
    });
  },
};

const TRACKS = {
  title: { bpm: 64, scale: 'in', root: 52, voices: [
    { inst: 'flute', oct: 1, seq: '7 - - 6 5 - 4 - 5 - - - . . . . 7 - 8 - 9 - 8 - 7 - - - . . . . 9 - 8 7 6 - 5 - 4 - 5 - 3 - - - 2 - - - - - - - . . . . . . . .' },
    { inst: 'bass', oct: -1, seq: '0 - - - - - - - 3 - - - - - - - 2 - - - - - - - 0 - - - - - - -' },
    { inst: 'pluck', oct: 0, seq: '. . 5 . . . 7 . . . 5 . . . 4 . . . 5 . . . 7 . . . 8 . . . 7 .' , vol: 0.6 } ] },
  sorrow: { bpm: 58, scale: 'in', root: 50, voices: [
    { inst: 'flute', oct: 1, seq: '5 - - - 4 - 3 - 4 - - - - - . . 3 - 4 - 5 - 7 - 5 - - - - - . . 4 - 3 - 2 - 1 - 2 - - - 0 - - - - - - - . . . . . . . .' },
    { inst: 'pad', oct: -1, seq: '0 - - - - - - - - - - - - - - - 3 - - - - - - - - - - - - - - -' },
    { inst: 'drum', seq: 'K . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', vol: 0.5 } ] },
  field: { bpm: 92, scale: 'in', root: 52, voices: [
    { inst: 'pluck', oct: 1, seq: '0 2 3 . 4 . 3 2 3 . . . 2 . 0 . 0 2 3 . 4 . 5 . 4 . . . 3 . . . 5 . 4 3 4 . 3 2 3 . 2 0 2 . . . 0 . 2 . 3 . 2 . 0 . . . . . . .' },
    { inst: 'bass', oct: -1, seq: '0 . . . 0 . . . 3 . . . 2 . . . 0 . . . 0 . . . 3 . . . 4 . . .' },
    { inst: 'drum', seq: 'K . . . h . k . K . . . h . . . K . . . h . k . K . k . h . . .', vol: 0.6 } ] },
  town: { bpm: 104, scale: 'yo', root: 55, voices: [
    { inst: 'flute', oct: 1, seq: '2 - 3 - 4 - 3 2 0 - 2 - 3 - - - 4 - 5 - 6 - 5 4 3 - 2 - 3 - - - 2 - 3 - 4 - 3 2 0 - 1 - 0 - - - 2 - 3 2 0 - -1 - 0 - - - - - - -' },
    { inst: 'shami', oct: 0, seq: '0 . 2 . 0 . 4 . 0 . 2 . 0 . 4 . 3 . 5 . 3 . 7 . 3 . 5 . 3 . 7 .', vol: 0.8 },
    { inst: 'drum', seq: 'K . h . k . h . K . h . k . h h', vol: 0.5 } ] },
  battle: { bpm: 150, scale: 'in', root: 50, voices: [
    { inst: 'shami', oct: 1, seq: '0 0 2 0 3 0 2 0 4 3 2 0 2 . 1 . 0 0 2 0 3 0 4 0 5 4 3 2 3 . 4 . 7 . 5 . 4 3 4 5 7 . 5 . 4 . 3 . 2 3 4 . 3 2 0 . 2 . 1 . 0 . . .' },
    { inst: 'bass', oct: -1, seq: '0 . 0 . 0 . 5 . 0 . 0 . 4 . 3 . 0 . 0 . 0 . 5 . 2 . 2 . 3 . 4 .' },
    { inst: 'drum', seq: 'K . k . K K k . K . k . K k K k', vol: 0.8 } ] },
  boss: { bpm: 160, scale: 'hira', root: 47, voices: [
    { inst: 'shami', oct: 1, seq: '0 . 0 1 0 . 3 . 2 . 1 . 0 . . . 4 . 4 3 2 . 3 . 4 . 7 . 5 . . . 7 . 5 4 3 . 4 . 5 . 4 3 2 . 1 . 0 1 2 . 3 . 2 1 0 . -1 . 0 . . .' },
    { inst: 'bass', oct: -1, seq: '0 0 . 0 0 . 0 . 1 1 . 1 0 . -1 . 0 0 . 0 0 . 0 . 3 3 . 3 2 . 1 .' },
    { inst: 'drum', seq: 'K . K k K . k k K . K k K c k k', vol: 0.9 } ] },
  dungeon: { bpm: 70, scale: 'hira', root: 45, voices: [
    { inst: 'pluck', oct: 1, seq: '0 . . . . . 1 . . . . . 0 . . . . . . . -1 . . . 0 . . . . . . . 3 . . . . . 2 . . . . . 1 . . . . . . . 0 . . . . . . . . . . .' },
    { inst: 'pad', oct: -1, seq: '0 - - - - - - - - - - - - - - - -1 - - - - - - - - - - - - - - -' },
    { inst: 'drum', seq: 'K . . . . . . . k . . . . . . . . . . . . . . . k . . . . . . .', vol: 0.6 } ] },
  falls: { bpm: 80, scale: 'yo', root: 50, voices: [
    { inst: 'flute', oct: 1, seq: '4 - - - 3 - 2 - 3 - - - - - . . 2 - 3 - 4 - 5 - 4 - - - - - . . 5 - 4 - 3 - 2 - 0 - - - 2 - - - 1 - - - - - - - . . . . . . . .' },
    { inst: 'pluck', oct: 0, seq: '0 . 2 . 4 . 2 . 0 . 2 . 4 . 2 . -1 . 1 . 3 . 1 . -1 . 1 . 3 . 1 .', vol: 0.5 } ] },
  reunion: { bpm: 60, scale: 'yo', root: 53, voices: [
    { inst: 'flute', oct: 1, seq: '2 - - - 4 - 3 - 2 - 0 - 2 - - - 4 - - - 5 - 7 - 5 - 4 - 5 - - - 4 - - - 3 - 2 - 0 - - - -1 - 0 - - - - - - - - - - - . . . .' },
    { inst: 'pad', oct: -1, seq: '0 - - - - - - - - - - - - - - - 3 - - - - - - - - - - - - - - -' },
    { inst: 'pluck', oct: 0, seq: '0 . . . 4 . . . 7 . . . 4 . . . 3 . . . 5 . . . 8 . . . 5 . . .', vol: 0.5 } ] },
  ending: { bpm: 72, scale: 'yo', root: 55, voices: [
    { inst: 'flute', oct: 1, seq: '0 - 2 - 3 - 4 - 3 - - - 2 - 0 - 2 - 3 - 4 - 6 - 5 - - - - - . . 7 - 6 - 5 - 4 - 3 - 4 - 2 - - - 0 - 2 - 3 - 2 - 0 - - - - - - - . .' },
    { inst: 'pluck', oct: 0, seq: '0 . 4 . 7 . 4 . 3 . 7 . 9 . 7 . 2 . 5 . 9 . 5 . 0 . 4 . 7 . 4 .', vol: 0.55 },
    { inst: 'bass', oct: -1, seq: '0 - - - - - - - 3 - - - - - - - 2 - - - - - - - 0 - - - - - - -' } ] },
};
