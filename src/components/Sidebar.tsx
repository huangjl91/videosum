import { Upload, ListChecks, Library, LayoutTemplate, Settings, Plus, LucideIcon } from 'lucide-react';
import { ViewKey } from '../types';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { key: 'upload', label: '上传视频', icon: Upload },
  { key: 'tasks', label: '任务中心', icon: ListChecks },
  { key: 'library', label: '报告库', icon: Library },
  { key: 'templates', label: '模板中心', icon: LayoutTemplate },
  { key: 'settings', label: '设置', icon: Settings },
];

interface Props {
  active: ViewKey;
  onNav: (v: ViewKey) => void;
  onNew: () => void;
}

export default function Sidebar({ active, onNav, onNew }: Props) {
  return (
    <aside className="w-56 shrink-0 h-full bg-sidebar flex flex-col">
      {/* 品牌 */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-hairline/70">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-[15px] shadow-sm">
          V
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-ink">VideoSum</div>
          <div className="text-[11px] text-sub2">自动视频总结</div>
        </div>
      </div>

      {/* 新建 CTA */}
      <div className="px-3 pt-3">
        <button
          onClick={onNew}
          className="w-full h-10 rounded-pill bg-primary hover:bg-[#1666cf] text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus size={16} /> 新建总结
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-2.5 mt-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const on = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNav(item.key)}
              className={[
                'w-full h-10 px-3 rounded-btn flex items-center gap-3 text-[13px] transition-colors',
                on ? 'bg-primary text-white' : 'text-sub hover:bg-white/70',
              ].join(' ')}
            >
              <Icon size={17} className={on ? 'text-white' : 'text-sub2'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* 用量卡片 */}
      <div className="mx-3 mb-3 rounded-card bg-white p-3 shadow-card border border-hairline/60">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-sub2">本月用量</span>
          <span className="text-ink2 font-medium">18 / 30</span>
        </div>
        <div className="mt-2 h-1.5 rounded-pill bg-sidebar overflow-hidden">
          <div className="h-full rounded-pill bg-primary" style={{ width: '60%' }} />
        </div>
        <div className="mt-1.5 text-[11px] text-sub2">还可生成 12 份报告</div>
      </div>

      {/* 用户行 */}
      <div className="mx-2.5 mb-3 h-12 rounded-card bg-white/60 flex items-center gap-2.5 px-3 border border-hairline/50">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#22d3ee] text-white flex items-center justify-center text-[13px] font-medium">
          黄
        </div>
        <div className="leading-tight">
          <div className="text-[13px] text-ink2 font-medium">黄健辉</div>
          <div className="text-[11px] text-sub2">专业版</div>
        </div>
      </div>
    </aside>
  );
}
