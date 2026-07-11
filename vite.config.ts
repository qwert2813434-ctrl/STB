import { defineConfig } from "vite";

// TAURI_DEV_HOST＝Tauri CLI 在跑 iOS/Android 真機開發時注入的 Mac 區網 IP——
// dev server 要綁在上面，iPad 才連得到熱更新。桌面開發時維持 localhost。
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 5174 }
      : undefined,
  },
});
