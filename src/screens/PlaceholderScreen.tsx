import { Construction } from 'lucide-react';

interface Props {
  title: string;
  desc: string;
}

export default function PlaceholderScreen({ title, desc }: Props) {
  return (
    <div className="vs-fade h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-full bg-[#EAF1FE] text-primary flex items-center justify-center mb-3">
        <Construction size={26} />
      </div>
      <div className="text-[16px] font-semibold text-ink">{title}</div>
      <div className="text-[13px] text-sub2 mt-1 max-w-sm leading-relaxed">{desc}</div>
    </div>
  );
}
