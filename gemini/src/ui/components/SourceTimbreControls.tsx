import { SOURCE_TIMBRES, strongReplacement, type SourceTimbreId } from "../../audio/sourceTimbres.ts";
import { useStore } from "../store.ts";
import { Screen, Chip } from "./Screen.tsx";
import { PRESETS, sameBody } from "../body.ts";
import { SongPlayback } from "./SongPlayback.tsx";
import { playDemo, useSing } from "../singing.ts";

export function SourceTimbreControls() {
  const singing = useStore((s) => s.mode === "sing");
  const settings = useStore((s) => s.sourceTimbre);
  const set = useStore((s) => s.setSourceTimbre);
  const preset = SOURCE_TIMBRES.find((p) => p.id === settings.id)!;
  const replacement = strongReplacement(settings.id);
  const selectPreset = (id: SourceTimbreId) => {
    const s = useStore.getState();
    // A deliberate strong replacement selects its corresponding vocal tract.
    // Subsequent body switches remain available as a comparison; bypass retains this tract.
    const demo = useSing.getState().demo;
    const target = strongReplacement(id);
    const body = target ? PRESETS[target.body] : s.body;
    const changeBody = !sameBody(s.body, body);
    if (changeBody) s.setBody(body);
    set({ id, bypass: false });
    if (changeBody && s.mode === "sing" && demo) void playDemo(demo, body, s.start);
  };
  return (
    <Screen title={singing ? "可选音色唱歌" : "声源音色"} sub={singing ? "选歌 · 选音色 · 开始唱歌" : "进入声道前"} className="source-timbre" label="声源音色滤镜">
      {singing && <SongPlayback />}
      <div className="source-timbre-row">
        <label>仿人声预设
          <select aria-label="仿人声预设" value={settings.id} onChange={(e) => selectPreset(e.target.value as SourceTimbreId)}>
            {SOURCE_TIMBRES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>强度 {Math.round(settings.amount * 100)}%
          <input aria-label="音色强度" type="range" min="0" max="1" step="0.01" value={settings.amount} disabled={settings.id === "original" || settings.bypass} onChange={(e) => set({ amount: Number(e.target.value) })} />
        </label>
        <Chip on={settings.bypass} disabled={settings.id === "original"} onClick={() => set({ bypass: !settings.bypass })}>旁路 · 听原声</Chip>
        <span className="source-timbre-hint" aria-live="polite">{settings.bypass ? "旁路中：使用原声设置" : preset.hint}</span>
        <a href="/timbre-lab/index.html" target="_blank" rel="noreferrer">打开对照试听 ↗</a>
      </div>
      <p className="source-timbre-note">{replacement ? `${preset.name}：基频升高 ${(replacement.semitones * settings.amount).toFixed(1)} 半音（旁路时不升调），对正在播放的乐谱同样有效。选择时切到${replacement.label}声道；旁路保留该声道。合成音色试验，非真人声纹。` : "调节声带激励；音高、口型和节奏沿用当前设置。"} 旋钮为原始值；3D 舞台预录音不受影响。</p>
    </Screen>
  );
}
