#!/bin/bash
# STB Mac 一鍵發版：簽名 → 公證 → staple → DMG → 簽名 → 公證 → staple → quarantine 驗收 → 蓋 release/
# 用法：scripts/release-mac.sh [STB.app 路徑]
#   預設吃 tauri build 產物 src-tauri/target/release/bundle/macos/STB.app
# 2026-08-03 起發版只准走這支（7/28 曾把未公證包推上線，全網下載中「已損毀」6 天）
set -euo pipefail
cd "$(dirname "$0")/.."

APP="${1:-src-tauri/target/release/bundle/macos/STB.app}"
ID="Developer ID Application: WEI-MING KAO (GHCWJ24V46)"
DMG="release/STB_1.0.0_aarch64.dmg"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

[ -d "$APP" ] || { echo "❌ 找不到 ${APP}（先 npm run tauri build，或把 .app 路徑當參數傳入）"; exit 1; }
VER=$(defaults read "$(cd "$APP" && pwd)/Contents/Info.plist" CFBundleShortVersionString)
echo "▸ 發版 v${VER}（來源：${APP}）"

notarize() { # $1=檔案
  xcrun notarytool submit "$1" --keychain-profile stb-notary --wait 2>&1 | tail -3 \
    | grep -q "Accepted" || { echo "❌ 公證失敗：${1}（xcrun notarytool log 查詳情）"; exit 1; }
}

echo "▸ 簽名（由內而外：stb-trim → 整包）"
ditto "$APP" "$WORK/STB.app"
codesign --force --options runtime --timestamp -s "$ID" "$WORK/STB.app/Contents/MacOS/stb-trim"
codesign --force --options runtime --timestamp -s "$ID" "$WORK/STB.app"

echo "▸ 公證 app（幾分鐘）"
ditto -c -k --keepParent "$WORK/STB.app" "$WORK/app.zip"
notarize "$WORK/app.zip"
xcrun stapler staple -q "$WORK/STB.app"

echo "▸ 重打 DMG（手動 hdiutil，bundle_dmg.sh flaky）＋簽名"
mkdir "$WORK/root"
ditto "$WORK/STB.app" "$WORK/root/STB.app"
ln -s /Applications "$WORK/root/Applications"
hdiutil create -volname "STB" -srcfolder "$WORK/root" -ov -format UDZO "$WORK/out.dmg" -quiet
codesign --force --timestamp -s "$ID" "$WORK/out.dmg"

echo "▸ 公證 DMG（幾分鐘）"
notarize "$WORK/out.dmg"
xcrun stapler staple -q "$WORK/out.dmg"

echo "▸ quarantine 模擬驗收"
xattr -w com.apple.quarantine "0083;0;Safari;RELEASE-TEST" "$WORK/out.dmg"
spctl -a -t open --context context:primary-signature "$WORK/out.dmg" >/dev/null 2>&1 \
  || { echo "❌ DMG spctl 未過"; exit 1; }
hdiutil attach -nobrowse -readonly "$WORK/out.dmg" -mountpoint "$WORK/mnt" -quiet
ditto "$WORK/mnt/STB.app" "$WORK/qapp"
hdiutil detach "$WORK/mnt" -quiet
xattr -w com.apple.quarantine "0083;0;Safari;RELEASE-TEST" "$WORK/qapp"
spctl -a -t exec -vv "$WORK/qapp" 2>&1 | grep -q "Notarized Developer ID" \
  || { echo "❌ app spctl 未過"; exit 1; }

cp "$WORK/out.dmg" "$DMG"
echo "✅ v$VER 全綠，已蓋 ${DMG}（SHA $(shasum -a 256 "$DMG" | cut -c1-8)…）"
echo "剩下手動三件："
echo "  1. git add $DMG && git commit && git push（pre-push hook 會再驗一次）"
echo "  2. 檢查 releaseNotes.ts APP_VERSION＋工具間 stb-latest.json（notesI18n 三語）是否同版本"
echo "  3. ditto 蓋 /Applications/STB.app"
