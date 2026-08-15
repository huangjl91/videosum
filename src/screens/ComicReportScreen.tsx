import { ArrowLeft, Sparkles, Tag, Bot, Database } from 'lucide-react';
import { Task, SummarySection, ComicTheme } from '../api';

interface Props {
  report: Task;
  onBack: () => void;
}

const THEME_LABEL: Record<ComicTheme, string> = {
  drone: '无人机',
  space: '太空',
  animal: '动物',
  food: '美食',
  history: '历史',
  tech: '科技',
  nature: '自然',
  default: '科普',
};

/** 彩色面板循环配色 */
const PANEL_COLORS = [
  {
    border: '#4facfe',
    grad: 'linear-gradient(135deg,#e0f7fa 0%,#b2ebf2 100%)',
    accent: '#00a8ff',
  },
  {
    border: '#ff6b6b',
    grad: 'linear-gradient(135deg,#fff3e0 0%,#ffe0b2 100%)',
    accent: '#ff6b6b',
  },
  {
    border: '#1dd1a1',
    grad: 'linear-gradient(135deg,#e8f5e9 0%,#c8e6c9 100%)',
    accent: '#1dd1a1',
  },
  {
    border: '#a29bfe',
    grad: 'linear-gradient(135deg,#f3e5f5 0%,#e1bee7 100%)',
    accent: '#a29bfe',
  },
];

const INK = '#1a1a2e';
const INK2 = '#4a4a6a';
const YELLOW = '#ffd93d';
const YELLOW_DARK = '#ffb800';

/** 标签颜色池（除主题/科普漫画外的额外标签） */
const TAG_COLORS = ['#1dd1a1', '#a29bfe', '#ff9f43', '#1dd1a1'];

/** ts("mm:ss" 或 "hh:mm:ss") -> 秒 */
function parseTs(t?: string): number {
  if (!t) return 0;
  const parts = t.split(':').map((x) => parseInt(x, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
/** 秒 -> "mm:ss" */
function fmtDur(sec?: number): string {
  if (!sec || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 动漫小人物「讲解员小星」——内联 SVG，黑描边漫画风。
 */
type Pose = 'hello' | 'think' | 'wow' | 'point' | 'read';
function ComicMascot({ pose = 'hello', size = 64 }: { pose?: Pose; size?: number }) {
  const eyes =
    pose === 'wow' ? (
      <>
        <circle cx="44" cy="42" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="58" cy="42" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="45" cy="43" r="2.5" fill={INK} />
        <circle cx="59" cy="43" r="2.5" fill={INK} />
      </>
    ) : pose === 'think' ? (
      <>
        <circle cx="44" cy="42" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="58" cy="42" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="43" cy="43" r="2.5" fill={INK} />
        <circle cx="57" cy="43" r="2.5" fill={INK} />
      </>
    ) : (
      <>
        <circle cx="44" cy="42" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="58" cy="42" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
        <circle cx="45" cy="43" r="2.5" fill={INK} />
        <circle cx="59" cy="43" r="2.5" fill={INK} />
      </>
    );

  const mouth =
    pose === 'wow' ? (
      <ellipse cx="51" cy="54" rx="4" ry="6" fill={INK} />
    ) : pose === 'think' ? (
      <path d="M46 53 Q51 50 56 53" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M45 52 Q51 58 57 52" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
    );

  const arms =
    pose === 'hello' ? (
      <path d="M30 70 Q18 64 20 54" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    ) : pose === 'point' ? (
      <path d="M72 72 L86 60" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    ) : pose === 'read' ? (
      <path d="M30 72 Q24 80 30 86" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    ) : (
      <path d="M30 72 Q24 78 28 84" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <rect x="38" y="66" width="26" height="26" rx="10" fill="#1A73E8" stroke={INK} strokeWidth="2.5" />
      <path d="M51 70 L44 66 L44 74 Z M51 70 L58 66 L58 74 Z" fill={YELLOW} stroke={INK} strokeWidth="2" />
      {arms}
      <path d="M70 72 Q76 78 72 84" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <circle cx="51" cy="42" r="22" fill="#FFE0B2" stroke={INK} strokeWidth="2.5" />
      <path d="M30 38 Q32 18 51 18 Q70 18 72 38 Q64 28 51 30 Q38 28 30 38 Z" fill="#1A73E8" stroke={INK} strokeWidth="2" />
      {eyes}
      {mouth}
      <circle cx="38" cy="50" r="3" fill="#FF8A80" opacity="0.7" />
      <circle cx="64" cy="50" r="3" fill="#FF8A80" opacity="0.7" />
    </svg>
  );
}

/** 主题装饰 SVG */
function ThemeDecor({ theme, size = 40 }: { theme: ComicTheme; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 100 100',
    className: 'shrink-0',
  };
  switch (theme) {
    case 'drone':
      return (
        <svg {...common}>
          <line x1="30" y1="40" x2="15" y2="28" stroke={INK} strokeWidth="3" />
          <line x1="70" y1="40" x2="85" y2="28" stroke={INK} strokeWidth="3" />
          <line x1="30" y1="40" x2="15" y2="52" stroke={INK} strokeWidth="3" />
          <line x1="70" y1="40" x2="85" y2="52" stroke={INK} strokeWidth="3" />
          <ellipse cx="14" cy="27" rx="12" ry="3.5" fill="#1A73E8" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="86" cy="27" rx="12" ry="3.5" fill="#1A73E8" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="14" cy="53" rx="12" ry="3.5" fill="#1A73E8" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="86" cy="53" rx="12" ry="3.5" fill="#1A73E8" stroke={INK} strokeWidth="2.5" />
          <rect x="36" y="38" width="28" height="20" rx="6" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
          <circle cx="50" cy="48" r="4" fill={YELLOW} stroke={INK} strokeWidth="2" />
        </svg>
      );
    case 'space':
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="26" fill="#1A73E8" stroke={INK} strokeWidth="3" />
          <ellipse cx="50" cy="50" rx="38" ry="12" fill="none" stroke={YELLOW} strokeWidth="3" transform="rotate(-20 50 50)" />
          <circle cx="42" cy="44" r="4" fill={INK} />
          <circle cx="58" cy="56" r="3" fill={INK} />
          <circle cx="54" cy="42" r="2.5" fill={INK} />
          <path d="M84 20 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill={YELLOW} stroke={INK} strokeWidth="1.5" />
        </svg>
      );
    case 'animal':
      return (
        <svg {...common}>
          <path d="M30 40 L34 22 L48 34 Z" fill="#FFB74D" stroke={INK} strokeWidth="3" />
          <path d="M70 40 L66 22 L52 34 Z" fill="#FFB74D" stroke={INK} strokeWidth="3" />
          <circle cx="50" cy="52" r="22" fill="#FFB74D" stroke={INK} strokeWidth="3" />
          <circle cx="42" cy="48" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="58" cy="48" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="42" cy="49" r="2" fill={INK} />
          <circle cx="58" cy="49" r="2" fill={INK} />
          <path d="M46 60 Q50 64 54 60" fill="none" stroke={INK} strokeWidth="2" />
        </svg>
      );
    case 'food':
      return (
        <svg {...common}>
          <path d="M22 50 Q50 80 78 50 Z" fill={YELLOW} stroke={INK} strokeWidth="3" />
          <line x1="22" y1="50" x2="78" y2="50" stroke={INK} strokeWidth="3" />
          <path d="M40 42 q4 -8 0 -14" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M56 42 q4 -8 0 -14" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="80" y1="30" x2="70" y2="48" stroke={INK} strokeWidth="3" />
          <ellipse cx="82" cy="28" rx="6" ry="4" fill="#fff" stroke={INK} strokeWidth="2.5" />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <path d="M30 44 Q50 34 70 44 L66 70 Q50 78 34 70 Z" fill="#C9A227" stroke={INK} strokeWidth="3" />
          <line x1="30" y1="44" x2="70" y2="44" stroke={INK} strokeWidth="3" />
          <rect x="44" y="32" width="12" height="10" fill="none" stroke={INK} strokeWidth="2.5" />
          <line x1="36" y1="70" x2="32" y2="80" stroke={INK} strokeWidth="3" />
          <line x1="64" y1="70" x2="68" y2="80" stroke={INK} strokeWidth="3" />
        </svg>
      );
    case 'tech':
      return (
        <svg {...common}>
          <rect x="32" y="32" width="36" height="36" rx="4" fill="#1A73E8" stroke={INK} strokeWidth="3" />
          <rect x="42" y="42" width="16" height="16" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
          <line x1="40" y1="28" x2="40" y2="20" stroke={INK} strokeWidth="3" />
          <line x1="60" y1="28" x2="60" y2="20" stroke={INK} strokeWidth="3" />
          <line x1="32" y1="44" x2="24" y2="44" stroke={INK} strokeWidth="3" />
          <line x1="32" y1="60" x2="24" y2="60" stroke={INK} strokeWidth="3" />
          <line x1="68" y1="44" x2="76" y2="44" stroke={INK} strokeWidth="3" />
          <line x1="68" y1="60" x2="76" y2="60" stroke={INK} strokeWidth="3" />
        </svg>
      );
    case 'nature':
      return (
        <svg {...common}>
          <line x1="50" y1="78" x2="50" y2="40" stroke={INK} strokeWidth="3" />
          <path d="M50 58 Q34 52 30 38 Q46 42 50 56 Z" fill="#4CAF50" stroke={INK} strokeWidth="2.5" />
          <path d="M50 50 Q66 44 70 30 Q54 34 50 48 Z" fill="#4CAF50" stroke={INK} strokeWidth="2.5" />
          <circle cx="50" cy="34" r="7" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
        </svg>
      );
    default:
      return <ComicMascot pose="hello" size={size} />;
  }
}

/** 黄色小机器人（压在黄色框左下角外侧，呼应参考图） */
function ComicRobot({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.18))' }}>
      <rect x="42" y="74" width="36" height="32" rx="12" fill={YELLOW} stroke={INK} strokeWidth="3" />
      <rect x="55" y="82" width="10" height="12" rx="2" fill="#ff6b6b" stroke={INK} strokeWidth="2" />
      <path d="M40 86 Q24 80 22 68" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M80 86 Q96 80 98 68" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="20" cy="66" r="5" fill="#4facfe" stroke={INK} strokeWidth="2" />
      <circle cx="100" cy="66" r="5" fill="#4facfe" stroke={INK} strokeWidth="2" />
      <circle cx="48" cy="112" r="10" fill="#4a4a6a" stroke={INK} strokeWidth="3" />
      <circle cx="72" cy="112" r="10" fill="#4a4a6a" stroke={INK} strokeWidth="3" />
      <circle cx="48" cy="112" r="4" fill="#a29bfe" />
      <circle cx="72" cy="112" r="4" fill="#a29bfe" />
      <rect x="54" y="64" width="12" height="12" fill="#4a4a6a" stroke={INK} strokeWidth="2" />
      <rect x="34" y="22" width="52" height="46" rx="14" fill={YELLOW} stroke={INK} strokeWidth="3" />
      <rect x="40" y="28" width="40" height="30" rx="8" fill={INK} />
      <circle cx="50" cy="40" r="5" fill="#4facfe" />
      <circle cx="70" cy="40" r="5" fill="#4facfe" />
      <circle cx="52" cy="38" r="1.5" fill="#fff" />
      <circle cx="72" cy="38" r="1.5" fill="#fff" />
      <line x1="44" y1="22" x2="38" y2="8" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <line x1="76" y1="22" x2="82" y2="8" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="38" cy="8" r="4" fill="#ff6b6b" stroke={INK} strokeWidth="2" />
      <circle cx="82" cy="8" r="4" fill="#4facfe" stroke={INK} strokeWidth="2" />
    </svg>
  );
}

/** 对话气泡（带小星头像） */
function SpeechBubble({
  text,
  role,
  pose = 'hello',
}: {
  text?: string;
  role?: string;
  pose?: Pose;
}) {
  if (!text) return null;
  return (
    <div className="flex items-end gap-2 mt-2">
      <div className="shrink-0 -mb-1">
        <ComicMascot pose={pose} size={44} />
      </div>
      <div className="relative inline-block max-w-full">
        <div
          className="rounded-[22px] border-2 px-3.5 py-2"
          style={{ borderColor: INK, background: '#fff', boxShadow: '3px 3px 0 #000' }}
        >
          {role ? (
            <div className="text-[10px] font-bold mb-0.5" style={{ color: '#00a8ff' }}>
              {role}
            </div>
          ) : null}
          <div className="text-[13px] font-bold leading-snug" style={{ color: INK }}>
            {text}
          </div>
        </div>
        <div
          className="absolute -bottom-[9px] left-8 w-4 h-4 border-b-2 border-r-2 rotate-45"
          style={{ background: '#fff', borderColor: INK, clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }}
        />
      </div>
    </div>
  );
}

/** 旁白框 */
function CaptionBox({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div
      className="mt-2 px-3 py-2 rotate-[-0.6deg] border-2"
      style={{ background: '#fff9db', borderColor: INK, boxShadow: '3px 3px 0 #000' }}
    >
      <div className="text-[12px] leading-snug" style={{ color: INK2 }}>
        <span className="font-bold" style={{ color: INK }}>
          旁白：
        </span>
        {text}
      </div>
    </div>
  );
}

/** 拟声词 */
function SfxLabel({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="absolute -top-3 -right-2 z-10">
      <div
        className="px-2 py-0.5 rotate-[8deg] border-2"
        style={{ background: YELLOW, borderColor: INK, boxShadow: '2px 2px 0 #000' }}
      >
        <span className="text-[14px] font-black tracking-wider" style={{ color: INK }}>
          {text}
        </span>
      </div>
    </div>
  );
}

/** 单格漫画面板（彩色） */
function ComicPanel({
  sec,
  index,
  frameUrl,
  theme = 'default',
}: {
  sec: SummarySection;
  index: number;
  frameUrl?: string;
  theme?: ComicTheme;
}) {
  const POSES: Pose[] = ['point', 'think', 'wow', 'hello', 'read', 'think'];
  const pose = POSES[index % POSES.length];
  const color = PANEL_COLORS[index % PANEL_COLORS.length];

  return (
    <div
      className="relative bg-white overflow-hidden"
      style={{
        border: `3px solid ${color.border}`,
        borderRadius: 16,
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      }}
    >
      <SfxLabel text={sec.sfx} />

      {/* 分镜画面 */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: 150, background: color.grad }}
      >
        {frameUrl ? (
          <img src={frameUrl} alt={sec.title} className="w-full h-full object-cover" />
        ) : (
          <ThemeDecor theme={theme} size={90} />
        )}
        {/* 时间戳条 */}
        <div
          className="absolute bottom-0 left-0 right-0 text-white text-[11px] px-2 py-1 flex justify-between items-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <span className="font-bold">{sec.title}</span>
          {sec.ts ? <span className="opacity-90 font-mono">{sec.ts}</span> : null}
        </div>
        {/* 主题迷你模型（右上角） */}
        {theme !== 'default' && !frameUrl ? null : null}
      </div>

      {/* 文字层 */}
      <div className="p-3 space-y-2">
        <div className="text-[15px] font-black" style={{ color: INK }}>
          {sec.title}
        </div>
        {sec.dialogue ? (
          <SpeechBubble text={sec.dialogue} role={sec.role} pose={pose} />
        ) : null}
        {sec.caption ? <CaptionBox text={sec.caption} /> : null}
        <div className="text-[12px] leading-relaxed" style={{ color: INK2 }}>
          {sec.content}
        </div>
        {sec.bullets?.length ? (
          <ul className="mt-1 space-y-1">
            {sec.bullets.map((b, i) => (
              <li key={i} className="text-[12px] flex gap-1.5" style={{ color: INK2 }}>
                <span style={{ color: color.accent }}>▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** 视频参数指标卡 */
function MetricTile({ num, label, color }: { num: string; label: string; color: string }) {
  return (
    <div
      className="text-center px-2 py-3"
      style={{
        background: '#fff',
        borderRadius: 14,
        border: `2px solid ${color}`,
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
      }}
    >
      <div className="text-[20px] font-black" style={{ color: INK, fontFamily: 'Times New Roman, Georgia, serif' }}>
        {num}
      </div>
      <div className="text-[11px] mt-1 font-bold" style={{ color: INK2 }}>
        {label}
      </div>
    </div>
  );
}

/** 彩虹关键帧时间轴（基于真实帧时间） */
function RainbowTimeline({ frames, duration }: { frames: { ts?: string }[]; duration: number }) {
  const pts = frames
    .map((f) => parseTs(f.ts))
    .filter((t) => t > 0 || duration <= 0)
    .sort((a, b) => a - b);
  const positions = (pts.length ? pts : [0]).map((t) =>
    duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0
  );
  return (
    <div
      className="px-5 py-4 rounded-2xl"
      style={{ background: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
    >
      <div className="text-[15px] font-black mb-4" style={{ color: INK }}>
        ⏱ 关键帧时间轴
      </div>
      <div className="relative" style={{ height: 8, background: '#e9ecef', borderRadius: 4 }}>
        <div
          className="absolute left-0 top-0 bottom-0 rounded-4"
          style={{
            width: positions.length ? `${Math.max(...positions)}%` : '100%',
            background: 'linear-gradient(90deg,#4facfe,#a29bfe,#ff6b6b,#1dd1a1)',
            borderRadius: 4,
          }}
        />
      </div>
      <div className="flex justify-between mt-2" style={{ marginTop: 14 }}>
        {positions.map((p, i) => (
          <div key={i} className="text-center" style={{ width: 42 }}>
            <div
              className="mx-auto mb-1 rounded-full"
              style={{
                width: 14,
                height: 14,
                background: '#fff',
                border: `3px solid ${INK}`,
                boxShadow: `0 0 0 3px ${YELLOW}`,
              }}
            />
            <span className="text-[10px] font-black" style={{ color: INK, fontFamily: 'Times New Roman, serif' }}>
              {fmtDur(pts[i] || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 构建分镜列表：以真实视频帧为基准，保证每个分镜都带视频截图，且数量不少于 minCount */
function buildPanels(
  sections: SummarySection[],
  frames: { ts?: string; url: string }[],
  minCount: number
) {
  const n = Math.max(sections.length, frames.length, minCount);
  const rolePool = ['小星', '讲解员', '旁白', '摄影师', '科学家', '观众'];
  const sfxPool = ['咔嚓！', '嗡——', '嗖嗖嗖！', '嘀！', '轰隆！', '呼呼——'];
  const out: { sec: SummarySection; frame?: { ts?: string; url: string }; index: number }[] = [];
  for (let i = 0; i < n; i++) {
    const frame = frames.length ? frames[i % frames.length] : undefined;
    const sec = sections[i];
    const role = sec?.role?.trim() || rolePool[i % rolePool.length];
    const safeSec: SummarySection = sec || {
      title: `第 ${i + 1} 格：关键画面`,
      ts: frame?.ts,
      role,
      dialogue: `${role}：这是视频第 ${frame?.ts || '0:00'} 秒的关键画面，让我们一起看看这里发生了什么！`,
      caption: `时间锚点：${frame?.ts || '0:00'}。这一帧已被系统抽取为关键分镜，是理解本段科普内容的重要视觉节点。`,
      content: frame
        ? `画面定格在视频第 ${frame.ts} 秒。这一帧捕捉了视频的关键瞬间，画面细节丰富，是理解整段科普内容的重要节点。结合前后分镜，可以更完整地梳理出视频讲述的知识脉络与核心要点。`
        : `这是第 ${i + 1} 个关键分镜。系统已为其预留画面位置，结合前后分镜可串联出视频的主要内容线索。`,
      sfx: sfxPool[i % sfxPool.length],
      bullets: [`时间：${frame?.ts || '0:00'}`, `分镜：${i + 1}/${n}`, '等待画面语义识别'],
    };
    out.push({ sec: safeSec, frame, index: i });
  }
  return out;
}

export default function ComicReportScreen({ report, onBack }: Props) {
  const s = report.summary;
  if (!s) return null;
  const meta = report.meta;
  const theme: ComicTheme = s.theme || 'default';
  const frames = report.frames || [];
  const panels = buildPanels(s.sections || [], frames, 6);

  return (
    <div className="vs-fade p-6 max-w-[1100px] mx-auto relative">
      <button
        onClick={onBack}
        className="text-[13px] hover:text-ink flex items-center gap-1 mb-3 transition-colors"
        style={{ color: INK2 }}
      >
        <ArrowLeft size={15} /> 返回报告库
      </button>

      {/* 黄色外框 */}
      <div className="relative" style={{ paddingBottom: 36 }}>
        <div
          className="relative overflow-hidden"
          style={{
            background: '#fff',
            border: `8px solid ${YELLOW}`,
            borderRadius: 28,
            boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
          }}
        >
          {/* 顶部条纹装饰 */}
          <div
            style={{
              height: 10,
              background:
                'repeating-linear-gradient(90deg,#ffd93d 0px,#ffd93d 16px,#ffb800 16px,#ffb800 32px)',
            }}
          />
          <div className="px-8 py-7" style={{ padding: '32px 34px 40px 34px' }}>
            {/* 角标 */}
            <div
              className="absolute top-4 right-4 text-[11px] font-black px-3 py-1 rounded-3xl rotate-3"
              style={{ background: INK, color: YELLOW, letterSpacing: 1, boxShadow: '4px 4px 0 #ffb800' }}
            >
              VOL.01
            </div>

            {/* 头部 */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="grid place-items-center text-[30px] rounded-2xl shrink-0"
                style={{
                  width: 64,
                  height: 64,
                  background: 'linear-gradient(135deg,#4facfe,#a29bfe)',
                  boxShadow: '0 8px 20px rgba(79,172,254,0.35)',
                }}
              >
                {theme === 'drone' ? '🚁' : theme === 'space' ? '🪐' : theme === 'animal' ? '🐱' : theme === 'food' ? '🍜' : theme === 'tech' ? '💡' : '📺'}
              </div>
              <div className="flex-1">
                <h1
                  className="m-0 font-black leading-tight"
                  style={{ fontSize: 32, color: INK, letterSpacing: '-0.5px' }}
                >
                  {s.title}
                </h1>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: INK2, margin: '8px 0 0 0' }}>
                  视频：{report.originalFilename}
                  {meta ? ` · ${meta.width}×${meta.height} · ${meta.codec}` : ''}
                  {meta ? ` · 时长 ${fmtDur(meta.durationSec)}` : ''}
                </p>
                {/* 彩色标签 */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span
                    className="text-[12px] font-bold px-2.5 py-0.5 rounded-3xl text-white"
                    style={{ background: '#00a8ff', boxShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}
                  >
                    {THEME_LABEL[theme]}
                  </span>
                  <span
                    className="text-[12px] font-bold px-2.5 py-0.5 rounded-3xl text-white"
                    style={{ background: '#ff6b6b', boxShadow: '2px 2px 0 rgba(0,0,0,0.15)' }}
                  >
                    科普漫画
                  </span>
                  {s.tags?.slice(0, 4).map((t, i) => (
                    <span
                      key={i}
                      className="text-[12px] font-bold px-2.5 py-0.5 rounded-3xl text-white"
                      style={{
                        background: TAG_COLORS[i % TAG_COLORS.length],
                        boxShadow: '2px 2px 0 rgba(0,0,0,0.15)',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* AI 降级提示 */}
            {s.aiError ? (
              <div
                className="mb-5 px-3 py-2 border-2 flex items-start gap-2"
                style={{ background: '#FFF3CD', borderColor: INK, boxShadow: '3px 3px 0 #000' }}
              >
                <span className="text-[16px]">⚠️</span>
                <div className="text-[12px] leading-snug" style={{ color: INK }}>
                  <span className="font-bold">AI 视觉模型未返回可用结果，已自动用基础模式生成。</span>
                  <span className="opacity-80">
                    {' '}
                    原因：{s.aiError.slice(0, 100)}… 请在「设置」中检查模型是否为支持图片输入的视觉模型。
                  </span>
                </div>
              </div>
            ) : null}

            {/* 摘要卡（黄色渐变） */}
            <div
              className="mb-5 px-5 py-4 border-l-4 relative"
              style={{
                background: 'linear-gradient(135deg,#fff9db 0%,#fff3bf 100%)',
                borderLeftColor: YELLOW_DARK,
                borderRadius: 14,
              }}
            >
              <div
                className="inline-block text-[12px] font-black px-2.5 py-1 rounded-md mb-2"
                style={{ background: YELLOW, color: INK, boxShadow: '2px 2px 0 #ffb800' }}
              >
                📋 内容提要
              </div>
              <p className="m-0 text-[14px] leading-relaxed" style={{ color: INK }}>
                {s.overview}
              </p>
            </div>

            {/* 数据指标卡 */}
            {meta ? (
              <div className="grid grid-cols-4 gap-3 mb-5">
                <MetricTile num={fmtDur(meta.durationSec)} label="视频总时长" color="#4facfe" />
                <MetricTile num={`${meta.width}×${meta.height}`} label="画面分辨率" color="#1dd1a1" />
                <MetricTile num={`${Math.round(meta.fps)} fps`} label="视频帧率" color="#ff6b6b" />
                <MetricTile num={String(report.frames.length)} label="关键帧数" color="#a29bfe" />
              </div>
            ) : null}

            {/* 分镜标题 */}
            <div className="text-[18px] font-black flex items-center gap-2 mb-3.5" style={{ color: INK }}>
              🎬 漫画分镜解读
              <span className="text-[12px] font-bold px-2 py-0.5 rounded-3xl text-white" style={{ background: YELLOW_DARK }}>
                {panels.length} 格 · 含视频截图
              </span>
            </div>

            {/* 分镜网格：以真实视频帧为基准，保证每张分镜都带视频截图 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {panels.map(({ sec, frame, index }) => (
                <ComicPanel
                  key={index}
                  sec={sec}
                  index={index}
                  frameUrl={frame?.url}
                  theme={theme}
                />
              ))}
            </div>

            {/* 关键帧时间轴 */}
            {report.frames.length ? (
              <div className="mt-6">
                <RainbowTimeline frames={report.frames} duration={meta?.durationSec || 0} />
              </div>
            ) : null}

            {/* 底部标签 + 来源 */}
            <div
              className="mt-5 flex justify-between items-center text-[11px]"
              style={{ color: INK2, borderTop: '1px dashed #cbd5e0', paddingTop: 14 }}
            >
              <div className="flex gap-2">
                <span className="text-white px-2.5 py-1 rounded-3xl font-bold" style={{ background: INK }}>
                  #科普漫画
                </span>
                <span className="text-white px-2.5 py-1 rounded-3xl font-bold" style={{ background: INK }}>
                  #{THEME_LABEL[theme]}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {s.source === 'ai' ? <Bot size={13} /> : <Database size={13} />}
                {s.source === 'ai'
                  ? `由 AI 视觉模型（${s.model || '未知'}）生成`
                  : '基于视频元数据生成（未启用 AI 模型，画面内容需视觉模型识别）'}
              </div>
            </div>
          </div>
        </div>

        {/* 左下角黄色小机器人（压框外） */}
        <div className="absolute" style={{ bottom: -28, left: 24, zIndex: 5 }}>
          <ComicRobot size={110} />
        </div>
      </div>
    </div>
  );
}
