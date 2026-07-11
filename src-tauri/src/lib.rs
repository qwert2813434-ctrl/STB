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

// project.json 的最後修改時間（毫秒）——前端輪詢它偵測「外部編輯」
// （AI／文字編輯器改了檔案 → App 自動重載，讓 GPT/Claude 能直接駕駛案子）
#[tauri::command]
fn project_mtime(dir: String) -> Result<u64, String> {
  let path = Path::new(&dir).join("project.json");
  let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
  let mtime = meta
    .modified()
    .map_err(|e| e.to_string())?
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0);
  Ok(mtime)
}

// 列出資料夾下的所有案子（iPad 專案管理頁的來源：掃真實檔案，
// 在「檔案」App 裡增刪的案子清單即時反映，不靠 localStorage 記憶）
#[derive(serde::Serialize)]
struct ProjectEntry {
  dir: String,
  title: String,
  mtime: u64,
}

#[tauri::command]
fn list_projects(parent: String) -> Result<Vec<ProjectEntry>, String> {
  let mut out: Vec<ProjectEntry> = Vec::new();
  let rd = match fs::read_dir(&parent) {
    Ok(r) => r,
    Err(_) => return Ok(out), // 資料夾還不存在＝還沒有案子
  };
  for entry in rd.flatten() {
    let p = entry.path();
    let pj = p.join("project.json");
    if !pj.is_file() {
      continue;
    }
    let title = fs::read_to_string(&pj)
      .ok()
      .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
      .and_then(|v| {
        v.get("meta")
          .and_then(|m| m.get("title"))
          .and_then(|t| t.as_str())
          .map(String::from)
      })
      .filter(|s| !s.is_empty())
      .unwrap_or_else(|| {
        p.file_name()
          .and_then(|n| n.to_str())
          .unwrap_or("未命名案子")
          .to_string()
      });
    let mtime = fs::metadata(&pj)
      .ok()
      .and_then(|m| m.modified().ok())
      .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|d| d.as_millis() as u64)
      .unwrap_or(0);
    out.push(ProjectEntry { dir: p.to_string_lossy().to_string(), title, mtime });
  }
  out.sort_by(|a, b| b.mtime.cmp(&a.mtime));
  Ok(out)
}

// 整個資料夾搬家（iPad 一次性遷移：過渡存檔住 App 內部空間，
// 「檔案」App 看不到 → 搬進 Documents）。來源不存在或目的已存在＝不動。
#[tauri::command]
fn move_dir(src: String, dst: String) -> Result<bool, String> {
  let s = Path::new(&src);
  let d = Path::new(&dst);
  if !s.is_dir() || d.exists() {
    return Ok(false);
  }
  if let Some(parent) = d.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::rename(s, d).map_err(|e| format!("搬移失敗：{}", e))?;
  Ok(true)
}

// iOS 分享面板：把匯出的檔案寫進暫存，彈原生 UIActivityViewController——
// AirDrop／存到檔案／LINE 都從這裡出去（iOS 沒有「另存到哪」對話框）。
// 用 objc2 動態呼叫，免寫 Swift 插件；iPad 必設 popover 錨點否則閃退。
#[cfg(target_os = "ios")]
mod ios_share {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject, Bool};

  #[repr(C)]
  #[derive(Clone, Copy)]
  pub struct CGPoint { pub x: f64, pub y: f64 }
  #[repr(C)]
  #[derive(Clone, Copy)]
  pub struct CGSize { pub width: f64, pub height: f64 }
  #[repr(C)]
  #[derive(Clone, Copy)]
  pub struct CGRect { pub origin: CGPoint, pub size: CGSize }
  unsafe impl objc2::Encode for CGPoint {
    const ENCODING: objc2::Encoding = objc2::Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
  }
  unsafe impl objc2::Encode for CGSize {
    const ENCODING: objc2::Encoding = objc2::Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
  }
  unsafe impl objc2::Encode for CGRect {
    const ENCODING: objc2::Encoding = objc2::Encoding::Struct("CGRect", &[CGPoint::ENCODING, CGSize::ENCODING]);
  }

  pub unsafe fn present(path: &str) {
    let ns_string = AnyClass::get("NSString").unwrap();
    let cpath = std::ffi::CString::new(path).unwrap();
    let ns_path: *mut AnyObject = msg_send![ns_string, stringWithUTF8String: cpath.as_ptr()];
    let ns_url = AnyClass::get("NSURL").unwrap();
    let url: *mut AnyObject = msg_send![ns_url, fileURLWithPath: ns_path];
    let ns_array = AnyClass::get("NSArray").unwrap();
    let items: *mut AnyObject = msg_send![ns_array, arrayWithObject: url];

    let avc_cls = AnyClass::get("UIActivityViewController").unwrap();
    let avc: *mut AnyObject = msg_send![avc_cls, alloc];
    let nil_acts: *mut AnyObject = std::ptr::null_mut();
    let avc: *mut AnyObject = msg_send![avc, initWithActivityItems: items, applicationActivities: nil_acts];

    let app_cls = AnyClass::get("UIApplication").unwrap();
    let shared: *mut AnyObject = msg_send![app_cls, sharedApplication];
    let mut window: *mut AnyObject = msg_send![shared, keyWindow];
    if window.is_null() {
      let windows: *mut AnyObject = msg_send![shared, windows];
      window = msg_send![windows, firstObject];
    }
    let root: *mut AnyObject = if window.is_null() { std::ptr::null_mut() } else { msg_send![window, rootViewController] };
    if !root.is_null() {
      // iPad：popover 錨在畫面中央
      let pop: *mut AnyObject = msg_send![avc, popoverPresentationController];
      if !pop.is_null() {
        let view: *mut AnyObject = msg_send![root, view];
        let bounds: CGRect = msg_send![view, bounds];
        let anchor = CGRect {
          origin: CGPoint { x: bounds.size.width / 2.0, y: bounds.size.height / 2.0 },
          size: CGSize { width: 1.0, height: 1.0 },
        };
        let _: () = msg_send![pop, setSourceView: view];
        let _: () = msg_send![pop, setSourceRect: anchor];
      }
      let nil_done: *mut AnyObject = std::ptr::null_mut();
      let _: () = msg_send![root, presentViewController: avc, animated: Bool::YES, completion: nil_done];
    }
    // 放掉 alloc/init 的 +1（呈現機制自己會持有；同 pick_photos 的 leak 修正）
    let _: () = msg_send![avc, release];
  }
}

// iOS 原生照片選擇器（PHPickerViewController）：iCloud 空殼問題的根治——
// 系統選擇器自己把雲端原檔下載完才交檔案，App 拿到的永遠是完整檔。
// 同 ios_share 走 objc2 動態呼叫；delegate 用 declare_class 宣告，
// 檔案由 loadFileRepresentation 給（回呼結束系統即刪暫存，必須當場拷走）。
#[cfg(target_os = "ios")]
mod ios_photos {
  use block2::RcBlock;
  use objc2::rc::Id;
  use objc2::runtime::{AnyClass, AnyObject, Bool, NSObject};
  use objc2::{declare_class, msg_send, msg_send_id, mutability, ClassType, DeclaredClass};
  use std::cell::RefCell;
  use std::sync::mpsc::Sender;
  use std::sync::{Arc, Mutex};

  pub struct Ivars {
    tx: RefCell<Option<Sender<Vec<String>>>>,
  }

  declare_class!(
    pub struct PickerDelegate;

    unsafe impl ClassType for PickerDelegate {
      type Super = NSObject;
      type Mutability = mutability::InteriorMutable;
      const NAME: &'static str = "STBPickerDelegate";
    }

    impl DeclaredClass for PickerDelegate {
      type Ivars = Ivars;
    }

    unsafe impl PickerDelegate {
      // 使用者「點選單外側／往下滑」關掉（不按取消）：iOS 不叫 didFinishPicking，
      // 走這條——沒送過結果就送空清單，前端的等待與 toast 才會收工。
      #[method(presentationControllerDidDismiss:)]
      fn did_dismiss(&self, _pc: *mut AnyObject) {
        if let Some(tx) = self.ivars().tx.borrow_mut().take() {
          let _ = tx.send(Vec::new());
        }
      }

      #[method(picker:didFinishPicking:)]
      fn did_finish(&self, picker: *mut AnyObject, results: *mut AnyObject) {
        unsafe {
          let nil: *mut AnyObject = std::ptr::null_mut();
          let _: () = msg_send![picker, dismissViewControllerAnimated: Bool::YES, completion: nil];
          let Some(tx) = self.ivars().tx.borrow_mut().take() else { return };
          let count: usize = msg_send![results, count];
          if count == 0 {
            let _ = tx.send(Vec::new()); // 取消／沒選＝空清單
            return;
          }
          // 本輪暫存區：每次選照片先清空重建，不讓舊檔累積
          let out_dir = std::env::temp_dir().join("stb_picked");
          let _ = std::fs::remove_dir_all(&out_dir);
          let _ = std::fs::create_dir_all(&out_dir);
          // (每格結果, 已完成數, 出口)——回呼在系統背景佇列，用鎖收攏
          let state = Arc::new(Mutex::new((vec![None::<String>; count], 0usize, Some(tx))));
          let finish_one = |st: &Arc<Mutex<(Vec<Option<String>>, usize, Option<Sender<Vec<String>>>)>>, i: usize, saved: Option<String>| {
            let mut g = st.lock().unwrap();
            g.0[i] = saved;
            g.1 += 1;
            if g.1 == count {
              if let Some(tx) = g.2.take() {
                let list: Vec<String> = g.0.iter().flatten().cloned().collect();
                let _ = tx.send(list);
              }
            }
          };
          for i in 0..count {
            let item: *mut AnyObject = msg_send![results, objectAtIndex: i];
            let provider: *mut AnyObject = msg_send![item, itemProvider];
            let type_img = ns_string("public.image");
            let has: Bool = msg_send![provider, hasItemConformingToTypeIdentifier: type_img];
            if provider.is_null() || !has.as_bool() {
              finish_one(&state, i, None);
              continue;
            }
            let st = state.clone();
            let od = out_dir.clone();
            let block = RcBlock::new(move |url: *mut AnyObject, _err: *mut AnyObject| {
              let mut saved = None;
              if !url.is_null() {
                let p: *mut AnyObject = msg_send![url, path];
                if !p.is_null() {
                  let c: *const std::os::raw::c_char = msg_send![p, UTF8String];
                  let src = std::ffi::CStr::from_ptr(c).to_string_lossy().to_string();
                  let fname = std::path::Path::new(&src)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("photo.jpg");
                  let dst = od.join(format!("{:03}_{}", i, fname));
                  if std::fs::copy(&src, &dst).is_ok() {
                    saved = Some(dst.to_string_lossy().to_string());
                  }
                }
              }
              let mut g = st.lock().unwrap();
              g.0[i] = saved;
              g.1 += 1;
              if g.1 == count {
                if let Some(tx) = g.2.take() {
                  let list: Vec<String> = g.0.iter().flatten().cloned().collect();
                  let _ = tx.send(list);
                }
              }
            });
            let _: () = msg_send![provider, loadFileRepresentationForTypeIdentifier: type_img, completionHandler: &*block];
          }
        }
      }
    }
  );

  impl PickerDelegate {
    fn new(tx: Sender<Vec<String>>) -> Id<Self> {
      let this = Self::alloc().set_ivars(Ivars { tx: RefCell::new(Some(tx)) });
      unsafe { msg_send_id![super(this), init] }
    }
  }

  unsafe fn ns_string(s: &str) -> *mut AnyObject {
    let cls = AnyClass::get("NSString").unwrap();
    let c = std::ffi::CString::new(s).unwrap();
    msg_send![cls, stringWithUTF8String: c.as_ptr()]
  }

  extern "C" {
    // delegate 是弱引用：掛到 picker 的關聯物件上保命（picker 活多久它活多久）
    fn objc_setAssociatedObject(
      object: *mut AnyObject,
      key: *const std::os::raw::c_void,
      value: *mut AnyObject,
      policy: usize,
    );
  }
  static ASSOC_KEY: u8 = 0;

  pub unsafe fn present(tx: Sender<Vec<String>>, limit: usize) {
    let Some(cfg_cls) = AnyClass::get("PHPickerConfiguration") else { return }; // 沒連 PhotosUI＝tx 落地回空
    let cfg: *mut AnyObject = msg_send![cfg_cls, alloc];
    let cfg: *mut AnyObject = msg_send![cfg, init];
    let _: () = msg_send![cfg, setSelectionLimit: limit as isize]; // 0＝不限張數
    if let Some(filter_cls) = AnyClass::get("PHPickerFilter") {
      let img_filter: *mut AnyObject = msg_send![filter_cls, imagesFilter];
      let _: () = msg_send![cfg, setFilter: img_filter];
    }

    let Some(picker_cls) = AnyClass::get("PHPickerViewController") else { return };
    let picker: *mut AnyObject = msg_send![picker_cls, alloc];
    let picker: *mut AnyObject = msg_send![picker, initWithConfiguration: cfg];

    let delegate = PickerDelegate::new(tx);
    let del_ptr = Id::as_ptr(&delegate) as *mut AnyObject;
    objc_setAssociatedObject(picker, &ASSOC_KEY as *const u8 as *const _, del_ptr, 1); // RETAIN_NONATOMIC
    let _: () = msg_send![picker, setDelegate: del_ptr];
    // 滑掉/點外側關閉的通知走 presentationController 的 delegate
    let pc: *mut AnyObject = msg_send![picker, presentationController];
    if !pc.is_null() {
      let _: () = msg_send![pc, setDelegate: del_ptr];
    }

    let app_cls = AnyClass::get("UIApplication").unwrap();
    let shared: *mut AnyObject = msg_send![app_cls, sharedApplication];
    let mut window: *mut AnyObject = msg_send![shared, keyWindow];
    if window.is_null() {
      let windows: *mut AnyObject = msg_send![shared, windows];
      window = msg_send![windows, firstObject];
    }
    let root: *mut AnyObject = if window.is_null() { std::ptr::null_mut() } else { msg_send![window, rootViewController] };
    if !root.is_null() {
      let nil_done: *mut AnyObject = std::ptr::null_mut();
      let _: () = msg_send![root, presentViewController: picker, animated: Bool::YES, completion: nil_done];
    }
    // 放掉我們 alloc/init 拿到的 +1（畫面呈現本身會持有 picker）——
    // 之前漏了這個 release：滑掉選單時 picker 永遠不死 → delegate 不死 →
    // channel 不關 → 前端「正在準備照片…」永遠掛著（Armin 抓到的卡死）。
    // 沒呈現成功的話這裡就是最後一個引用，picker 連同 delegate 一起釋放，
    // channel 斷線＝前端收到空清單，一樣收得了工。
    let _: () = msg_send![picker, release];
    let _: () = msg_send![cfg, release];
  }
}

// 選照片（iOS）：彈原生 PHPicker → 回傳拷進暫存的檔案路徑清單。
// limit 0＝不限張數；取消＝空清單。等待走 blocking pool，不卡 UI。
#[tauri::command]
async fn pick_photos(app: tauri::AppHandle, limit: usize) -> Result<Vec<String>, String> {
  #[cfg(target_os = "ios")]
  {
    let (tx, rx) = std::sync::mpsc::channel::<Vec<String>>();
    app
      .run_on_main_thread(move || unsafe { ios_photos::present(tx, limit) })
      .map_err(|e| e.to_string())?;
    let paths = tauri::async_runtime::spawn_blocking(move || rx.recv().unwrap_or_default())
      .await
      .map_err(|e| e.to_string())?;
    Ok(paths)
  }
  #[cfg(not(target_os = "ios"))]
  {
    let _ = (app, limit);
    Err("原生照片選擇器僅 iOS 提供".into())
  }
}

// 匯出的統一出口（iOS 分享面板／桌面開檔）：寫進暫存 → 交給系統
#[tauri::command]
fn share_export(app: tauri::AppHandle, name: String, b64: String) -> Result<(), String> {
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(b64.as_bytes())
    .map_err(|e| format!("檔案解碼失敗：{}", e))?;
  let path = std::env::temp_dir().join(&name);
  fs::write(&path, bytes).map_err(|e| format!("寫入暫存失敗：{}", e))?;
  #[cfg(target_os = "ios")]
  {
    let p = path.to_string_lossy().to_string();
    app
      .run_on_main_thread(move || unsafe { ios_share::present(&p) })
      .map_err(|e| e.to_string())?;
  }
  #[cfg(not(target_os = "ios"))]
  {
    let _ = &app;
    std::process::Command::new("open")
      .arg(&path)
      .spawn()
      .map(|_| ())
      .map_err(|e| format!("開啟失敗：{}", e))?;
  }
  Ok(())
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
    .invoke_handler(tauri::generate_handler![save_project, load_project, import_asset, read_asset, read_file, save_file, open_path, video_for_embed, save_as, project_mtime, share_export, list_projects, move_dir, pick_photos])
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
