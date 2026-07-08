use base64::Engine;
use std::fs;
use std::path::Path;

// 案子＝一個資料夾；真相檔＝ {folder}/project.json。
// 第一版整份 JSON 自含（分鏡圖為 data URL 內嵌）；抽出 assets/ 檔案留後續。

#[tauri::command]
fn save_project(dir: String, contents: String) -> Result<(), String> {
  let folder = Path::new(&dir);
  fs::create_dir_all(folder).map_err(|e| e.to_string())?;
  fs::write(folder.join("project.json"), contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_project(dir: String) -> Result<String, String> {
  let path = Path::new(&dir).join("project.json");
  fs::read_to_string(&path).map_err(|e| format!("讀取 {} 失敗：{}", path.display(), e))
}

// 另存新檔：把案子完整複製到新資料夾——寫入當前內容的 project.json，
// 並連 assets/（影片等素材）一起帶走，新資料夾就是獨立完整的案子。
// 防呆：目標資料夾已有 project.json 就擋（避免蓋掉別的案子）。
#[tauri::command]
fn save_as(src_dir: Option<String>, dst_dir: String, contents: String) -> Result<(), String> {
  let dst = Path::new(&dst_dir);
  if dst.join("project.json").exists() {
    return Err("目標資料夾已有案子（project.json）——請選空資料夾或新建一個。".into());
  }
  fs::create_dir_all(dst).map_err(|e| e.to_string())?;
  fs::write(dst.join("project.json"), contents).map_err(|e| e.to_string())?;
  if let Some(s) = src_dir {
    let src_assets = Path::new(&s).join("assets");
    if src_assets.is_dir() {
      copy_dir(&src_assets, &dst.join("assets"))?;
    }
  }
  Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> Result<(), String> {
  fs::create_dir_all(dst).map_err(|e| e.to_string())?;
  for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let to = dst.join(entry.file_name());
    if entry.path().is_dir() {
      copy_dir(&entry.path(), &to)?;
    } else {
      fs::copy(entry.path(), &to).map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

// 讀案子裡的檔案原始 bytes（影片播放用：前端轉 Blob URL 餵 <video>，
// 不走 asset protocol——WKWebView 對自訂協定的影片串流不可靠且失敗無聲）
#[tauri::command]
fn read_asset(dir: String, rel: String) -> Result<tauri::ipc::Response, String> {
  let path = Path::new(&dir).join(&rel);
  let bytes = fs::read(&path).map_err(|e| format!("讀取 {} 失敗：{}", path.display(), e))?;
  Ok(tauri::ipc::Response::new(bytes))
}

// 讀任意路徑的檔案 bytes（「＋ 加入檔案」選了圖片時，給前端轉 Blob 餵裁切器）
#[tauri::command]
fn read_file(path: String) -> Result<tauri::ipc::Response, String> {
  let bytes = fs::read(&path).map_err(|e| format!("讀取 {} 失敗：{}", path, e))?;
  Ok(tauri::ipc::Response::new(bytes))
}

// 把外部檔案（影片等）複製進案子 assets/，回傳相對路徑 "assets/檔名"
#[tauri::command]
fn import_asset(dir: String, src: String) -> Result<String, String> {
  let assets = Path::new(&dir).join("assets");
  fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
  let src_path = Path::new(&src);
  let stem = src_path.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
  let ext = src_path.extension().and_then(|s| s.to_str()).unwrap_or("mp4");
  let ts = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let name = format!("{}_{}.{}", stem, ts, ext);
  fs::copy(src_path, assets.join(&name)).map_err(|e| e.to_string())?;
  Ok(format!("assets/{}", name))
}

// 匯出檔案（PDF/PPTX）：前端組好檔案轉 base64，這裡解碼寫到選定路徑。
// （WKWebView 的 window.print() 是空操作，故不走系統列印面板。）
#[tauri::command]
fn save_file(path: String, b64: String) -> Result<(), String> {
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(b64.as_bytes())
    .map_err(|e| format!("檔案解碼失敗：{}", e))?;
  fs::write(&path, bytes).map_err(|e| format!("寫入 {} 失敗：{}", path, e))
}

// 匯出 PPTX 的影片嵌入前處理：
// - 有首尾裁切 → 隨附的 stb-trim（AVFoundation）轉 720p＋裁切一次做掉
// - 無裁切、小檔且已是 mp4 → 原 bytes 直接回
// - 無裁切、過大或 .mov 容器 → stb-trim 整段轉；沒有 sidecar 時退 avconvert
// （Armin 實案：參考影片是 118MB .mov＋裁切段，直接嵌會爆檔且裁切會不見。）
#[tauri::command]
fn video_for_embed(
  dir: String, rel: String, max_mb: u64,
  trim_start: Option<f64>, trim_end: Option<f64>,
) -> Result<tauri::ipc::Response, String> {
  let src = Path::new(&dir).join(&rel);
  let meta = fs::metadata(&src).map_err(|e| format!("讀取 {} 失敗：{}", src.display(), e))?;
  let lower = rel.to_lowercase();
  let is_mp4 = lower.ends_with(".mp4") || lower.ends_with(".m4v");
  let has_trim = matches!((trim_start, trim_end), (Some(s), Some(e)) if e > s);
  if !has_trim && is_mp4 && meta.len() <= max_mb * 1024 * 1024 {
    let bytes = fs::read(&src).map_err(|e| e.to_string())?;
    return Ok(tauri::ipc::Response::new(bytes));
  }
  let ts = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let tmp = std::env::temp_dir().join(format!("stb_embed_{}.mp4", ts));

  // 首選：隨 app 打包的 stb-trim（externalBin，與主程式同目錄）
  let mut done = false;
  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir_) = exe.parent() {
      let helper = dir_.join("stb-trim");
      if helper.exists() {
        let mut cmd = std::process::Command::new(&helper);
        cmd.arg(&src).arg(&tmp);
        if has_trim {
          cmd.arg(trim_start.unwrap().to_string()).arg(trim_end.unwrap().to_string());
        }
        done = cmd.status().map(|s| s.success()).unwrap_or(false);
      }
    }
  }
  // 備援：系統 avconvert（只能整段轉，裁切段會遺失——記錄用）
  if !done {
    let status = std::process::Command::new("avconvert")
      .arg("--preset").arg("Preset1280x720")
      .arg("--source").arg(&src)
      .arg("--output").arg(&tmp)
      .arg("--replace")
      .status()
      .map_err(|e| format!("avconvert 啟動失敗：{}", e))?;
    if !status.success() {
      let _ = fs::remove_file(&tmp);
      return Err(format!("影片轉檔失敗（{}）", rel));
    }
  }
  let bytes = fs::read(&tmp).map_err(|e| e.to_string())?;
  let _ = fs::remove_file(&tmp);
  Ok(tauri::ipc::Response::new(bytes))
}

// 開啟已匯出的檔案：直接走 macOS `open`。
// （不用 opener plugin 的 openPath——它有路徑 scope 限制，曾讓匯出在最後一步失敗。）
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
  std::process::Command::new("open")
    .arg(&path)
    .spawn()
    .map(|_| ())
    .map_err(|e| format!("開啟 {} 失敗：{}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![save_project, load_project, import_asset, read_asset, read_file, save_file, open_path, video_for_embed, save_as])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
