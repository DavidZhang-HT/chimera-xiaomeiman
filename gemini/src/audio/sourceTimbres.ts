import type { VoiceSource } from "../wasm/types.ts";

/** Strong replacement presets transpose the final source pitch inside the engine. */
export const TIMBRE_KEYS = ["breathiness", "tension", "brightness", "roughness", "drift"] as const;
type TimbrePatch = Pick<VoiceSource, typeof TIMBRE_KEYS[number]>;
export const SOURCE_TIMBRES = [
  { id: "original", name: "原声", hint: "保留当前声源旋钮设置", source: null },
  { id: "warm", name: "温润", hint: "较柔和的声带闭合，减少高频棱角", source: { breathiness: 0.10, tension: 0.38, brightness: 0.08, roughness: 0.07, drift: 4 } },
  { id: "airy", name: "轻气声", hint: "增加声门漏气，放松闭合力度", source: { breathiness: 0.50, tension: 0.33, brightness: 0.10, roughness: 0.10, drift: 6 } },
  { id: "clear", name: "清亮", hint: "更利落的闭合，增加谐波亮度", source: { breathiness: 0.08, tension: 0.62, brightness: 0.62, roughness: 0.06, drift: 3 } },
  { id: "husky", name: "微沙哑", hint: "增加周期与振幅微扰，保留音高目标", source: { breathiness: 0.28, tension: 0.58, brightness: 0.38, roughness: 0.42, drift: 7 } },
  { id: "female-strong", name: "女声强替代", hint: "基频 +7 半音 · 柔和闭合 · 降低粗糙度", source: { breathiness: 0.22, tension: 0.36, brightness: 0.18, roughness: 0.025, drift: 2 } },
  { id: "child-strong", name: "童音强替代 · 空灵", hint: "基频 +12 半音 · 清澈轻柔 · 低粗糙度", source: { breathiness: 0.18, tension: 0.30, brightness: 0.22, roughness: 0.01, drift: 1.2 } },
] as const satisfies readonly { id: string; name: string; hint: string; source: TimbrePatch | null }[];

export type SourceTimbreId = typeof SOURCE_TIMBRES[number]["id"];
/** Shared by the source blend and UI so the pitch shift and recommended tract agree. */
export function strongReplacement(id: SourceTimbreId): { semitones: number; body: "female" | "child"; label: string } | null {
  if (id === "female-strong") return { semitones: 7, body: "female", label: "女性" };
  if (id === "child-strong") return { semitones: 12, body: "child", label: "童声" };
  return null;
}
export interface SourceTimbreSettings { id: SourceTimbreId; amount: number; bypass: boolean }
export const DEFAULT_TIMBRE: SourceTimbreSettings = { id: "original", amount: 1, bypass: false };

/** Always blend from the user's unmodified settings, never from the previous preset. */
export function applySourceTimbre(base: VoiceSource, settings: SourceTimbreSettings): VoiceSource {
  const target = SOURCE_TIMBRES.find((p) => p.id === settings.id)?.source;
  const amount = Number.isFinite(settings.amount) ? Math.max(0, Math.min(1, settings.amount)) : 0;
  const result = { ...base };
  if (!target || settings.bypass || amount === 0) return result;
  for (const key of TIMBRE_KEYS) result[key] = base[key] + (target[key] - base[key]) * amount;
  const replacement = strongReplacement(settings.id);
  if (replacement) {
    result.pitchShiftSemitones = base.pitchShiftSemitones + replacement.semitones * amount;
    result.fry = base.fry * (1 - amount);
  }
  return result;
}
