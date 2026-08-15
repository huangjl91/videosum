import { useEffect, useState } from 'react';
import { Film, Clock, Trash2, UploadCloud } from 'lucide-react';
import { getReports, deleteReport, ReportListItem } from '../api';

interface Props {
  onOpen: (id: string) => void;
  onUpload: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export default function LibraryScreen({ onOpen, onUpload }: Props) {
  const [list, setList] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getReports()
      .then((r) => setList(r.reports))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除该报告？视频文件也会一并删除。')) return;
    await deleteReport(id);
    load();
  };

  return (
    <div className="vs-fade p-6 max-w-[1184px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-semibold text-ink">报告库</div>
        <button
          onClick={onUpload}
          className="h-9 px-4 rounded-btn bg-primary hover:bg-[#1666cf] text-white text-[13px] font-medium flex items-center gap-1.5"
        >
          <UploadCloud size={15} /> 新建总结
        </button>
      </div>

      {loading ? (
        <div className="text-[13px] text-sub2 mt-6">加载中…</div>
      ) : list.length === 0 ? (
        <div className="mt-10 text-center text-sub2 text-[13px]">
          还没有报告。点击右上角「新建总结」上传视频开始处理。
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r) => (
            <div
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="rounded-card bg-white border border-hairline/60 shadow-card p-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-btn ${r.cover} flex items-center justify-center text-white shrink-0`}>
                  <Film size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-sub2 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> {r.typeLabel} · {r.duration} · {timeAgo(r.createdAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => remove(r.id, e)}
                  className="text-sub2 hover:text-red-500 shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
