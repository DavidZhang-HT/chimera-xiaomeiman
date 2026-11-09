import { expect, test } from "bun:test";
import { initEngine, WasmVoice } from "./harness.ts";
import { applySourceTimbre, DEFAULT_TIMBRE, SOURCE_TIMBRES, TIMBRE_KEYS } from "../src/audio/sourceTimbres.ts";
import { renderVoice } from "../tools/lib/renderVoice.ts";
await initEngine();
const { DEFAULT_SOURCE } = await import("../src/wasm/engine.ts");

test("bypass and zero intensity recover the exact user's source without accumulating presets", () => {
  const base = { ...DEFAULT_SOURCE, f0: 220, pressure: 9, brightness: 0.33 };
  for (const { id } of SOURCE_TIMBRES) {
    expect(applySourceTimbre(base, { id, amount: 1, bypass: true })).toEqual(base);
    expect(applySourceTimbre(base, { id, amount: 0, bypass: false })).toEqual(base);
    expect(applySourceTimbre(base, { id, amount: NaN, bypass: false })).toEqual(base);
    const full = applySourceTimbre(base, { id, amount: 1, bypass: false });
    const half = applySourceTimbre(base, { id, amount: 0.5, bypass: false });
    for (const k of TIMBRE_KEYS) expect(half[k]).toBeCloseTo((base[k] + full[k]) / 2, 12);
    expect(full.f0).toBe(220);
    expect(full.pressure).toBe(9);
    expect(full.fry).toBe(base.fry);
    expect(full.vibratoDepth).toBe(base.vibratoDepth);
    expect(full.pitchShiftSemitones).toBe(id === "female-strong" || id === "female-ethereal" ? 7 : id === "child-strong" ? 12 : base.pitchShiftSemitones);
  }
  expect(base.brightness).toBe(0.33);
});

test("all four bodies produce finite, audible, distinct source variants; bypass is sample-identical", () => {
  const gs = [{ t0: 0, t1: 0.32, rampIn: 0.04, rampOut: 0.05, strength: 1, targets: { breath: 1 } }];
  for (const body of [{ female: 0, child: 0 }, { female: 0.5, child: 0 }, { female: 1, child: 0 }, { female: 0, child: 1 }]) {
    const base = { ...DEFAULT_SOURCE, f0: 180 };
    const original = renderVoice(body, base, gs, 0.45);
    for (const { id } of SOURCE_TIMBRES.slice(1)) {
      const out = renderVoice(body, applySourceTimbre(base, { ...DEFAULT_TIMBRE, id }), gs, 0.45);
      let energy = 0, diff = 0;
      for (let i = 0; i < out.length; i++) {
        expect(Number.isFinite(out[i]) && Math.abs(out[i]) <= 1).toBe(true);
        energy += out[i] ** 2;
        diff += (out[i] - original[i]) ** 2;
      }
      expect(Math.sqrt(energy / out.length)).toBeGreaterThan(0.001);
      expect(Math.sqrt(diff / out.length)).toBeGreaterThan(0.0001);
    }
    const bypass = renderVoice(body, applySourceTimbre(base, { id: "husky", amount: 1, bypass: true }), gs, 0.45);
    expect(bypass).toEqual(original);
  }
}, 30000);

test("both female replacements reach an active score, support half strength and bypass", () => {
  for (const id of ["female-strong", "female-ethereal"] as const) {
    const voice = new WasmVoice();
    const base = { ...DEFAULT_SOURCE, f0: 196 };
    voice.setSource({ ...base });
    voice.schedule([{ t0: 0, t1: 3, rampIn: 0.02, rampOut: 0.02, strength: 1, targets: { f0: 196, breath: 1 } }], 0);
    voice.render(24000);
    const before = voice.state().f0;
    voice.setSource({ ...applySourceTimbre(base, { id, amount: 1, bypass: false }) });
    voice.render(24000);
    const after = voice.state().f0;
    expect(Math.abs(after / before - 2 ** (7 / 12))).toBeLessThan(0.01);
    voice.setSource({ ...applySourceTimbre(base, { id, amount: 1, bypass: true }) });
    voice.render(24000);
    expect(Math.abs(voice.state().f0 - before)).toBeLessThan(1);
    expect(voice.score().length).toBeGreaterThan(0);
    voice.setSource({ ...applySourceTimbre(base, { id, amount: 0.5, bypass: false }) });
    voice.render(24000);
    expect(Math.abs(voice.state().f0 / before - 2 ** (3.5 / 12))).toBeLessThan(0.01);
  }
});

test("child replacement doubles an active score, half strength shifts six semitones, bypass restores it", () => {
  const voice = new WasmVoice();
  const base = { ...DEFAULT_SOURCE, f0: 196 };
  voice.setSource({ ...base });
  voice.schedule([{ t0: 0, t1: 4, rampIn: 0.02, rampOut: 0.02, strength: 1, targets: { f0: 196, breath: 1 } }], 0);
  voice.render(24000);
  const before = voice.state().f0;
  for (const [amount, ratio] of [[1, 2], [0.5, Math.SQRT2], [0, 1]]) {
    voice.setSource({ ...applySourceTimbre(base, { id: "child-strong", amount, bypass: false }) });
    const audio = voice.render(24000);
    expect(Math.abs(voice.state().f0 / before - ratio)).toBeLessThan(0.01);
    expect(audio.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
  }
  expect(voice.score().length).toBeGreaterThan(0);
});

test("child profile reduces roughness and fry without accumulating female transposition", () => {
  const base = { ...DEFAULT_SOURCE, fry: 0.4, pitchShiftSemitones: 2 };
  const child = applySourceTimbre(base, { id: "child-strong", amount: 1, bypass: false });
  expect(child.pitchShiftSemitones).toBe(14);
  expect(child.fry).toBe(0);
  expect(child.roughness).toBeCloseTo(0.01, 12);
  expect(applySourceTimbre(base, { id: "child-strong", amount: 1, bypass: true })).toEqual(base);
  expect(base.fry).toBe(0.4);
});


test("ethereal female has a distinct waveform at the same pitch and matched RMS as the existing female", () => {
  const base = { ...DEFAULT_SOURCE, f0: 196 };
  const gestures = [{ t0: 0, t1: 0.6, rampIn: 0.04, rampOut: 0.05, strength: 1, targets: { f0: 196, breath: 1 } }];
  const rms = (xs: Float32Array) => Math.sqrt(xs.reduce((sum, x) => sum + x*x, 0) / xs.length);
  const renders = (["female-strong", "female-ethereal"] as const).map((id) => {
    const source = applySourceTimbre(base, { id, amount: 1, bypass: false });
    expect(source.pitchShiftSemitones).toBe(7);
    const audio = renderVoice({female:1,child:0}, source, gestures, 0.7);
    const level = rms(audio);
    expect(level).toBeGreaterThan(0.001);
    return audio.map(x => x / level);
  });
  const difference = renders[0].map((x, i) => x - renders[1][i]);
  expect(rms(difference)).toBeGreaterThan(0.01);
});
