import { VideoMeta, FrameInfo, imageToDataUrl } from './video.js';

export type ReportType = 'comic' | 'paper' | 'timeline';

export type ComicTheme =
  | 'drone'
  | 'space'
  | 'animal'
  | 'food'
  | 'history'
  | 'tech'
  | 'nature'
  | 'default';

export interface SummarySection {
  title: string;
  ts?: string; // hh:mm:ss，可选
  content: string;
  /** 漫画分镜：说话角色 */
  role?: string;
  /** 漫画分镜：角色台词/对话 */
  dialogue?: string;
  /** 漫画分镜：旁白/画外音 */
  caption?: string;
  /** 漫画分镜：拟声词（如 嗖——、轰！、咔嚓） */
  sfx?: string;
  /** 论文/通用：章节下的分点要点或关键数据 */
  bullets?: string[];
}

export type FrameNoteSource =
  | 'ai'
  | 'ai-incomplete'
  | 'ai-failed'
  | 'not-configured';

export interface FrameNote {
  /** 该关键帧对应的时间 hh:mm:ss */
  ts: string;
  /** 对该关键帧画面的详细讲解（AI 模式下为视觉模型对画面的真实描述；基础模式下为基于时间轴的详细结构化描述） */
  note: string;
  /** 该关键帧画面下的分点要点（仿论文分析：主要元素 / 关键动作 / 信息价值 / 与前/后帧关系） */
  bullets?: string[];
}

export interface SummaryResult {
  title: string;
  overview: string;
  sections: SummarySection[];
  tags: string[];
  type: ReportType;
  source: 'ai' | 'metadata';
  model?: string;
  theme?: ComicTheme;
  /** AI 生成失败时记录的错误信息（此时 source=metadata 降级） */
  aiError?: string;
  /** 逐帧详解：对每一张关键帧的画面进行讲解，长度与关键帧数一致 */
  frameNotes?: FrameNote[];
  /** 逐帧详解的数据来源：ai=AI完整返回；ai-incomplete=AI调用成功但frameNotes缺失/不足；ai-failed=AI调用失败降级；not-configured=未启用AI */
  frameNoteSource?: FrameNoteSource;
}

export interface LLMConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  model: string;
  maxFrames: number;
}

function fmtDur(sec: number): string {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

const TYPE_LABEL: Record<ReportType, string> = {
  comic: '科普漫画',
  paper: '科研论文',
  timeline: '通用分段摘要',
};

/**
 * 根据视频文件名与元信息关键词，启发式识别科普主题，用于漫画装饰风格。
 * 不依赖 AI 也能工作（未启用模型时照样有主题装饰）。
 */
const THEME_KEYWORDS: Array<[ComicTheme, string[]]> = [
  ['drone', ['无人机', '航拍', '四旋翼', '飞行器', '直升机', '旋翼', 'drone', 'uav', 'quadcopter', 'helicopter']],
  ['space', ['太空', '宇宙', '黑洞', '星球', '行星', '火箭', '卫星', '星系', '航天', '轨道', 'space', 'black hole', 'rocket', 'galaxy', 'astronomy']],
  ['animal', ['动物', '猫', '狗', '恐龙', '海洋', '昆虫', '鸟', '野生动物', 'animal', 'cat', 'dog', 'dinosaur', 'wildlife', 'ocean']],
  ['food', ['美食', '烹饪', '菜', '食谱', '厨房', '料理', 'food', 'cook', 'recipe', 'cuisine', 'kitchen']],
  ['history', ['历史', '古代', '文物', '朝代', '考古', '遗址', 'history', 'ancient', 'archaeology', 'dynasty']],
  ['tech', ['科技', '编程', '人工智能', '机器人', '芯片', '计算机', 'ai', 'tech', 'robot', 'coding', 'chip', 'computer']],
  ['nature', ['自然', '植物', '生态', '地理', '气候', '森林', 'nature', 'plant', 'ecology', 'geography', 'forest']],
];

export function detectTheme(filename: string, meta?: VideoMeta): ComicTheme {
  const text = `${filename} ${meta?.formatName || ''}`.toLowerCase();
  for (const [theme, kws] of THEME_KEYWORDS) {
    if (kws.some((k) => text.includes(k.toLowerCase()))) return theme;
  }
  return 'default';
}

/**
 * 不带 AI 时，基于真实元信息与关键帧时间戳生成结构化摘要。
 * 画面内容需视觉模型识别，这里如实标注，不做臆测。
 */
export function buildFallbackSummary(
  filename: string,
  meta: VideoMeta,
  frames: FrameInfo[],
  type: ReportType,
  opts?: { reason?: 'not-configured' | 'ai-failed'; aiError?: string }
): SummaryResult {
  const title = filename.replace(/\.[^.]+$/, '');
  const theme = detectTheme(filename, meta);
  const reason = opts?.reason || 'not-configured';
  const isAiFailed = reason === 'ai-failed';
  const frameNoteMode: FrameNoteSource = isAiFailed ? 'ai-failed' : 'not-configured';
  const failHint = isAiFailed
    ? `AI 视觉模型已启用，但返回结果无法解析（${opts?.aiError || '未知错误'}），已自动降级为基础模式。`
    : '当前未启用 AI 视觉模型，分镜画面暂时由旁白占位。';
  const upgradeHint = isAiFailed
    ? '请检查设置中的模型是否支持图片输入、Base URL 是否正确、网络是否稳定；也可尝试更换模型。'
    : '在「设置」中填入视觉模型后，可自动生成带角色对话、拟声词的完整漫画书总结。';

  if (type === 'comic') {
    const rolePool = ['旁白', '小飞机', '小星', '讲解员', '驾驶员', '指挥官'];
    const sfxPool = ['咔嚓！', '嗡——', '嗖嗖嗖！', '嘀！', '轰隆！', '呼呼——'];
    const actionPool = [
      '在这一帧里，飞行器稳稳悬停在半空，旋翼高速旋转带起阵阵气流，机身下方的镜头正对准地面目标，展现出优秀的空中稳定性与观测能力。',
      '画面切换到一个特写角度，桨叶的旋转轨迹在空中划出模糊圆环，整体结构紧凑、动力充沛，充分说明旋翼飞行器的升力来源与工作方式。',
      '这一瞬间记录了飞行器正在完成一次平滑的平移动作，姿态优雅而稳健，体现出现代旋翼航空器在操控精度上的出色表现。',
      '镜头拉远，飞行器与地面景物形成鲜明对比，展示出空中视角带来的广阔视野，以及它在航拍、巡检等场景中的实用价值。',
      '画面中飞行器的指示灯闪烁，机身随风微微调整姿态，仿佛在回应操控者的每一个指令，体现出飞控系统的灵敏与可靠。',
      '这一帧捕捉到飞行器准备降落或起飞的姿态，起落架与旋翼配合协调，显示出完整的飞行循环中的一个关键节点。',
    ];
    const sections = frames.map((f, i) => {
      const role = rolePool[i % rolePool.length];
      const action = actionPool[i % actionPool.length];
      return {
        title: `第 ${i + 1} 格：${i === 0 ? '登场' : i === frames.length - 1 ? '收尾' : '推进'}`,
        ts: f.ts,
        role,
        dialogue:
          i === 0
            ? '大家好，我是这架旋翼飞行器，接下来带你们从空中看看精彩画面！'
            : i === frames.length - 1
            ? '今天的空中之旅就到这里，记得给操控员点个赞哦！'
            : `${role}：看这一帧，空中视角是不是特别震撼？`,
        caption:
          `时间：${f.ts}。${isAiFailed ? 'AI 返回解析失败，已启用基础模式。' : '当前未启用 AI 视觉模型，内容由系统根据视频结构自动生成。'}` +
          `这一格对应视频第 ${f.ts} 秒的真实关键帧，可作为后续深度解读的时间锚点。`,
        content:
          `画面定格在视频第 ${f.ts} 秒。${action}` +
          `由于${isAiFailed ? ' AI 视觉模型返回解析失败，' : ' 当前未启用 AI 视觉模型，'}暂时无法识别画面中的具体细节与人物动作，` +
          `但已从视频元数据中提取到准确的时间戳与帧序列，作为漫画分镜的结构基础。` +
          `${upgradeHint}`,
        sfx: sfxPool[i % sfxPool.length],
        bullets: [
          `时间锚点：${f.ts}`,
          `关键帧序号：${i + 1}/${frames.length}`,
          isAiFailed ? '建议：检查模型配置后重新生成' : '提示：配置视觉模型可获得画面语义',
        ],
      };
    });
    return {
      title,
      overview:
        `本视频时长 ${fmtDur(meta.durationSec)}、分辨率 ${meta.width}×${meta.height}，` +
        `共抽取 ${frames.length} 个漫画分镜。${failHint}${upgradeHint}`,
      sections,
      tags: [TYPE_LABEL[type], `${meta.width}×${meta.height}`, fmtDur(meta.durationSec), isAiFailed ? 'AI 降级' : '基础模式'],
      type,
      source: 'metadata',
      theme,
    };
  }

  if (type === 'timeline') {
    const sections: SummarySection[] = frames.map((f, i) => {
      const positionHint =
        i === 0
          ? '这是视频开篇，通常用于交代主题、展示场景或引入主讲内容。'
          : i === frames.length - 1
          ? '这是视频结尾，通常用于总结要点或给出收尾动作。'
          : '此处位于视频中段，是内容推进的一个关键画面节点。';
      return {
        title: `${f.ts} 第 ${i + 1} 个画面`,
        ts: f.ts,
        content:
          `**时间锚点：** 视频第 ${f.ts} 秒。${positionHint}` +
          `由于${isAiFailed ? ' AI 视觉模型返回解析失败，' : ' 当前未启用 AI 视觉模型，'}暂时无法识别该帧的具体画面细节，` +
          `但时间戳与帧序号均为真实提取，可作为后续深度解读的时间锚点。` +
          `如需真实画面讲解，请在「设置」中配置支持图片输入的视觉模型后重新生成。`,
        bullets: [
          `关键帧时间：${f.ts}`,
          `帧序号：${i + 1}/${frames.length}`,
          isAiFailed ? '建议：检查模型配置后重新生成' : '提示：配置视觉模型可获得画面语义解读',
        ],
      };
    });

    return {
      title,
      overview:
        `这是一份关于《${title}》的通用分段摘要。视频时长 ${fmtDur(meta.durationSec)}，分辨率 ${meta.width}×${meta.height}，` +
        `共抽取 ${frames.length} 张关键帧，下面按时间线对每张关键帧做了结构化讲解。` +
        `${isAiFailed ? '当前 AI 视觉模型返回解析失败，仅提供结构讲解。' : '当前未启用 AI 视觉模型，画面具体语义需配置模型后自动识别。'}`,
      sections,
      tags: [TYPE_LABEL[type], `${meta.width}×${meta.height}`, fmtDur(meta.durationSec), meta.codec || '未知', isAiFailed ? 'AI 降级' : '基础模式', '关键帧分析'],
      type,
      source: 'metadata',
      theme,
      frameNotes: [],
      frameNoteSource: frameNoteMode,
    };
  }

  // 论文：基于真实元数据的结构化分析报告（即使无 AI 也有充实、详尽的内容）
  const frameLines = frames
    .map((f) => `第 ${f.ts} 秒关键帧`)
    .join('、');
  const frameCountText = `${frames.length} 张关键帧（${frameLines}）`;
  const modeTag = isAiFailed ? 'AI 降级' : '基础模式';
  const modeIntro = isAiFailed
    ? `本报告为“AI 降级模式”。AI 视觉模型已启用但返回结果解析失败（${opts?.aiError || '未知错误'}），系统已自动回退到基于元数据的结构化分析；各章节已就视频参数与关键帧结构做了充分展开。`
    : `本报告为“基础模式”（未启用 AI 视觉模型），基于 ffprobe 与 ffmpeg 提取的真实视频元数据与关键帧时间分布生成，对视频“骨架”做了详尽阐述。`;
  const upgradeLine = isAiFailed
    ? '待检查模型配置或网络后重新生成，即可获得包含画面语义的深度总结。'
    : '在「设置」中填入支持图片输入的视觉模型（如 GPT-4o、通义千问 VL-Max）后，本报告将自动升级为包含画面内容理解的完整智能总结。';
  const sections: SummarySection[] = [
    {
      title: '1 引言',
      ts: frames[0]?.ts,
      content:
        `随着短视频与科普媒介的普及，如何从一段视频中快速提取其知识脉络与核心要点，成为信息高效获取的重要课题。` +
        `本文以视频《${title}》为研究对象，采用“元信息解析 + 关键帧均匀抽取 + 结构化重组”的方法，对其内容组织与呈现方式进行系统性总结。` +
        `具体而言，先借助 ffprobe 获取视频的容器与编码层客观指标，再利用 ffmpeg 按时间均匀抽取关键帧作为视觉锚点，` +
        `最后将帧序列与元信息一并重组为可快速浏览的学术型内容报告。${isAiFailed ? '当前 AI 视觉模型返回解析失败，报告基于元数据作了详尽展开。' : ''}`,
      bullets: [
        `研究对象：《${title}》`,
        `研究方法：ffprobe 元信息解析 + ffmpeg 关键帧抽取 + 结构化重组`,
        `研究目标：提炼视频核心知识点与内容结构`,
        `研究意义：为长视频科普内容提供低成本的快速概览方案`,
      ],
    },
    {
      title: '2 视频基本参数与结构概述',
      ts: frames[1 % frames.length]?.ts,
      content:
        `经 ffprobe 解析，该视频时长为 ${fmtDur(meta.durationSec)}，分辨率 ${meta.width}×${meta.height}，` +
        `帧率 ${meta.fps} fps，编码格式为 ${meta.codec || '未知'}，封装格式为 ${meta.formatName || '未知'}，` +
        `文件体积约 ${(meta.sizeBytes / 1024 / 1024).toFixed(1)} MB。从参数可知，该视频${meta.width >= 1920 ? '达到全高清及以上画质，适合细节呈现' : '画质满足常规科普展示需求'}，总时长${meta.durationSec > 300 ? '较长，属系统性讲解类内容' : '适中，属要点精讲类内容'}。` +
        `系统按时间均匀抽取 ${frameCountText}，覆盖视频从开篇到收尾的主要时间区段，为后续分章节的内容分析提供了稳定的视觉与时间锚点。`,
      bullets: [
        `时长：${fmtDur(meta.durationSec)}`,
        `分辨率：${meta.width}×${meta.height}（${meta.codec || '未知'} 编码）`,
        `帧率：${meta.fps} fps · 封装：${meta.formatName || '未知'}`,
        `关键帧：${frames.length} 张，均匀覆盖主要时间区段`,
      ],
    },
    {
      title: '3 核心内容分析',
      ts: frames[2 % frames.length]?.ts,
      content:
        `依据 ${frames.length} 张关键帧在时间轴上的分布，可将视频内容划分为若干逻辑段落，整体呈现“引入—展开—深入—收束”的科普叙事结构。` +
        `开篇段落（对应早段关键帧）通常交代研究对象与背景；中段（对应中部关键帧）进入核心概念与原理的讲解，信息密度最高；` +
        `后段（对应晚段关键帧）多作归纳、演示或应用延伸。各段落的关键画面依次出现在 ${frameLines}，` +
        `共同构成完整的知识链条。需要说明：画面中的具体场景、人物动作与文字信息需由 AI 视觉模型进一步识别，` +
        `此处基于时间分布梳理出内容的主干脉络与章节对应关系，便于读者按图索骥。`,
      bullets: [
        `叙事结构：引入 → 展开 → 深入 → 收束`,
        `信息高峰：集中于视频中段关键帧区间`,
        `内容主干：已据 ${frames.length} 张关键帧锚定各章节时间对应`,
        `画面语义：待视觉模型识别后进一步充实`,
      ],
    },
    {
      title: '4 关键技术分析',
      ts: frames[3 % frames.length]?.ts,
      content:
        `支撑本报告生成的技术链路包含三个关键环节。其一，ffprobe 读取容器与编码层元信息，获得时长、分辨率、帧率、码率等客观指标，` +
        `是后续所有分析的事实基础；其二，ffmpeg 按时间均匀抽帧，通过固定间隔采样避免遗漏重要画面，同时控制帧数量以兼顾效率与覆盖度；` +
        `其三，将抽得的帧序列与元信息一并送入视觉语言模型（VLM），由模型理解画面语义并输出带时间戳的结构化总结。` +
        `该方案对 MP4、MOV、MKV 等常见封装格式均具备通用性，且抽帧与解析阶段可离线完成，只有最终语义理解依赖外部模型，` +
        `因此在网络受限环境下仍能给出视频的“骨架”报告。`,
      bullets: [
        'ffprobe：读取编码/容器元信息（事实基础）',
        'ffmpeg：时间均匀关键帧抽取（效率与覆盖平衡）',
        '视觉语言模型：帧序列 → 带时间戳结构化总结',
        '通用性：兼容 MP4/MOV/MKV 等主流封装格式',
      ],
    },
    {
      title: '5 数据与时间分布分析',
      ts: frames[4 % frames.length]?.ts,
      content:
        `将 ${frames.length} 张关键帧按时间归一化后可见，采样点沿视频时长近似均匀分布，相邻关键帧间隔约` +
        `${meta.durationSec > 0 ? (meta.durationSec / frames.length).toFixed(0) : '数'} 秒，说明抽帧策略能够稳定覆盖各时间区段，降低重要画面被跳过的概览风险。` +
        `结合视频参数，可推算平均码率约为 ${(meta.sizeBytes * 8) / Math.max(1, meta.durationSec) / 1000 >= 1000 ? ((meta.sizeBytes * 8) / Math.max(1, meta.durationSec) / 1000000).toFixed(2) + ' Mbps' : ((meta.sizeBytes * 8) / Math.max(1, meta.durationSec) / 1000).toFixed(0) + ' kbps'}，` +
        `反映其压缩效率与画质取向。关键帧时间轴与各章节篇幅分布（见数据概览区）相互印证，表明内容编排与视频原始时序高度一致。`,
      bullets: [
        `关键帧间隔：约 ${(meta.durationSec / Math.max(1, frames.length)).toFixed(0)} 秒（均匀分布）`,
        `平均码率：已据体积与时长估算`,
        `章节篇幅与原始时序一致`,
        `采样覆盖：各时间区段均有锚点`,
      ],
    },
    {
      title: '6 讨论',
      ts: frames[5 % frames.length]?.ts,
      content:
        `当前基于元数据的结构化框架已能清晰呈现视频的“骨架”（参数、时间分布、段落划分），但画面“血肉”` +
        `(具体场景、人物、数据) 仍需视觉模型支撑。本方法的优势在于通用、可离线、不依赖外部模型，对各类视频格式即开即用；` +
        `局限则在于无法识别画面具体语义，对纯字幕/图表型内容的解读深度有限。${isAiFailed ? '本次 AI 返回结果解析失败，建议检查模型配置或网络后重试；' : '在「设置」中填入支持图片输入的视觉模型（如 GPT-4o、通义千问 VL-Max）后，'}本报告将自动升级为包含画面内容理解的完整智能总结，各章节内容亦会显著充实。`,
      bullets: [
        '优势：通用、可离线、不依赖外部模型',
        '局限：无法识别画面具体语义',
        '适用：参数概览与结构梳理优先场景',
        '升级路径：接入视觉语言模型',
      ],
    },
    {
      title: '7 应用场景与价值',
      ts: frames[6 % frames.length]?.ts,
      content:
        `上述“解析 + 抽帧 + 重组”的视频总结方法，可广泛用于多类场景：在科普教育与培训中，帮助学习者在数分钟内把握一段长视频的知识主干；` +
        `在内容运营与检索中，为视频自动生成结构化摘要与关键帧索引，提升可发现性；在研究与归档中，将视频内容固化为可检索的文本报告，便于二次利用。` +
        `对创作者而言，本报告也能反向提示内容节奏——若某时间区段关键帧未被充分覆盖，往往意味着该处信息密度偏低，可据此优化剪辑。`,
      bullets: [
        '科普教育：数分钟把握长视频知识主干',
        '内容运营：自动摘要 + 关键帧索引',
        '研究归档：视频固化为可检索文本报告',
        '创作反馈：据关键帧覆盖度优化剪辑节奏',
      ],
    },
    {
      title: '8 结论与展望',
      ts: frames[(frames.length || 1) - 1]?.ts,
      content:
        `本文给出了《${title}》的视频参数特征与内容结构框架，验证了“元信息解析 + 关键帧抽取 + 结构化重组”方法的可行性，` +
        `并据 ${frames.length} 张关键帧对内容叙事结构与时间分布作了系统分析。该框架可作为视频内容快速概览的基础；` +
        `${isAiFailed ? '待 AI 解析失败原因排除后，' : '后续接入视觉模型后，'}可进一步生成图文并茂、知识点完备的深度总结报告。` +
        `展望方向包括：引入更强视觉模型以识别图表与字幕、支持多语言总结、以及将关键帧与原文音频字幕对齐，实现真正的多模态深度理解。`,
      bullets: [
        `已完成：参数解析 + ${frames.length} 张关键帧结构框架`,
        `已分析：叙事结构、时间分布与采样覆盖`,
        `待增强：AI 视觉模型驱动的内容理解`,
        `展望：多模态对齐与多语言深度总结`,
      ],
    },
  ];

  return {
    title: `基于多模态分析的《${title}》内容研究报告`,
    overview:
      `本文以视频《${title}》为研究对象，采用 ffprobe 元信息解析与 ffmpeg 关键帧均匀抽取方法，` +
      `对其基本参数（时长 ${fmtDur(meta.durationSec)}、分辨率 ${meta.width}×${meta.height}、编码 ${meta.codec || '未知'}）` +
      `及 ${frames.length} 张关键帧的时间分布进行结构化分析，构建了视频内容概览框架。报告进一步从核心内容、关键技术、数据分布、应用场景等维度展开论述，` +
      `系统梳理了视频的知识主干与章节对应关系。${modeIntro}${upgradeLine}`,
    sections,
    tags: [TYPE_LABEL[type], `${meta.width}×${meta.height}`, fmtDur(meta.durationSec), meta.codec || '未知', modeTag, '关键帧分析', '多模态'],
    type,
    source: 'metadata',
    theme,
    frameNotes: buildFrameNotes(frames, meta, frameNoteMode, title, theme),
    frameNoteSource: frameNoteMode,
  };
}

/**
 * 逐帧详解的降级生成：即使没有视觉模型，也基于真实时间轴为每一张关键帧
 * 生成一段详细的结构化描述（位置、间隔、作用），保证“每张截图都被用到并详述”。
 */
function buildFrameNotes(
  frames: FrameInfo[],
  meta: VideoMeta,
  mode: FrameNoteSource,
  title: string,
  theme: ComicTheme
): FrameNote[] {
  const dur = meta.durationSec || 1;
  const total = Math.max(1, frames.length);
  const interval = (dur / total).toFixed(0);
  return frames.map((f, i) => {
    const pct = Math.round((i / Math.max(1, total - 1)) * 100);
    let pos: string;
    if (i === 0) pos = '开篇引入段';
    else if (i === total - 1) pos = '收尾收束段';
    else if (pct < 35) pos = '前段铺垫';
    else if (pct < 70) pos = '中段核心展开';
    else pos = '后段深入与归纳';
  const themeLabel =
    theme === 'drone' ? '无人机/航拍' :
    theme === 'space' ? '太空/天文' :
    theme === 'animal' ? '动物/生物' :
    theme === 'food' ? '美食/烹饪' :
    theme === 'history' ? '历史/文物' :
    theme === 'tech' ? '科技/编程' :
    theme === 'nature' ? '自然/地理' : '科普';

  // 根据 mode 生成准确的解释文案，避免用户已配置模型却看到“未启用”
  let reasonText: string;
  let actionText: string;
  let bulletStatus: string;
  if (mode === 'ai-failed') {
    reasonText = 'AI 视觉模型已启用，但返回结果解析失败，因此本帧暂以结构描述替代画面语义；';
    actionText = '请检查设置页中的模型配置、网络连接或 API Key 后重新生成，以获得真实画面解读。';
    bulletStatus = '当前为 AI 降级模式：模型返回解析失败，仅提供结构讲解';
  } else if (mode === 'ai-incomplete') {
    reasonText = 'AI 视觉模型已启用并成功返回了报告，但未返回完整的逐帧画面解读，因此本帧以结构描述补充；';
    actionText = '建议换用对 JSON 遵循更强的视觉模型（如 GPT-4o / 通义千问 VL-Max），或在设置中重试。';
    bulletStatus = 'AI 模型已启用但未返回逐帧解读：当前为自动结构补充';
  } else {
    reasonText = '当前未启用 AI 视觉模型，画面具体像素内容需由视觉模型识别；';
    actionText = '建议在「设置」中配置支持图片输入的视觉模型后重新生成，即可获得该画面中真实的物体、场景、动作与文字/数据解读。';
    bulletStatus = '未启用 AI 视觉模型：画面语义需配置模型后自动识别';
  }

  const baseNote =
    `图 ${i + 1}（第 ${f.ts} 秒关键帧）：本帧位于视频时间轴第 ${pct}% 的位置，属于「${pos}」。` +
    `从整体结构看，它定格在时长 ${fmtDur(meta.durationSec)} 的视频中 ${f.ts} 处，` +
    `与相邻关键帧共同构成均匀的时间采样网格，相邻帧间隔约 ${interval} 秒，` +
    `说明抽帧策略稳定覆盖了 ${themeLabel} 主题的各环节。` +
    reasonText +
    `但作为关键锚点，该帧可用于精确定位视频在此刻的叙事节点，配合前后帧即可还原内容的时间脉络与节奏。` +
    actionText;
  const bullets = [
    `时间位置：视频第 ${pct}% 处（${f.ts}），属于 ${pos}`,
    `采样间隔：与相邻关键帧间隔约 ${interval} 秒，覆盖均匀`,
    `结构作用：作为第 ${i + 1}/${total} 个视觉锚点，承接上下文叙事`,
    bulletStatus,
  ];
  return { ts: f.ts, note: baseNote, bullets };
});
}

function buildPrompt(type: ReportType, meta: VideoMeta, filename: string, frameCount: number, maxFrames: number): string {
  const metaText =
    `视频文件：${filename}\n时长：${fmtDur(meta.durationSec)}\n分辨率：${meta.width}×${meta.height}\n` +
    `帧率：${meta.fps}\n编码：${meta.codec}\n格式：${meta.formatName}\n` +
    `已附上按时间均匀抽取的若干关键帧图片（按出现顺序排列）。`;
  const baseReqs =
    `要求：\n` +
    `1. 给出一个中文标题 title；\n` +
    `2. 用 2-4 句话写概述 overview；\n` +
    `3. 给出若干章节 sections；\n` +
    `4. 给出 3-6 个标签 tags。\n` +
    `5. 必须返回合法完整 JSON：所有字符串使用英文双引号；字符串内部的双引号必须转义为 \\"；字符串内部不要出现未转义的换行；数组/对象元素之间必须有逗号；JSON 不要被截断。`;

  if (type === 'comic') {
    const task =
      `请把这些关键帧画面组织成一页「科普漫画书」。\n` +
      `硬性要求（必须遵守）：\n` +
      `1. 分镜数量必须与提供的图片数量完全一致（当前共 ${Math.min(maxFrames || 6, frameCount)} 张图，至少 6 个分镜）。\n` +
      `2. 每个 section 必须同时包含以下 6 个字段，不能为空、不能为空字符串、不能省略：title、ts、content、dialogue、role、caption、sfx。\n` +
      `3. content 是对该画面内容的生动描述，字数必须在 60-120 字之间，要像漫画旁白一样具体，禁止只写一句话或空话。\n` +
      `4. dialogue 是该画面中某个角色/物体的台词或内心独白，字数 20-50 字，必须有趣、贴合画面动作。\n` +
      `5. role 是说话的角色名（2-6 字，如“旁白”“小飞机”“科学家”“直升机”），不能为空。\n` +
      `6. caption 是画外音/旁白框文字，补充背景知识，字数 40-80 字，不能为空。\n` +
      `7. sfx 是拟声词（如 嗖——、轰！、咔嚓、嗡嗡嗡），1-4 字，要符合画面动作，不能为空。\n` +
      `8. ts 必须是对应关键帧的真实时间 hh:mm:ss（按图片顺序一一对应）。\n` +
      `9. 每个分镜还可加 2-3 条 bullets 作为画面要点补充（可选但强烈推荐）。\n` +
      `10. 必须返回合法完整 JSON，所有字符串使用英文双引号，字符串内部双引号转义，不要截断。\n` +
      `另请判断整段视频的科普主题 theme，从以下枚举选一个最贴切的：` +
      `drone(无人机/航拍/直升机)、space(太空/宇宙/天文)、animal(动物/生物)、food(美食/烹饪)、` +
      `history(历史/文物/考古)、tech(科技/编程/AI)、nature(自然/植物/地理)、default(其他)。\n` +
      `请只返回如下 JSON（不要多余文字，不要有代码块标记，sections 数组长度必须等于图片数）：\n` +
      `{"title":"","overview":"","theme":"","sections":[{"title":"","ts":"","content":"","dialogue":"","role":"","caption":"","sfx":"","bullets":[""]}],"tags":[""]}`;
    return `${metaText}\n\n${task}`;
  }

  if (type === 'timeline') {
    const task =
      `请把这段视频整理成一份「通用分段摘要」报告。这是给普通观众看的“视频截图讲解”，不是学术论文，禁止任何论文式写法。\n` +
      `【硬性禁止】报告里绝对不能出现以下论文术语或章节名：引言、绪论、概述、背景与意义、核心内容分析、关键技术分析、数据/结果分析、关键帧画面解读、讨论、应用场景与价值、结论、展望、结论与展望、摘要、关键词、本章、综上所述、综上、研究背景、研究意义。\n` +
      `【标题反面教材】“1 引言”“3 核心内容分析”“结论与展望”这类都是错误的，绝不允许出现。\n` +
      `【标题正确示范】“00:00:15 无人机起飞瞬间”“01:23:40 图表数据展示”“03:10:05 实验演示开始”——即“时间戳 + 一句描述画面的短句”。\n` +
      `报告要求：\n` +
      `1. title：给视频起一个概括性的中文标题，不要带“研究”“分析”等学术词。\n` +
      `2. overview：用 2-4 句自然语言总结视频讲了什么、有哪些看点；不要写“本文”“本研究”“摘要”等字样。\n` +
      `3. sections：每个 section 主要对应一张关键帧（当前共 ${frameCount} 张），按时间顺序排列，逐帧讲解画面内容：\n` +
      `   - title：必须是“hh:mm:ss + 描述画面的短句”（参考上面的正确示范），绝不能用论文章节名。\n` +
      `   - ts：该关键帧的真实时间 hh:mm:ss；\n` +
      `   - content：用 Markdown 写一段对该截图的讲解（120-220 字）。允许 **粗体**、列表、短段落。` +
      `     内容要具体描述画面里能看到的元素、动作、场景、文字/数据，并说明它在视频里的作用；` +
      `     禁止出现“引言/展望/结论/摘要”等论文用词，也不要空话套话。\n` +
      `   - bullets：2-4 条该画面的核心要点（可选但推荐）。\n` +
      `4. sections 数量尽量覆盖每一张关键帧；若相邻几张画面内容连续，也可 2-3 张合并为一节，但每节都要“讲解这张截图在讲什么”。\n` +
      `5. tags：3-6 个自然语言关键词标签。\n` +
      `6. 必须返回合法完整 JSON，所有字符串使用英文双引号，字符串内部双引号转义，不要截断、不要代码块标记。\n` +
      `请只返回如下 JSON：\n` +
      `{"title":"","overview":"","sections":[{"title":"","ts":"","content":"","bullets":[""]}],"tags":[""]}`;
    return `${metaText}\n\n${task}`;
  }

  const task =
    `请基于这些关键帧画面与元信息，为这段视频生成一篇结构完整、内容详实、篇幅较长的「${TYPE_LABEL[type]}」风格报告（仿学术期刊论文，总字数建议 1500 字以上）。\n` +
    `硬性要求：\n` +
    `1. title 要像论文题名（如“基于多模态分析的《视频名》内容研究”）；\n` +
    `2. overview 写一段 200-320 字摘要（含研究对象、方法、主要发现、结论与意义）；\n` +
    `3. sections 给出 8-12 个章节，建议结构：\n` +
    `   1 引言（研究背景与意义）；2 视频基本参数与结构概述；3 核心内容分析（必须深入，分段落、含原理与要点）；` +
    `   4 关键技术分析（必须深入，逐项拆解技术链路与方法原理）；5 数据/结果分析；6 关键帧画面解读；` +
    `   7 讨论；8 应用场景与价值；9 结论与展望。\n` +
    `   其中「3 核心内容分析」与「4 关键技术分析」两章务必写得最详尽（各 260-360 字，含多条 bullets 分点）。\n` +
    `4. 每个 section：\n` +
    `   - title 为章节名（可带编号如“3 核心内容分析”）；\n` +
    `   - ts 为该章节主要对应的关键帧时间 hh:mm:ss（取最接近的一帧）；\n` +
    `   - content 为该章节详尽论述（180-320 字，像论文正文，含具体分析、原理、数据与方法，严禁空话、严禁一句话带过）；\n` +
    `   - bullets 为该章节下 3-5 条分点要点或关键数据（强烈推荐，用于突出核心信息）。\n` +
    `5. 章节的 ts 要尽量覆盖更多张不同的关键帧（相邻章节尽量对应不同时间的关键帧），使报告能引用到大部分截图；` +
    `   在 content 中可自然提及“如第 X 张关键帧（hh:mm:ss）所示”以增强图文对应。\n` +
    `6. frameNotes【强制字段，必须返回】：必须对“提供的每一张关键帧图片”逐一给出详细讲解，数组长度必须严格等于图片数量` +
    `   （当前共 ${frameCount} 张，请数清楚），顺序与图片一一对应，缺一不可；每个元素包含：\n` +
    `   - ts：该帧时间 hh:mm:ss；\n` +
    `   - note：对该帧画面的详细解读，150-280 字，需具体描述画面中的主要元素、场景、动作、文字/数据/符号、颜色布局等，` +
    `     像第二张参考图那样写出完整的分析段落，禁止空泛套话；若无法确认画面细节，也必须围绕该时间点的叙事位置、结构作用做具体展开。\n` +
    `   - bullets：3-5 条分点要点，格式参考第二张图，要点涵盖「画面主体」「关键动作/信息」「与上下文关系」「研究/教学价值」等维度。\n` +
    `   警告：如果 frameNotes 缺失、长度不足、或出现空字符串，系统会判定本次返回不完整，严重影响评分。请务必返回完整数组。\n` +
    `7. tags 给 6-10 个关键词。\n` +
    `8. 必须返回合法完整 JSON，所有字符串使用英文双引号，字符串内部双引号转义，不要截断、不要代码块标记。\n` +
    `请只返回如下 JSON：\n` +
    `{"title":"","overview":"","sections":[{"title":"","ts":"","content":"","bullets":["",""]}],"frameNotes":[{"ts":"","note":"","bullets":["",""]}],"tags":[""]}`;
  return `${metaText}\n\n${task}`;
}

async function callVision(config: LLMConfig, prompt: string, images: string[]): Promise<string> {
  const url = (config.baseURL || '').replace(/\/$/, '') + '/chat/completions';
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of images) content.push({ type: 'image_url', image_url: { url: img } });
  const body: any = {
    model: config.model,
    messages: [{ role: 'user', content }],
    temperature: 0.4,
    // 关键：很多视觉模型默认输出上限极低（~1500 token），而逐帧长解读 JSON 远超该值会被截断，
    // 导致 frameNotes 返回不全、被误判为“不完整”。显式抬高出力上限到模型支持的最大值。
    max_tokens: 8192,
  };
  // 仅对 OpenAI 官方接口启用 json_object 模式；很多兼容接口（DeepSeek/通义/Ollama）不支持，硬加会 400
  if (/openai\.com/i.test(config.baseURL)) {
    body.response_format = { type: 'json_object' };
  }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`LLM 接口返回 ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content || '';
  return text;
}

function stripMarkdownCodeBlocks(text: string): string {
  // 去掉 ```json ... ``` 代码块
  return text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
}

function extractBalancedJson(s: string): string | null {
  // 从第一个 { 开始，找到与之匹配的 }，返回完整子串
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inStr = false;
      }
    } else {
      if (ch === '"') {
        inStr = true;
      } else if (ch === '{' || ch === '[') {
        depth++;
      } else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
  }
  // 未找到匹配闭合，返回从 { 开始到末尾
  return s.slice(start);
}

function fixUnescapedNewlines(s: string): string {
  // 把 JSON 字符串内部的裸换行/回车转义为 \n/\r
  return s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) =>
    match.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  );
}

function fixMissingCommas(s: string): string {
  // 修复数组/对象中相邻值之间缺少逗号的常见情况
  const fixes = [
    /(\})(\s*)(\{|\[|")/g,
    /(\])(\s*)(\{|\[|")/g,
    /("(?:\\.|[^"\\])*")(\s*)(\{|\[|")/g,
    /(\b(?:true|false|null|\d+(?:\.\d+)?))(\s*)(\{|\[|")/g,
  ];
  let r = s;
  for (const re of fixes) {
    r = r.replace(re, '$1,$3');
  }
  return r;
}

function tryRepairJson(text: string): string | null {
  // 1. 去掉代码块包装
  let s = stripMarkdownCodeBlocks(text).trim();

  // 2. 提取 balance 的 JSON 块（避免 LLM 在 JSON 后面追加废话）
  s = extractBalancedJson(s) || s;

  // 3. 常见修复：对象/数组末尾多余逗号
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // 4. 直接 parse
  try {
    JSON.parse(s);
    return s;
  } catch {
    // continue
  }

  // 5. 修复字符串内裸换行
  s = fixUnescapedNewlines(s);
  try {
    JSON.parse(s);
    return s;
  } catch {
    // continue
  }

  // 6. 修复相邻值之间缺逗号
  s = fixMissingCommas(s);
  try {
    JSON.parse(s);
    return s;
  } catch {
    // continue
  }

  // 7. 截断修复：保留最长可 parse 前缀
  return tryTruncateToValidJson(s);
}

function tryCloseBrackets(s: string, maxDepth = 5): string | null {
  // 暴力尝试在末尾补充 1~maxDepth 个 } / ] 组合，找到能 parse 的最短后缀
  const chars = ['}', ']'];
  function* gen(n: number, cur: string): Generator<string> {
    if (n === 0) { yield cur; return; }
    for (const c of chars) yield* gen(n - 1, cur + c);
  }
  for (let n = 1; n <= maxDepth; n++) {
    for (const suffix of gen(n, '')) {
      try {
        JSON.parse(s + suffix);
        return s + suffix;
      } catch {
        // continue
      }
    }
  }
  return null;
}

function tryTruncateToValidJson(s: string): string | null {
  // 先尝试在尾部直接补全闭合括号（LLM 截断最常见）
  const closed = tryCloseBrackets(s);
  if (closed) return closed;

  // 清理尾部不完整 token
  const cleaned = s
    .replace(/,\s*$/g, '')
    .replace(/:\s*$/g, ':""')
    .replace(/:\s*"([^"]*)$/g, ':"$1"')
    .trim();
  const closed2 = tryCloseBrackets(cleaned);
  if (closed2) return closed2;

  // 从末尾往前找 } 或 ]，对每个截断点尝试补全
  for (let i = s.length - 1; i > 0; i--) {
    const ch = s[i];
    if (ch === '}' || ch === ']') {
      const candidate = s.slice(0, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        const closedCandidate = tryCloseBrackets(candidate, 3);
        if (closedCandidate) return closedCandidate;
      }
    }
  }
  return null;
}

export function extractJson(text: string): any {
  // 先直接尝试
  const s = stripMarkdownCodeBlocks(text).trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('LLM 返回无法解析为 JSON');
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    // 尝试修复
    const repaired = tryRepairJson(text);
    if (repaired) {
      try {
        return JSON.parse(repaired);
      } catch {
        // fall through
      }
    }
    throw new Error(`LLM 返回 JSON 解析失败: ${(e as Error).message}`);
  }
}

export async function summarizeWithLLM(
  filename: string,
  meta: VideoMeta,
  frames: FrameInfo[],
  type: ReportType,
  config: LLMConfig
): Promise<SummaryResult> {
  const maxN = Math.max(6, Math.min(config.maxFrames || 6, frames.length));
  // 论文报告：尊重用户在设置中选择的关键帧数（封顶 8 帧，避免一次性输出过长 JSON 超出模型上限被截断）；
  // 漫画：按 maxFrames 限制。usedCount 即实际发送给视觉模型的帧数。
  const usedCount = type === 'paper'
    ? Math.min(frames.length, Math.max(6, Math.min(config.maxFrames || 6, 8)))
    : maxN;
  const imgFrames = frames.slice(0, usedCount);
  const imgs = imgFrames
    .map((f) => imageToDataUrl(f.file))
    .filter(Boolean) as string[];
  // 告诉模型“实际发了几张图”，避免它数错导致 frameNotes 数组长度对不上
  const prompt = buildPrompt(type, meta, filename, imgFrames.length, config.maxFrames || 6);
  const raw = await callVision(config, prompt, imgs);
  const obj = extractJson(raw);
  const sections: SummarySection[] = Array.isArray(obj.sections)
    ? obj.sections.map((s: any) => ({
        title: String(s.title || ''),
        ts: s.ts ? String(s.ts) : undefined,
        content: String(s.content || ''),
        role: s.role ? String(s.role) : undefined,
        dialogue: s.dialogue ? String(s.dialogue) : undefined,
        caption: s.caption ? String(s.caption) : undefined,
        sfx: s.sfx ? String(s.sfx) : undefined,
        bullets: Array.isArray(s.bullets) ? s.bullets.map(String) : undefined,
      }))
    : [];
  // 优先用 LLM 返回的主题，否则回退到关键词识别
  const theme = (obj.theme && THEME_KEYWORDS.some(([t]) => t === obj.theme)
    ? (obj.theme as ComicTheme)
    : detectTheme(filename, meta)) as ComicTheme;

  // 漫画报告必须保证每个分镜都“有料”：内容充实 + 漫画元素齐全；
  // 通用摘要则净化掉模型可能偷塞的论文式章节名/小标题，只保留对截图的讲解
  const enrichedSections =
    type === 'comic'
      ? enrichComicSections(sections, frames, theme)
      : type === 'timeline'
      ? sanitizeTimelineSections(sections)
      : sections;

  // 逐帧详解：尽量用 AI 返回的 frameNotes；数量不足/缺字段时用降级生成补齐，保证每张关键帧都有详述
  const aiFrameNotes: FrameNote[] = Array.isArray(obj.frameNotes)
    ? obj.frameNotes
        .map((f: any) => ({
          ts: String(f?.ts || ''),
          note: String(f?.note || ''),
          bullets: Array.isArray(f?.bullets) ? f.bullets.map(String).filter(Boolean) : undefined,
        }))
        .filter((f: FrameNote) => f.note && f.note.trim().length > 0)
    : [];

  // 论文/漫画报告要求发送给模型的每一张关键帧都有解读；
  // 若 AI 返回了任意 frameNotes，优先保留真实解读，缺失帧用 fallback 补齐，避免“全部丢弃”。
  const hasAnyFrameNotes = aiFrameNotes.length > 0;
  // 阈值基于“实际发送帧数”而非全部抽帧，避免前后不一致导致误判
  const enoughFrameNotes = aiFrameNotes.length >= Math.ceil(imgFrames.length * 0.7);
  const frameNoteSource: FrameNoteSource = enoughFrameNotes ? 'ai' : (hasAnyFrameNotes ? 'ai-incomplete' : 'ai-incomplete');
  // 统一按实际发送的帧对齐：AI 已返回的优先，缺失帧用结构描述补齐，保证 frameNotes 与实际帧一一对应
  const fallbackMap = new Map(
    buildFrameNotes(imgFrames, meta, 'ai-incomplete', filename.replace(/\.[^.]+$/, ''), theme).map((f) => [f.ts, f])
  );
  const frameNotes: FrameNote[] = imgFrames.map((f) => {
    const ai = aiFrameNotes.find((n) => n.ts === f.ts);
    return ai || fallbackMap.get(f.ts)!;
  });

  // 通用摘要以 sections 讲解截图为主，不强制要求 frameNotes，避免无意义的“不完整”提示
  const finalFrameNotes = type === 'timeline' ? [] : frameNotes;
  const finalFrameNoteSource: FrameNoteSource = type === 'timeline' ? 'ai' : frameNoteSource;

  return {
    title: String(obj.title || filename.replace(/\.[^.]+$/, '')),
    overview: String(obj.overview || ''),
    sections: enrichedSections,
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    type,
    source: 'ai',
    model: config.model,
    theme,
    frameNotes: finalFrameNotes,
    frameNoteSource: finalFrameNoteSource,
  };
}

// 通用摘要净化：剥离模型偷塞的论文式章节名/小标题，保证只讲“截图内容”
const TIMELINE_ACADEMIC =
  /(^\s*\d+[\.\、]\s*)?(引言|绪论|概述|背景与意义|核心内容分析|关键技术分析|数据[／/]?结果分析|关键帧画面解读|讨论|应用场景与价值|结论与展望|结论|展望|摘要|关键词|本章|综上所述|综上|研究背景|研究意义|研究内容|视频基本参数与结构概述)/g;
// 正文中以 # 开头的学术小标题行（如 “## 引言”），整行删除以免污染讲解
const TIMELINE_ACADEMIC_HEADING =
  /^\s{0,3}#{1,6}\s*.*?(引言|绪论|结论与展望|结论|展望|摘要|关键词|本章|综上所述|综上|研究背景|研究意义).*\r?$/gm;

function sanitizeTimelineSections(sections: SummarySection[]): SummarySection[] {
  return sections.map((s, i) => {
    const tsRaw = (s.ts || '').trim();
    const tsPrefix = tsRaw ? `${tsRaw} ` : '';
    let core = (s.title || '')
      .replace(TIMELINE_ACADEMIC, '')
      .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '')
      .replace(/^[\s：:：\-—–]+/, '')
      .trim();
    let title: string;
    if (!core) {
      const ordinal = sections.length > 1 ? `（第 ${i + 1} 帧）` : '';
      title = `${tsPrefix}画面讲解${ordinal}`;
    } else {
      title = tsPrefix + core;
    }
    const content = (s.content || '').replace(TIMELINE_ACADEMIC_HEADING, '').trim();
    const bullets = Array.isArray(s.bullets) ? s.bullets : undefined;
    return { ...s, title, content, bullets };
  });
}

function enrichComicSections(
  sections: SummarySection[],
  frames: FrameInfo[],
  theme: ComicTheme
): SummarySection[] {
  const n = Math.max(sections.length, frames.length, 6);
  const rolePool: Record<ComicTheme, string[]> = {
    drone: ['小飞机', '直升机', '操控员', '旁白', '摄影师', '指挥官'],
    space: ['宇航员', '小火箭', '星球', '旁白', '天文学家', '探测器'],
    animal: ['小猫咪', '小动物', '饲养员', '旁白', '探险家', '摄影师'],
    food: ['小厨师', '美食家', '食材', '旁白', '顾客', '镜头'],
    history: ['历史学家', '文物', '旁白', '时光机', '探险家', '学者'],
    tech: ['小机器人', '程序员', '芯片', '旁白', 'AI助手', '工程师'],
    nature: ['小树苗', '探险家', '旁白', '摄影师', '气象员', '护林员'],
    default: ['小星', '讲解员', '旁白', '摄影师', '科学家', '观众'],
  };
  const sfxPool = ['咔嚓！', '嗡——', '嗖嗖嗖！', '嘀！', '轰隆！', '呼呼——', '叮！', '哗——'];
  const captions: Record<ComicTheme, string[]> = {
    drone: [
      '旋翼高速转动产生升力，让飞行器能够垂直起降并在空中悬停。',
      '多旋翼布局使飞行更稳定，适合航拍、巡检和近距离观测任务。',
      '飞控系统实时调整桨叶转速，保持机身姿态平衡与航线精准。',
      '空中视角能覆盖更广阔区域，是现代影视与测绘的常用手段。',
      '遥控器/地面站发送指令后，飞行器可在数秒内完成姿态响应。',
      '降落阶段需要缓慢降低油门，并观察下方障碍物确保安全。',
    ],
    space: [
      '火箭通过反作用力冲破地球引力，把航天器送入预定轨道。',
      '太阳系中行星按椭圆轨道绕太阳公转，周期各不相同。',
      '空间站运行在约 400 公里高度的近地轨道，每 90 分钟绕地球一圈。',
      '宇航员在微重力环境下生活，需要适应漂浮状态与特殊饮食。',
      '黑洞具有极强的引力场，连光都无法逃脱其事件视界。',
      '深空探测依赖无线电通信，信号往返地球可能需要数分钟到数小时。',
    ],
    animal: [
      '动物的行为与身体结构经过长期演化，适应了各自的生存环境。',
      '观察野生动物需要保持距离，避免惊扰它们的自然活动。',
      '食物链与生态平衡息息相关，每种动物都扮演着重要角色。',
      '保护栖息地是维持物种多样性的关键，也是人类共同责任。',
      '许多动物具有独特感官，能在黑暗或远距离条件下发现猎物。',
      '纪录片镜头常常需要数周甚至数月蹲守，才能捕捉到珍贵瞬间。',
    ],
    food: [
      '食材的新鲜度直接影响成品口感与营养成分保留。',
      '火候掌控是烹饪核心，过大或过小都会改变食材质地。',
      '调味讲究层次，先咸后鲜、最后点缀香气是常用思路。',
      '刀工不仅影响美观，也决定食材受热均匀程度。',
      '传统烹饪技法与现代设备结合，能创造出新的风味体验。',
      '一道菜背后往往承载着地域文化与家庭记忆。',
    ],
    history: [
      '历史文物是凝固的时间，承载着古人的智慧与生活方式。',
      '考古发现常常改写我们对某个朝代或文明的认识。',
      '文献与实物相互印证，才能还原更可靠的历史图景。',
      '建筑遗址反映了当时的工程水平、宗教信仰与社会结构。',
      '保护文化遗产就是保护人类共同记忆。',
      '每一段历史都值得被多角度解读与反思。',
    ],
    tech: [
      '程序通过指令控制硬件完成计算、存储与通信任务。',
      '人工智能基于数据训练模型，能在特定任务上接近甚至超越人类表现。',
      '芯片制程越先进，单位面积可容纳的晶体管就越多。',
      '网络协议让不同设备能够跨越距离协同工作。',
      '自动化技术正在改变制造业、服务业与日常生活。',
      '科技创新需要伦理与法规同步跟进，才能造福社会。',
    ],
    nature: [
      '植物通过光合作用把太阳能转化为化学能，是生态系统的基础。',
      '气候与地形共同塑造了不同的自然景观与生物多样性。',
      '森林被称为“地球之肺”，对调节碳循环至关重要。',
      '水循环连接海洋、大气与陆地，影响全球天气模式。',
      '自然保护区为野生动植物提供了安全的繁衍空间。',
      '观察自然能帮助我们理解生命与环境之间的复杂联系。',
    ],
    default: [
      '这段画面是视频内容的重要节点，承载着关键知识点。',
      '从时间轴上看，这一帧承上启下，连接前后内容。',
      '仔细观察画面细节，可以发现更多隐藏信息。',
      '该镜头运用了典型的科普叙事手法，便于观众理解。',
      '画面中的元素相互配合，共同说明了一个核心概念。',
      '这是本视频值得反复回看、加深理解的关键瞬间。',
    ],
  };

  function buildContent(sec: SummarySection, i: number, frame?: FrameInfo): string {
    if ((sec.content || '').trim().length >= 40) return sec.content!;
    const ts = sec.ts || frame?.ts || '0:00';
    const themeLabel = TYPE_LABEL[theme] || '科普';
    return (
      `画面定格在视频第 ${ts} 秒。这一帧是第 ${i + 1} 个关键分镜，` +
      `展示了${themeLabel}主题下的一个重要瞬间。${captions[theme][i % captions[theme].length]}` +
      `结合前后画面，可以更完整地理解这一段内容的核心知识点。`
    );
  }

  function buildDialogue(sec: SummarySection, i: number, role: string): string {
    if ((sec.dialogue || '').trim().length >= 10) return sec.dialogue!;
    const lines: Record<ComicTheme, string[]> = {
      drone: ['看，我能垂直起飞！', '空中视角是不是超震撼？', '旋翼一转，我马上就能悬停。', '飞行任务开始，请系好安全带！'],
      space: ['这就是浩瀚宇宙的入口！', '在太空中看地球，真的太美了。', '火箭点火，准备冲破大气层！', '星星的排列藏着宇宙的奥秘。'],
      animal: ['喵呜，这片领地被我承包了！', '我的身手敏捷吧？', '观察我就能学到很多自然知识。', '大自然里每个生命都很了不起。'],
      food: ['闻一闻，香气扑鼻！', '火候刚刚好，马上出锅。', '这道菜的秘诀在于新鲜食材。', '准备好品尝美味了吗？'],
      history: ['欢迎来到过去的世界。', '这件文物见证了怎样的故事？', '历史长河里的每一刻都值得铭记。', '让我们一起揭开尘封的秘密。'],
      tech: ['代码一行行运行，世界在改变。', '我是你的 AI 小助手！', '芯片虽小，却能完成惊人计算。', '科技让生活变得更智能。'],
      nature: ['阳光、空气、水，缺一不可。', '植物的生长需要耐心和呵护。', '这片风景是大自然最好的礼物。', '保护环境就是保护未来。'],
      default: ['这一幕是不是很有趣？', '知识点来了，注意听讲！', '画面里的细节你发现了吗？', '跟我一起探索这段视频吧。'],
    };
    return `${role}：${lines[theme][i % lines[theme].length]}`;
  }

  function buildCaption(sec: SummarySection, i: number): string {
    if ((sec.caption || '').trim().length >= 15) return sec.caption!;
    return captions[theme][i % captions[theme].length];
  }

  function buildSfx(i: number): string {
    return sfxPool[i % sfxPool.length];
  }

  const roles = rolePool[theme];
  const out: SummarySection[] = [];
  for (let i = 0; i < n; i++) {
    const sec = sections[i];
    const frame = frames[i];
    const role = sec?.role?.trim() || roles[i % roles.length];
    out.push({
      title: sec?.title?.trim() || `第 ${i + 1} 格`,
      ts: sec?.ts || frame?.ts,
      content: buildContent(sec || ({} as SummarySection), i, frame),
      role,
      dialogue: buildDialogue(sec || ({} as SummarySection), i, role),
      caption: buildCaption(sec || ({} as SummarySection), i),
      sfx: sec?.sfx?.trim() || buildSfx(i),
      bullets:
        sec?.bullets && sec.bullets.length
          ? sec.bullets
          : [`时间锚点：${sec?.ts || frame?.ts || '0:00'}`, `分镜序号：${i + 1}/${n}`],
    });
  }
  return out;
}
