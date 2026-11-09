import { DEFAULT_SOURCE, NEUTRAL, type HumanArtic, type VoiceSource } from "../wasm/engine.ts";

export type TimbreFilterId =
  | "natural"
  | "warm_pop"
  | "sweet_clear"
  | "bel_canto"
  | "intimate_airy"
  | "husky_soul";

export interface TimbreFilterPreset {
  id: TimbreFilterId;
  label: string;
  shortLabel: string;
  desc: string;
  /** Input glottal fold source parameters (VoiceSource patch, excluding f0/voiced) */
  source: Omit<Partial<VoiceSource>, "f0" | "voiced">;
  /** Supraglottal & laryngeal input posture (larynx, root, epilarynx, ventricular, lipWidth) */
  artic: Partial<HumanArtic>;
  /** Default singing vibrato depth in cents */
  vibrato: number;
  /** Subtle acoustic radiation / formant shaping for live & show playback */
  eq: {
    lowShelfDb: number;    // 220 Hz chest warmth
    mudCutDb: number;      // 750 Hz boxy/electronic nasal cut
    presenceHz: number;    // 2600-3400 Hz singer's formant focus
    presenceDb: number;
    airShelfDb: number;    // 6000 Hz breathy silkiness / harshness roll-off
    lowpassHz: number;     // anti-buzz high roll-off
  };
}

export const TIMBRE_FILTERS: TimbreFilterPreset[] = [
  {
    id: "warm_pop",
    label: "温暖流行 · Warm Pop",
    shortLabel: "温暖流行",
    desc: "微降喉位扩大咽腔共鸣 + 柔和声带闭合与轻气声后隙（周深式治愈抒情音色）",
    source: {
      pressure: 8.6,
      tension: 0.44,
      brightness: 0.36,
      breathiness: 0.26,
      roughness: 0.08,
      fry: 0.0,
      vibratoRate: 5.6,
      drift: 6.5,
      glide: 0.065,
    },
    artic: {
      larynx: -0.28,
      root: 0.24,
      epilarynx: 0.32,
      ventricular: 0.04,
      lipWidth: 0.62,
    },
    vibrato: 32,
    eq: {
      lowShelfDb: 3.5,
      mudCutDb: -3.2,
      presenceHz: 2850,
      presenceDb: 2.2,
      airShelfDb: 1.8,
      lowpassHz: 9500,
    },
  },
  {
    id: "sweet_clear",
    label: "清甜透亮 · Sweet Clear",
    shortLabel: "清甜透亮",
    desc: "微抬喉位缩短声道 + 微笑展唇提亮 F2/F3 + 清脆会厌管聚焦（贴耳甜歌音色）",
    source: {
      pressure: 8.4,
      tension: 0.54,
      brightness: 0.56,
      breathiness: 0.20,
      roughness: 0.06,
      fry: 0.0,
      vibratoRate: 5.9,
      drift: 5.0,
      glide: 0.05,
    },
    artic: {
      larynx: 0.38,
      root: 0.12,
      epilarynx: 0.48,
      ventricular: 0.0,
      lipWidth: 0.84,
    },
    vibrato: 26,
    eq: {
      lowShelfDb: 0.5,
      mudCutDb: -2.8,
      presenceHz: 3300,
      presenceDb: 3.5,
      airShelfDb: 2.8,
      lowpassHz: 11500,
    },
  },
  {
    id: "bel_canto",
    label: "美声共鸣 · Bel Canto",
    shortLabel: "美声共鸣",
    desc: "深沉喉位 + 舌根前移打开咽腔 + 高会厌管收窄激发 3kHz 歌手共振峰（饱满穿透）",
    source: {
      pressure: 11.2,
      tension: 0.65,
      brightness: 0.62,
      breathiness: 0.06,
      roughness: 0.07,
      fry: 0.0,
      vibratoRate: 5.8,
      drift: 4.5,
      glide: 0.055,
    },
    artic: {
      larynx: -0.68,
      root: 0.42,
      epilarynx: 0.82,
      ventricular: 0.0,
      lipWidth: 0.36,
    },
    vibrato: 52,
    eq: {
      lowShelfDb: 4.5,
      mudCutDb: -2.0,
      presenceHz: 2950,
      presenceDb: 4.2,
      airShelfDb: -1.5,
      lowpassHz: 8800,
    },
  },
  {
    id: "intimate_airy",
    label: "耳畔气声 · Intimate Airy",
    shortLabel: "耳畔气声",
    desc: "高声门开商与杓状软骨后隙漏气 + 轻柔肺压与圆润声带闭合（近距离呼吸感浅唱）",
    source: {
      pressure: 6.8,
      tension: 0.32,
      brightness: 0.16,
      breathiness: 0.52,
      roughness: 0.11,
      fry: 0.03,
      vibratoRate: 5.2,
      drift: 7.5,
      glide: 0.08,
    },
    artic: {
      larynx: -0.18,
      root: 0.15,
      epilarynx: 0.14,
      ventricular: 0.08,
      lipWidth: 0.54,
    },
    vibrato: 18,
    eq: {
      lowShelfDb: 3.8,
      mudCutDb: -4.0,
      presenceHz: 2500,
      presenceDb: -1.5,
      airShelfDb: 3.2,
      lowpassHz: 7800,
    },
  },
  {
    id: "husky_soul",
    label: "磁性烟嗓 · Husky Soul",
    shortLabel: "磁性烟嗓",
    desc: "声门周期/振幅微扰 + 假声带轻微内收颗粒阻尼 + 低频气泡音染色（灵魂乐质感）",
    source: {
      pressure: 9.6,
      tension: 0.60,
      brightness: 0.48,
      breathiness: 0.32,
      roughness: 0.36,
      fry: 0.14,
      vibratoRate: 5.4,
      drift: 8.0,
      glide: 0.07,
    },
    artic: {
      larynx: -0.35,
      root: 0.10,
      epilarynx: 0.56,
      ventricular: 0.36,
      lipWidth: 0.48,
    },
    vibrato: 36,
    eq: {
      lowShelfDb: 3.2,
      mudCutDb: -2.5,
      presenceHz: 2700,
      presenceDb: 2.8,
      airShelfDb: -0.5,
      lowpassHz: 8500,
    },
  },
  {
    id: "natural",
    label: "原始物理 · Raw Synth",
    shortLabel: "原始物理",
    desc: "未加输入端姿态与声门润色的原始合成器默认参数（用于对比音色变化）",
    source: {
      pressure: DEFAULT_SOURCE.pressure,
      tension: DEFAULT_SOURCE.tension,
      brightness: DEFAULT_SOURCE.brightness,
      breathiness: DEFAULT_SOURCE.breathiness,
      roughness: DEFAULT_SOURCE.roughness,
      fry: DEFAULT_SOURCE.fry,
      vibratoRate: DEFAULT_SOURCE.vibratoRate,
      drift: DEFAULT_SOURCE.drift,
      glide: DEFAULT_SOURCE.glide,
    },
    artic: {
      larynx: NEUTRAL.larynx,
      root: NEUTRAL.root,
      epilarynx: NEUTRAL.epilarynx,
      ventricular: NEUTRAL.ventricular,
      lipWidth: NEUTRAL.lipWidth,
    },
    vibrato: 35,
    eq: {
      lowShelfDb: 0,
      mudCutDb: 0,
      presenceHz: 3000,
      presenceDb: 0,
      airShelfDb: 0,
      lowpassHz: 20000,
    },
  },
];

export function getTimbreFilter(id: TimbreFilterId): TimbreFilterPreset {
  return TIMBRE_FILTERS.find((f) => f.id === id) ?? TIMBRE_FILTERS[0];
}
