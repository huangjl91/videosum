import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { getTask, Task } from '../api';

interface Props {
  taskId: string;
  onAnalyzed: () => void;
  onDone: (task: Task) => void;
  onCancel: () => void;
}

const STAGE_TEXT: Record<string, string> = {
  uploaded: '已接收文件',
  probe: '读取视频元信息',
  frames: '抽取关键帧',
  analyzed: '分析完成',
  summarize: '生成总结',
  done: '完成',
};

export default function ProcessingScreen({ taskId, onAnalyzed, onDone, onCancel }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fired = useRef<{ analyzed: boolean; done: boolean }>({ analyzed: false, done: false });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const t = await getTask(taskId);
        if (!alive) return;
        setTask(t);
        if (t.status === 'analyzed' && !fired.current.analyzed) {
          fired.current.analyzed = true;
          onAnalyzed();
        } else if (t.status === 'done' && !fired.current.done) {
          fired.current.done = true;
          onDone(t);
        } else if (t.status === 'error') {
          setError(t.error || '处理失败');
        }
      } catch (e: any) {
        if (alive) setError(e?.message || '获取任务状态失败');
      }
    };
    tick();
    const timer = setInterval(tick, 800);
    return () => { alive = false; clearInterval(timer); };
  }, [taskId]);

  const progress = task?.progress ?? 0;
  const stage = task ? STAGE_TEXT[task.stage] || task.stage : '准备中';

  return (
    <div className="vs-fade p-6 max-w-[820px] mx-auto">
      <div className="rounded-card bg-white border border-hairline/60 shadow-card p-7">
        <div className="flex items-center gap-3">
          {task?.status === 'error' ? (
            <AlertCircle className="text-red-500" size={22} />
          ) : task?.status === 'done' ? (
            <CheckCircle2 className="text-emerald-500" size={22} />
          ) : (
            <Loader2 className="text-primary animate-spin" size={22} />
          )}
          <div>
            <div className="text-[15px] font-semibold text-ink">{stage}</div>
            <div className="text-[12px] text-sub2">{task?.originalFilename}</div>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-sub2 hover:text-ink flex items-center gap-1 text-[12px]"
          >
            <X size={14} /> 取消
          </button>
        </div>

        <div className="mt-5 h-2 rounded-pill bg-[#EEF2F8] overflow-hidden">
          <div
            className="h-full rounded-pill bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-sub2">{progress}%</div>

        <div className="mt-5 space-y-1.5">
          {(task?.logs || []).map((l, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-ink2">
              <span className="text-sub2 shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
              <span>{l.msg}</span>
            </div>
          ))}
          {!task && <div className="text-[12px] text-sub2">正在连接后端…</div>}
        </div>

        {error && (
          <div className="mt-4 rounded-btn bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
