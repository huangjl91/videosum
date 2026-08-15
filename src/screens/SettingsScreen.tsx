import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Bot, CheckCircle2 } from 'lucide-react';
import { getConfig, saveConfig, LLMConfig } from '../api';

const PRESETS = [
  { name: 'OpenAI', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '本地 Ollama', baseURL: 'http://localhost:11434/v1', model: 'llava' },
  { name: '阿里通义', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
];

export default function SettingsScreen() {
  const [cfg, setCfg] = useState<LLMConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig().then((r) => setCfg(r.config)).catch(() => {});
  }, []);

  if (!cfg) return <div className="p-6 text-[13px] text-sub2">加载中…</div>;

  const update = (patch: Partial<LLMConfig>) => {
    setCfg({ ...cfg, ...patch });
    setSaved(false);
  };

  const onSave = async () => {
    await saveConfig(cfg);
    setSaved(true);
  };

  return (
    <div className="vs-fade p-6 max-w-[760px] mx-auto">
      <div className="flex items-center gap-2 text-[16px] font-semibold text-ink">
        <SettingsIcon size={18} /> AI 模型设置
      </div>
      <div className="text-[13px] text-sub2 mt-1">
        配置兼容 OpenAI 的视觉模型接口后，总结将基于视频关键帧的真实画面内容生成；未配置时使用视频元数据生成结构摘要。
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => update({ baseURL: p.baseURL, model: p.model })}
            className="text-[12px] text-primary border border-primary/40 bg-[#EAF1FE] px-3 py-1 rounded-pill hover:bg-[#DCEBFE]"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-card bg-white border border-hairline/60 shadow-card p-5 space-y-4">
        <label className="flex items-center gap-2 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="w-4 h-4"
          />
          启用 AI 视觉模型生成总结
        </label>

        <div>
          <div className="text-[12px] text-sub2 mb-1">接口地址 (Base URL)</div>
          <input
            value={cfg.baseURL}
            onChange={(e) => update({ baseURL: e.target.value })}
            className="w-full h-9 px-3 rounded-btn border border-hairline text-[13px]"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div>
          <div className="text-[12px] text-sub2 mb-1">API Key</div>
          <input
            type="password"
            value={cfg.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            className="w-full h-9 px-3 rounded-btn border border-hairline text-[13px]"
            placeholder="sk-..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-sub2 mb-1">模型名</div>
            <input
              value={cfg.model}
              onChange={(e) => update({ model: e.target.value })}
              className="w-full h-9 px-3 rounded-btn border border-hairline text-[13px]"
            />
          </div>
          <div>
            <div className="text-[12px] text-sub2 mb-1">最大关键帧数</div>
            <input
              type="number"
              min={1}
              max={12}
              value={cfg.maxFrames}
              onChange={(e) => update({ maxFrames: Number(e.target.value) })}
              className="w-full h-9 px-3 rounded-btn border border-hairline text-[13px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            className="h-9 px-5 rounded-btn bg-primary hover:bg-[#1666cf] text-white text-[13px] font-medium flex items-center gap-1.5"
          >
            <Save size={15} /> 保存
          </button>
          {saved && (
            <span className="text-[12px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={14} /> 已保存
            </span>
          )}
        </div>

        <div className="text-[11px] text-sub2 flex items-center gap-1.5">
          <Bot size={13} /> 需使用支持图片输入的视觉模型（vision）。配置文件仅保存在本机用户目录。
        </div>
      </div>
    </div>
  );
}
