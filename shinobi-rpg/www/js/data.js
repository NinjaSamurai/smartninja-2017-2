'use strict';
/* ===== Data: items, techniques, enemies, player progression ===== */

const ITEMS = {
  onigiri: { name: 'Onigiri', type: 'use', price: 12, heal: 40, desc: 'Rice ball with salted plum. Restores 40 HP.' },
  salve: { name: 'Herbal Salve', type: 'use', price: 45, heal: 130, desc: 'Mugwort and comfrey paste. Restores 130 HP.' },
  hyorogan: { name: 'Hyōrōgan', type: 'use', price: 35, ki: 15, desc: 'Shinobi ration pill of grain, honey and ginseng. Restores 15 Ki.' },
  tonic: { name: 'Ginseng Tonic', type: 'use', price: 160, heal: 9999, ki: 40, desc: 'Rare mountain ginseng. Restores all HP and 40 Ki.' },
  gedoku: { name: 'Gedoku Pill', type: 'use', price: 18, cure: 'poison', desc: 'Bitter antidote of charcoal and herbs. Cures poison.' },
  eyewash: { name: 'Eye Wash', type: 'use', price: 18, cure: 'blind', desc: 'Clean water steeped with herbs. Cures blindness.' },
  makibishi: { name: 'Makibishi', type: 'battle', price: 30, dmgAll: 28, desc: 'Iron caltrops scattered at the feet. 28 damage to all foes.' },
  horoku: { name: 'Hōroku-hiya', type: 'battle', price: 95, dmgAll: 80, desc: 'Clay fire grenade packed with powder. 80 damage to all foes.' },
  smokeball: { name: 'Smoke Ball', type: 'battle', price: 25, escape: true, desc: 'Thick smoke. Guarantees escape from ordinary battles.' },

  worn_blade: { name: 'Worn Ninjatō', type: 'weapon', atk: 4, price: 20, desc: 'A plain straight blade, notched from years of training.' },
  isshin_blade: { name: "Isshin's Blade", type: 'weapon', atk: 10, price: 0, desc: "Your father's ninjatō. Dark steel, balanced for the quick draw." },
  kusarigama: { name: 'Kusarigama', type: 'weapon', atk: 15, bonus: { agi: 2 }, price: 420, desc: 'Sickle on a weighted chain. Fast and vicious. +2 AGI.' },
  masterwork: { name: 'Iga Ninjatō', type: 'weapon', atk: 22, price: 1100, desc: 'Folded steel from a master Iga smith.' },
  kiyomitsu: { name: 'Kiyomitsu Katana', type: 'weapon', atk: 29, price: 2400, desc: 'A samurai blade of the Kaga school. Taken from Kuroiwa.' },
  karasu_giri: { name: 'Crow-Cutter', type: 'weapon', atk: 36, bonus: { agi: 3 }, price: 0, desc: 'Black-lacquered blade of the Yatagarasu. Terribly sharp. +3 AGI.' },

  travel_garb: { name: 'Travel Garb', type: 'armor', def: 2, price: 10, desc: 'Plain hemp traveling clothes.' },
  shozoku: { name: 'Shinobi Shōzoku', type: 'armor', def: 5, bonus: { agi: 1 }, price: 110, desc: 'Persimmon-dyed night garb. Blends with shadow. +1 AGI.' },
  kusari: { name: 'Kusari Katabira', type: 'armor', def: 10, price: 480, desc: 'A shirt of fine chain worn beneath the clothes.' },
  domaru: { name: 'Dō-maru', type: 'armor', def: 16, bonus: { agi: -2 }, price: 1250, desc: 'Laced lamellar armor. Strong, but heavy. −2 AGI.' },
  nightsilk: { name: 'Night-silk Shōzoku', type: 'armor', def: 17, bonus: { agi: 4 }, price: 0, desc: 'Kōga-made garb lined with thin mail. +4 AGI.' },

  omamori: { name: 'Omamori', type: 'charm', def: 0, bonus: { end: 2 }, price: 0, desc: 'Protective charm from the Ueno shrine. +2 END.' },
  shuko: { name: 'Shuko Claws', type: 'charm', bonus: { agi: 3 }, price: 380, desc: 'Iron climbing claws worn on the palm. +3 AGI.' },
  tigertooth: { name: 'Tiger Tooth', type: 'charm', bonus: { str: 3 }, price: 700, desc: 'A charm brought from the continent. +3 STR.' },
  prayer_beads: { name: "Mother's Beads", type: 'charm', bonus: { foc: 4, end: 1 }, price: 0, desc: "Your mother's sandalwood juzu. +4 FOC, +1 END." },
  kota_charm: { name: 'Lucky Bell', type: 'charm', bonus: { agi: 1, foc: 1 }, price: 0, desc: 'A little brass bell from a grateful grandmother. +1 AGI, +1 FOC.' },

  hairpin: { name: 'Camellia Hairpin', type: 'key', desc: "Yuki's red camellia kanzashi, scorched at the edges. Found in the ashes of home." },
  letter: { name: "Father's Letter", type: 'key', read: 'letter', desc: 'A letter in your father\'s hand, hidden beneath the shrine room floor.' },
  war_fan: { name: "Tōzō's War Fan", type: 'key', desc: "The bandit chief's iron war fan, painted with a demon crest. Proof of his death." },
  permit: { name: 'Travel Permit', type: 'key', desc: 'A tsūkō tegata stamped by Magistrate Mizuno. Opens Ueno\'s north gate.' },
  camellia: { name: 'Red Camellia', type: 'key', read: 'camellia', desc: 'A fresh red camellia. A strip of paper is knotted around the stem.' },
  orders: { name: "Gensai's Orders", type: 'key', read: 'orders', desc: 'A letter sealed with a three-legged crow, taken from Hanzaki.' },
  lost_charm: { name: "Kota's Charm", type: 'key', desc: 'A small wooden charm carved with a child\'s name: "Kota".' },
};

const SKILLS = {
  shuriken: { name: 'Bō-shuriken', lv: 1, ki: 2, target: 'one', desc: 'Throw iron spikes (X / S button). 1 Ki each.' },
  breath: { name: 'Kokyū-hō', lv: 3, ki: 4, target: 'self', field: true, desc: 'Breath control. Stand still a moment to restore 35% of max HP.' },
  smoke: { name: 'Kemuri-dama', lv: 4, ki: 4, target: 'self', desc: 'Smoke bomb. Enemies lose track of you — strike them unaware for a silent kill.' },
  blind: { name: 'Metsubushi', lv: 6, ki: 4, target: 'one', desc: 'Blinding powder thrown in a cone. Blinded foes stagger about helplessly.' },
  iai: { name: 'Iai-nuki', lv: 8, ki: 6, target: 'one', desc: 'A lightning quick-draw dash that cuts through everything in its path.' },
  needle: { name: 'Doku-bari', lv: 10, ki: 5, target: 'one', desc: 'A fast poisoned needle. The target loses health over time.' },
  mist: { name: 'Kasumi-giri', lv: 12, ki: 9, target: 'all', desc: 'Mist cut. A whirling flurry that strikes every foe around you.' },
  stitch: { name: 'Kage-nui', lv: 14, ki: 10, target: 'one', desc: 'Shadow stitch. A thrown kunai pins the target in place.' },
  camellia: { name: 'Tsubaki-otoshi', lv: 99, ki: 14, target: 'one', desc: "Falling Camellia. Yuki's technique: one perfect, final cut." },
};

/* Real-time enemies. kind: movement style. moves: [move, weight]. pref: preferred distance (px).
   spd px/s, reach px, wind = attack tell (s), cd = rest between attacks (s), sight = view range (px). */
const ENEMIES = {
  looter: { name: 'Looter', hp: 24, atk: 6, def: 1, agi: 4, xp: 6, mon: 12, spr: 'looter', spd: 38, moves: [['slash', 1]], wind: 0.55, cd: 1.6 },
  bandit: { name: 'Mountain Bandit', hp: 36, atk: 9, def: 3, agi: 5, xp: 10, mon: 12, spr: 'bandit', spd: 46, moves: [['slash', 3], ['heavy', 1]], wind: 0.5, cd: 1.4, drop: ['onigiri', 0.2] },
  wolf: { name: 'Starving Wolf', hp: 26, atk: 8, def: 1, agi: 10, xp: 9, mon: 3, spr: 'wolf', spd: 72, moves: [['pounce', 1]], cd: 1.5, beast: 1 },
  ronin: { tough: 1, name: 'Masterless Rōnin', hp: 58, atk: 11, def: 5, agi: 7, xp: 18, mon: 28, spr: 'ronin', spd: 48, moves: [['slash', 3], ['heavy', 2]], wind: 0.45, cd: 1.2, drop: ['salve', 0.15] },
  tozo: { name: 'Onibi Tōzō', hp: 420, atk: 14, def: 6, agi: 6, xp: 90, mon: 150, spr: 'tozo', boss: 1, scale: 2, spd: 44, moves: [['heavy', 3], ['leap', 2], ['spin', 1]], wind: 0.6, cd: 1.1, reach: 30 },

  ashigaru: { name: 'Oda Ashigaru', hp: 82, atk: 19, def: 11, agi: 8, xp: 32, mon: 24, spr: 'ashigaru', spd: 44, moves: [['thrust', 1]], wind: 0.5, cd: 1.5, drop: ['onigiri', 0.25] },
  gunner: { name: 'Teppō Gunner', hp: 58, atk: 18, def: 8, agi: 6, xp: 36, mon: 32, spr: 'gunner', spd: 34, moves: [['shoot', 1]], pref: 110, cd: 2.2 },
  boar: { tough: 1, name: 'Wild Boar', hp: 105, atk: 20, def: 9, agi: 7, xp: 38, mon: 4, spr: 'boar', spd: 40, moves: [['charge', 1]], cd: 1.6, beast: 1, drop: ['onigiri', 0.5] },
  scout: { name: 'Crow Scout', hp: 72, atk: 18, def: 9, agi: 15, xp: 44, mon: 36, spr: 'crow', spd: 62, moves: [['slash', 2], ['throw', 2]], pref: 60, wind: 0.4, cd: 1.3, poison: 0.3, drop: ['hyorogan', 0.25] },
  assassin: { name: 'Crow Assassin', hp: 300, atk: 21, def: 12, agi: 15, xp: 150, mon: 120, spr: 'crow2', boss: 1, spd: 72, moves: [['slash', 3], ['fan', 2], ['vanish', 2], ['powder', 1]], pref: 50, wind: 0.4, cd: 0.9, poison: 0.4 },

  guard: { tough: 1, name: 'Samurai Guard', hp: 140, atk: 25, def: 19, agi: 10, xp: 95, mon: 60, spr: 'samurai', spd: 44, moves: [['slash', 3], ['heavy', 2], ['guard', 1]], wind: 0.5, cd: 1.3, drop: ['salve', 0.2] },
  shinobi: { name: 'Crow Shinobi', hp: 120, atk: 23, def: 15, agi: 20, xp: 105, mon: 70, spr: 'crow', spd: 68, moves: [['slash', 2], ['throw', 2], ['powder', 1]], pref: 60, wind: 0.38, cd: 1.2, poison: 0.35, drop: ['gedoku', 0.3] },
  dog: { name: 'War Hound', hp: 100, atk: 22, def: 11, agi: 18, xp: 85, mon: 8, spr: 'dog', spd: 82, moves: [['pounce', 1]], cd: 1.2, beast: 1 },
  sniper: { name: 'Matchlock Sniper', hp: 110, atk: 25, def: 14, agi: 10, xp: 115, mon: 80, spr: 'gunner', spd: 34, moves: [['shoot', 1]], pref: 130, cd: 2.0, drop: ['horoku', 0.15] },
  hanzaki: { name: 'Hanzaki, the Iron Crow', hp: 1200, atk: 34, def: 25, agi: 12, xp: 600, mon: 400, spr: 'hanzaki', boss: 1, scale: 2, spd: 46, moves: [['heavy', 3], ['spin', 2], ['leap', 2], ['guard', 1]], wind: 0.55, cd: 1.0, reach: 32 },

  elite: { tough: 1, name: 'Yatagarasu Elite', hp: 230, atk: 36, def: 25, agi: 22, xp: 175, mon: 110, spr: 'crow2', spd: 74, moves: [['slash', 3], ['fan', 1], ['vanish', 1], ['powder', 1]], pref: 50, wind: 0.36, cd: 1.1, poison: 0.3, drop: ['hyorogan', 0.3] },
  monk: { tough: 1, name: 'Renegade Sōhei', hp: 280, atk: 38, def: 27, agi: 12, xp: 195, mon: 100, spr: 'monk', spd: 42, moves: [['thrust', 2], ['spin', 2]], wind: 0.55, cd: 1.3, drop: ['salve', 0.3] },
  shadow: { name: "Gensai's Shadow", hp: 190, atk: 35, def: 21, agi: 30, xp: 185, mon: 120, spr: 'shadow', spd: 84, moves: [['slash', 2], ['vanish', 2], ['throw', 1]], pref: 50, wind: 0.32, cd: 1.0, dodge: 0.3 },
  sota: { name: 'Sota', hp: 700, atk: 32, def: 21, agi: 24, xp: 0, mon: 0, spr: 'sota', boss: 1, spd: 80, moves: [['slash', 3], ['fan', 2], ['vanish', 1]], pref: 45, wind: 0.36, cd: 0.9, poison: 0.2 },
  gensai: { name: 'Kuroda Gensai', hp: 2600, atk: 42, def: 29, agi: 26, xp: 0, mon: 0, spr: 'gensai', boss: 1, spd: 76, moves: [['slash', 3], ['fan', 2], ['vanish', 2], ['radial', 2], ['powder', 1]], pref: 50, wind: 0.42, cd: 0.85, poison: 0.25 },
};

/* ----- Player ----- */
const P = {};
function newPlayer() {
  Object.assign(P, { name: 'Ren', lv: 1, xp: 0, str: 6, agi: 6, end: 6, foc: 5, pts: 0, skills: ['shuriken'],
    eq: { weapon: 'worn_blade', armor: 'travel_garb', charm: null }, active: null });
  P.hp = maxHP(); P.ki = maxKi();
}
function stat(k) {
  let v = P[k];
  for (const s of ['weapon', 'armor', 'charm']) { const it = ITEMS[P.eq[s]]; if (it && it.bonus && it.bonus[k]) v += it.bonus[k]; }
  return v;
}
const maxHP = () => 20 + stat('end') * 5 + P.lv * 4;
const maxKi = () => 4 + stat('foc') * 2 + P.lv;
const pAtk = () => stat('str') + ((ITEMS[P.eq.weapon] || {}).atk || 0);
const pDef = () => Math.floor(stat('end') * 0.6) + ((ITEMS[P.eq.armor] || {}).def || 0) + ((ITEMS[P.eq.charm] || {}).def || 0);
const pCrit = () => 5 + Math.floor(stat('agi') * 0.35) + Math.floor(stat('foc') * 0.2);
const xpNext = l => 5 * l * (l + 1);

const SKILL_ACTIVE_DEFAULT = ['breath', 'smoke', 'blind', 'iai', 'needle', 'mist', 'stitch', 'camellia'];
const STAT_INFO = {
  str: ['STR', 'Strength', 'Raises the power of your blade.'],
  agi: ['AGI', 'Agility', 'Speed, evasion, accuracy and critical strikes.'],
  end: ['END', 'Endurance', 'Raises maximum HP and defense.'],
  foc: ['FOC', 'Focus', 'Raises maximum Ki and critical chance.'],
};

/* Encounter tables */
const ENC = {
  forest: [['bandit'], ['wolf', 'wolf'], ['bandit', 'bandit'], ['wolf'], ['ronin'], ['bandit', 'wolf']],
  pass: [['ashigaru'], ['ashigaru', 'ashigaru'], ['boar'], ['gunner', 'ashigaru'], ['scout'], ['scout', 'boar'], ['gunner', 'scout']],
  fortress: [['guard'], ['guard', 'shinobi'], ['dog', 'dog'], ['sniper', 'guard'], ['shinobi', 'shinobi'], ['dog', 'shinobi']],
  castle: [['elite'], ['monk'], ['shadow', 'shadow'], ['elite', 'monk'], ['shadow', 'elite'], ['elite', 'elite']],
};
