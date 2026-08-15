import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  formatName: string;
  sizeBytes: number;
}

function num(v: any): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function probeVideo(filePath: string): Promise<VideoMeta> {
  const { stdout } = await execFileP('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const info = JSON.parse(stdout);
  const fmt = info.format || {};
  const vstream = (info.streams || []).find((s: any) => s.codec_type === 'video') || {};
  let fps = 0;
  if (vstream.avg_frame_rate) {
    const parts = String(vstream.avg_frame_rate).split('/');
    if (parts.length === 2) fps = num(parts[0]) / (num(parts[1]) || 1);
    else fps = num(vstream.avg_frame_rate);
  }
  return {
    durationSec: Math.round(num(fmt.duration) * 100) / 100,
    width: num(vstream.width),
    height: num(vstream.height),
    fps: Math.round(fps * 100) / 100,
    codec: String(vstream.codec_name || ''),
    formatName: String(fmt.format_name || ''),
    sizeBytes: num(fmt.size),
  };
}

export interface FrameInfo {
  index: number;
  tSec: number;
  ts: string; // hh:mm:ss
  file: string; // absolute path
}

function fmtTs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

/**
 * 用 ffmpeg 按时间均匀抽取 count 张关键帧（不依赖视频原始帧率）。
 * 输出宽度上限 640，便于前端展示与 LLM 视觉识别。
 */
export async function extractFrames(
  filePath: string,
  outDir: string,
  count: number,
  durationSec: number
): Promise<FrameInfo[]> {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // 清空旧帧
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.jpg')) fs.unlinkSync(path.join(outDir, f));
  }
  const safeCount = Math.max(1, Math.min(count, 24));
  const fpsVal = safeCount / Math.max(durationSec, 0.1);
  await execFileP('ffmpeg', [
    '-y',
    '-i', filePath,
    '-vf', `fps=${fpsVal.toFixed(4)},scale='if(gt(iw,640),640,-1)':-1`,
    '-frames:v', String(safeCount),
    path.join(outDir, 'frame_%03d.jpg'),
  ]);
  const files = fs.readdirSync(outDir)
    .filter((f) => /^frame_\d+\.jpg$/.test(f))
    .sort();
  return files.map((f, i) => {
    const tSec = ((i + 0.5) * durationSec) / safeCount;
    return {
      index: i,
      tSec: Math.round(tSec * 100) / 100,
      ts: fmtTs(tSec),
      file: path.join(outDir, f),
    };
  });
}

/** 把图片读成 base64 dataURL（用于 LLM 视觉输入） */
export function imageToDataUrl(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
