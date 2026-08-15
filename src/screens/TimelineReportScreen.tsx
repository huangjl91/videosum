import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, ListTree, Clock, Bot, Database, ImageIcon, Tag } from 'lucide-react';
import { Task } from '../api';
import { sectionForFrame } from '../reportUtils';

interface Props {
  report: Task;
  onBack: () => void;
}

// 通用摘要的 Markdown 渲染样式：轻松卡片风，避免论文的严肃排版
const mdComponents = {
  p: ({ ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
  strong: ({ ...props }: any) => <strong className="font-semibold text-ink" {...props} />,
  ul: ({ ...props }: any) => <ul className="list-disc ml-5 mb-2" {...props} />,
  ol: ({ ...props }: any) => <ol className="list-decimal ml-5 mb-2" {...props} />,
  li: ({ ...props }: any) => <li className="mb-0.5" {...props} />,
  h1: ({ ...props }: any) => <h1 className="text-lg font-bold text-ink mt-2 mb-1" {...props} />,
  h2: ({ ...props }: any) => <h2 className="text-base font-bold text-ink mt-2 mb-1" {...props} />,
  h3: ({ ...props }: any) => <h3 className="text-[14px] font-semibold text-ink mt-1.5 mb-1" {...props} />,
  blockquote: ({ ...props }: any) => (
    <blockquote className="border-l-4 border-primary/30 pl-3 italic text-sub2 my-2" {...props} />
  ),
  code: ({ inline, ...props }: any) =>
    inline ? (
      <code className="bg-[#f3f4f6] px-1 rounded text-[12px]" {...props} />
    ) : (
      <code className="block bg-[#f3f4f6] p-2 rounded text-[12px] overflow-auto my-2" {...props} />
    ),
};

export default function TimelineReportScreen({ report, onBack }: Props) {
  const s = report.summary;
  if (!s) return null;
  const meta = report.meta;
  const frames = report.frames || [];
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 每张原始帧对应一个讲解卡片，与顶部缩略图严格 1:1 对齐。
  // 先算出每帧对应的“时间最近的 section”（用于取讲解文案）。
  const frameSectionIdx = frames.map((f) => sectionForFrame(s.sections, f.ts));

  // 顶部列出全部原始关键帧；点击第 i 张帧 → 直接滚动到第 i 个卡片，
  // 该卡片展示的就是第 i 张帧的截图 + 对应讲解，从根本上保证图文一致、不会错位。
  const scrollToFrame = (frameIdx: number) => {
    sectionRefs.current[frameIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="vs-fade p-6 max-w-[960px] mx-auto">
      <button
        onClick={onBack}
        className="text-[13px] text-sub2 hover:text-ink flex items-center gap-1 mb-3"
      >
        <ArrowLeft size={15} /> 返回报告库
      </button>

      {/* ===== 顶部：标题 + 总览 + 关键帧 strip ===== */}
      <div className="rounded-card bg-white border border-hairline/60 shadow-card p-5 mb-5">
        <div className="flex items-center gap-2 text-primary mb-2">
          <ListTree size={18} />
          <span className="text-[16px] font-semibold text-ink">通用分段摘要</span>
        </div>
        <div className="text-[12px] text-sub2 mb-3">
          {report.originalFilename}
          {meta ? ` · ${meta.width}×${meta.height} · ${meta.codec}` : ''}
        </div>

        <h1 className="text-[20px] font-bold text-ink mb-2">{s.title}</h1>
        <div className="text-[13px] text-ink2 leading-relaxed mb-4">
          <ReactMarkdown components={mdComponents}>{s.overview}</ReactMarkdown>
        </div>

        <div className="text-[12px] font-semibold text-ink mb-2 flex items-center gap-1.5">
          <ImageIcon size={14} /> 视频关键帧（共 {frames.length} 张，点击跳转到对应讲解）
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {frames.map((f, i) => (
            <button
              key={i}
              onClick={() => scrollToFrame(i)}
              className="shrink-0 group text-left"
            >
              <img
                src={f.url}
                alt={f.ts}
                className="w-32 h-20 object-cover rounded-btn border border-hairline/60 group-hover:border-primary transition-colors bg-black/5"
              />
              <div className="text-[11px] text-sub2 mt-1 font-mono">{f.ts}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== 主体：每张关键帧一个讲解卡片，与顶部缩略图 1:1 对应 ===== */}
      <div className="space-y-4">
        {frames.map((f, i) => {
          const secIdx = frameSectionIdx[i];
          const sec = s.sections[secIdx];
          return (
            <div
              key={i}
              ref={(el) => (sectionRefs.current[i] = el)}
              className="rounded-card bg-white border border-hairline/60 shadow-card p-5"
            >
              <div className="flex items-center gap-2 text-primary mb-3">
                <Clock size={15} />
                <span className="font-mono text-[12px]">{f.ts}</span>
                {sec?.title ? (
                  <span className="text-[14px] font-semibold text-ink">{sec.title}</span>
                ) : null}
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <figure className="md:w-[40%] shrink-0">
                  <img
                    src={f.url}
                    alt={f.ts}
                    className="w-full rounded-btn border border-hairline/60 object-cover max-h-56 bg-black/5"
                  />
                  <figcaption className="text-[11px] text-sub2 mt-1 text-center font-mono">
                    关键帧 {f.ts}
                  </figcaption>
                </figure>

                <div className="flex-1 min-w-0">
                  {sec ? (
                    <>
                      <div className="text-[13px] leading-relaxed text-ink2">
                        <ReactMarkdown components={mdComponents}>{sec.content}</ReactMarkdown>
                      </div>
                      {sec.bullets?.length ? (
                        <ul className="mt-3 ml-5 list-disc space-y-1">
                          {sec.bullets.map((b, j) => (
                            <li key={j} className="text-[12px] text-ink2">
                              {b}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-[13px] text-sub2">（该关键帧暂无对应讲解）</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 标签与来源 ===== */}
      {s.tags?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {s.tags.map((t, i) => (
            <span
              key={i}
              className="text-[12px] text-primary bg-[#EAF1FE] px-2.5 py-0.5 rounded-pill flex items-center gap-1"
            >
              <Tag size={11} />
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 text-[11px] text-sub2 flex items-center gap-1.5">
        {s.source === 'ai' ? <Bot size={13} /> : <Database size={13} />}
        {s.source === 'ai'
          ? `由 AI 视觉模型（${s.model || '未知'}）生成`
          : '基于视频元数据生成（未启用 AI 模型，画面内容需视觉模型识别）'}
      </div>
    </div>
  );
}
