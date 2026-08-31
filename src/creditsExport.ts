// credits.json 匯出（`credits-spec.html` 的 v1 規格）。
// 刻意不 import Tauri／DOM，才跑得了 dev-tests/credits-json.ts。
import type { Project } from "./model";
import { canonRole, roleRank } from "./creditRoles";

/** credits.json（`credits-spec.html` 的 v1 規格；電話不進去——那是現場資訊不是名單）。 */
export function creditsJson(p: Project): string {
  const credits = [...p.contacts].sort((a, b) => roleRank(a.role) - roleRank(b.role))
    .filter((c) => c.name.trim())
    .map((c) => ({
      role: canonRole(c.role) || c.role,
      name: c.name.trim(),
      ...(c.ig ? { ig: c.ig } : {}),
    }));
  return JSON.stringify({
    version: 1,
    studio: { name: p.meta.client || "" },
    works: [{
      title: p.meta.title,
      date: new Date().toISOString().slice(0, 7),
      ...(p.meta.client ? { client: p.meta.client } : {}),
      public: false,          // STB 出的是製作中的案子，預設未公開；上線後自己改
      credits,
    }],
  }, null, 2);
}

