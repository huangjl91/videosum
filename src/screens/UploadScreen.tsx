import { useRef, useState } from 'react';
import { UploadCloud, Sparkles, FileText, Download, Film, Loader2 } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
  onOpenLibrary: () => void;
}

const FEATURES = [
  { icon: Sparkles, title: '真实抽帧分析', desc: '后端用 ffmpeg 按时间均匀抽取关键帧，读取真实时长 / 分辨率 / 编码' },
  { icon: FileText, title: '多模板报告', desc: '科普漫画、科研论文、通用分段摘要，由 AI 视觉模型生成结构化总结' },
  { icon: Download, title: '本地存储', desc: '视频与报告均保存在本机用户目录，不上传第三方' },
];

const ACCEPT = '.mp4,.mov,.mkv,.webm,.avi,.flv';

export default function UploadScreen({ onUpload, onOpenLibrary }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<File | null>(null);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) setPending(f);
  };

  const submit = () => {
    if (pending) onUpload(pending);
  };

  return (
    <div className="vs-fade p-6 max-w-[1184px] mx-auto">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        className={`cursor-pointer rounded-card border-2 border-dashed py-10 flex flex-col items-center text-center transition-colors ${
          drag ? 'border-primary bg-[#F5F9FF]' : 'border-[#C9D4E6] bg-white hover:border-primary hover:bg-[#F5F9FF]'
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-[#EAF1FE] flex items-center justify-center text-primary mb-3">
          <UploadCloud size={26} />
        </div>
        <div className="text-[16px] font-semibold text-ink">拖拽视频到此处，或点击上传</div>
        <div className="text-[13px] text-sub2 mt-1">支持 MP4 / MOV / MKV / WebM / AVI，单个文件最大 2 GB</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
        <button
          type="button"
          className="mt-4 h-9 px-5 rounded-btn bg-primary hover:bg-[#1666cf] text-white text-[13px] font-medium transition-colors"
          onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        >
          选择视频文件
        </button>
      </div>

      {pending && (
        <div className="mt-4 rounded-card bg-white border border-hairline/60 shadow-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-btn bg-[#EAF1FE] text-primary flex items-center justify-center shrink-0">
            <Film size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-ink truncate">{pending.name}</div>
            <div className="text-[11px] text-sub2">{(pending.size / 1024 / 1024).toFixed(1)} MB · 已就绪，点击开始处理</div>
          </div>
          <button
            onClick={submit}
            className="h-9 px-5 rounded-btn bg-primary hover:bg-[#1666cf] text-white text-[13px] font-medium flex items-center gap-1.5"
          >
            开始处理 <Loader2 size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-card bg-white border border-hairline/60 shadow-card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-btn bg-[#EAF1FE] text-primary flex items-center justify-center shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-ink">{f.title}</div>
                <div className="text-[12px] text-sub2 mt-0.5 leading-snug">{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[14px] font-semibold text-ink">报告库</div>
          <button onClick={onOpenLibrary} className="text-[12px] text-primary hover:underline">
            查看全部
          </button>
        </div>
        <div className="rounded-card bg-white border border-hairline/60 shadow-card p-4 text-[13px] text-sub2">
          处理完成的视频总结会保存在本机，可在「报告库」中随时查看与导出。
        </div>
      </div>
    </div>
  );
}
