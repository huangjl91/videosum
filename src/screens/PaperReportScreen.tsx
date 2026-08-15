import { useState } from 'react';
import { ArrowLeft, Bot, Database, BarChart3, Clock, Film, Gauge, FileDown, AlertTriangle } from 'lucide-react';
import type { Task, ComicTheme } from '../api';
import { frameForSection } from '../reportUtils';
import { buildPaperDocx } from '../docxExport';

interface Props {
  report: Task;
  onBack: () => void;
}

// 仿《机械设计》核心期刊字体体系（Windows 系统字体）
const FONT = {
  song: `'宋体','SimSun','Songti SC','FangSong',serif`, // 正文：书宋/宋体
  hei: `'黑体','SimHei','Heiti SC','Microsoft YaHei',sans-serif`, // 标题：黑体
  fang: `'仿宋','FangSong','FangSong_GB2312','STFangsong',serif`, // 摘要/图题表题：仿宋
  kai: `'楷体','KaiTi','Kaiti SC',serif`, // 作者/单位：楷体
  tnr: `'Times New Roman',Times,serif`, // 英文/数字
};

function tsToSec(ts?: string): number {
  if (!ts) return 0;
  const p = ts.split(':').map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/** 视频参数指标卡 */
function MetricTiles({ meta, frameCount }: { meta: Task['meta']; frameCount: number }) {
  const items = [
    { icon: Clock, label: '时长', value: meta ? fmt(meta.durationSec) : '-' },
    { icon: Film, label: '分辨率', value: meta ? `${meta.width}×${meta.height}` : '-' },
    { icon: Gauge, label: '帧率', value: meta ? `${meta.fps} fps` : '-' },
    { icon: BarChart3, label: '编码', value: meta?.codec || '-' },
    { icon: Film, label: '关键帧', value: `${frameCount} 张` },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {items.map((it, i) => (
        <div key={i} className="border border-[#cfd4da] bg-[#fbfcfd] px-3 py-2.5">
          <div className="text-[11px] text-[#666]" style={{ fontFamily: FONT.fang }}>
            {it.label}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <it.icon size={14} className="text-[#1A73E8]" />
            <span className="text-[14px] font-bold text-[#1a1a1a]" style={{ fontFamily: FONT.tnr }}>
              {it.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 关键帧时间轴（SVG） */
function FrameTimeline({ meta, frames }: { meta: Task['meta']; frames: Task['frames'] }) {
  const dur = meta?.durationSec || 1;
  const W = 760;
  const H = 56;
  const pad = 12;
  const trackW = W - pad * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: FONT.tnr }}>
      <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#cfd4da" strokeWidth={2} />
      {/* 起点/终点 */}
      <circle cx={pad} cy={H / 2} r={3} fill="#1A73E8" />
      <circle cx={W - pad} cy={H / 2} r={3} fill="#1A73E8" />
      {frames.map((f, i) => {
        const x = pad + (tsToSec(f.ts) / dur) * trackW;
        return (
          <g key={i}>
            <circle cx={x} cy={H / 2} r={4.5} fill="#fff" stroke="#1A73E8" strokeWidth={2} />
            <text x={x} y={H / 2 - 9} fontSize={9} fill="#444" textAnchor="middle">
              {f.ts}
            </text>
          </g>
        );
      })}
      <text x={pad} y={H - 4} fontSize={9} fill="#888">0:00</text>
      <text x={W - pad} y={H - 4} fontSize={9} fill="#888" textAnchor="end">
        {fmt(dur)}
      </text>
    </svg>
  );
}

/** 章节篇幅分布（SVG 横向条形） */
function SectionBars({ sections }: { sections: any[] }) {
  const data = sections.map((s: any, i: number) => ({
    label: `第${i + 1}节`,
    len: (s.content?.length || 0) + (s.bullets?.join('')?.length || 0),
    title: s.title,
  }));
  const max = Math.max(1, ...data.map((d: any) => d.len));
  const rowH = 22;
  const labelW = 38;
  const W = 760;
  const H = data.length * rowH + 6;
  const barArea = W - labelW - 70;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: FONT.tnr }}>
      {data.map((d: any, i: number) => {
        const y = i * rowH + 4;
        const w = Math.max(4, (d.len / max) * barArea);
        return (
          <g key={i}>
            <text x={0} y={y + 14} fontSize={10} fill="#444">{d.label}</text>
            <rect x={labelW} y={y + 4} width={barArea} height={14} fill="#eef1f5" />
            <rect x={labelW} y={y + 4} width={w} height={14} fill="#1A73E8" />
            <text x={labelW + barArea + 6} y={y + 14} fontSize={10} fill="#666">{d.len}字</text>
          </g>
        );
      })}
    </svg>
  );
}

function fmt(sec: number): string {
  const s = Math.floor(sec || 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const THEME_LABEL: Record<string, string> = {
  drone: '无人机/航拍',
  space: '太空/天文',
  animal: '动物/生物',
  food: '美食/烹饪',
  history: '历史/文物',
  tech: '科技/编程/AI',
  nature: '自然/地理',
  default: '该科普',
};

/** 旧报告或降级报告没有 frameNotes 时，为每帧生成一段相对丰富的结构讲解 + 要点 */
function buildLocalFallbackNote(
  frame: Task['frames'][number],
  index: number,
  total: number,
  meta: Task['meta'],
  theme?: ComicTheme
) {
  const dur = meta?.durationSec || 1;
  const interval = dur / Math.max(1, total);
  const pct = Math.round((index / Math.max(1, total - 1)) * 100);
  let pos: string;
  if (index === 0) pos = '开篇引入段';
  else if (index === total - 1) pos = '收尾收束段';
  else if (pct < 35) pos = '前段铺垫';
  else if (pct < 70) pos = '中段核心展开';
  else pos = '后段深入与归纳';
  const themeLabel = THEME_LABEL[theme || 'default'] || '本视频';
  const note =
    `图 ${index + 1}（第 ${frame.ts} 秒关键帧）：本帧位于视频时间轴第 ${pct}% 的位置，属于「${pos}」。` +
    `从整体结构看，它定格在时长 ${fmt(dur)} 的视频中 ${frame.ts} 处，与相邻关键帧共同构成均匀的时间采样网格，相邻帧间隔约 ${interval.toFixed(0)} 秒，` +
    `说明抽帧策略稳定覆盖了 ${themeLabel} 主题的各环节。` +
    `由于当前报告生成时未获得 AI 视觉模型的画面语义（可能是更新前生成或模型未启用），该帧的具体像素内容（人物、物体、文字、动作、数据）暂时无法自动识别；` +
    `但作为关键锚点，该帧可用于精确定位视频在此刻的叙事节点，配合前后帧即可还原内容的时间脉络与节奏。` +
    `建议在「设置」中配置支持图片输入的视觉模型后重新生成报告，即可获得该画面中真实的场景、对象与信息解读。`;
  const bullets = [
    `时间位置：视频第 ${pct}% 处（${frame.ts}），属于 ${pos}`,
    `采样间隔：与相邻关键帧间隔约 ${interval.toFixed(0)} 秒，覆盖均匀`,
    `结构作用：作为第 ${index + 1}/${total} 个视觉锚点，承接上下文叙事`,
    '当前为结构讲解：配置视觉模型后可获得画面语义级解读',
  ];
  return { note, bullets };
}

/** 关键帧详述：每一张关键帧都展示并配详细讲解（仿第二张图：图 + 正文 + bullets） */
function FrameDetailSection({
  report,
}: {
  report: Task;
}) {
  const { frames, summary: s } = report;
  const meta = report.meta;
  if (!frames?.length) return null;

  const frameNotes = s?.frameNotes;
  const src = s?.frameNoteSource;

  // 提示条文案：直接用后端给出的 frameNoteSource 做精准提示，避免“已配置却显示未启用”的误导
  let alert: { title: string; body: string } | null = null;
  if (src === 'ai-incomplete') {
    alert = {
      title: 'AI 模型已启用，但逐帧解读返回不完整',
      body: `已使用模型 ${s?.model || ''} 生成报告，但返回的 frameNotes 数量不足或部分为空。系统已保留模型返回的解读，并对缺失帧用时间轴结构讲解补齐。如需更完整的画面解读，请尝试重新生成或更换为支持更长 JSON 输出的视觉模型（如 GPT-4o、通义千问 VL-Max）。`,
    };
  } else if (src === 'ai-failed') {
    alert = {
      title: 'AI 返回解析失败，已降级为基础模式',
      body: `降级原因：${(s?.aiError || '未知错误').slice(0, 120)}。当前显示的是基于时间轴的自动结构讲解；请检查模型配置或网络后重新生成。`,
    };
  } else if (src === 'not-configured') {
    alert = {
      title: '当前未启用 AI 视觉模型',
      body: '在「设置」中配置支持图片输入的视觉模型（如 GPT-4o、通义千问 VL-Max）后，重新上传视频并生成论文报告，即可获得真实画面级解读。',
    };
  } else if (!src || src !== 'ai') {
    // 旧报告（更新前生成）没有 frameNoteSource 字段
    alert = {
      title: '当前报告尚无逐帧 AI 画面解读',
      body: '该报告生成于本次更新之前。如需真实画面级解读，请在「设置」配置支持图片输入的视觉模型后，重新上传视频并生成论文报告。',
    };
  }

  // 按帧时间戳配对 note；缺 note 时用本地生成器补一段更丰富的兜底
  const noteMap = new Map((frameNotes || []).map((n) => [n.ts, n]));
  // 若本次有 AI 逐帧解读且数量少于抽帧总数（论文按设置仅发送部分帧给模型），只渲染被模型真正解读的前 N 张，
  // 避免把未解读帧的本地兜底混进“逐帧解读”造成空话观感
  const renderFrames =
    frameNotes && frameNotes.length > 0 && frameNotes.length < frames.length
      ? frames.slice(0, frameNotes.length)
      : frames;
  const details = renderFrames.map((f, i) => {
    const ai = noteMap.get(f.ts);
    const fallback = buildLocalFallbackNote(f, i, frames.length, meta, s?.theme);
    return {
      frame: f,
      note: ai?.note?.trim() || fallback.note,
      bullets: ai?.bullets?.length ? ai.bullets : fallback.bullets,
    };
  });

  return (
    <div className="mt-5">
      {alert ? (
        <div className="mb-3 px-3 py-2.5 rounded bg-[#fff8e6] border border-[#f0d78c] text-[#8a6d0b] flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="text-[12px] leading-relaxed">
            <div className="font-bold">{alert.title}</div>
            <div>{alert.body}</div>
          </div>
        </div>
      ) : null}
      <div className="text-[12px] text-[#555] mb-3" style={{ fontFamily: FONT.fang }}>
        图3 视频关键帧详述（共 {renderFrames.length} 张，逐帧解读）
      </div>
      <div className="space-y-6">
        {details.map((d, i) => (
          <div
            key={i}
            className="flex flex-col md:flex-row gap-4 border border-[#e4e8ee] bg-[#fcfdfe] p-3"
          >
            <figure className="md:w-[42%] flex flex-col items-center shrink-0">
              <img
                src={d.frame.url}
                alt={d.frame.ts}
                className="w-full max-h-56 object-contain border border-[#ccc] bg-white"
              />
              <figcaption
                className="text-[10.5px] text-[#666] mt-1 text-center"
                style={{ fontFamily: FONT.fang }}
              >
                图 3.{i + 1} 第 {d.frame.ts} 秒关键帧
              </figcaption>
            </figure>
            <div className="md:flex-1">
              <div
                className="text-[13px] font-bold text-[#1A73E8] mb-1.5"
                style={{ fontFamily: FONT.hei }}
              >
                帧 {i + 1} 详解（{d.frame.ts}）
              </div>
              <p
                className="text-[12.5px] leading-[1.95] text-[#222] text-justify"
                style={{ textIndent: '2em', fontFamily: FONT.song }}
              >
                {d.note}
              </p>
              {d.bullets?.length ? (
                <ul className="mt-2 ml-6 list-disc space-y-0.5">
                  {d.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="text-[12px] leading-relaxed text-[#333]"
                      style={{ fontFamily: FONT.song }}
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaperReportScreen({ report, onBack }: Props) {
  const s = report.summary;
  if (!s) return null;
  const meta = report.meta;
  const dur = meta ? fmt(meta.durationSec) : '-';
  const title = s.title || report.originalFilename.replace(/\.[^.]+$/, '');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  async function handleExportDocx() {
    setExporting(true);
    setExportMsg(null);
    try {
      const buf = await buildPaperDocx(report);
      const safeName = (report.originalFilename.replace(/\.[^.]+$/, '') || 'report') + '_论文报告.docx';
      const res = (await (window as any).oc.invoke('export:docx', { filename: safeName, buffer: buf })) || {};
      if (res.canceled) {
        // 用户取消保存，不提示
      } else if (!res.ok) {
        setExportMsg('导出失败，请重试');
      } else {
        setExportMsg(`已导出：${res.filePath || safeName}`);
      }
    } catch (e: any) {
      setExportMsg('导出失败：' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="vs-fade p-6 max-w-[920px] mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="text-[13px] text-sub2 hover:text-ink flex items-center gap-1"
        >
          <ArrowLeft size={15} /> 返回报告库
        </button>
        <div className="flex items-center gap-3">
          {exportMsg ? (
            <span className="text-[12px] text-[#1a7f37] max-w-[280px] truncate" title={exportMsg}>
              {exportMsg}
            </span>
          ) : null}
          <button
            onClick={handleExportDocx}
            disabled={exporting}
            className="text-[13px] flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#cfd4da] bg-white hover:bg-[#f3f6fb] text-[#1a1a1a] disabled:opacity-60"
          >
            <FileDown size={15} /> {exporting ? '导出中…' : '导出 DOCX'}
          </button>
        </div>
      </div>

      {/* A4 风格论文页 */}
      <div
        className="bg-white border border-[#d9dde3] shadow-card px-12 py-10 text-[#1a1a1a]"
        style={{ fontFamily: FONT.song }}
      >
        {/* 题名 */}
        <h1
          className="text-center text-[22px] font-bold leading-snug"
          style={{ fontFamily: FONT.hei }}
        >
          {title}
        </h1>
        {/* 作者 / 视频信息（楷体，居中） */}
        <div
          className="text-center text-[13px] mt-2 text-[#333]"
          style={{ fontFamily: FONT.kai }}
        >
          视频名称：《{report.originalFilename.replace(/\.[^.]+$/, '')}》
        </div>
        <div
          className="text-center text-[12px] mt-0.5 text-[#666]"
          style={{ fontFamily: FONT.kai }}
        >
          {meta
            ? `时长 ${dur} · 分辨率 ${meta.width}×${meta.height} · ${meta.codec} · 帧率 ${meta.fps}fps`
            : '视频参数解析中'}
        </div>

        {/* 摘要（仿宋） */}
        <div className="mt-6" style={{ fontFamily: FONT.fang }}>
          <div className="text-[14px] font-bold" style={{ fontFamily: FONT.hei }}>
            摘要
          </div>
          <p className="text-[12.5px] leading-[1.9] mt-1 text-[#222]">{s.overview}</p>
        </div>

        {/* 关键词（仿宋） */}
        {s.tags?.length ? (
          <div className="mt-2 text-[12.5px] text-[#222]" style={{ fontFamily: FONT.fang }}>
            <span className="font-bold" style={{ fontFamily: FONT.hei }}>关键词：</span>
            {s.tags.join('；')}
          </div>
        ) : null}

        {/* ===== 数据可视化 ===== */}
        <div className="mt-7 border-t border-[#e2e6ea] pt-5">
          <div
            className="text-[14px] font-bold mb-3"
            style={{ fontFamily: FONT.hei }}
          >
            数据概览
          </div>
          <MetricTiles meta={meta} frameCount={report.frames.length} />
          <div className="mt-5">
            <div className="text-[12px] text-[#555] mb-1" style={{ fontFamily: FONT.fang }}>
              图1 关键帧时间轴分布
            </div>
            <FrameTimeline meta={meta} frames={report.frames} />
          </div>
          <div className="mt-5">
            <div className="text-[12px] text-[#555] mb-1" style={{ fontFamily: FONT.fang }}>
              图2 各章节内容篇幅分布
            </div>
            <SectionBars sections={s.sections} />
          </div>
          <FrameDetailSection report={report} />
        </div>

        {/* ===== 章节正文 ===== */}
        <div className="mt-7 border-t border-[#e2e6ea] pt-5 space-y-5">
          {s.sections.map((sec, i) => {
            // 有 ts 时按时间匹配最近帧；无 ts 时按章节序号循环分配，保证每章都有图且不重复挤第一张
            const fr = sec.ts
              ? frameForSection(report.frames, sec)
              : report.frames.length
              ? report.frames[i % report.frames.length]
              : null;
            return (
              <section key={i}>
                <h2
                  className="text-[15px] font-bold"
                  style={{ fontFamily: FONT.hei }}
                >
                  {sec.title}
                  {sec.ts ? (
                    <span className="text-[12px] font-normal text-[#888]">
                      {' '}（{sec.ts}）
                    </span>
                  ) : null}
                </h2>
                <p
                  className="text-[13px] leading-[1.95] mt-1.5 text-[#222] text-justify"
                  style={{ textIndent: '2em', fontFamily: FONT.song }}
                >
                  {sec.content}
                </p>
                {sec.bullets?.length ? (
                  <ul className="mt-1.5 ml-7 list-disc space-y-0.5">
                    {sec.bullets.map((b, j) => (
                      <li
                        key={j}
                        className="text-[12.5px] leading-relaxed text-[#333]"
                        style={{ fontFamily: FONT.song }}
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fr && (
                  <figure className="mt-3 flex flex-col items-center">
                    <img
                      src={fr.url}
                      alt={sec.ts || `frame-${i}`}
                      className="max-h-52 border border-[#ccc]"
                    />
                    <figcaption
                      className="text-[11px] text-[#666] mt-1"
                      style={{ fontFamily: FONT.fang }}
                    >
                      图 {i + 1} 第 {fr.ts} 秒关键帧（{sec.title}）
                    </figcaption>
                  </figure>
                )}
              </section>
            );
          })}
        </div>

        {/* 脚注 */}
        <div
          className="mt-7 text-[11px] text-[#888] flex items-center gap-1.5 border-t border-[#eee] pt-3"
          style={{ fontFamily: FONT.fang }}
        >
          {s.source === 'ai' ? <Bot size={13} /> : <Database size={13} />}
          {s.source === 'ai'
            ? `由 AI 视觉模型（${s.model || '未知'}）生成`
            : '基于视频元数据生成（基础模式，画面内容需视觉模型识别）'}
          {s.aiError ? ` · 降级原因：${s.aiError.slice(0, 60)}` : ''}
        </div>
      </div>
    </div>
  );
}
