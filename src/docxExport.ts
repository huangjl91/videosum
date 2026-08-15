// 论文报告 DOCX 导出：在前端（渲染进程）用 docx 库生成，并抓取关键帧图片内嵌。
// 生成的二进制通过 window.oc.invoke('export:docx') 交给主进程弹保存对话框写盘。
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import type { Task } from './api';

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';
const MAX_W = 460;

interface ImgData {
  data: Uint8Array;
  width: number;
  height: number;
}

async function fetchImage(url: string): Promise<ImgData | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const objUrl = URL.createObjectURL(new Blob([buf]));
    const dim = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = objUrl;
    });
    URL.revokeObjectURL(objUrl);
    return { data: buf, width: dim.w, height: dim.h };
  } catch {
    return null;
  }
}

function imgType(url: string): 'png' | 'jpg' {
  return /\.png($|\?)/i.test(url) ? 'png' : 'jpg';
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

function buildDocxFallbackNote(
  frame: { ts: string },
  index: number,
  total: number,
  durSec: number,
  theme?: string
): { note: string; bullets: string[] } {
  const dur = durSec || 1;
  const interval = dur / Math.max(1, total);
  const pct = Math.round((index / Math.max(1, total - 1)) * 100);
  let pos: string;
  if (index === 0) pos = '开篇引入段';
  else if (index === total - 1) pos = '收尾收束段';
  else if (pct < 35) pos = '前段铺垫';
  else if (pct < 70) pos = '中段核心展开';
  else pos = '后段深入与归纳';
  const note =
    `图 ${index + 1}（第 ${frame.ts} 秒关键帧）：本帧位于视频时间轴第 ${pct}% 的位置，属于「${pos}」。` +
    `它定格在时长 ${fmt(dur)} 的视频中 ${frame.ts} 处，与相邻关键帧构成均匀的时间采样网格，相邻帧间隔约 ${interval.toFixed(0)} 秒，` +
    `覆盖了 ${THEME_LABEL[theme || 'default'] || '本视频'} 主题的各环节。` +
    `当前未获得 AI 视觉模型的画面语义，因此无法自动识别该帧中的具体物体、文字、动作或数据；` +
    `但作为关键锚点，它可精确定位此刻的叙事节点，配合前后帧可还原时间脉络。` +
    `配置支持图片输入的视觉模型后重新生成报告，即可获得真实画面级解读。`;
  const bullets = [
    `时间位置：视频第 ${pct}% 处（${frame.ts}），属于 ${pos}`,
    `采样间隔：与相邻关键帧间隔约 ${interval.toFixed(0)} 秒，覆盖均匀`,
    `结构作用：作为第 ${index + 1}/${total} 个视觉锚点，承接上下文叙事`,
    '当前为结构讲解：配置视觉模型后可获得画面语义级解读',
  ];
  return { note, bullets };
}

export async function buildPaperDocx(report: Task): Promise<Uint8Array> {
  const s = report.summary;
  if (!s) throw new Error('报告尚未生成');
  const meta = report.meta;
  const dur = meta ? fmt(meta.durationSec) : '-';
  const baseName = report.originalFilename.replace(/\.[^.]+$/, '');
  const title = s.title || `基于多模态分析的《${baseName}》内容研究报告`;

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: 36 })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `视频名称：《${baseName}》`, italics: true, size: 24 })],
    })
  );
  if (meta) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `时长 ${dur} · 分辨率 ${meta.width}×${meta.height} · 编码 ${meta.codec} · 帧率 ${meta.fps}fps`,
            size: 20,
          }),
        ],
      })
    );
  }

  // 摘要
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '摘要', bold: true })] })
  );
  children.push(new Paragraph({ children: [new TextRun({ text: s.overview, size: 24 })] }));
  if (s.tags?.length) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '关键词：', bold: true, size: 22 }),
          new TextRun({ text: s.tags.join('；'), size: 22 }),
        ],
      })
    );
  }

  // 数据概览
  children.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '数据概览', bold: true })] })
  );
  if (meta) {
    const metrics =
      `时长 ${dur}；分辨率 ${meta.width}×${meta.height}；帧率 ${meta.fps} fps；编码 ${meta.codec || '未知'}；` +
      `封装 ${meta.formatName || '未知'}；文件体积约 ${((meta.sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB；` +
      `关键帧 ${report.frames.length} 张。`;
    children.push(new Paragraph({ children: [new TextRun({ text: metrics, size: 24 })] }));
  }

  // 关键帧详述：每一张关键帧都嵌入并配详细讲解（尽量用满每一张）
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: '关键帧详述', bold: true })],
    })
  );
  const src = s.frameNoteSource;
  let frameNoteAlert = '';
  if (src === 'ai-incomplete') {
    frameNoteAlert = `提示：已使用模型 ${s.model || ''} 生成报告，但返回的逐帧画面解读不完整。系统已保留模型返回的解读，并对缺失帧用时间轴结构讲解补齐；如需更完整的画面解读，请重新生成或更换为支持更长 JSON 输出的视觉模型。`;
  } else if (src === 'ai-failed') {
    frameNoteAlert = `提示：AI 返回解析失败，已降级为基础模式。降级原因：${(s.aiError || '未知错误').slice(0, 120)}。当前为基于时间轴的结构讲解。`;
  } else if (src === 'not-configured') {
    frameNoteAlert = '提示：当前未启用 AI 视觉模型。以下内容是基于时间轴自动生成的结构讲解；在「设置」配置支持图片输入的视觉模型后重新生成，可获得真实画面级解读。';
  } else if (!src || src !== 'ai') {
    frameNoteAlert = '提示：该报告生成于本次更新之前，尚无逐帧 AI 画面解读。以下内容是基于时间轴自动生成的结构讲解；配置视觉模型后重新生成可获得真实画面级解读。';
  }
  if (frameNoteAlert) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: frameNoteAlert,
            size: 20,
            color: '8a6d0b',
            italics: true,
          }),
        ],
      })
    );
  }

  const noteMap = new Map((s.frameNotes || []).map((n) => [n.ts, n]));
  for (let i = 0; i < report.frames.length; i++) {
    const f = report.frames[i];
    const aiNote = noteMap.get(f.ts);
    const fallback = buildDocxFallbackNote(f, i, report.frames.length, meta?.durationSec || 0, s.theme);
    const note = aiNote?.note?.trim() || fallback.note;
    const bullets = aiNote?.bullets?.length ? aiNote.bullets : fallback.bullets;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `帧 ${i + 1} 详解（${f.ts}）`, bold: true, size: 22, color: '1A73E8' })],
      })
    );
    const img = await fetchImage(BASE + f.url);
    if (img && img.width > 0) {
      const scale = Math.min(1, MAX_W / img.width);
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: imgType(f.url),
              data: img.data,
              transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
            }),
          ],
        })
      );
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `图 ${i + 1} 第 ${f.ts} 秒关键帧`, size: 18, italics: true })],
        })
      );
    }
    children.push(new Paragraph({ children: [new TextRun({ text: note, size: 22 })] }));
    for (const b of bullets) {
      children.push(
        new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun({ text: b, size: 22 })],
        })
      );
    }
  }

  // 章节正文（每章配对应关键帧图）
  for (let i = 0; i < s.sections.length; i++) {
    const sec = s.sections[i];
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: sec.title + (sec.ts ? `（${sec.ts}）` : ''), bold: true })],
      })
    );
    children.push(new Paragraph({ children: [new TextRun({ text: sec.content, size: 24 })] }));
    if (sec.bullets?.length) {
      for (const b of sec.bullets) {
        children.push(
          new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            children: [new TextRun({ text: b, size: 22 })],
          })
        );
      }
    }
    const fr = sec.ts
      ? report.frames.find((f) => f.ts === sec.ts) || report.frames[i % report.frames.length]
      : report.frames[i % report.frames.length];
    if (fr) {
      const img = await fetchImage(BASE + fr.url);
      if (img && img.width > 0) {
        const scale = Math.min(1, MAX_W / img.width);
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: imgType(fr.url),
                data: img.data,
                transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
              }),
            ],
          })
        );
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `图 ${report.frames.length + i + 1} 第 ${fr.ts} 秒关键帧（${sec.title}）`, size: 18, italics: true }),
            ],
          })
        );
      }
    }
  }

  // 脚注
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text:
            s.source === 'ai'
              ? `由 AI 视觉模型（${s.model || '未知'}）生成`
              : '基于视频元数据生成（基础模式，画面内容需视觉模型识别）' +
                (s.aiError ? ` · 降级原因：${s.aiError.slice(0, 60)}` : ''),
          size: 18,
          color: '888888',
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [{ children }],
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: 'bullet', text: '•', alignment: AlignmentType.LEFT }],
        },
      ],
    },
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
