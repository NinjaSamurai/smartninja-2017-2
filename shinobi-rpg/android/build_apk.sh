#!/usr/bin/env bash
# Builds Kagenuma.apk without Gradle, using the Debian/Ubuntu Android SDK packages:
#   sudo apt-get install aapt apksigner android-sdk-platform-23 dalvik-exchange zipalign default-jdk
# Usage: ./build_apk.sh   ->  ../dist/Kagenuma.apk
set -euo pipefail
unset JAVA_TOOL_OPTIONS _JAVA_OPTIONS || true  # silence JVM banner noise; no network needed
cd "$(dirname "$0")"

SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
JAR=$(ls "$SDK"/platforms/*/android.jar | sort -V | tail -1)
OUT=build
DIST=../dist
rm -rf "$OUT"; mkdir -p "$OUT"/gen "$OUT"/obj "$OUT"/assets "$DIST"

echo "== Copying game into assets/www"
cp -r ../www "$OUT"/assets/www

echo "== Packaging resources (aapt)"
aapt package -f -m -J "$OUT"/gen -M AndroidManifest.xml -S res -A "$OUT"/assets -I "$JAR" -F "$OUT"/app.unsigned.apk

echo "== Compiling Java"
javac -nowarn --release 8 -classpath "$JAR" -d "$OUT"/obj "$OUT"/gen/com/kagenuma/shinobi/R.java src/com/kagenuma/shinobi/*.java

echo "== Dexing"
dalvik-exchange --dex --min-sdk-version=21 --output="$OUT"/classes.dex "$OUT"/obj
(cd "$OUT" && aapt add app.unsigned.apk classes.dex >/dev/null)

echo "== Aligning"
zipalign -f -p 4 "$OUT"/app.unsigned.apk "$OUT"/app.aligned.apk

KS=${KEYSTORE:-kagenuma.keystore}
if [ ! -f "$KS" ]; then
  echo "== Creating signing key ($KS)"
  keytool -genkeypair -keystore "$KS" -storepass kagenuma -keypass kagenuma -alias kagenuma \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Kagenuma, O=Kagenuma, C=JP"
fi

echo "== Signing"
apksigner sign --ks "$KS" --ks-pass pass:kagenuma --key-pass pass:kagenuma --ks-key-alias kagenuma \
  --out "$DIST"/Kagenuma.apk "$OUT"/app.aligned.apk
apksigner verify --verbose "$DIST"/Kagenuma.apk 2>&1 | grep -E "Verified|Verifies" || true
ls -l "$DIST"/Kagenuma.apk
