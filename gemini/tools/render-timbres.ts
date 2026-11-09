/** Reproducible source-only audition: bun tools/render-timbres.ts. Uses the bundled WASM. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { initChimera } from "../src/wasm/chimera.ts";
import { applySourceTimbre, DEFAULT_TIMBRE, SOURCE_TIMBRES } from "../src/audio/sourceTimbres.ts";
import { renderVoice } from "./lib/renderVoice.ts";
import { writeWav } from "./lib/wav.ts";
import { FFT, hann } from "./lib/fft.ts";

const bytes = readFileSync(new URL("../src/wasm/chimera.wasm", import.meta.url));
await initChimera(bytes);
const { DEFAULT_SOURCE, lyricsToSyllables, planSong } = await import("../src/wasm/engine.ts");
const FS = 48000;
const bodies = [
  { id: "male", name: "男声", body: { female: 0, child: 0 } },
  { id: "neutral", name: "中性", body: { female: 0.5, child: 0 } },
  { id: "female", name: "女声", body: { female: 1, child: 0 } },
  { id: "child", name: "童声", body: { female: 0, child: 1 } },
];
const outDir = "public/timbre-lab";
mkdirSync(outDir, { recursive: true });
const syl = lyricsToSyllables("ma mi mu la");
if (syl.length !== 4) throw new Error(`Expected four audition syllables, got ${syl.length}`);
const notes = [55, 59, 62, 55].map((midi, i) => ({ midi, beats: 1.5, syl: syl[i] }));
const auditions = [...SOURCE_TIMBRES,
  { id: "pitch-only", name: "只换基频", hint: "女声对照：只升高 7 半音，保留原声带参数", source: null },
  { id: "child-pitch-only", name: "只升一个八度", hint: "童声对照：只升高 12 半音，保留原声带参数", source: null },
] as const;

/** Autocorrelation estimate on a sustained vowel; independent of the requested pitch. */
function measuredPitch(audio: Float32Array): number | null {
  const begin = Math.round(FS * 0.6), count = 4096;
  const lo = Math.floor(FS / 600), hi = Math.ceil(FS / 80);
  const corr = new Float64Array(hi + 2);
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let cross = 0, a2 = 0, b2 = 0;
    for (let i = 0; i < count; i++) {
      const a = audio[begin + i], b = audio[begin + i + lag];
      cross += a * b; a2 += a * a; b2 += b * b;
    }
    corr[lag] = cross / Math.sqrt(a2 * b2 + 1e-30);
  }
  const peaks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((k) => corr[k] > corr[k - 1] && corr[k] >= corr[k + 1]);
  const best = Math.max(...peaks.map((k) => corr[k]));
  const lag = peaks.find((k) => corr[k] >= Math.max(0.8, best * 0.98));
  if (!lag) return null;
  const correction = 0.5 * (corr[lag - 1] - corr[lag + 1]) / (corr[lag - 1] - 2 * corr[lag] + corr[lag + 1]);
  return FS / (lag + correction);
}

function stats(audio: Float32Array) {
  let energy = 0, peak = 0;
  for (const x of audio) {
    if (!Number.isFinite(x) || Math.abs(x) > 1) throw new Error("Invalid render");
    energy += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  // Spectral centroid of the first sustained /a/, a descriptive measurement, not a quality score.
  const n = 4096, fft = new FFT(n), win = hann(n), re = new Float64Array(n), im = new Float64Array(n);
  const begin = Math.round(FS * 0.6);
  for (let i = 0; i < n; i++) re[i] = audio[begin + i] * win[i];
  fft.transform(re, im);
  let weighted = 0, total = 0;
  for (let k = 1; k * FS / n <= 8000; k++) {
    const power = re[k] ** 2 + im[k] ** 2;
    weighted += power * k * FS / n;
    total += power;
  }
  return { rms: Math.sqrt(energy / audio.length), peak, centroidHz: weighted / total, measuredFirstVowelF0: measuredPitch(audio) };
}

const renders = bodies.flatMap(({ id: bodyId, body }) => {
  const plan = planSong(notes, { body, bpm: 90, t0: 0.15, vibrato: 0 });
  return auditions.map((preset) => {
    const base = { ...DEFAULT_SOURCE, f0: 196, pressure: 8, vibratoDepth: 0 };
    const source = preset.id === "pitch-only" ? { ...base, pitchShiftSemitones: 7 }
      : preset.id === "child-pitch-only" ? { ...base, pitchShiftSemitones: 12 }
      : applySourceTimbre(base, { ...DEFAULT_TIMBRE, id: preset.id });
    const audio = renderVoice(body, source, plan.gestures, plan.end + 0.5, FS);
    console.info(`[render-timbres] ${bodyId}/${preset.id}: ${audio.length} samples`);
    return { bodyId, preset: preset.id, source, audio, ...stats(audio) };
  });
});
// Same integrated RMS for every sample, with a target low enough to avoid any clipping.
const targetRms = Math.min(0.07, ...renders.map((r) => 0.85 * r.rms / r.peak));
const report = renders.map(({ audio, ...r }) => {
  const gain = targetRms / r.rms;
  const matched = audio.map((x) => x * gain);
  writeWav(`${outDir}/${r.bodyId}-${r.preset}.wav`, [matched], FS);
  return { ...r, seconds: audio.length / FS, gainDb: 20 * Math.log10(gain), matchedPeak: r.peak * gain };
});
writeFileSync(`${outDir}/report.json`, JSON.stringify({
  wasmSha256: createHash("sha256").update(bytes).digest("hex"), sampleRate: FS,
  comparison: "Same ma mi mu la score/timing, 90 bpm. Original: G3 B3 D4 G3. female-strong and pitch-only: +7 semitones (D4 F#4 A4 D4). child-strong and child-pitch-only: +12 semitones (G4 B4 D5 G4). No EQ/reverb; integrated RMS matching, not perceptual loudness matching. Body selector sets tract geometry independently.",
  reference: { title: "Libera — Far Away (Angel Voices)", url: "https://libera.org.uk/music/angel-voices/", usage: "Optional listening reference only; no recording downloaded, analyzed, sampled or cloned. Preset parameters are hand-designed." },
  targetRms, renders: report,
}, null, 2));

const displayOrder = ["original", "child-pitch-only", "child-strong", "female-strong", "pitch-only", "warm", "airy", "clear", "husky"];
const rows = displayOrder.map((id) => auditions.find((p) => p.id === id)!).map((p, i) => `<button class="preset${p.id === "child-strong" ? " selected" : ""}" data-preset="${p.id}" aria-pressed="${p.id === "child-strong"}"><span class="number">0${i}</span><strong>${p.name}</strong><span>${p.hint}</span></button>`).join("\n");
writeFileSync(`${outDir}/index.html`, `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>声源音色 · 对照试听</title>
<style>
:root{color-scheme:light;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#0f172a;background:#f8fafc}*{box-sizing:border-box}body{margin:0}main{max-width:1050px;margin:48px auto;padding:0 24px}a{color:#0284c7}header{display:flex;justify-content:space-between;gap:20px;align-items:baseline}h1{font-size:34px;letter-spacing:-1px;margin:16px 0}p{line-height:1.8;color:#475569}.eyebrow{font-size:12px;letter-spacing:3px;color:#0284c7}.chain{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:24px 0}.chain span{padding:10px 16px;background:white;border:1px solid #e2e8f0;border-radius:6px}.chain .active{border-color:#0284c7;color:#0284c7}.controls{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:20px;background:white;border:1px solid #e2e8f0;border-radius:10px}select,button{font:inherit;color:inherit}select{padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:white}audio{flex:1;min-width:230px;max-width:100%}.presets{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.preset{display:flex;flex-direction:column;text-align:left;gap:14px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;cursor:pointer;line-height:1.6}.preset.selected{border:2px solid #0284c7;padding:19px;background:#f0f9ff}.preset strong{font-size:20px}.preset span:last-child{font-size:13px;color:#475569}.number{font-size:12px;color:#64748b}#status{font-size:14px}details{border-top:1px solid #e2e8f0;padding:20px 0;margin-top:24px}summary{cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #d97706;outline-offset:3px}footer{margin:30px 0;font-size:13px;color:#64748b}@media(max-width:760px){main{margin:24px auto}.presets{grid-template-columns:repeat(2,1fr)}h1{font-size:28px}header{flex-wrap:wrap}.controls{padding:12px}}
</style>
<main><header><span class="eyebrow">CHIMERA / SOURCE STUDY 03</span><a href="/">选音色唱歌 ↗</a></header>
<h1>童音强替代 · 空灵。</h1>
<p>新增「童音强替代」：升高一个八度，配合童声声道、轻柔闭合、少量气声与稳定声源。<br>建议依次比较「原声 → 只升一个八度 → 童音强替代」。同一发音与节奏，已匹配整段 RMS 电平。</p>
<div class="chain" aria-label="音色产生链路"><span>乐谱与发音动作</span>→<span class="active">声带激励 · 本次改变</span>→<span>咽腔 / 口腔 / 鼻腔</span>→<span>唇鼻辐射与输出</span></div>
<div class="controls"><label>声道体型 <select id="body">${bodies.map((b) => `<option value="${b.id}"${b.id === "child" ? " selected" : ""}>${b.name}</option>`).join("")}</select></label><audio id="audio" controls loop preload="metadata" src="child-child-strong.wav"></audio></div>
<div class="presets">${rows}</div><p id="status" aria-live="polite">童声 · 童音强替代 · 首音目标约 196 → 392 Hz · 点击播放</p>
<p>切换预设会保留播放位置。选择「原声」进行 A/B 对比；改变体型则可听声道对音色的影响。</p>
<details><summary>这个实验能说明什么？</summary><p>这些是合成声源预设，并非真人声纹、真人录音或神经变声。女声强替代升调 7 半音，童音强替代升调 12 半音，都在乐谱音高计算后生效，因此正在唱的音也会变化；它保留旋律音程和时长，但改变调性。试听页声道由体型下拉框控制，默认童声声道；实时界面选中女声或童音强替代时，会自动选择对应声道。温润与清亮主要改变闭合形状；气声改变声门漏气；微沙哑改变周期及振幅微扰。强度在这里固定为 100%，实时界面可连续调节。</p><p>输入端能改变质感，但口型、声道长度、鼻腔耦合、辅音气流与韵律仍决定最终声音。RMS 匹配可减少音量偏差，不等于严格感知响度匹配。音频存在可测差异，并不证明更像真人；自然度仍需听感判断。</p><p>可对照聆听 <a href="https://libera.org.uk/music/angel-voices/" target="_blank" rel="noreferrer">Libera《Far Away》官方曲目页</a>。本预设按清澈、轻柔、低粗糙度的方向手工设计，没有提取、采样或克隆参考录音，也未测量与真人录音的相似度。</p><p>本页是独立试验素材，不会替换《小美满》舞台的预录 WAV。<a href="report.json">查看渲染参数与测量数据</a></p></details>
<footer>48 kHz / mono WAV · 4 种体型 × 9 组对照 · 同一 WASM 引擎离线渲染</footer></main>
<script>
const audio=document.querySelector('#audio'),body=document.querySelector('#body'),status=document.querySelector('#status');
const names=${JSON.stringify(Object.fromEntries(auditions.map((p) => [p.id, p.name])))};
let preset='child-strong',serial=0,pending=null;
async function switchTrack(){
 const request=++serial;
 const state=pending||{time:audio.currentTime,playing:!audio.paused}; pending=state;
 document.querySelectorAll('[data-preset]').forEach(b=>{const on=b.dataset.preset===preset;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 status.textContent=body.selectedOptions[0].text+' · '+names[preset]+' · 加载中';
 audio.pause();audio.src=body.value+'-'+preset+'.wav';audio.load();
 audio.onloadedmetadata=async()=>{if(request!==serial)return;audio.currentTime=Math.min(state.time,Math.max(0,audio.duration-0.02));pending=null;status.textContent=body.selectedOptions[0].text+' · '+names[preset];if(state.playing){try{await audio.play()}catch(e){status.textContent='请点击播放继续试听'}}};
 audio.onerror=()=>{if(request===serial){pending=null;status.textContent='音频加载失败，请重新生成试听素材或刷新页面'}};
}
body.addEventListener('change',switchTrack);
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{preset=b.dataset.preset;switchTrack()}));
</script></html>`);
console.info(`[render-timbres] Wrote ${report.length} WAVs and ${outDir}/index.html; matched RMS ${targetRms.toFixed(5)}`);
