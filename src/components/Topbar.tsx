import { Search, HelpCircle, Bell } from 'lucide-react';

interface Props {
  title: string;
}

export default function Topbar({ title }: Props) {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-hairline flex items-center justify-between px-5">
      <h1 className="text-[16px] font-semibold text-ink">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="w-64 h-9 rounded-pill bg-canvas border border-hairline flex items-center gap-2 px-3 text-sub2">
          <Search size={15} />
          <input
            className="bg-transparent outline-none text-[13px] text-ink placeholder:text-sub2 w-full"
            placeholder="搜索报告、视频或模板…"
          />
        </div>
        <button className="w-9 h-9 rounded-full hover:bg-canvas flex items-center justify-center text-sub2">
          <HelpCircle size={18} />
        </button>
        <button className="relative w-9 h-9 rounded-full hover:bg-canvas flex items-center justify-center text-sub2">
          <Bell size={18} />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#22d3ee] text-white flex items-center justify-center text-[13px] font-medium">
          黄
        </div>
      </div>
    </header>
  );
}
