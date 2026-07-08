import AVFoundation
import Foundation

// STB 匯出用小幫手（隨 app 打包的 sidecar）：
// 影片轉 720p H.264 mp4，可選首尾裁切——avconvert 做不到指定起點，
// 這裡用 AVAssetExportSession.timeRange 一次做掉「轉檔＋裁切」。
// 用法：stb-trim <src> <dst> [start end]（秒；省略或 end<=start＝整段）

let a = CommandLine.arguments
guard a.count >= 3 else {
  FileHandle.standardError.write("usage: stb-trim <src> <dst> [start end]\n".data(using: .utf8)!)
  exit(64)
}
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
guard let sess = AVAssetExportSession(asset: asset, presetName: AVAssetExportPreset1280x720) else {
  FileHandle.standardError.write("cannot create export session\n".data(using: .utf8)!)
  exit(2)
}
try? FileManager.default.removeItem(atPath: a[2])
sess.outputURL = URL(fileURLWithPath: a[2])
sess.outputFileType = .mp4
if a.count >= 5, let s = Double(a[3]), let e = Double(a[4]), e > s {
  sess.timeRange = CMTimeRange(
    start: CMTime(seconds: s, preferredTimescale: 600),
    end: CMTime(seconds: e, preferredTimescale: 600)
  )
}
let sem = DispatchSemaphore(value: 0)
sess.exportAsynchronously { sem.signal() }
sem.wait()
if sess.status != .completed {
  FileHandle.standardError.write("export failed: \(sess.error?.localizedDescription ?? "unknown")\n".data(using: .utf8)!)
  exit(1)
}
