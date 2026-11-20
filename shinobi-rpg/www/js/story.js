'use strict';
/* ===== Story, characters and events ===== */
const F = k => !!G.flags[k];
const setF = (k, v = true) => { G.flags[k] = v; };
const npcById = id => (G.map.npcs || []).find(n => n.id === id);
const CHAPTERS = { 1: 'Chapter I — Ashes', 2: 'Chapter II — The Market Town', 3: 'Chapter III — Akame Falls', 4: 'Chapter IV — The Heads at Kuroiwa', 5: 'Chapter V — The Crow Castle', 6: 'Epilogue — Camellias' };

function objective() {
  if (!F('looters')) return 'Return home. Find out what happened to Kagenuma village.';
  if (!F('gonbei')) return 'Search the ruins of the village for survivors.';
  if (!F('blade')) return 'Search the ruins of your family home, as Gonbei said. Then take the east road to Ueno.';
  if (!F('sakichi')) return 'Travel east through the Iga Forest to Ueno. Find Sakichi the informant at the teahouse.';
  if (!has('permit')) return has('war_fan') ? "Bring Tōzō's war fan to Magistrate Mizuno in Ueno for a travel permit." : 'Get a travel permit for the north gate. Magistrate Mizuno wants the bandit Onibi Tōzō dead — his camp lies north of the forest road.';
  if (!F('falls')) return "Pass Ueno's north gate and climb the Akame Pass toward Kuroiwa fortress.";
  if (!F('heads')) return 'Reach Kuroiwa fortress at the top of the pass. See the truth with your own eyes.';
  if (!F('hanzaki')) return "Infiltrate Kuroiwa and find its commander in the keep.";
  if (!F('yukiJoined')) return "Go through Kuroiwa's rear gate to Karasu-jō, the Crow Castle.";
  if (!F('end')) return 'Climb to the top of the Crow Castle. Bring Sota home.';
  return 'Go home.';
}
function journalNotes() {
  const n = [];
  if (F('gonbei')) n.push('Men under a three-legged crow crest burned Kagenuma. Father and Mother are dead. Sota was carried off alive.');
  if (F('gonbei')) n.push("Yuki's grave holds nothing but her scorched hairpin.");
  if (F('blade')) n.push("Father's letter names Kuroda Gensai — his former student — as leader of the Yatagarasu.");
  if (F('sakichi')) n.push('Sakichi: Sota was taken to Kuroiwa and executed, they say. A masked woman is hunting the crows too.');
  if (F('falls')) n.push('A masked kunoichi saved you at Akame Falls and left a red camellia.');
  if (F('heads')) n.push("The boy's head on Kuroiwa's gate is not Sota's.");
  if (F('hanzaki')) n.push("Gensai's orders: Sota was moved to Karasu-jō. 'Find the girl.'");
  if (F('yukiJoined')) n.push('Yuki is alive. She fights at your side.');
  n.push('Tip: Each level grants 2 training points — spend them in Training.');
  n.push('Tip: Pray at Jizō statues to rest and record your journey.');
  if (F('sakichi')) n.push('Tip: Matchlock gunners need a turn to aim. Smoke or blinding powder makes them miss.');
  return n;
}
async function readDoc(id) {
  if (id === 'letter') {
    await say("\"Ren — If you are reading this, then I was right to be afraid, and I am gone.\"");
    await say("\"Years ago I took in a boy from Kōka, sharp as a new blade: Kuroda Gensai. I taught him everything. Too much. He came to believe the Iga way — small clans, loyal to no lord — was weakness. That shinobi should be forged into one weapon and sold to whoever pays most.\"");
    await say("\"When I refused him the Kagenuma scrolls, he swore he would take what I would not give. Now I hear he serves Oda, and gathers men under the sign of the three-legged crow. The Yatagarasu.\"");
    await say("\"If he comes, it will not be for gold. It will be for what I love. Protect Sota and Yuki. Protect each other. A camellia falls whole — never petal by petal. — Your father, Isshin\"");
  } else if (id === 'camellia') {
    await say('The note is written in a hurried hand:');
    await say('"The head on the gate is not his. Trust nothing the crows show you."');
    await say('Unsigned. The brushwork is rushed... and strangely familiar.');
  } else if (id === 'orders') {
    await say('"Hanzaki — Move the boy to Karasu-jō at once. He takes to the poppy well; within a month he will not remember his own name."');
    await say('"Display the decoy\'s head at your gate. Let Iga believe the Kagenuma line is ended. If the elder brother comes, kill him quietly."');
    await say('"And find the girl. She was seen near Akame. She must not reach the boy before I have finished with him. — G."');
  }
}

function moveEntity(n, dir, speed = 3) {
  const [dx, dy] = DV[dir]; n.dir = dir;
  return new Promise(res => { n.mv = { x: n.px + dx * 16, y: n.py + dy * 16, speed: speed * 16, res }; });
}
async function walkNpc(n, dirs, speed) { for (const d of dirs) await moveEntity(n, d, speed); }

/* ---------------- VILLAGE ---------------- */
Object.assign(MAPS.village, {
  exits: [{ x: 31, y: 10, to: 'forest', tx: 1, ty: 13, dir: 'right', cond: () => F('gonbei') && F('blade'),
    blocked: async () => { await say('Ren', F('gonbei') ? "Gonbei said Father hid something beneath the shrine room floor. I should search the house first." : 'Not yet. Someone might still be alive here.'); } }],
  npcs: [
    { id: 'looter1', x: 12, y: 9, spr: 'looter', dir: 'down', cond: () => !F('looters'), talk: () => lootersScene() },
    { id: 'looter2', x: 14, y: 9, spr: 'bandit', dir: 'down', cond: () => !F('looters'), talk: () => lootersScene() },
    { id: 'gonbei', x: 28, y: 14, spr: 'gonbei', dir: 'left', talk: () => gonbeiTalk() },
  ],
  events: [
    { type: 'step', x: 0, y: 14, w: 32, h: 1, cond: () => !F('looters'), run: () => lootersScene() },
    { type: 'touch', x: 15, y: 5, run: () => homeSearch() },
    { type: 'touch', x: 4, y: 3, run: () => say('A fresh grave beneath a plain wooden marker: "Kagenuma Isshin." Father. The earth is still soft.') },
    { type: 'touch', x: 6, y: 3, run: () => say('"Kagenuma Chiyo." Mother. Someone has laid a sprig of wild chrysanthemum on the mound.') },
    { type: 'touch', x: 8, y: 3, run: async () => { await say('A small marker: "Kagenuma Yuki, sixteen years." No mound — the earth is undisturbed.'); if (F('gonbei')) await say('Ren', 'Nothing to bury but a hairpin. ...Yuki.'); } },
    { type: 'door', x: 29, y: 13, run: () => say('The storehouse door is warped shut by the heat. Gonbei has been sleeping in its shadow.') },
  ],
  touchTiles: { x: () => say(R.pick(['Charred beams, still warm at the core. The smell of smoke clings to everything.', 'A rice pot, split by the heat. Someone was cooking dinner when they came.', 'Ash and broken roof tiles. A child\'s wooden top lies blackened in the cinders.'])),
    u: () => say('The village well. Someone has thrown a dead dog into it. The water is ruined.') },
});
async function lootersScene() {
  if (F('looters')) return;
  await say('Looter', "Heh. These Iga rats hid their silver well. Keep digging, there's got to be more.");
  await say('Bandit', '...Oi. Someone\'s coming up the road.');
  await say('Ren', 'Step away from my father\'s house.');
  await say('Looter', 'One more ghost from the ashes? Gut him and get back to work!');
  await say('Tip: Press A (Z / Space) to slash — tap it quickly for a combo. B (X / Shift) dodge-rolls. Watch for enemies flashing red: that is your cue to roll.');
  await battle(['looter', 'looter'], { replace: ['looter1', 'looter2'], intro: 'The looters draw their knives!' });
  setF('looters');
  await say('Ren', '...Carrion birds. The real killers are long gone.');
  await say('Ren', 'Mother. Father. Yuki. Sota. Is anyone here?');
  await say('From near the old storehouse, someone coughs.');
}
async function gonbeiTalk() {
  const g = npcById('gonbei');
  if (!F('looters')) { await say('Gonbei', '...'); return; }
  if (!F('gonbei')) {
    Music.play('sorrow');
    await say('Gonbei', 'Young master... Ren-sama? You came back. ...I prayed you would stay away.');
    await say('Ren', "Gonbei! You're hurt. Who did this? Where is everyone?");
    await say('Gonbei', 'Four nights ago, on the new moon. Not Oda\'s soldiers — shinobi. Thirty, perhaps more. They wore black, and on their sleeves...');
    await say('Gonbei', '...a crow. A crow with three legs.');
    await say('Gonbei', 'Your father held the gate alone so the others could run. Your mother would not leave him. I buried them myself, on the hill, beside your grandfather.');
    await say('Ren', '...And Yuki? Sota?');
    await say('Gonbei', 'Yuki-sama slept in the east wing. The fire took it first. I searched three days, Ren-sama. All I found was this.');
    give('hairpin');
    await say("Yuki's camellia hairpin. The lacquer has bubbled and blackened. She wore it every day since Mother gave it to her.");
    await say('Ren', '...');
    await say('Gonbei', 'But Sota-sama — they took him alive. I saw it from the ditch where I lay. A tall man with a scarred face carried him out over his shoulder.');
    await say('Gonbei', 'He laughed and said, "Gensai-sama will be pleased with this one."');
    await say('Ren', 'Gensai...');
    await say('Gonbei', 'Go to Ueno, east through the forest. The market town hears everything. Ask for Sakichi at the teahouse — he sells what he hears.');
    await say('Gonbei', 'And Ren-sama... beneath the floor of the shrine room, your father kept something for you. The fire may have spared it.');
    setF('gonbei');
    await say('Ren', 'Rest, Gonbei. I will bring Sota home. I swear it on their graves.');
    await say('Tip: Face people and things and press A to talk or examine. Open the menu with ☰ (Esc / Tab).');
    return;
  }
  const c = await ask('Gonbei', F('blade') ? 'Go, young master. I will tend the graves. Do you need to rest a while first?' : 'The shrine room was at the center of the house. Search there.', ['Rest here', 'Talk', 'Leave']);
  if (c === 0) { await fadeOut(0.6); P.hp = maxHP(); P.ki = maxKi(); await wait(0.6); await fadeIn(0.6); await say('Gonbei', 'There. Rice and a little dried fish. It is all I have.'); }
  else if (c === 1) {
    if (F('yukiJoined')) await say('Gonbei', 'I always thought Yuki-sama was too clever to die in a fire.');
    else if (F('hanzaki')) await say('Gonbei', 'You look like your father when you frown like that, Ren-sama.');
    else await say('Gonbei', R.pick(['Your father used to say: the shinobi who survives is the one who knows when to vanish.', 'Sota-sama snuck out fishing at the pond every morning. He thought nobody knew.', 'Oda\'s armies are massing in Ise. They say this autumn they will come for all of Iga.']));
  }
}
async function homeSearch() {
  if (!F('gonbei')) { await say('The house where you were born is a black skeleton. You cannot bring yourself to search it. Not yet.'); return; }
  if (F('blade')) { await say('Nothing remains of the shrine room but ash and the scorched stone of the hearth.'); return; }
  await say('You pick through the ruin to where the shrine room stood. Beneath the ash, the floorboards are charred — but the stone pit beneath is cool.');
  await say('Wrapped in oiled cloth: your father\'s ninjatō, a letter, and your mother\'s sandalwood prayer beads.');
  give('isshin_blade'); give('letter', 1, true); give('prayer_beads', 1, true);
  toast("Obtained Father's Letter"); toast("Obtained Mother's Beads");
  setF('blade');
  await say('Ren', "Father's blade... He never let me so much as touch it.");
  const c = await ask(null, 'Read the letter now?', ['Read', 'Later']);
  if (c === 0) await readDoc('letter');
  await say('Ren', 'Kuroda Gensai. Father\'s own student.');
  await say('Tip: Equip the blade and the beads from the menu — Equipment. They are far better than what you carry.');
  await say('Tip: Enemies who have not noticed you take double damage — triple from behind. Approach carefully.');
}

/* ---------------- FOREST ---------------- */
Object.assign(MAPS.forest, {
  spawnN: 7, noSpawn: [[15, 1, 13, 6], [5, 5, 9, 7]],
  exits: [
    { x: 0, y: 13, to: 'village', tx: 30, ty: 10, dir: 'left' },
    { x: 39, y: 13, to: 'town', tx: 1, ty: 13, dir: 'right' },
  ],
  chests: { '17,3': { item: 'salve', n: 2 }, '25,3': { gold: 150 }, '33,7': { item: 'lost_charm', n: 1 }, '13,22': { item: 'hyorogan', n: 2 } },
  npcs: [
    { id: 'woodcutter', x: 16, y: 14, spr: 'villager', dir: 'up', talk: async () => {
      if (F('tozo')) await say('Woodcutter', "Tōzō's dead? Hah! I'll sleep in my own house tonight. Thank you, traveler.");
      else { await say('Woodcutter', 'Careful on this road. Onibi Tōzō and his bandits hold the old charcoal camp up the trail to the north.'); await say('Woodcutter', "They say Mizuno, the magistrate in Ueno, has put a price on his head. Nobody's brave enough to collect it."); }
    } },
    { id: 'pilgrim', x: 31, y: 19, spr: 'monk_npc', dir: 'left', talk: async () => {
      await say('Pilgrim', 'Two years ago Oda\'s son marched into Iga and the clans sent him home bleeding. His father has not forgotten the shame.');
      await say('Pilgrim', 'Now there are men in black on every road, buying and selling secrets. Even shinobi turn on shinobi. These are the last days of the old Iga, I fear.');
    } },
    { id: 'herbwoman', x: 9, y: 9, spr: 'oldwoman', dir: 'down', talk: async () => {
      await say('Herb Gatherer', 'Mugwort, comfrey, a little charcoal for poison... I gather what the mountain gives. Will you buy?');
      await shop(['onigiri', 'salve', 'hyorogan', 'gedoku'], 'Herb Gatherer');
    } },
    { id: 'tozo', x: 22, y: 2, spr: 'tozo', dir: 'down', cond: () => !F('tozo'), talk: () => tozoScene() },
    { id: 'tb1', x: 18, y: 3, spr: 'bandit', dir: 'down', cond: () => !F('tozo'), talk: () => tozoScene() },
    { id: 'tb2', x: 24, y: 3, spr: 'bandit', dir: 'down', cond: () => !F('tozo'), talk: () => tozoScene() },
  ],
  events: [{ type: 'step', x: 16, y: 4, w: 11, h: 2, cond: () => !F('tozo'), run: () => tozoScene() }],
});
async function tozoScene() {
  if (F('tozo')) return;
  await say('Tōzō', 'Well, well. A lone crow-chick in black pajamas, walking into my camp.');
  await say('Ren', 'You are Onibi Tōzō.');
  await say('Tōzō', "Iga whelp, eh? Your kind burned easy enough last week. What's left of your village worth stealing?");
  await say('Ren', 'You were there?');
  await say('Tōzō', "Ha! We only picked the bones after the crows had fed. Black-clad devils. They paid us silver to watch the roads, and keep our mouths shut.");
  await say('Tōzō', 'Speaking of mouths. Boys — shut his.');
  await battle(['bandit', 'bandit'], { replace: ['tb1', 'tb2'], intro: "Tōzō's men rush you!" });
  await say('Tōzō', 'Useless! Fine. I\'ll do it myself.');
  await battle(['tozo'], { boss: true, replace: ['tozo'], intro: 'Onibi Tōzō hefts his great nodachi!' });
  await say('Tip: Big foes like Tōzō leap at you — a red ring marks where they will land. Roll out of it!');
  await say('Tōzō', 'Wait — wait! The crows... they went north with a covered cart. To Kuroiwa, up past Akame Falls. There was a boy in the cart. That\'s all I know, I swear!');
  await say('Tōzō', '...Should have stayed... a woodcutter...');
  setF('tozo');
  give('war_fan');
  await say('Ren', "Kuroiwa. And Mizuno's bounty will open the north road. Good.");
}

/* ---------------- TOWN ---------------- */
function smithStock() {
  const s = ['shozoku', 'kusarigama', 'kusari', 'shuko'];
  if (F('falls')) s.push('masterwork', 'domaru', 'tigertooth');
  return s;
}
Object.assign(MAPS.town, {
  exits: [
    { x: 0, y: 13, to: 'forest', tx: 38, ty: 13, dir: 'left' },
    { x: 20, y: 0, w: 2, to: 'pass', tx: 17, ty: 32, dir: 'up', cond: () => has('permit'),
      blocked: async () => { await say('Gate Guard', 'Halt. No one passes north to Akame without a travel permit. Lord Oda\'s orders. Get one from Magistrate Mizuno.'); } },
  ],
  onEnter: async () => { if (!F('townSeen')) { setF('townSeen'); setF('ch', 2); await chapter('Chapter II', 'The Market Town'); await say('Ueno. Smoke from a hundred cooking fires, merchants shouting prices, and Oda\'s spearmen watching from every corner.'); } },
  npcs: [
    { id: 'g1', x: 19, y: 1, spr: 'gate_guard', dir: 'down', talk: async () => { if (has('permit')) await say('Gate Guard', 'Your papers are in order. Go on — and watch for gunmen in the pass. Not all of them answer to us.'); else await say('Gate Guard', 'North road\'s closed. Permit from the magistrate or turn around.'); } },
    { id: 'g2', x: 22, y: 1, spr: 'gate_guard', dir: 'down', talk: () => say('Gate Guard', 'Iga folk keep coming through, all of them with sad stories. Not my problem.') },
    { id: 'child', x: 10, y: 7, spr: 'child', dir: 'down', wander: true, talk: () => say('Child', R.pick(['Mother says not to talk to men dressed in black. Are you a ninja?', 'I saw a lady on the roof last night! She jumped all the way to the inn!', 'Kagome, kagome, the bird in the cage...'])) },
    { id: 'refugee', x: 24, y: 12, spr: 'woman', dir: 'left', talk: async () => { await say('Refugee', 'We fled from Kashiwara with nothing. Oda\'s men burn any village that shelters shinobi.'); await say('Refugee', 'My husband went back for our ox. That was ten days ago.'); } },
    { id: 'ronin', x: 34, y: 7, spr: 'ronin', dir: 'down', talk: async () => { await say('Drunk Rōnin', 'Seven years I served the Rokkaku. Now Oda pays farmers to shoot men like me from a hundred paces with those cursed teppō.'); await say('Drunk Rōnin', 'Here\'s a free lesson: a gunner needs a breath to aim. Throw smoke in his face and he\'ll hit nothing but sky.'); } },
    { id: 'merchant', x: 15, y: 13, spr: 'merchant', dir: 'down', talk: async () => { await say('Merchant', 'Crows? Aye — black-clad men came through a week back with a covered cart, before the gate even opened. Went north.'); await say('Merchant', 'The guards looked the other way. That tells you who they work for.'); } },
    { id: 'oldwoman', x: 7, y: 17, spr: 'oldwoman', dir: 'down', talk: () => kotaQuest() },
    { id: 'kota', x: 9, y: 17, spr: 'child', dir: 'left', cond: () => F('kota'), talk: () => say('Kota', 'Grandma says you found my charm in the bamboo! Were there tanuki? I bet there were tanuki.') },
    { id: 'priest', x: 6, y: 23, spr: 'priest', dir: 'down', talk: () => priestTalk() },
    { id: 'patrol', x: 27, y: 18, spr: 'ashigaru', dir: 'left', wander: true, talk: () => say('Ashigaru', R.pick(['Move along.', 'Iga or not, keep your blade sheathed in town.', 'They say Lord Nobunaga will send forty thousand men into Iga before the leaves fall.'])) },
    { id: 'woman2', x: 31, y: 12, spr: 'woman2', dir: 'down', talk: () => say('Townswoman', 'The teahouse? North side of the main street. Sakichi practically lives there — ask him anything, if you can afford it.') },
  ],
  events: [
    { type: 'door', x: 6, y: 4, run: () => inn(20, 'Innkeeper') },
    { type: 'door', x: 14, y: 4, run: async () => { await say('Shopkeeper', 'Welcome! Provisions for the road?'); await shop(['onigiri', 'salve', 'hyorogan', 'tonic', 'gedoku', 'eyewash', 'makibishi', 'horoku', 'smokeball'], 'Shopkeeper'); } },
    { type: 'door', x: 28, y: 4, run: () => sakichiTalk() },
    { type: 'door', x: 5, y: 10, run: async () => { await say('Blacksmith', F('falls') ? 'Iron from Izumo came in. I have finer work now, if your purse is deep.' : 'Blades, chain, claws. Iga steel, mostly. Iga smiths are the best — and the cheapest, now.'); await shop(smithStock(), 'Blacksmith'); } },
    { type: 'door', x: 30, y: 10, run: () => magistrateTalk() },
    { type: 'door', x: 5, y: 16, run: () => say('The door is barred. You hear a family arguing in low voices inside.') },
    { type: 'door', x: 14, y: 16, run: () => say('A sign on the door: "Closed — gone to my brother in Nara."') },
    { type: 'door', x: 28, y: 16, run: () => say('An old man peers through a gap in the shutters, then quickly slams them closed.') },
    { type: 'door', x: 34, y: 16, run: () => say('A cat sleeps on the step. The door is locked.') },
    { type: 'touch', x: 7, y: 25, run: () => say('A small Shinto shrine to the kami of the crossroads. Paper streamers stir in the wind.') },
  ],
  touchTiles: { u: () => say('The town well. A woman nods to you as she draws water.'), p: () => say('Rice paddies, already harvested. Stubble and still water.') },
});
async function sakichiTalk() {
  if (!F('sakichi')) {
    await say('Sakichi', 'Sit, sit. Tea is three mon. Information... is fifty.');
    const c = await ask('Sakichi', 'What do you want to know, stranger?', ['The crow-marked men (50 mon)', 'Nothing']);
    if (c !== 0) { await say('Sakichi', 'Then enjoy your tea.'); return; }
    if (G.gold < 50) { await say('Sakichi', 'Fifty mon, friend. Come back when your purse is heavier. The bandits in the forest carry plenty.'); return; }
    G.gold -= 50; Snd.sfx('coin');
    await say('Sakichi', 'The three-legged crow. Yatagarasu. They belong to a man named Kuroda Gensai. He sells Iga\'s secrets to Oda — and Iga\'s children, when the price is right.');
    await say('Ren', 'They took a boy from Kagenuma. Fourteen years old. Where?');
    await say('Sakichi', '...Kagenuma. You\'re family, then.');
    await say('Sakichi', 'The cart went north, to Kuroiwa fortress beyond Akame Falls. I\'m sorry, friend. Word came down three days ago. The boy was executed. They put his head on the gate, the way they do.');
    await say('Ren', '...');
    await say('Ren', "I don't believe it. Not until I see it with my own eyes.");
    await say('Sakichi', "Then you'll need to get through the north gate, and for that you need Mizuno's permit. He wants Onibi Tōzō's head. Kill the bandit, and Mizuno will kiss your feet.");
    await say('Sakichi', "One more thing — free of charge, because I liked your family's reputation. You're not the only one asking about the crows.");
    await say('Sakichi', 'A woman. Masked. Pays in silver and never stays long. The crows want her badly.');
    setF('sakichi');
    return;
  }
  if (!has('permit')) await say('Sakichi', 'Tōzō\'s camp is up the north trail in the forest. Bring Mizuno proof, and the gate is yours.');
  else if (!F('falls')) await say('Sakichi', 'The Akame pass is crawling with Oda gunners and crow scouts. Carry antidotes.');
  else if (!F('hanzaki')) await say('Sakichi', 'Kuroiwa is held by a brute called Hanzaki. The Iron Crow. He wears lamellar under his black and fights like a landslide.');
  else if (!F('end')) await say('Sakichi', 'Karasu-jō... I know men who went there to sell secrets. None of them came back.');
  else await say('Sakichi', 'They say Gensai is dead. I didn\'t hear it from you, and you didn\'t hear it from me.');
}
async function magistrateTalk() {
  if (has('permit')) { await say('Mizuno', 'The road north is open to you. Do try not to embarrass me.'); return; }
  if (has('war_fan')) {
    await say('Mizuno', "Tōzō's war fan! Then the demon of the forest road is truly dead.");
    await say('Mizuno', 'You have my thanks — and Lord Oda\'s, should he ever care to ask. Here: three hundred mon, and a permit for the north gate.');
    takeItem('war_fan'); addGold(300); give('permit');
    setF('ch', 3);
    await say('Mizuno', "Whatever business you have in the north... I don't want to know it.");
    return;
  }
  await say('Mizuno', 'A permit for the north road? In these times? Impossible.');
  await say('Mizuno', '...Unless. The bandit Onibi Tōzō preys on the forest road and makes me look a fool before Lord Oda\'s inspectors.');
  await say('Mizuno', 'Bring me proof of his death and you will have your permit — and a reward. His camp is north of the forest road.');
}
async function kotaQuest() {
  if (F('kota')) { await say('Old Woman', 'Kota hasn\'t let go of that charm since. Bless you, young man.'); return; }
  if (has('lost_charm')) {
    await say('Old Woman', "That's... Kota's charm! Where did you find it? In the bamboo? Oh, thank the Buddha.");
    takeItem('lost_charm'); setF('kota');
    await say('Old Woman', 'I have nothing of value — only this bell. My husband carried it in the war against the Rokkaku. He said it rang whenever danger was near.');
    give('kota_charm'); give('salve', 2);
    return;
  }
  await say('Old Woman', 'My grandson Kota dropped his protective charm when we fled through the forest. He cries for it every night.');
  await say('Old Woman', 'It must be somewhere in that bamboo grove east of the forest road... but I\'m too old, and the wolves...');
}
async function priestTalk() {
  if (!F('omamori')) {
    await say('Priest', 'You carry grief like a stone in your sleeve, traveler. Take this omamori.');
    await say('Priest', 'It cannot turn a blade. But it may steady the hand that holds one.');
    give('omamori'); setF('omamori'); return;
  }
  const c = await ask('Priest', 'May the kami watch over your road.', ['Ask about camellias', 'Ask about the war', 'Farewell']);
  if (c === 0) { await say('Priest', 'Samurai dislike the camellia. It falls whole, like a head from the block.'); await say('Priest', 'But Iga mothers plant it by their doors. For them it means a family that stays whole — even when it falls.'); }
  else if (c === 1) await say('Priest', 'Oda burned Mount Hiei ten years ago — temples, monks, women and children. Twenty thousand souls. He will not hesitate over Iga.');
}

/* ---------------- PASS ---------------- */
Object.assign(MAPS.pass, {
  spawnN: 8, noSpawn: [[15, 11, 12, 9], [5, 3, 10, 5], [3, 22, 8, 5]],
  exits: [
    { x: 17, y: 33, w: 2, to: 'town', tx: 20, ty: 1, dir: 'down' },
    { x: 17, y: 0, w: 2, to: 'fortress', tx: 16, ty: 30, dir: 'up' },
  ],
  chests: { '20,7': { item: 'tonic', n: 1 }, '14,20': { item: 'salve', n: 3 } },
  onEnter: async () => { if (!F('passSeen')) { setF('passSeen'); setF('ch', 3); await chapter('Chapter III', 'Akame Falls'); await say('The Akame gorge: forty-eight waterfalls, they say, and every one of them watched by someone.'); } },
  npcs: [
    { id: 'monk', x: 23, y: 24, spr: 'monk_npc', dir: 'left', talk: async () => {
      await say('Wandering Monk', 'En no Gyōja himself trained in these falls, a thousand years ago. Now Oda\'s gunners hunt deer and men here with equal pleasure.');
      if (!F('monkGift')) { setF('monkGift'); await say('Wandering Monk', 'You have a long road. Take these — the mountain provides, and so must we.'); give('onigiri', 3); }
    } },
    { id: 'as1', x: 20, y: 14, spr: 'crow2', dir: 'down', cond: () => F('ambush') && !F('falls') },
    { id: 'as2', x: 21, y: 14, spr: 'crow', dir: 'down', cond: () => F('ambush') && !F('falls') },
    { id: 'as3', x: 21, y: 18, spr: 'crow2', dir: 'up', cond: () => F('ambush3') && !F('falls') },
    { id: 'masked', x: 25, y: 18, spr: 'yuki_mask', dir: 'left', cond: () => F('ambush3') && !F('falls') },
  ],
  events: [{ type: 'step', x: 20, y: 16, w: 2, h: 2, cond: () => !F('falls'), run: () => fallsScene() }],
});
async function fallsScene() {
  if (F('falls')) return;
  await say("The thunder of Akame's falls fills the gorge. Spray hangs in the air like smoke, and the bridge is slick beneath your feet.");
  setF('ambush'); Snd.sfx('slash');
  await wait(0.3);
  await say('Crow Assassin', 'Kagenuma Ren. Gensai-sama said the eldest might crawl out of hiding.');
  await say('Ren', 'Where is my brother?');
  await say('Crow Assassin', "Your brother? Ask the crows on Kuroiwa's gate. They've been picking at him for days.");
  await say('Ren', '...You will tell me everything before you die.');
  await battle(['assassin', 'scout'], { boss: true, replace: ['as1', 'as2'], intro: 'The Yatagarasu close in on the bridge!' });
  setF('ambush3');
  G.dir = 'down';
  Flash.go('#fff', 0.5);
  await say('Behind you — a third shadow drops from the cliff, blade already falling—');
  Snd.sfx('throw'); await wait(0.25); Snd.sfx('hit'); Flash.go('#c02020', 0.5);
  const a3 = npcById('as3'); a3.dir = 'left';
  await wait(0.4);
  await say('—and crumples, a throwing blade buried in his throat.');
  setF('as3down'); a3.hidden = true; Snd.sfx('die');
  const m = npcById('masked'); m.dir = 'left';
  G.dir = 'right';
  await say('A slight figure in dark plum stands on the rocks above the river, face hidden by a pale mask.');
  await say('Ren', 'Who are you? Why help me?');
  await say('Masked Woman', '...');
  await say('She tosses something onto the bridge at your feet. Then, in a puff of grey smoke, she is gone.');
  Snd.sfx('smoke'); m.hidden = true;
  give('camellia');
  await say('Ren', 'A camellia. A red camellia, fresh-cut...');
  await say('Ren', 'Mother grew these beneath Yuki\'s window.');
  await readDoc('camellia');
  await say('Ren', '...Who are you?');
  setF('falls');
}

/* ---------------- FORTRESS ---------------- */
Object.assign(MAPS.fortress, {
  spawnN: 9, noSpawn: [[1, 1, 32, 7], [0, 22, 34, 10]],
  exits: [
    { x: 15, y: 31, w: 4, to: 'pass', tx: 17, ty: 1, dir: 'down' },
    { x: 16, y: 0, w: 2, to: 'castle', tx: 14, ty: 38, dir: 'up', cond: () => F('hanzaki'),
      blocked: async () => { await say('The rear gate is barred from the far side. Somewhere in this keep is someone who holds the key.'); } },
  ],
  chests: { '12,17': { item: 'horoku', n: 2 }, '9,9': { item: 'kiyomitsu', n: 1 }, '24,9': { item: 'tonic', n: 1 } },
  onEnter: async () => { if (!F('fortSeen')) { setF('fortSeen'); setF('ch', 4); await chapter('Chapter IV', 'The Heads at Kuroiwa'); } },
  npcs: [
    { id: 'hanzaki', x: 16, y: 2, spr: 'hanzaki', dir: 'down', cond: () => !F('hanzaki'), talk: () => hanzakiScene() },
    { id: 'hg1', x: 13, y: 3, spr: 'samurai', dir: 'down', cond: () => !F('hanzaki') },
    { id: 'hg2', x: 20, y: 3, spr: 'samurai', dir: 'down', cond: () => !F('hanzaki') },
  ],
  events: [
    { type: 'step', x: 0, y: 26, w: 34, h: 1, cond: () => !F('heads'), run: () => headsScene() },
    { type: 'step', x: 1, y: 6, w: 32, h: 1, cond: () => !F('hanzaki'), run: () => hanzakiScene() },
  ],
  touchTiles: { k: () => F('heads') ? say('You cannot leave them like this. When this is over, you will come back and bury them all.') : say('Pikes. Heads.'),
    H: () => say('A storehouse, packed with rice bales and powder kegs stamped with the Oda crest.') },
});
async function headsScene() {
  if (F('heads')) return;
  Music.stop();
  await say("Four pikes stand before Kuroiwa's gate. Four heads, blackened by sun and smoke. Crows lift lazily into the air as you approach.");
  await say('The smallest is a boy\'s. A paper tag flutters beneath it: "KAGENUMA SOTA — TRAITOR TO THE REALM."');
  await say('Ren', '...Sota.');
  await say('Your legs will not hold you. You fall to your knees in the dirt.');
  await wait(0.8);
  await say('...But something is wrong. You make yourself look again. Closer. At the left ear.');
  await say('Ren', 'When he was seven, Sota tore his left ear on a fishhook. I stitched it myself, by lamplight, while he cried and made me swear never to tell Father.');
  await say('This ear is whole. Unmarked.');
  Music.play('dungeon');
  await say('Ren', "It's not him.  ...It's not him.");
  await say('Ren', 'The note on the camellia was right. Whoever you are — thank you.');
  await say('Ren', 'Some other mother\'s son, displayed so all of Iga believes the Kagenuma are finished. Gensai will answer for this boy too.');
  setF('heads');
}
async function hanzakiScene() {
  if (F('hanzaki')) return;
  await say('Hanzaki', "So the head didn't fool you. Gensai said it might not. He thinks very highly of your family's eyes.");
  await say('Hanzaki', 'I am Hanzaki. The Iron Crow. I have killed eleven Iga men this year. You would make it a round dozen.');
  await say('Ren', 'Where is Sota?');
  await say('Hanzaki', 'Gone to Karasu-jō, learning to forget your name. Every day he forgets a little more. Soon he will hunt you himself, and smile while he does it.');
  await say('Ren', 'Then my road goes through you.');
  await battle(['hanzaki', 'guard', 'guard'], { boss: true, replace: ['hanzaki', 'hg1', 'hg2'], intro: 'Hanzaki, the Iron Crow, raises his great blade!' });
  await say('Hanzaki', 'Heh... you fight... like Isshin...');
  await say('Hanzaki', 'Gensai will... enjoy... breaking you...');
  setF('hanzaki'); setF('ch', 5);
  await say("Beneath Hanzaki's armor you find an iron key and a sealed letter bearing a three-legged crow.");
  give('orders');
  await readDoc('orders');
  await say('Ren', '"Find the girl"...?');
  await say('Ren', 'A woman the crows fear. Who knew Sota\'s head was a lie. Who leaves red camellias...');
  await say('Ren', "No. I won't let myself hope for that. Not yet. Not until I see her face.");
  await say('The rear gate of Kuroiwa now stands open. Beyond it, the road climbs to Karasu-jō.');
}

/* ---------------- CASTLE ---------------- */
Object.assign(MAPS.castle, {
  spawnN: 9, noSpawn: [[7, 1, 16, 10], [8, 33, 14, 7]],
  exits: [{ x: 14, y: 39, w: 2, to: 'fortress', tx: 16, ty: 1, dir: 'down' }],
  chests: { '8,28': { item: 'nightsilk', n: 1 }, '5,17': { item: 'tonic', n: 2 }, '24,17': { item: 'karasu_giri', n: 1 } },
  onEnter: async () => { if (!F('castleSeen')) { setF('castleSeen'); await chapter('Chapter V', 'The Crow Castle'); await say('Karasu-jō squats on its crag like a carrion bird — black walls, black tiles, and not a single lantern lit in welcome.'); } },
  npcs: [
    { id: 'yukimask', x: 15, y: 17, spr: 'yuki_mask', dir: 'down', cond: () => F('yukiAppear') && !F('yukiJoined') },
    { id: 'gensai', x: 14, y: 3, spr: 'gensai', dir: 'down', cond: () => !F('end') },
    { id: 'sota', x: 15, y: 5, spr: 'sota', dir: 'down', cond: () => !F('end') },
  ],
  events: [
    { type: 'step', x: 5, y: 20, w: 20, h: 1, cond: () => !F('yukiJoined'), run: () => yukiScene() },
    { type: 'step', x: 8, y: 9, w: 14, h: 1, cond: () => !F('end'), run: () => finalScene() },
  ],
});
async function yukiScene() {
  if (F('yukiJoined')) return;
  setF('yukiAppear'); Snd.sfx('smoke'); Flash.go('#fff', 0.4);
  G.dir = 'up';
  await say('Smoke blooms in the hall. When it clears, the masked woman stands before you.');
  await say('Ren', 'You again. You have saved my life twice now and never said a word. Who are you?');
  await say('Masked Woman', '...');
  await say('Slowly, she lifts the mask away.');
  const y = npcById('yukimask'); y.spr = 'yuki';
  Music.play('reunion');
  await wait(0.8);
  await say('Yuki', '...Ren-niisan.');
  await say('Ren', 'Yuki...? No. No, you died. Gonbei found your hairpin in the ashes. I stood at your grave—');
  await say('Yuki', 'I dropped it running. I was in the garden when they came. I saw Father fall at the gate... and I ran into the hills. The crows hunted me for two days.');
  await say('Yuki', 'A Kōga woman found me half-dead by the river. She taught me everything Father never let me learn. Shuriken. Poisons. How to disappear.');
  await say('Ren', 'Why didn\'t you come to me? I buried you, Yuki. I said goodbye to you.');
  await say('Yuki', 'Because the crows were watching you, niisan. Every road you took. If they knew I lived, they would have used me to bait you — or you to bait me.');
  await say('Yuki', 'So I followed in the shadows, and cut down what I could.');
  await say('Ren', 'The camellia...');
  await say('Yuki', "Mother's flowers. I hoped some part of you would know.");
  await say('Ren gives Yuki her scorched hairpin. Her hands are shaking as she slides it into her hair.');
  takeItem('hairpin');
  await say('Yuki', 'Sota is above us. Gensai has been feeding him poppy and lies — that Father sold him, that we abandoned him. He may not know us.');
  await say('Ren', 'Then we will remind him.');
  await say('Yuki', 'Together. A camellia falls whole—');
  await say('Ren', '—never petal by petal.');
  setF('yukiJoined'); y.hidden = true;
  G.yuki = mkYukiF(y.px, y.py);
  P.skills.push('camellia'); P.hp = maxHP(); P.ki = maxKi();
  Snd.sfx('level');
  toast('Yuki joined you!', '#f09aaa');
  await say('Yuki now travels with you! She fights on her own, throws shuriken, and patches you up when you are badly hurt.');
  P.active = 'camellia';
  await say('Ren and Yuki learned Tsubaki-otoshi — the Falling Camellia. It strikes every foe in sight. (Set to your T button.)');
  Music.play('dungeon');
}
async function finalScene() {
  if (F('end')) return;
  Music.stop();
  await say('Gensai', "Isshin's children. Both of them. I sent the whole of the Yatagarasu to find you, girl — and you walk in through my front door.");
  await say('Yuki', 'Sota! Sota, it\'s us!');
  await say('Sota', '...I don\'t know you.');
  await say('Gensai', 'Of course you don\'t. Tell them, Sota. Tell them what your family did.');
  await say('Sota', 'When the fire came, my brother was off on some lord\'s errand. My sister ran. Father sold me to pay his debts. Gensai-sensei is the only one who came for me.');
  await say('Ren', 'That is a lie. Father died at the gate with his sword in his hand. Mother died beside him.');
  await say('Gensai', 'Words. Sota — show your brother what I have taught you.');
  await battle(['sota'], { boss: true, replace: ['sota'], restore: true, music: 'boss', keepMusic: true, intro: 'Sota draws his blade. His eyes are empty.',
    endWhen: B => B.enemies[0].hp < B.enemies[0].maxhp * 0.5 });
  Music.play('reunion');
  await say('Sota staggers back, breathing hard. You lower your blade.');
  await say('Ren', 'Sota. Look at me. Touch your left ear.');
  await say('Sota', '...?');
  await say('Ren', 'You tore it on a fishhook at the Kagenuma pond. You cried the whole time I stitched it, and made me promise never to tell Father you\'d been fishing instead of training.');
  await say('Ren', 'I kept that promise. Seven years.');
  await say('Sota', '...Nii...san?');
  await say('Yuki', 'And Mother scolded all three of us when you hid her hairpin in the rice barrel. Remember?');
  await say('Sota', 'Yuki-neesan... the fire... I thought — he said you —');
  await say('The blade falls from Sota\'s hand. He is weeping.');
  Music.stop();
  await say('Gensai', 'Touching. Truly. Isshin always did ruin his students with sentiment.');
  await say('Gensai', 'No matter. I will simply begin again — with all three of you.');
  await say('Ren', 'Yuki. Get Sota behind you.');
  await say('Yuki', 'Together, niisan.');
  await battle(['gensai'], { boss: true, replace: ['gensai'], music: 'boss', intro: 'Kuroda Gensai, master of the Yatagarasu, draws his black blade!' });
  await say('Gensai sinks to one knee. His blade clatters across the floor.');
  await say('Gensai', 'So... the camellia... falls whole...');
  await say('Gensai', 'Isshin... you old fool... You were right... about them...');
  await say('Kuroda Gensai is dead.');
  setF('end');
  await say('Ren', "It's over. Let's go home.");
  await epilogue();
}

/* ---------------- EPILOGUE ---------------- */
Object.assign(MAPS.spring, {
  noFollower: true,
  npcs: [
    { id: 'e_yuki', x: 6, y: 4, spr: 'yuki', dir: 'up' },
    { id: 'e_sota', x: 7, y: 4, spr: 'sota', dir: 'up' },
    { id: 'e_gonbei', x: 9, y: 5, spr: 'gonbei', dir: 'left' },
  ],
});
async function epilogue() {
  await fadeOut(1.5);
  setF('ch', 6);
  await narrate(['They buried Kuroda Gensai beneath a nameless stone at Karasu-jō. Without him, the Yatagarasu scattered like crows before a storm.', 'They buried the boy from Kuroiwa\'s gate too, with prayers, though no one ever learned his name.', 'Spring came late to the valley of Kagenuma that year.']);
  await chapter('Epilogue', 'Camellias');
  loadMap('spring', 5, 4, 'up');
  G.busy = true;
  await fadeIn(1.5);
  await say('Gonbei', 'Isshin-sama... Chiyo-sama... They came home. All three of them.');
  await say('Yuki', "We should take my marker down, niisan. It's bad luck to keep a grave for the living.");
  await say('Ren', 'Leave it a while. I want to remember how it felt to lose you — so I never let it happen again.');
  await say('Sota', 'Niisan... will the soldiers come back?');
  await say('Ren', 'Oda\'s armies will come to Iga. Maybe this autumn. Maybe the next.');
  await say('Ren', 'But they will not find the Kagenuma scattered. Not anymore.');
  await say('Yuki lays red camellias on the three graves. They do not drop their petals one by one. When they fall, they fall whole.');
  await wait(1.0);
  await fadeOut(2.0);
  Music.play('ending');
  await narrate(['In the autumn of 1581, Oda Nobunaga\'s armies swept into Iga from every side. The valleys burned, and the old clans were broken.', 'But some families slipped away into the mountains — and survived, carrying their arts to every corner of Japan.', 'Among them, it is said, were two brothers and a sister who never again let one another fall alone.', 'A camellia falls whole. Never petal by petal.'], { title: '影 沼' });
  await narrate(['KAGENUMA\nAshes of the Shinobi', 'Story, code, art and music\ngenerated entirely in code — no external assets.', 'Thank you for playing.'], {});
  try { localStorage.setItem('kagenuma_cleared', '1'); } catch (e) {}
  location.reload();
}

/* ---------------- New game / prologue ---------------- */
async function prologue() {
  await narrate([
    'Iga Province. The ninth year of Tenshō — 1581.',
    'For two hundred years the hidden clans of Iga have answered to no lord. Now the warlord Oda Nobunaga\'s armies gather at the borders like wolves around a fold.',
    'For three days, the young shinobi Kagenuma Ren has run home through the mountains from a mission in Ōmi.',
    'On the second night, from a ridge above the valley, he saw the smoke.',
  ]);
  await chapter('Chapter I', 'Ashes');
  setF('ch', 1);
  loadMap('village', 13, 21, 'up');
  G.busy = true;
  await fadeIn(1.2);
  await say('Ren', '...No.');
  await say('Ren', 'No, no, no...');
  await say('Tip: Move freely in any direction with the arrow keys / WASD, the on-screen stick, or a gamepad.');
}
