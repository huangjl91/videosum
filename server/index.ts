import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  DATA_DIR,
  getSetting,
  setSetting,
  getTask,
  saveTask,
  getAllTasks,
  deleteTask,
} from './db.js';
import { probeVideo, extractFrames, FrameInfo } from './video.js';
import {
  summarizeWithLLM,
  buildFallbackSummary,
  LLMConfig,
  ReportType,
  SummaryResult,
} from './llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

// 关键帧等静态资源
app.use('/files', express.static(UPLOADS_DIR));

const TYPE_LABEL: Record<ReportType, string> = {
  comic: '科普漫画',
  paper: '科研论文',
  timeline: '通用摘要',
};
const COVER: Record<ReportType, string> = {
  comic: 'bg-[#1A73E8]',
  paper: 'bg-[#7C3AED]',
  timeline: 'bg-[#0EA5E9]',
};

function now() {
  return Date.now();
}

function loadLLMConfig(): LLMConfig {
  const raw = getSetting('llmConfig');
  const def: LLMConfig = {
    enabled: false,
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxFrames: 6,
  };
  if (!raw) return def;
  try {
    return { ...def, ...JSON.parse(raw) };
  } catch {
    return def;
  }
}

function suggestType(filename: string, durationSec: number): ReportType {
  const f = filename.toLowerCase();
  if (/(论文|科研|research|paper|综述|实验|学术)/.test(f)) return 'paper';
  if (/(漫画|科普|comic|卡通|趣说|动画)/.test(f)) return 'comic';
  if (durationSec > 600) return 'paper';
  if (durationSec < 90) return 'comic';
  return 'timeline';
}

function pushLog(task: any, msg: string) {
  if (!task.logs) task.logs = [];
  task.logs.push({ t: now(), msg });
}

// ===== 上传 =====
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req: any, _file, cb) => cb(null, `${req.taskId}.mp4`),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

app.post('/api/upload', (req: any, res, next) => {
  req.taskId = crypto.randomUUID();
  upload.single('video')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err?.message || '上传失败' });
    if (!req.file) return res.status(400).json({ error: '未收到视频文件' });
    const task = {
      id: req.taskId,
      originalFilename: req.file.originalname,
      videoPath: req.file.path,
      status: 'uploaded',
      stage: 'uploaded',
      progress: 0,
      logs: [{ t: now(), msg: `已接收文件：${req.file.originalname}` }],
      createdAt: now(),
      meta: null,
      frames: [],
      suggestedType: null,
      type: null,
      summary: null,
    };
    saveTask(task);
    // 异步开始分析
    analyzeJob(req.taskId).catch((e) => console.error('[analyze]', e));
    res.json({ id: req.taskId, filename: req.file.originalname });
  });
});

async function analyzeJob(id: string) {
  const task = getTask(id);
  if (!task) return;
  task.status = 'analyzing';
  task.stage = 'probe';
  task.progress = 10;
  pushLog(task, '正在读取视频元信息（ffprobe）…');
  saveTask(task);
  const meta = await probeVideo(task.videoPath);
  task.meta = meta;
  task.progress = 35;
  task.stage = 'frames';
  const dur = (meta.durationSec || 0).toString();
  pushLog(task, `元信息：时长 ${dur}s，分辨率 ${meta.width}×${meta.height}，${meta.codec} 编码`);
  saveTask(task);

  const frameDir = path.join(UPLOADS_DIR, id, 'frames');
  const count = Math.min(12, Math.max(8, Math.round(meta.durationSec / 12) || 8));
  pushLog(task, `正在均匀抽取 ${count} 张关键帧（ffmpeg）…`);
  const frames: FrameInfo[] = await extractFrames(task.videoPath, frameDir, count, meta.durationSec);
  task.frames = frames.map((f) => ({
    index: f.index,
    ts: f.ts,
    url: `/files/${id}/frames/${path.basename(f.file)}`,
  }));
  task.progress = 70;
  task.suggestedType = suggestType(task.originalFilename, meta.durationSec);
  pushLog(task, `已抽取 ${frames.length} 张关键帧，建议报告类型：${TYPE_LABEL[task.suggestedType]}`);
  task.status = 'analyzed';
  task.stage = 'analyzed';
  task.progress = 100;
  pushLog(task, '分析完成，请在类型确认页选择报告模板');
  saveTask(task);
}

// ===== 任务状态 =====
app.get('/api/tasks/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

// ===== 生成总结 =====
app.post('/api/summarize', async (req, res) => {
  const id = String(req.body?.id || '');
  const type = (req.body?.type as ReportType) || 'comic';
  const task = getTask(id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'analyzed') {
    return res.status(409).json({ error: '任务尚未完成分析', status: task.status });
  }
  task.type = type;
  task.status = 'summarizing';
  task.stage = 'summarize';
  task.progress = 10;
  pushLog(task, `开始生成「${TYPE_LABEL[type]}」总结…`);
  saveTask(task);
  // 异步执行
  summarizeJob(id, type).catch((e) => {
    const t = getTask(id);
    if (t) {
      t.status = 'error';
      t.error = e?.message || String(e);
      pushLog(t, '总结生成失败：' + (e?.message || String(e)));
      saveTask(t);
    }
  });
  res.json({ ok: true });
});

async function summarizeJob(id: string, type: ReportType) {
  const task = getTask(id);
  if (!task) return;
  const cfg = loadLLMConfig();
  task.progress = 40;
  let summary: SummaryResult | undefined;
  let aiError: string | undefined;
  let reason: 'not-configured' | 'ai-failed' = 'not-configured';
  const frames = rebuildFrames(task);

  if (cfg.enabled && cfg.apiKey && cfg.baseURL && cfg.model) {
    reason = 'ai-failed';
    pushLog(task, `调用 AI 视觉模型（${cfg.model}）生成总结…`);
    saveTask(task);
    try {
      summary = await summarizeWithLLM(
        task.originalFilename,
        task.meta,
        frames,
        type,
        cfg
      );
      pushLog(task, 'AI 总结生成完成');
    } catch (e: any) {
      // 任何 AI 错误（网络/超时/JSON 解析失败）都降级，绝不让报告挂掉
      aiError = e?.message || String(e);
      pushLog(task, '⚠ AI 生成失败，已自动降级为基础模式：' + aiError);
    }
  } else {
    pushLog(task, '未配置 AI 模型，基于视频元数据生成结构摘要');
  }

  if (!summary) {
    summary = buildFallbackSummary(task.originalFilename, task.meta, frames, type, {
      reason,
      aiError,
    });
    if (aiError) summary.aiError = aiError;
    summary.source = 'metadata';
  }
  task.summary = summary;
  task.status = 'done';
  task.stage = 'done';
  task.progress = 100;
  saveTask(task);
}

// 把存储的相对 url 还原成 FrameInfo（供 LLM 读取本地图）
function rebuildFrames(task: any): FrameInfo[] {
  const id = task.id;
  return (task.frames || []).map((f: any) => ({
    index: f.index,
    tSec: 0,
    ts: f.ts,
    file: path.join(UPLOADS_DIR, id, 'frames', path.basename(f.url)),
  }));
}

// ===== 报告库 =====
app.get('/api/reports', (_req, res) => {
  const list = getAllTasks().map((t) => ({
    id: t.id,
    title: t.summary?.title || t.originalFilename.replace(/\.[^.]+$/, ''),
    type: t.type || t.suggestedType || 'timeline',
    typeLabel: TYPE_LABEL[(t.type || t.suggestedType || 'timeline') as ReportType],
    duration: t.meta ? fmtDur(t.meta.durationSec) : '-',
    createdAt: t.createdAt,
    cover: COVER[(t.type || t.suggestedType || 'timeline') as ReportType],
    status: t.status,
  }));
  res.json({ reports: list });
});

app.get('/api/reports/:id', (req, res) => {
  const t = getTask(req.params.id);
  if (!t) return res.status(404).json({ error: '报告不存在' });
  res.json({ report: t });
});

app.delete('/api/reports/:id', (req, res) => {
  const ok = deleteTask(req.params.id);
  // 同时删除文件
  try {
    fs.rmSync(path.join(UPLOADS_DIR, req.params.id), { recursive: true, force: true });
    fs.rmSync(path.join(UPLOADS_DIR, req.params.id + '.mp4'), { force: true });
  } catch {
    /* ignore */
  }
  res.json({ ok });
});

// ===== AI 模型配置 =====
app.get('/api/config', (_req, res) => {
  res.json({ config: loadLLMConfig() });
});
app.post('/api/config', (req, res) => {
  const c = req.body?.config;
  if (!c || typeof c !== 'object') return res.status(400).json({ error: '缺少配置' });
  const clean: LLMConfig = {
    enabled: !!c.enabled,
    baseURL: String(c.baseURL || 'https://api.openai.com/v1'),
    apiKey: String(c.apiKey || ''),
    model: String(c.model || 'gpt-4o-mini'),
    maxFrames: Number(c.maxFrames || 6),
  };
  setSetting('llmConfig', JSON.stringify(clean));
  res.json({ ok: true, config: clean });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', t: now() }));

function fmtDur(sec: number): string {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

// 生产环境：托管前端构建产物
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

export function startServer(preferredPort: number = Number(process.env.PORT) || 3000) {
  return new Promise<{ server: any; port: number }>((resolve, reject) => {
    const tryListen = (port: number) => {
      const server = app.listen(port, () => {
        const actual = (server.address() as any)?.port ?? port;
        console.log(`\n◆ VideoSum 后端已启动: http://localhost:${actual}`);
        resolve({ server, port: actual });
      });
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err && err.code === 'EADDRINUSE' && port !== 0) {
          console.warn(`[server] 端口 ${port} 被占用，改用 OS 自动选择空闲端口`);
          tryListen(0);
        } else {
          reject(err);
        }
      });
    };
    tryListen(preferredPort);
  });
}

// 非 Electron 环境（如本地 node 直接运行调试）自动启动；Electron 主进程会显式调用 startServer。
if (!process.versions.electron) {
  startServer(3000).catch((e) => {
    console.error('[server] 启动失败:', e);
    process.exit(1);
  });
}
