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
  shuriken: { name: 'Bō-shuriken', lv: 1, ki: 2, target: 'one', desc: 'Throw iron spikes. Never misses.' },
  breath: { name: 'Kokyū-hō', lv: 3, ki: 4, target: 'self', field: true, desc: 'Breath control. Restores 35% of max HP.' },
  smoke: { name: 'Kemuri-dama', lv: 4, ki: 4, target: 'self', desc: 'Smoke bomb. Enemies struggle to hit you for 3 turns.' },
  blind: { name: 'Metsubushi', lv: 6, ki: 4, target: 'one', desc: 'Blinding powder of ash and pepper. Target often misses.' },
  iai: { name: 'Iai-nuki', lv: 8, ki: 6, target: 'one', desc: 'A lightning quick-draw. Heavy damage, high critical chance.' },
  needle: { name: 'Doku-bari', lv: 10, ki: 5, target: 'one', desc: 'Poisoned needle. Target loses health every turn.' },
  mist: { name: 'Kasumi-giri', lv: 12, ki: 9, target: 'all', desc: 'Mist cut. One flowing motion that strikes every enemy.' },
  stitch: { name: 'Kage-nui', lv: 14, ki: 10, target: 'one', desc: 'Shadow stitch. Strikes a nerve point; the foe loses a turn.' },
  camellia: { name: 'Tsubaki-otoshi', lv: 99, ki: 14, target: 'one', desc: "Falling Camellia. Yuki's technique: one perfect, final cut." },
};

/* ai: [action, weight] */
const ENEMIES = {
  looter: { name: 'Looter', hp: 24, atk: 6, def: 1, agi: 4, xp: 6, mon: 12, spr: 'looter', ai: [['attack', 1]] },
  bandit: { name: 'Mountain Bandit', hp: 36, atk: 9, def: 3, agi: 5, xp: 10, mon: 12, spr: 'bandit', ai: [['attack', 3], ['heavy', 1]], drop: ['onigiri', 0.2] },
  wolf: { name: 'Starving Wolf', hp: 26, atk: 8, def: 1, agi: 10, xp: 9, mon: 3, spr: 'wolf', ai: [['attack', 3], ['multi', 1]] },
  ronin: { name: 'Masterless Rōnin', hp: 58, atk: 11, def: 5, agi: 7, xp: 18, mon: 28, spr: 'ronin', ai: [['attack', 3], ['heavy', 2]], drop: ['salve', 0.15] },
  tozo: { name: 'Onibi Tōzō', hp: 300, atk: 15, def: 6, agi: 6, xp: 90, mon: 150, spr: 'tozo', boss: 1, scale: 5, ai: [['attack', 3], ['heavy', 2], ['roar', 1]] },

  ashigaru: { name: 'Oda Ashigaru', hp: 82, atk: 19, def: 11, agi: 8, xp: 32, mon: 24, spr: 'ashigaru', ai: [['attack', 3], ['thrust', 1]], drop: ['onigiri', 0.25] },
  gunner: { name: 'Teppō Gunner', hp: 58, atk: 18, def: 8, agi: 6, xp: 36, mon: 32, spr: 'gunner', ai: [['aim', 1]] },
  boar: { name: 'Wild Boar', hp: 105, atk: 20, def: 9, agi: 7, xp: 38, mon: 4, spr: 'boar', ai: [['attack', 2], ['charge', 1]], drop: ['onigiri', 0.5] },
  scout: { name: 'Crow Scout', hp: 72, atk: 18, def: 9, agi: 15, xp: 44, mon: 36, spr: 'crow', ai: [['attack', 2], ['poison', 1], ['multi', 1]], drop: ['hyorogan', 0.25] },
  assassin: { name: 'Crow Assassin', hp: 230, atk: 23, def: 12, agi: 15, xp: 150, mon: 120, spr: 'crow2', boss: 1, ai: [['attack', 3], ['poison', 2], ['multi', 2], ['blind', 1]] },

  guard: { name: 'Samurai Guard', hp: 140, atk: 25, def: 19, agi: 10, xp: 95, mon: 60, spr: 'samurai', ai: [['attack', 3], ['heavy', 2], ['guard', 1]], drop: ['salve', 0.2] },
  shinobi: { name: 'Crow Shinobi', hp: 120, atk: 23, def: 15, agi: 20, xp: 105, mon: 70, spr: 'crow', ai: [['attack', 2], ['poison', 1], ['multi', 2], ['blind', 1]], drop: ['gedoku', 0.3] },
  dog: { name: 'War Hound', hp: 100, atk: 22, def: 11, agi: 18, xp: 85, mon: 8, spr: 'dog', ai: [['attack', 3], ['multi', 1]] },
  sniper: { name: 'Matchlock Sniper', hp: 110, atk: 25, def: 14, agi: 10, xp: 115, mon: 80, spr: 'gunner', ai: [['aim', 1]], drop: ['horoku', 0.15] },
  hanzaki: { name: 'Hanzaki, the Iron Crow', hp: 950, atk: 35, def: 25, agi: 12, xp: 600, mon: 400, spr: 'hanzaki', boss: 1, scale: 5, ai: [['attack', 3], ['heavy', 2], ['sweep', 2], ['guard', 1]] },

  elite: { name: 'Yatagarasu Elite', hp: 230, atk: 38, def: 25, agi: 22, xp: 175, mon: 110, spr: 'crow2', ai: [['attack', 3], ['multi', 2], ['poison', 1], ['blind', 1]], drop: ['hyorogan', 0.3] },
  monk: { name: 'Renegade Sōhei', hp: 280, atk: 40, def: 27, agi: 12, xp: 195, mon: 100, spr: 'monk', ai: [['attack', 2], ['sweep', 2], ['heavy', 1]], drop: ['salve', 0.3] },
  shadow: { name: "Gensai's Shadow", hp: 190, atk: 37, def: 21, agi: 30, xp: 185, mon: 120, spr: 'shadow', evade: 18, ai: [['attack', 2], ['multi', 2], ['blind', 1]] },
  sota: { name: 'Sota', hp: 640, atk: 34, def: 21, agi: 24, xp: 0, mon: 0, spr: 'sota', boss: 1, ai: [['attack', 3], ['multi', 2], ['poison', 1]] },
  gensai: { name: 'Kuroda Gensai', hp: 2300, atk: 44, def: 29, agi: 26, xp: 0, mon: 0, spr: 'gensai', boss: 1, scale: 5, ai: [['attack', 3], ['multi', 2], ['poison', 1], ['blind', 1], ['feathers', 2]] },
};

/* ----- Player ----- */
const P = {};
function newPlayer() {
  Object.assign(P, { name: 'Ren', lv: 1, xp: 0, str: 6, agi: 6, end: 6, foc: 5, pts: 0, skills: ['shuriken'],
    eq: { weapon: 'worn_blade', armor: 'travel_garb', charm: null } });
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
