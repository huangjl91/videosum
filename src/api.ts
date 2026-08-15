// 前端 API 客户端：开发模式连后端 3000，生产模式同源（相对路径）。
export type ReportType = 'comic' | 'paper' | 'timeline';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

async function req<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`请求失败 ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export interface FrameRef {
  index: number;
  ts: string;
  url: string;
}

export interface TaskLog {
  t: number;
  msg: string;
}

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  formatName: string;
  sizeBytes: number;
}

export interface SummarySection {
  title: string;
  ts?: string;
  content: string;
  /** 漫画分镜：说话角色 */
  role?: string;
  /** 漫画分镜：角色台词/对话 */
  dialogue?: string;
  /** 漫画分镜：旁白/画外音 */
  caption?: string;
  /** 漫画分镜：拟声词（如 嗖——、轰！、咔嚓） */
  sfx?: string;
  /** 论文/通用：章节下的分点要点或关键数据 */
  bullets?: string[];
}

export type ComicTheme =
  | 'drone'
  | 'space'
  | 'animal'
  | 'food'
  | 'history'
  | 'tech'
  | 'nature'
  | 'default';

export interface FrameNote {
  /** 该关键帧对应的时间 hh:mm:ss */
  ts: string;
  /** 对该关键帧画面的详细讲解 */
  note: string;
  /** 该关键帧画面下的分点要点 */
  bullets?: string[];
}

export interface SummaryResult {
  title: string;
  overview: string;
  sections: SummarySection[];
  tags: string[];
  type: 'comic' | 'paper' | 'timeline';
  source: 'ai' | 'metadata';
  model?: string;
  theme?: ComicTheme;
  /** AI 生成失败时记录的错误（此时已降级为基础模式） */
  aiError?: string;
  /** 逐帧详解：对每一张关键帧画面进行讲解，长度与关键帧数一致 */
  frameNotes?: FrameNote[];
  /** 逐帧详解数据来源：ai=AI完整返回；ai-incomplete=AI调用成功但frameNotes缺失/不足；ai-failed=AI调用失败降级；not-configured=未启用AI */
  frameNoteSource?: 'ai' | 'ai-incomplete' | 'ai-failed' | 'not-configured';
}

export interface Task {
  id: string;
  originalFilename: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'summarizing' | 'done' | 'error';
  stage: string;
  progress: number;
  logs: TaskLog[];
  createdAt: number;
  meta: VideoMeta | null;
  frames: FrameRef[];
  suggestedType: 'comic' | 'paper' | 'timeline' | null;
  type: 'comic' | 'paper' | 'timeline' | null;
  summary: SummaryResult | null;
  error?: string;
}

export interface ReportListItem {
  id: string;
  title: string;
  type: 'comic' | 'paper' | 'timeline';
  typeLabel: string;
  duration: string;
  createdAt: number;
  cover: string;
  status: string;
}

export interface LLMConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  model: string;
  maxFrames: number;
}

export function uploadVideo(file: File): Promise<{ id: string; filename: string }> {
  const fd = new FormData();
  fd.append('video', file);
  return fetch(BASE + '/api/upload', { method: 'POST', body: fd }).then(async (res) => {
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`上传失败 ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  });
}

export function getTask(id: string): Promise<Task> {
  return req<Task>(`/api/tasks/${id}`);
}

export function summarize(id: string, type: ReportType): Promise<{ ok: boolean }> {
  return req('/api/summarize', {
    method: 'POST',
    body: JSON.stringify({ id, type }),
  });
}

export function getReports(): Promise<{ reports: ReportListItem[] }> {
  return req('/api/reports');
}

export function getReport(id: string): Promise<{ report: Task }> {
  return req(`/api/reports/${id}`);
}

export function deleteReport(id: string): Promise<{ ok: boolean }> {
  return req(`/api/reports/${id}`, { method: 'DELETE' });
}

export function getConfig(): Promise<{ config: LLMConfig }> {
  return req('/api/config');
}

export function saveConfig(cfg: LLMConfig): Promise<{ ok: boolean; config: LLMConfig }> {
  return req('/api/config', { method: 'POST', body: JSON.stringify({ config: cfg }) });
}
