import { FrameRef, SummarySection } from './api';

function toSec(ts?: string): number {
  if (!ts) return -1;
  const p = ts.split(':').map(Number);
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] || 0;
}

/** 为某个 section 找到时间最接近的帧（用于图文对应） */
export function frameForSection(frames: FrameRef[], section: SummarySection): FrameRef | null {
  if (!frames?.length || !section.ts) return frames[0] || null;
  const target = toSec(section.ts);
  let best: FrameRef | null = null;
  let bestDiff = Infinity;
  for (const f of frames) {
    const d = Math.abs(toSec(f.ts) - target);
    if (d < bestDiff) { bestDiff = d; best = f; }
  }
  return best;
}

/** 为某个关键帧找到时间最接近的 section（用于“点击缩略图跳转到对应讲解”） */
export function sectionForFrame(sections: SummarySection[], frameTs: string): number {
  if (!sections?.length) return -1;
  const target = toSec(frameTs);
  if (target < 0) return 0;
  let bestIdx = 0;
  let bestDiff = Infinity;
  sections.forEach((sec, i) => {
    const d = Math.abs(toSec(sec.ts) - target);
    if (d < bestDiff) { bestDiff = d; bestIdx = i; }
  });
  return bestIdx;
}
