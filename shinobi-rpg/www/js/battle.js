'use strict';
/* ===== Turn-based battle system ===== */
const Battle = { B: null };

function mkEnemy(id, i, n, dup) {
  const d = ENEMIES[id];
  const e = Object.assign({}, d, { id, maxhp: d.hp, hp: d.hp, st: {}, side: 'enemy', flash: 0, shake: 0, alpha: 1, dead: false, lunge: 0 });
  e.scale = d.scale || 4; e.sp = SPR[d.spr];
  e.x = 240 + (i - (n - 1) / 2) * (n > 2 ? 118 : 140); e.y = 172;
  if (dup) e.name = d.name + ' ' + 'ABC'[dup - 1];
  e.pron = SPR[d.spr].animal ? 'its' : 'his';
  return e;
}
function mkRen() {
  return { name: 'Ren', isRen: true, hp: P.hp, maxhp: maxHP(), ki: P.ki, maxki: maxKi(), atk: pAtk(), def: pDef(), agi: stat('agi'), crit: pCrit(), st: {}, side: 'ally', hurt: 0 };
}
function mkYuki() {
  const mh = Math.round(maxHP() * 0.85);
  return { name: 'Yuki', ai: true, hp: mh, maxhp: mh, atk: Math.round(pAtk() * 0.85) + 2, def: Math.round(pDef() * 0.8), agi: stat('agi') + 3, crit: 15, st: {}, side: 'ally', hurt: 0 };
}

function bsay(t, dur = 1.0) {
  const B = Battle.B; B.text = t;
  return new Promise(r => { B.waiting = { t: dur, r }; });
}
function dmgNum(target, val, col, big) {
  const B = Battle.B; let x, y;
  if (target.side === 'enemy') { x = target.x; y = target.y - 16 * target.scale * 0.6; }
  else { const i = B.allies.indexOf(target); x = 196 + i * 160; y = 210; }
  B.nums.push({ x: x + R.f(-6, 6), y, s: String(val), col: col || '#fff', t: 0, big });
}
const living = arr => arr.filter(a => a.hp > 0);
function weighted(list) { const tot = list.reduce((s, x) => s + x[1], 0); let r = Math.random() * tot; for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list[0][0]; }

function hitChance(a, d, o = {}) {
  if (o.sure) return 1;
  let h = 0.93 + (a.agi - d.agi) * 0.012 + (o.hitMod || 0);
  if (a.st.blind) h -= 0.45;
  if (d.st.smoke) h -= 0.5;
  if (d.evade) h -= d.evade / 100;
  return clamp(h, 0.08, 0.99);
}
function calcDmg(a, d, mult = 1, o = {}) {
  let atk = a.atk * (a.st.roar ? 1.3 : 1);
  let base = atk * 2 * mult - d.def * (o.pierce ? 0.3 : 1);
  base = Math.max(1 + atk * 0.15, base);
  if (d.st.guard) base *= 0.5;
  base *= R.f(0.9, 1.1);
  let crit = false;
  if (!o.noCrit && Math.random() < (a.crit || 5) / 100 + (o.critBonus || 0)) { crit = true; base *= 1.6; }
  return { dmg: Math.max(1, Math.round(base)), crit };
}
function onDown(t) {
  if (t.side === 'enemy') { t.dead = true; Snd.sfx('die'); }
}
function applyDmg(t, d, crit) {
  t.hp = Math.max(0, t.hp - d);
  dmgNum(t, d, crit ? '#ffd040' : (t.side === 'ally' ? '#ff9a8a' : '#ffffff'), crit);
  if (t.side === 'enemy') { t.flash = 0.22; t.shake = 0.25; Snd.sfx(crit ? 'crit' : 'hit'); }
  else { Shake.go(0.25, 3); Flash.go('#a01010', 0.22); t.hurt = 0.35; Snd.sfx('hurt'); }
  if (t.hp <= 0) onDown(t);
}
function fx(type, o) { Battle.B.fx.push(Object.assign({ type, t: 0, life: 0.3 }, o)); }

async function attackEnemy(a, t, mult = 1, o = {}) {
  if (t.hp <= 0) { const al = living(Battle.B.enemies); if (!al.length) return false; t = al[0]; }
  if (o.anim === 'star') { Snd.sfx('throw'); fx('star', { x0: a.isRen ? 196 : 356, y0: 250, x1: t.x, y1: t.y - 8 * t.scale, life: 0.22 }); await wait(0.22); }
  else { Snd.sfx('slash'); fx('slash', { x: t.x, y: t.y - 8 * t.scale, s: t.scale, life: 0.25 }); await wait(0.15); }
  if (Math.random() > hitChance(a, t, o)) { Snd.sfx('miss'); dmgNum(t, 'miss', '#a0a0b0'); await wait(0.35); return false; }
  const { dmg, crit } = calcDmg(a, t, mult, o);
  applyDmg(t, dmg, crit);
  await wait(0.3);
  if (crit && !o.quietCrit) await bsay('A critical strike!', 0.55);
  if (t.hp <= 0) await bsay(t.name + ' is defeated.', 0.6);
  return true;
}
async function attackAlly(e, t, mult = 1, o = {}) {
  if (t.hp <= 0) return false;
  e.lunge = 0.3;
  await wait(0.12);
  if (Math.random() > hitChance(e, t, o)) { Snd.sfx('miss'); dmgNum(t, 'miss', '#a0a0b0'); await wait(0.35); return false; }
  const r = calcDmg(e, t, mult, o);
  applyDmg(t, r.dmg, r.crit);
  await wait(0.35);
  if (t.hp <= 0) await bsay(t.isRen ? 'Ren collapses...' : t.name + ' is knocked down!', 0.8);
  return true;
}
function pickAlly(B) {
  const al = living(B.allies);
  if (al.length > 1 && Math.random() < 0.4) return al[1];
  return al[0];
}

async function enemyAct(B, e) {
  let act = e.st.aimed ? 'fire' : weighted(e.ai);
  if (e.id === 'gensai' && e.hp < e.maxhp * 0.5 && !e.phase2) {
    e.phase2 = true; e.atk = Math.round(e.atk * 1.15);
    e.ai = [['attack', 2], ['multi', 2], ['feathers', 3], ['heavy', 2], ['poison', 1]];
    await bsay('Gensai: "Enough. Isshin taught you well — but he taught ME first."', 2.2);
  }
  const t = pickAlly(B); if (!t) return;
  const nm = e.name;
  switch (act) {
    case 'attack': await bsay(nm + ' attacks ' + t.name + '!', 0.55); await attackAlly(e, t, 1); break;
    case 'heavy': await bsay(nm + ' brings ' + e.pron + ' weapon down with full force!', 0.7); await attackAlly(e, t, 1.5, { hitMod: -0.1 }); break;
    case 'multi': { await bsay(nm + ' strikes in a flurry!', 0.55); const n = R.i(2, 3); for (let i = 0; i < n && t.hp > 0; i++) await attackAlly(e, t, 0.55); break; }
    case 'thrust': await bsay(nm + ' drives ' + e.pron + ' spear forward!', 0.6); await attackAlly(e, t, 1.3, { pierce: true }); break;
    case 'poison': await bsay(nm + ' lunges with a blade slick with poison!', 0.7);
      if (await attackAlly(e, t, 0.8) && t.hp > 0 && !t.st.poison && Math.random() < 0.6) { t.st.poison = 5; Snd.sfx('poison'); await bsay(t.name + ' is poisoned!', 0.7); } break;
    case 'blind': await bsay(nm + ' hurls a cloud of blinding powder!', 0.7);
      if (Math.random() < 0.6) { t.st.blind = 3; await bsay(t.name + ' is blinded!', 0.7); } else await bsay(t.name + ' shields ' + (t.name === 'Yuki' ? 'her' : 'his') + ' eyes in time.', 0.7); break;
    case 'aim': e.st.aimed = 1; await bsay(nm + ' levels a matchlock. The slow-match hisses...', 1.0); break;
    case 'fire': e.st.aimed = 0; Snd.sfx('gun'); Flash.go('#fff4d0', 0.7); await bsay('BANG!', 0.4); await attackAlly(e, t, 2.3, { hitMod: -0.08 }); break;
    case 'charge': await bsay(nm + ' lowers ' + e.pron + ' head and charges!', 0.6); await attackAlly(e, t, 1.7, { hitMod: -0.15 }); break;
    case 'roar': e.st.roar = 3; Snd.sfx('taiko'); await bsay(nm + ' roars and works ' + (e.pron === 'its' ? 'itself' : 'himself') + ' into a fury!', 0.9); break;
    case 'guard': e.st.guard = 1; await bsay(nm + ' settles into a guarded stance.', 0.7); break;
    case 'sweep': await bsay(nm + ' sweeps in a wide, killing arc!', 0.7); for (const a of living(B.allies)) await attackAlly(e, a, 0.9); break;
    case 'feathers': await bsay(nm + ' looses a storm of black-fletched darts!', 0.8);
      for (let k = 0; k < 2; k++) for (const a of living(B.allies)) await attackAlly(e, a, 0.5); break;
  }
}

async function yukiAct(B, y) {
  const ren = B.allies[0], foes = living(B.enemies); if (!foes.length) return;
  const t = R.pick(foes);
  if (ren.hp > 0 && ren.hp < ren.maxhp * 0.35 && (B.yukiHeals || 0) < 3 && Math.random() < 0.7) {
    B.yukiHeals = (B.yukiHeals || 0) + 1;
    const h = Math.round(ren.maxhp * 0.3); ren.hp = Math.min(ren.maxhp, ren.hp + h);
    Snd.sfx('heal'); dmgNum(ren, '+' + h, '#8af08a');
    await bsay('Yuki presses a salve into Ren\'s wounds. "Stay with me, niisan."', 1.2);
  } else if (foes.length > 1 && Math.random() < 0.4) {
    await bsay('Yuki looses a fan of shuriken!', 0.6);
    for (const f of foes) await attackEnemy(y, f, 0.6, { sure: true, anim: 'star', quietCrit: true });
  } else if (!t.st.blind && !t.boss && Math.random() < 0.15) {
    await bsay('Yuki flings metsubushi into ' + t.name + '\'s eyes!', 0.8); t.st.blind = 3;
  } else {
    await bsay('Yuki darts in with her tantō!', 0.55); await attackEnemy(y, t, 1);
  }
}

class TargetSel extends Widget {
  constructor(B) { super(); this.B = B; this.list = living(B.enemies); this.i = 0; }
  update() {
    const n = this.list.length;
    if (Input.take('left') || Input.take('up')) { this.i = (this.i + n - 1) % n; Snd.sfx('cursor'); }
    if (Input.take('right') || Input.take('down')) { this.i = (this.i + 1) % n; Snd.sfx('cursor'); }
    if (Input.take('ok')) { Snd.sfx('ok'); this.finish(this.list[this.i]); }
    else if (Input.take('cancel')) { Snd.sfx('cancel'); this.finish(null); }
  }
  draw() {
    const e = this.list[this.i]; const y = e.y - 16 * e.scale - 10 + Math.sin(G.time * 8) * 2;
    ctx.fillStyle = '#f0d070'; ctx.beginPath(); ctx.moveTo(e.x - 6, y); ctx.lineTo(e.x + 6, y); ctx.lineTo(e.x, y + 7); ctx.fill();
    drawWin(12, 194, 118, 26); text(e.name, 71, 200, { size: 10, align: 'center' });
  }
}
async function pickTarget(B) { const l = living(B.enemies); if (l.length === 1) return l[0]; return UI.push(new TargetSel(B)); }

async function playerCommand(B, ren) {
  while (true) {
    B.text = 'What will Ren do?';
    const i = await menu([{ label: 'Strike' }, { label: 'Technique' }, { label: 'Item' }, { label: 'Defend' }, { label: 'Flee', disabled: !!B.o.noFlee }],
      { x: 12, y: 194, w: 118, rows: 5, lh: 12.6, cancel: false, index: B.lastCmd || 0 });
    B.lastCmd = i;
    if (i === 0) { const t = await pickTarget(B); if (t) return { type: 'attack', target: t }; }
    else if (i === 1) {
      const list = P.skills.map(id => ({ id, label: SKILLS[id].name, right: SKILLS[id].ki, disabled: ren.ki < SKILLS[id].ki, desc: SKILLS[id].desc }));
      const j = await menu(list, { x: 12, y: 40, w: 190, rows: Math.min(8, list.length), title: 'Ki ' + ren.ki + '/' + ren.maxki, desc: true, index: B.lastSkill || 0 });
      if (j < 0) continue; B.lastSkill = j;
      const id = list[j].id, sk = SKILLS[id];
      if (sk.target === 'one') { const t = await pickTarget(B); if (!t) continue; return { type: 'skill', id, target: t }; }
      return { type: 'skill', id };
    } else if (i === 2) {
      const ids = invList(it => it.type === 'use' || it.type === 'battle');
      if (!ids.length) { await bsay('You have nothing useful to hand.', 0.8); continue; }
      const list = ids.map(id => ({ id, label: ITEMS[id].name, right: '×' + count(id), desc: ITEMS[id].desc, disabled: ITEMS[id].escape && B.o.noFlee }));
      const j = await menu(list, { x: 12, y: 40, w: 190, rows: Math.min(8, list.length), title: 'Items', desc: true });
      if (j < 0) continue;
      return { type: 'item', id: list[j].id };
    } else if (i === 3) return { type: 'defend' };
    else if (i === 4) return { type: 'flee' };
  }
}

async function playerAct(B, act) {
  const ren = act.actor;
  if (act.type === 'attack') { await bsay('Ren strikes!', 0.4); await attackEnemy(ren, act.target, 1); }
  else if (act.type === 'defend') { await bsay('Ren steadies his breathing and guards. (+2 Ki)', 0.7); }
  else if (act.type === 'flee') {
    const avg = living(B.enemies).reduce((s, e) => s + e.agi, 0) / living(B.enemies).length;
    if (Math.random() < 0.55 + (ren.agi - avg) * 0.03) { Snd.sfx('smoke'); await bsay('Ren melts into the shadows and escapes.', 1); return 'fled'; }
    await bsay('They cut off your retreat!', 0.8);
  } else if (act.type === 'item') {
    const it = ITEMS[act.id]; takeItem(act.id);
    await bsay('Ren uses ' + it.name + '.', 0.5);
    if (it.heal || it.ki) {
      if (it.heal) { const h = Math.min(it.heal, ren.maxhp - ren.hp); ren.hp += h; dmgNum(ren, '+' + h, '#8af08a'); }
      if (it.ki) { ren.ki = Math.min(ren.maxki, ren.ki + it.ki); dmgNum(ren, '+' + it.ki + ' Ki', '#8ac0f0'); }
      Snd.sfx('heal'); await wait(0.4);
    } else if (it.cure) { delete ren.st[it.cure]; Snd.sfx('heal'); await bsay(it.cure === 'poison' ? 'The poison is purged.' : 'Your sight clears.', 0.7); }
    else if (it.dmgAll) {
      Snd.sfx(act.id === 'horoku' ? 'gun' : 'throw'); if (act.id === 'horoku') Flash.go('#ffa040', 0.6);
      for (const e of living(B.enemies)) { const d = Math.round(it.dmgAll * R.f(0.9, 1.1)); applyDmg(e, d); }
      await wait(0.5);
      for (const e of B.enemies) if (e.dead && !e.announced) { e.announced = true; }
    } else if (it.escape) { Snd.sfx('smoke'); await bsay('A burst of smoke — and Ren is gone.', 1); return 'fled'; }
  } else if (act.type === 'skill') {
    const sk = SKILLS[act.id]; ren.ki -= sk.ki; const t = act.target;
    switch (act.id) {
      case 'shuriken': await bsay('Ren throws bō-shuriken!', 0.45); await attackEnemy(ren, t, 0.9, { sure: true, anim: 'star' }); break;
      case 'breath': { await bsay('Ren slows his breath, gathering himself. (Kokyū-hō)', 0.8); const h = Math.round(ren.maxhp * 0.35); ren.hp = Math.min(ren.maxhp, ren.hp + h); dmgNum(ren, '+' + h, '#8af08a'); Snd.sfx('heal'); await wait(0.4); break; }
      case 'smoke': Snd.sfx('smoke'); fx('smoke', { life: 0.8 }); ren.st.smoke = 3; await bsay('Ren hurls a kemuri-dama! Smoke swallows him.', 0.9); break;
      case 'blind': await bsay('Ren flings metsubushi!', 0.5);
        if (Math.random() < (t.boss ? 0.5 : 0.85)) { t.st.blind = 3; Snd.sfx('smoke'); await bsay(t.name + ' is blinded!', 0.7); } else await bsay(t.name + ' turns away in time.', 0.7); break;
      case 'iai': await bsay('Iai-nuki! The blade leaves its scabbard like lightning.', 0.7); await attackEnemy(ren, t, 1.9, { critBonus: 0.3, hitMod: 0.1 }); break;
      case 'needle': await bsay('Ren flicks a poisoned needle!', 0.5);
        if (await attackEnemy(ren, t, 0.6, { anim: 'star', hitMod: 0.15 }) && t.hp > 0) { t.st.poison = 5; Snd.sfx('poison'); await bsay(t.name + ' is poisoned!', 0.6); } break;
      case 'mist': await bsay('Kasumi-giri! Ren flows through them like mist.', 0.7);
        for (const e of living(B.enemies)) await attackEnemy(ren, e, 1.0, { quietCrit: true }); break;
      case 'stitch': await bsay('Kage-nui! Ren drives his blade at a nerve point.', 0.7);
        if (await attackEnemy(ren, t, 1.2) && t.hp > 0) { if (!t.boss || Math.random() < 0.5) { t.st.stun = 1; await bsay(t.name + ' is pinned in place!', 0.7); } else await bsay(t.name + ' shrugs it off!', 0.6); } break;
      case 'camellia': {
        const together = B.allies[1] && B.allies[1].hp > 0;
        await bsay(together ? 'Ren and Yuki move as one — Tsubaki-otoshi!' : 'Tsubaki-otoshi — the Falling Camellia!', 1.0);
        Flash.go('#c02030', 0.5);
        await attackEnemy(ren, t, together ? 3.6 : 3.0, { sure: true, critBonus: 0.15 }); break;
      }
    }
  }
  return null;
}

function checkEnd(B) {
  if (B.o.endWhen && B.o.endWhen(B)) return 'special';
  if (!living(B.enemies).length) return 'win';
  if (B.allies[0].hp <= 0) return 'lose';
  return null;
}

async function battleLoop(B) {
  const o = B.o;
  const names = {}; B.enemies.forEach(e => (names[ENEMIES[e.id].name] = (names[ENEMIES[e.id].name] || 0) + 1));
  const intro = Object.keys(names).map(n => names[n] > 1 ? names[n] + ' ' + n + (n.endsWith('f') ? 's' : 's') : (/^[AEIOU]/.test(n) ? 'An ' : 'A ') + n);
  await bsay(o.intro || (intro.join(' and ') + (B.enemies.length > 1 ? ' attack!' : ' attacks!')), 1.0);
  let first = null;
  if (!o.boss && !o.noAmbush) {
    const avg = B.enemies.reduce((s, e) => s + e.agi, 0) / B.enemies.length;
    const r = Math.random();
    if (r < 0.1 + (stat('agi') - avg) * 0.01) first = 'ally'; else if (r > 0.94) first = 'enemy';
    if (first === 'ally') await bsay('You caught them off guard! (Free turn)', 0.9);
    if (first === 'enemy') await bsay('Ambush! They strike first!', 0.9);
  }
  let round = 0;
  while (true) {
    round++;
    const acts = [];
    if (!(first === 'enemy' && round === 1)) {
      for (const a of B.allies) {
        if (a.hp <= 0) continue;
        if (a.isRen) { if (a.st.stun) { acts.push({ actor: a, type: 'stunned' }); continue; } const c = await playerCommand(B, a); c.actor = a; acts.push(c); }
        else acts.push({ actor: a, type: 'ai' });
      }
    }
    if (!(first === 'ally' && round === 1)) for (const e of living(B.enemies)) acts.push({ actor: e, type: 'ai' });
    for (const a of acts) {
      a.spd = a.actor.agi * R.f(0.75, 1.25);
      if (a.type === 'defend') { a.spd = 9999; a.actor.st.guard = 1; a.actor.ki = Math.min(a.actor.maxki, a.actor.ki + 2); }
      if (a.type === 'item' || a.type === 'flee') a.spd += 30;
    }
    acts.sort((x, y) => y.spd - x.spd);
    for (const act of acts) {
      const a = act.actor; if (a.hp <= 0) continue;
      if (a.st.stun) { a.st.stun = 0; await bsay(a.name + ' cannot move!', 0.7); continue; }
      let r = null;
      if (a.side === 'enemy') await enemyAct(B, a);
      else if (a.ai) await yukiAct(B, a);
      else r = await playerAct(B, act);
      if (r === 'fled') return 'fled';
      const end = checkEnd(B); if (end) return end;
    }
    for (const a of [...B.allies, ...B.enemies]) {
      if (a.hp <= 0) { a.st = {}; continue; }
      if (a.st.poison) {
        const d = Math.max(1, Math.min(a.boss ? 60 : 999, Math.round(a.maxhp * (a.side === 'ally' ? 0.06 : 0.08))));
        applyDmg(a, d); a.flash = 0;
        await bsay(a.name + ' suffers from poison.', 0.6);
        a.st.poison--; if (a.st.poison <= 0) delete a.st.poison;
        const end = checkEnd(B); if (end) return end;
      }
      for (const k of ['smoke', 'blind', 'roar']) if (a.st[k]) { a.st[k]--; if (!a.st[k]) delete a.st[k]; }
      delete a.st.guard;
    }
    const ren = B.allies[0]; if (ren.hp > 0) ren.ki = Math.min(ren.maxki, ren.ki + 1);
  }
}

async function battle(ids, o = {}) {
  const prevMusic = Music.cur;
  Snd.sfx('enc'); Flash.go('#fff', 0.9);
  await fadeOut(0.35);
  const cnt = {}; ids.forEach(id => (cnt[id] = (cnt[id] || 0) + 1));
  const seen = {};
  const B = { enemies: ids.map((id, i) => { seen[id] = (seen[id] || 0) + 1; return mkEnemy(id, i, ids.length, cnt[id] > 1 ? seen[id] : 0); }),
    allies: [mkRen()], nums: [], fx: [], text: '', o, waiting: null, bg: battleBg(o.bg || G.map.bg || 'forest') };
  if (G.flags.yukiJoined && !o.noYuki) B.allies.push(mkYuki());
  Battle.B = B; G.mode = 'battle';
  Music.play(o.music || (o.boss ? 'boss' : 'battle'));
  await fadeIn(0.35);
  let result = await battleLoop(B);
  const ren = B.allies[0];
  if (result === 'win') {
    const xp = B.enemies.reduce((s, e) => s + e.xp, 0), mon = B.enemies.reduce((s, e) => s + e.mon, 0);
    Music.stop();
    if (xp || mon) { await bsay('Victory.  ' + xp + ' XP   ' + mon + ' mon', 1.6); }
    G.gold += mon;
    for (const e of B.enemies) if (e.drop && Math.random() < e.drop[1]) { give(e.drop[0], 1, true); await bsay('Found ' + ITEMS[e.drop[0]].name + '.', 0.9); }
    P.hp = Math.max(1, ren.hp); P.ki = ren.ki;
    await gainXP(xp, bsay);
  } else if (result === 'lose') {
    if (!o.canLose) { await bsay('Ren has fallen.', 1.4); await fadeOut(1.2); G.mode = 'map'; Battle.B = null; await gameOver(); return 'lose'; }
    P.hp = 1; P.ki = ren.ki;
  } else { P.hp = Math.max(1, ren.hp); P.ki = ren.ki; }
  await fadeOut(0.4);
  G.mode = 'map'; Battle.B = null; Shake.t = 0;
  if (!o.keepMusic) Music.play(o.afterMusic || prevMusic || G.map.music);
  G.encGrace = 6;
  await fadeIn(0.4);
  return result;
}

async function gainXP(xp, sayFn) {
  sayFn = sayFn || ((t) => say(t));
  P.xp += xp;
  while (P.xp >= xpNext(P.lv)) {
    P.xp -= xpNext(P.lv); P.lv++;
    P.str++; P.agi++; P.end++; P.foc++; P.pts += 2;
    P.hp = maxHP(); P.ki = maxKi();
    Snd.sfx('level');
    await sayFn('Ren reached level ' + P.lv + '!  STR, AGI, END, FOC +1', 1.8);
    await sayFn('+2 training points. Spend them in the Training menu.', 1.4);
    for (const id in SKILLS) if (SKILLS[id].lv === P.lv && !P.skills.includes(id)) { P.skills.push(id); Snd.sfx('item'); await sayFn('Learned ' + SKILLS[id].name + ': ' + SKILLS[id].desc, 2.2); }
  }
}

Battle.update = function (dt) {
  const B = this.B; if (!B) return;
  if (B.waiting && UI.stack.length === 0) { B.waiting.t -= dt; if (B.waiting.t <= 0 || Input.take('ok')) { const r = B.waiting.r; B.waiting = null; r(); } }
  for (const e of B.enemies) { e.flash = Math.max(0, e.flash - dt); e.shake = Math.max(0, e.shake - dt); e.lunge = Math.max(0, e.lunge - dt); if (e.dead) e.alpha = Math.max(0, e.alpha - dt * 1.6); }
  for (const a of B.allies) a.hurt = Math.max(0, a.hurt - dt);
  for (const n of B.nums) n.t += dt; B.nums = B.nums.filter(n => n.t < 1.1);
  for (const f of B.fx) f.t += dt; B.fx = B.fx.filter(f => f.t < f.life);
};
Battle.draw = function () {
  const B = this.B; if (!B) return;
  ctx.drawImage(B.bg, 0, 0);
  for (const e of B.enemies) {
    if (e.alpha <= 0) continue;
    const sz = 16 * e.scale, bob = Math.sin(G.time * 2.2 + e.x) * 1.5;
    const sx = e.shake > 0 ? R.f(-3, 3) : 0, ly = e.lunge > 0 ? Math.sin((0.3 - e.lunge) / 0.3 * Math.PI) * 10 : 0;
    ctx.globalAlpha = e.alpha;
    ctx.drawImage(e.flash > 0 ? e.sp.white : e.sp.down[0], Math.round(e.x - sz / 2 + sx), Math.round(e.y - sz + bob + ly), sz, sz);
    ctx.globalAlpha = 1;
    if (!e.dead) {
      const w = Math.min(60, sz * 0.7); bar(e.x - w / 2, e.y + 6, w, 3, e.hp, e.maxhp, e.boss ? '#d05030' : '#c8a040', 'rgba(0,0,0,.6)');
      const tags = []; if (e.st.poison) tags.push('PSN'); if (e.st.blind) tags.push('BLD'); if (e.st.stun) tags.push('STN'); if (e.st.aimed) tags.push('AIM'); if (e.st.roar) tags.push('ATK↑'); if (e.st.guard) tags.push('GRD');
      if (tags.length) text(tags.join(' '), e.x, e.y + 11, { size: 8, align: 'center', color: '#e0c080' });
    }
  }
  for (const f of B.fx) {
    const k = f.t / f.life;
    if (f.type === 'slash') {
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(f.x - 30 + k * 10, f.y - 30); ctx.lineTo(f.x + 30 * k, f.y + 30 * k - 4); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(200,220,255,' + (1 - k) + ')'; ctx.beginPath(); ctx.moveTo(f.x - 26, f.y - 32); ctx.lineTo(f.x + 34 * k, f.y + 28 * k); ctx.stroke();
    } else if (f.type === 'star') {
      const x = lerp(f.x0, f.x1, k), y = lerp(f.y0, f.y1, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(k * 12); ctx.fillStyle = '#d8d8e0'; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8); ctx.restore();
    } else if (f.type === 'smoke') {
      ctx.fillStyle = 'rgba(180,180,190,' + (0.5 * (1 - k)) + ')';
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(196 + Math.cos(i) * 30 * (0.5 + k), 230 - k * 30 + Math.sin(i * 2) * 10, 16 + k * 20, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  for (const n of B.nums) {
    const y = n.y - n.t * 26 - (n.t < 0.2 ? 0 : 4);
    ctx.globalAlpha = clamp(1.4 - n.t * 1.3, 0, 1);
    text(n.s, n.x, y, { size: n.big ? 16 : 13, bold: true, align: 'center', color: n.col });
    ctx.globalAlpha = 1;
  }
  if (B.text) { drawWin(12, 8, VW - 24, 26, 0.88); text(B.text, VW / 2, 14, { size: 11, align: 'center' }); }
  drawWin(136, 194, VW - 148, 70);
  B.allies.forEach((a, i) => {
    const x = 146 + i * 160 + (a.hurt > 0 ? R.f(-2, 2) : 0), y = 200;
    text(a.name, x, y, { bold: true, color: a.hp <= 0 ? '#7a6a6a' : (a.isRen ? '#9fbaf0' : '#f09aaa') });
    text('HP', x, y + 16, { size: 9, color: '#c8bc98' }); bar(x + 18, y + 19, 90, 5, a.hp, a.maxhp, a.hp < a.maxhp * 0.3 ? '#e04a2a' : '#c84a3a'); text(a.hp + '/' + a.maxhp, x + 112, y + 14, { size: 9 });
    if (a.isRen) { text('Ki', x, y + 30, { size: 9, color: '#c8bc98' }); bar(x + 18, y + 33, 90, 5, a.ki, a.maxki, '#4a8ad0'); text(a.ki + '/' + a.maxki, x + 112, y + 28, { size: 9 }); }
    const tags = []; if (a.st.poison) tags.push('Poisoned'); if (a.st.blind) tags.push('Blind'); if (a.st.smoke) tags.push('Smoke'); if (a.st.guard) tags.push('Guard');
    if (tags.length) text(tags.join(' · '), x, y + 46, { size: 9, color: '#e0c080' });
  });
  if (!UI.stack.length) drawWin(12, 194, 118, 70);
};
