#!/bin/bash
# STB Mac 一鍵發版：簽名 → 公證 → staple → DMG → 簽名 → 公證 → staple → quarantine 驗收 → 蓋 release/
# 用法：scripts/release-mac.sh [STB.app 路徑]
#   預設吃 tauri build 產物 src-tauri/target/release/bundle/macos/STB.app
# 2026-08-03 起發版只准走這支（7/28 曾把未公證包推上線，全網下載中「已損毀」6 天）
set -euo pipefail
cd "$(dirname "$0")/.."

APP="${1:-src-tauri/target/release/bundle/macos/STB.app}"
ID="Developer ID Application: WEI-MING KAO (GHCWJ24V46)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

[ -d "$APP" ] || { echo "❌ 找不到 ${APP}（先 npm run tauri build，或把 .app 路徑當參數傳入）"; exit 1; }
VER=$(defaults read "$(cd "$APP" && pwd)/Contents/Info.plist" CFBundleShortVersionString)
# 2026-08-06 起檔名帶版本：舊做法全部蓋進 STB_1.0.0_aarch64.dmg，使用者下載看到 1.0.0
# 以為抓到舊版，而且瀏覽器不覆蓋同名檔（會存成 -1.dmg），點到留在下載夾的舊顆＝「檔案已損壞」。
DMG="release/STB_${VER}_aarch64.dmg"
FROZEN="release/STB_1.0.0_aarch64.dmg"   # 凍結在 1.6.2，接住舊私訊/外部轉貼，不再更新
echo "▸ 發版 v${VER}（來源：${APP}）→ ${DMG}"

# 公證認證走 .p8 直連（2026-08-16 改，同 ALIGNED 2026-08-14）：鑰匙圈 profile（stb-notary）
# 會無預警讀不到（store-credentials 寫得進去、history 卻 not found），.p8 直連在 headless／排程下也穩。
NOTARY_AUTH=(--key "$HOME/.appstoreconnect/private_keys/AuthKey_J63NP838KQ.p8"
             --key-id J63NP838KQ --issuer f1386394-19c4-4163-aa40-504dac653053)
notarize() { # $1=檔案
  xcrun notarytool submit "$1" "${NOTARY_AUTH[@]}" --wait 2>&1 | tail -3 \
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
# 驗收一律打在副本上：quarantine 會沿著「掛載→拷出」傳染，
# 直接標 out.dmg 的話 RELEASE-TEST 這枚標籤會跟著 cp 進 release/，
# 之後從那顆 DMG 裝機就被 App Translocation 丟去 /private/var 亂碼路徑跑
#（2026-08-05 抓到；對外下載不受影響——使用者的 quarantine 是瀏覽器蓋的——但本機裝機會中）。
cp "$WORK/out.dmg" "$WORK/qtest.dmg"
xattr -w com.apple.quarantine "0083;0;Safari;RELEASE-TEST" "$WORK/qtest.dmg"
spctl -a -t open --context context:primary-signature "$WORK/qtest.dmg" >/dev/null 2>&1 \
  || { echo "❌ DMG spctl 未過"; exit 1; }
hdiutil attach -nobrowse -readonly "$WORK/qtest.dmg" -mountpoint "$WORK/mnt" -quiet
ditto "$WORK/mnt/STB.app" "$WORK/qapp"
hdiutil detach "$WORK/mnt" -quiet
xattr -w com.apple.quarantine "0083;0;Safari;RELEASE-TEST" "$WORK/qapp"
spctl -a -t exec -vv "$WORK/qapp" 2>&1 | grep -q "Notarized Developer ID" \
  || { echo "❌ app spctl 未過"; exit 1; }

cp "$WORK/out.dmg" "$DMG"
xattr -c "$DMG" 2>/dev/null || true   # 保險：出貨的 DMG 不帶任何殘留 metadata（不動內容，SHA 不變）

echo "▸ 同步下載連結（repo 內三處，外部一律指行銷頁不必動）"
RAW="https://github.com/qwert2813434-ctrl/STB/raw/main/release/STB_${VER}_aarch64.dmg"
sync() { # $1=檔案，其餘＝sed 表達式（可多條）
  local f="$1"; shift
  [ -f "$f" ] || { echo "  ⚠️ 找不到 ${f}，跳過（連結會留舊版，記得手動改）"; return; }
  local args=(); local e
  for e in "$@"; do args+=(-e "$e"); done
  sed -i '' "${args[@]}" "$f" && echo "  ✓ ${f}"
}
LINK="s|release/STB_[0-9.]*_aarch64\.dmg|release/STB_${VER}_aarch64.dmg|g"
# README 連結後面還帶「（v1.6.2）」字樣，只改網址會對不起來，兩條一起送
sync README.md         "$LINK" "s|（v[0-9][0-9.]*）|（v${VER}）|g"
sync docs/index.html   "$LINK"
FEED="../../../37 - 工具間/上線/stb-latest.json"
sync "$FEED"           "s|\"url\": \"[^\"]*\"|\"url\": \"${RAW}\"|"

# 版本化檔名會累積（每版一顆 4MB）。凍結檔永遠留著，其餘舊版可自行 git rm 瘦身。
OLD=$(ls release/STB_*_aarch64.dmg 2>/dev/null | grep -v "$(basename "$FROZEN")" | grep -v "$(basename "$DMG")" || true)
[ -n "$OLD" ] && { echo "▸ 舊版 DMG 還留在 repo（要瘦身就 git rm，歷史仍保得住）："; echo "$OLD" | sed 's/^/    /'; }

echo "✅ v${VER} 全綠，已產出 ${DMG}（SHA $(shasum -a 256 "$DMG" | cut -c1-8)…）"
echo "剩下手動五件："
echo "  1. git add -A && git commit && git push（pre-push hook 會再驗一次）"
echo "  2. releaseNotes.ts 的 APP_VERSION 是否＝${VER}"
echo "  3. 工具間 stb-latest.json：url 已自動改好，但 version 與 notesI18n 三語要你自己寫，"
echo "     然後在「37 - 工具間/上線/」git push 才會生效（沒推＝App 內升級橫幅不會跳）"
echo "  4. ditto 蓋 /Applications/STB.app —— 🔴 從 DMG 裡挖，不要拿 bundle/macos/STB.app"
echo "     hdiutil attach -nobrowse -readonly ${DMG} -mountpoint /tmp/m && ditto /tmp/m/STB.app /Applications/STB.app && hdiutil detach /tmp/m"
echo "     （build 產物沒簽沒公證，直接蓋上去 spctl 會說「code has no resources」；2026-09-01 實踩）"
echo "  5. 官網更新卡：20 - 網站製作/STB官網/{zh-Hant,en}/index.html 的「更新與預告」欄補一張"
echo "     v${VER} 卡（短標題＋2-3 條短句，文案自己寫；版號與下載連結會自己跟 feed 不用改），"
echo "     然後 git push —— 🔴 這條 2026-09-04 才補進清單：官網卡片曾經停在 1.7.1 三週沒人發現，"
echo "     就是因為這步驟從來不在清單上。日報已加落差偵測當保險，但那是事後抓不是代替你寫"
