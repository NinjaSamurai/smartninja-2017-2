# KAGENUMA — Ashes of the Shinobi (影沼)

An offline story RPG set in Iga Province in 1581, the year Oda Nobunaga invaded.
**Play it:** install `dist/Kagenuma.apk` on Android (5.0+), or open `www/index.html` in any browser.
It needs no internet connection. All art, music and sound are generated in code, so there are no asset files.

## Story
Kagenuma Ren, a 19-year-old shinobi, comes home to find his village burned by the Yatagarasu,
the "three-legged crow" shinobi led by his father's former student, Kuroda Gensai.
His parents are dead. His little brother Sota was carried off, and rumor says he was executed.
His sister Yuki is believed to have died in the fire...

Five chapters and an epilogue: the burned village → Iga Forest → Ueno market town → Akame Falls → Kuroiwa fortress → Karasu-jō, the Crow Castle.

## Features
- Turn-based battles: matchlock gunners that need a turn to aim, poison, blinding powder, smoke bombs, bosses with phases, and a companion who fights alongside you late in the game.
- **Character growth:** XP and levels. Each level raises every stat, gives **2 training points** to spend on STR/AGI/END/FOC, and unlocks techniques (Bō-shuriken, Kokyū-hō, Kemuri-dama, Metsubushi, Iai-nuki, Doku-bari, Kasumi-giri, Kage-nui, and one more through the story).
- Weapons, armor and charms, shops, an inn, treasure chests, a side quest, and saving at Jizō statues.
- Night lighting, embers, mist, falling leaves and petals. Procedural music in Japanese scales.
- Controls: arrows/WASD + Z/Enter (A) + X/Esc (B). On phones there is an on-screen pad, and the Back button works as B.

## Building the APK
On Debian/Ubuntu (no Gradle or Android Studio needed):
```
sudo apt-get install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign default-jdk
android/build_apk.sh        # -> dist/Kagenuma.apk
```
