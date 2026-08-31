# contact-roundtrip.ts — 舊檔往返測試

動 `Contact`／`normalizeProject` 之後必跑。驗「舊案存回去 byte-identical」這條鐵則。

```bash
npx tsx dev-tests/contact-roundtrip.ts \
  "../範例案子_中性示範/project.json" \
  "../_測試沙盒/沙盒案_示範/project.json"
```

**已知的既有差異（不是你改壞的）**：範例檔沒有 `films` 欄 → 每跑一次 `newId()` 都給新 id；
部分沙盒檔的縮排與 `logo` 欄本來就跟 `normalizeProject` 的輸出不同。
要驗自己的改動有沒有影響，正確做法是**比對改動前後兩份輸出**，不是比對原始檔：

```bash
git stash push -q src/model.ts && npx tsx dev-tests/dump.ts <檔> > /tmp/before.txt
git stash pop -q            && npx tsx dev-tests/dump.ts <檔> > /tmp/after.txt
diff <(sed -E 's/"(id|filmId)": "[a-z0-9]{8,}"/"\1": "X"/g' /tmp/before.txt) \
     <(sed -E 's/"(id|filmId)": "[a-z0-9]{8,}"/"\1": "X"/g' /tmp/after.txt)
```
