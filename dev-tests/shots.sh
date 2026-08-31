#!/bin/bash
# STB 多語系介面截圖 —— 在地化宣傳／商店頁素材用。
#
# 靠 main.ts 與 i18n.ts 的兩個 QA 後門（只讀不寫、無副作用）：
#   ?lang=zh|en|ja   強制語系
#   ?demo=<name>     載 public/demo/<name>.json（夾具，已進 .gitignore）
#   ?chap=<id>       直接跳章
#
# 用法：./dev-tests/shots.sh [埠號]   （預設 5199，要先跑 npx vite --port 5199）
set -e
PORT="${1:-5199}"
OUT="$PWD/dev-tests/shot/i18n"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZE="${STB_SHOT_SIZE:-1680,1050}"
mkdir -p "$OUT"

# 章節 × 夾具：哪一章用哪個案子才有東西看
#   magicstone＝26 顆分鏡（24 有圖）、演員 6、場景 6   ← tone 不用（Armin：魔法石的 tone 不行）
#   callsheet ＝淨毒五郎水篇，2 個拍攝日 → 通告單／Rundown／甘特
#   小紅帽 3D 童書那組 2026-08-30 拿掉（Armin：小紅帽比較不適合）。夾具還在，
#   要救回來就把 board3d:redhood 加回 SHOTS，並跑 STB_DEMO_REDHOOD=1。
# 夾具檔名帶語系（dev-tests/make-demo.mjs 產的）＝介面與內容一起在地化
SHOTS="storyboard:magicstone actor:magicstone location:magicstone staff:magicstone agenda:magicstone schedule:callsheet"

node dev-tests/make-demo.mjs   # 每次先重產夾具，內容跟著語系走

for LANG in ${STB_SHOT_LANGS:-zh en ja}; do
  for S in $SHOTS; do
    CHAP="${S%%:*}"; DEMO="${S##*:}"
    # board3d 這類別名：章節仍是 storyboard，只是換夾具換檔名
    [ "$CHAP" = "board3d" ] && CHAP=storyboard && NAME=board3d || NAME="$CHAP"
    F="$OUT/${LANG}_${NAME}.png"
    "$CHROME" --headless --disable-gpu --hide-scrollbars \
      --virtual-time-budget=${STB_SHOT_WAIT:-12000} --window-size="$SIZE" \
      --screenshot="$F" \
      "http://localhost:$PORT/?lang=$LANG&demo=$DEMO.$LANG&chap=$CHAP" >/dev/null 2>&1
    printf "  %-3s %-11s %s\n" "$LANG" "$NAME" "$(du -h "$F" | cut -f1)"
  done
done
echo "→ $OUT"
