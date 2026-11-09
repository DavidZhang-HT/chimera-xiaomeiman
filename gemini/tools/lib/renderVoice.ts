/** Offline render through the same source/gesture ABI as the browser AudioWorklet. */
import { readFileSync } from "node:fs";
import { writeGestures, SOURCE_KEYS } from "../../src/wasm/wire.ts";
import type { BodyMix, Gesture, VoiceSource } from "../../src/wasm/types.ts";

const module = new WebAssembly.Module(readFileSync(new URL("../../src/wasm/chimera.wasm", import.meta.url)));
type Exports = { memory: WebAssembly.Memory } & Record<string, (...args: number[]) => number>;

export function renderVoice(body: BodyMix, source: VoiceSource, gestures: readonly Gesture[], seconds: number, fs = 48000): Float32Array {
  if (gestures.length > 4000) throw new Error("Offline audition exceeds gesture capacity");
  const x = new WebAssembly.Instance(module, {}).exports as unknown as Exports;
  const h = x.engine_new(fs);
  try {
    x.engine_set_body(h, body.female, body.child);
    const values = new Float64Array(x.memory.buffer, x.engine_values(h), 32).fill(NaN);
    SOURCE_KEYS.forEach((key, i) => { values[i] = Number(source[key]); });
    x.engine_set_source(h);
    const n = writeGestures(x.memory.buffer, x.engine_records(h), gestures, 4000);
    x.engine_schedule(h, n, 0, 1);
    const out = new Float32Array(Math.ceil(seconds * fs));
    for (let i = 0; i < out.length; i += 128) {
      const size = Math.min(128, out.length - i);
      out.set(new Float32Array(x.memory.buffer, x.engine_render(h, size), size), i);
    }
    return out;
  } finally {
    x.engine_free(h);
  }
}
