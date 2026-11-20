# KAGENUMA — Ashes of the Shinobi (影沼)

An offline story RPG set in Iga Province in 1581, the year Oda Nobunaga invaded.
**Play it:** install `dist/Kagenuma.apk` on Android (5.0+), or open `www/index.html` in any browser.
It needs no internet connection. All art, music and sound are generated in code, so there are no asset files.

## Story
Kagenuma Ren, a 19-year-old shinobi, comes home to find his village burned by the Yatagarasu,
the "three-legged crow" shinobi led by his father's former student, Kuroda Gensai.
His parents are dead. His little brother Sota was carried off, and rumor says he was executed.
His sister Yuki is believed to have died in the fire...

Five chapters and an epilogue, played as a real-time action RPG: the burned village → Iga Forest → Ueno market town → Akame Falls → Kuroiwa fortress → Karasu-jō, the Crow Castle.

## Features
- **16-bit style graphics:** SNES-sized characters (16×24) with 3-tone shading and outlines, plus full animation sets (walk, sword combos, roll, hurt, death). Terrain is drawn pixel by pixel with blended paths, shorelines, cliff faces, tiled roofs and torch-lit castles. Tall trees overlap the player for depth.
- **Fluid movement in the style of *A Link to the Past*:** 8-direction movement with pixel-precise collision, corner sliding and a smooth camera.
- **Real-time action combat:** 3-hit sword combos, a charged spinning slash, dodge-rolls with invincibility frames, shuriken that can also knock enemy projectiles out of the air, and hit-stop on impact.
- **Readable enemies:** they flash red before striking, gunners show a smoking aim line, and big foes mark where they will land.
- **Stealth:** enemies have vision cones. Unaware foes take double damage, triple from behind, and smoke bombs make them lose you.
- **Bosses with attack patterns:** leap slams, spins, shuriken fans, radial dart storms, vanishing strikes, and an enraged phase at half health.
- **Yuki, the AI companion:** she joins late in the story, fights on her own, throws shuriken and heals you.
- **Character growth:** XP and levels. Each level raises every stat, gives **2 training points** to spend on STR/AGI/END/FOC, and unlocks techniques (smoke bomb, blinding powder, quick-draw dash, poison needle, mist cut, shadow stitch, and one more through the story).
- Weapons, armor and charms, shops, an inn, treasure chests, a side quest, Jizō save shrines, and Easy/Normal difficulty.
- **Controls:** keyboard, touch (analog stick + A/B/S/T buttons) and gamepad.
  Keyboard: arrows/WASD to move · Z/Space attack/talk · X/Shift roll · C shuriken · V technique · Esc/Tab menu.

## Building the APK
On Debian/Ubuntu (no Gradle or Android Studio needed):
```
sudo apt-get install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign default-jdk
android/build_apk.sh        # -> dist/Kagenuma.apk
```
