import { useEffect, useState } from 'react';
import { Sparkles, FileText, ListTree, Film, Clock, Check } from 'lucide-react';
import { getTask, Task, ReportType } from '../api';

interface Props {
  taskId: string;
  onChoose: (type: ReportType) => void;
}

const OPTIONS: { type: ReportType; label: string; desc: string; icon: any }[] = [
  { type: 'comic', label: '科普漫画', desc: '以分镜 + 文案呈现，适合科普 / 趣味内容', icon: Sparkles },
  { type: 'paper', label: '科研论文', desc: '章节化结构，适合教学 / 学术复盘', icon: FileText },
  { type: 'timeline', label: '通用摘要', desc: '按时间线分段，适合长视频速览', icon: ListTree },
];

function fmtDur(sec: number): string {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

export default function TypeDetectScreen({ taskId, onChoose }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [pick, setPick] = useState<ReportType | null>(null);

  useEffect(() => {
    getTask(taskId).then(setTask).catch(() => {});
  }, [taskId]);

  const suggested = task?.suggestedType || 'timeline';
  const meta = task?.meta;

  return (
    <div className="vs-fade p-6 max-w-[1000px] mx-auto">
      <div className="text-[15px] font-semibold text-ink">类型识别确认</div>
      <div className="text-[13px] text-sub2 mt-1">
        系统已分析视频并建议报告类型，你可采纳建议或手动切换。
      </div>

      {meta && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { k: '时长', v: fmtDur(meta.durationSec) },
            { k: '分辨率', v: `${meta.width}×${meta.height}` },
            { k: '帧率', v: `${meta.fps} fps` },
            { k: '编码', v: meta.codec || '-' },
          ].map((m) => (
            <div key={m.k} className="rounded-card bg-white border border-hairline/60 shadow-card p-3">
              <div className="text-[11px] text-sub2">{m.k}</div>
              <div className="text-[14px] font-semibold text-ink mt-0.5">{m.v}</div>
            </div>
          ))}
        </div>
      )}

      {task?.frames?.length ? (
        <div className="mt-4">
          <div className="text-[13px] font-medium text-ink2 mb-2 flex items-center gap-1.5">
            <Film size={14} /> 抽取的关键帧（{task.frames.length} 张）
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {task.frames.map((f) => (
              <div key={f.index} className="rounded-btn overflow-hidden border border-hairline/60 bg-black">
                <img src={f.url} alt={f.ts} className="w-full h-14 object-cover" />
                <div className="text-[10px] text-center text-white bg-black/60 -mt-4 relative">{f.ts}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-4">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const active = pick === o.type;
          const isSuggested = suggested === o.type;
          return (
            <button
              key={o.type}
              onClick={() => setPick(o.type)}
              className={`text-left rounded-card border p-4 transition-colors ${
                active ? 'border-primary bg-[#F5F9FF] shadow-card' : 'border-hairline/60 bg-white hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-btn bg-[#EAF1FE] text-primary flex items-center justify-center">
                  <Icon size={18} />
                </div>
                {isSuggested && (
                  <span className="text-[11px] text-primary bg-[#EAF1FE] px-2 py-0.5 rounded-pill">建议</span>
                )}
              </div>
              <div className="text-[14px] font-semibold text-ink mt-2">{o.label}</div>
              <div className="text-[12px] text-sub2 mt-0.5 leading-snug">{o.desc}</div>
              {active && <div className="mt-2 text-[12px] text-primary flex items-center gap-1"><Check size={13} /> 已选择</div>}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          disabled={!pick}
          onClick={() => pick && onChoose(pick)}
          className="h-10 px-6 rounded-btn bg-primary hover:bg-[#1666cf] disabled:opacity-50 text-white text-[13px] font-medium"
        >
          生成总结
        </button>
        <span className="text-[12px] text-sub2">
          {pick ? `将生成「${OPTIONS.find((o) => o.type === pick)?.label}」报告` : '请先选择一种报告类型'}
        </span>
      </div>
    </div>
  );
}
