/** Focused browser acceptance using the project's existing Playwright runner. */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const url = process.argv[2] ?? "http://127.0.0.1:5317/";
const out = "out/timbre-e2e";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors: string[] = [], passed: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} ${m.location().url}`); });
  page.on("response", (r) => { if (r.status() >= 400) console.error(`[HTTP ${r.status()}] ${r.url()}`); });
  // Observe messages sent to the real audio worklet, without replacing the engine.
  await page.addInitScript(() => {
    const g = globalThis as unknown as { sentSources: Record<string, number>[] };
    g.sentSources = [];
    const post = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (...args: [unknown, (Transferable[] | StructuredSerializeOptions)?]) {
      const msg = args[0] as { type?: string; values: Record<string, number> } | null;
      if (msg?.type === "source") g.sentSources.push(msg.values);
      return Reflect.apply(post, this, args);
    };
  });
  await page.goto(url);
  await page.getByLabel("仿人声预设", { exact: true }).selectOption("warm");
  await page.getByRole("radio", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: /Breathe in and start/ }).click();
  await page.waitForFunction(() => (globalThis as any).sentSources.some((s: any) => Math.abs(s.brightness - 0.08) < 1e-12));
  passed.push("Preset chosen before audio startup reaches the real worklet");
  for (const [id, brightness] of [["airy", 0.1], ["clear", 0.62], ["husky", 0.38]] as const) {
    await page.getByLabel("仿人声预设", { exact: true }).selectOption(id);
    await page.waitForFunction((b) => Math.abs((globalThis as any).sentSources.at(-1)?.brightness - b) < 1e-12, brightness);
  }
  await page.getByRole("button", { name: "旁路 · 听原声" }).click();
  await page.waitForFunction(() => (globalThis as any).sentSources.at(-1)?.brightness === 0.25);
  await page.getByRole("button", { name: "旁路 · 听原声" }).click();
  await page.getByRole("radio", { name: "女声 Female", exact: true }).click();
  await page.waitForFunction(() => Math.abs((globalThis as any).sentSources.at(-1)?.brightness - 0.38) < 1e-12 && (globalThis as any).sentSources.at(-1)?.f0 > 150);
  await page.getByLabel("音色强度", { exact: true }).fill("0");
  await page.waitForFunction(() => (globalThis as any).sentSources.at(-1)?.brightness === 0.25);
  await page.getByLabel("音色强度", { exact: true }).fill("1");
  await page.waitForFunction(() => Math.abs((globalThis as any).sentSources.at(-1)?.brightness - 0.38) < 1e-12);
  passed.push("Live preset switching, bypass, body rebuild and intensity restore correct source parameters");
  // Read the app's existing debug handle: a fresh dynamic import can create a second engine under HMR.
  {
    const result = await page.evaluate(() => {
      const engine = (window as any).__chimeraEngine;
      const samples = new Float32Array(engine.analyser.fftSize);
      engine.analyser.getFloatTimeDomainData(samples);
      return { error: engine.error, rms: Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length), load: engine.load };
    });
    assert.equal(result.error, null);
    assert(result.rms > 0.0001);
    passed.push(`Real AudioWorklet emits audio (RMS ${result.rms.toFixed(5)}, load ${result.load.toFixed(3)})`);
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("original");
    await page.evaluate(() => {
      const engine = (window as any).__chimeraEngine;
      engine.setSource({ f0: 196 });
      engine.schedule({ gestures: [{ t0: 0, t1: 30, rampIn: 0.02, rampOut: 0.02, strength: 1, targets: { f0: 196, breath: 1 } }], segments: [], end: 30 });
    });
    await page.waitForFunction(() => { const engine = (window as any).__chimeraEngine; return Math.abs(engine.latest?.t.f0 - 196) < 2; });
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("female-strong");
    await page.waitForFunction(() => { const engine = (window as any).__chimeraEngine; return Math.abs(engine.latest?.t.f0 - 293.67) < 3; });
    await page.getByRole("button", { name: "旁路 · 听原声" }).click();
    await page.waitForFunction(() => { const engine = (window as any).__chimeraEngine; return Math.abs(engine.latest?.t.f0 - 196) < 2; });
    await page.getByRole("button", { name: "旁路 · 听原声" }).click();
    passed.push("Strong female replacement changes an active score from 196 to 294 Hz, with live bypass back to 196 Hz");
    await page.getByRole("radio", { name: "男声 Male", exact: true }).click();
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("husky");
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("female-strong");
    assert.equal(await page.getByRole("radio", { name: "女声 Female", exact: true }).getAttribute("aria-checked"), "true");
    passed.push("Selecting strong replacement from a male body selects the female vocal tract");
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("child-strong");
    assert.equal(await page.getByRole("radio", { name: "童声 Child", exact: true }).getAttribute("aria-checked"), "true");
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("original");
    await page.evaluate(() => {
      const engine = (window as any).__chimeraEngine;
      engine.schedule({ gestures: [{ t0: 0, t1: 30, rampIn: 0.02, rampOut: 0.02, strength: 100, targets: { f0: 196, breath: 1 } }], segments: [], end: 30 });
    });
    await page.waitForFunction(() => Math.abs((window as any).__chimeraEngine.latest?.t.f0 - 196) < 2);
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("child-strong");
    await page.waitForFunction(() => Math.abs((window as any).__chimeraEngine.latest?.t.f0 - 392) < 3);
    await page.getByLabel("音色强度", { exact: true }).fill("0.5");
    await page.waitForFunction(() => Math.abs((window as any).__chimeraEngine.latest?.t.f0 - 196 * Math.SQRT2) < 3);
    await page.getByRole("button", { name: "旁路 · 听原声" }).click();
    await page.waitForFunction(() => Math.abs((window as any).__chimeraEngine.latest?.t.f0 - 196) < 2);
    await page.getByRole("button", { name: "旁路 · 听原声" }).click();
    await page.getByLabel("音色强度", { exact: true }).fill("1");
    passed.push("Child replacement selects the child tract, doubles an active score to 392 Hz, supports half strength and restores pitch on bypass");
    await page.getByLabel("仿人声预设", { exact: true }).selectOption("husky");
  }
  await page.screenshot({ path: `${out}/live-desktop.png`, fullPage: true });
  await page.getByRole("radio", { name: "Bestiary", exact: true }).click();
  assert.equal(await page.getByLabel("声源音色滤镜", { exact: true }).count(), 0);
  await page.getByRole("radio", { name: "Sing", exact: true }).click();
  assert.equal(await page.getByLabel("仿人声预设", { exact: true }).inputValue(), "husky");
  passed.push("Human timbre selection survives mode changes and is hidden for creatures");
  await page.goto(new URL("/timbre-lab/index.html", url).href);
  await page.locator("#audio").evaluate(async (el) => { await (el as HTMLAudioElement).play(); });
  await page.waitForFunction(() => (document.querySelector("audio") as HTMLAudioElement).currentTime > 0.4);
  for (const body of ["male", "neutral", "female", "child"]) {
    await page.locator("#body").selectOption(body);
    for (const id of ["original", "warm", "airy", "clear", "husky", "female-strong", "pitch-only", "child-strong", "child-pitch-only"]) {
      await page.locator(`[data-preset="${id}"]`).click();
      await page.waitForFunction((suffix) => { const a = document.querySelector("audio")!; return a.currentSrc.endsWith(suffix) && a.readyState >= 2 && !a.paused && a.currentTime > 0; }, `${body}-${id}.wav`);
    }
  }
  passed.push("All 36 audition WAVs load and play; track switching retains playback");
  await page.locator("#body").selectOption("child");
  await page.locator('[data-preset="child-strong"]').click();
  await page.waitForFunction(() => { const a = document.querySelector("audio")!; return a.currentSrc.endsWith("child-child-strong.wav") && a.readyState >= 2 && !a.paused; });
  await page.screenshot({ path: `${out}/lab-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/lab-mobile.png`, fullPage: true });
  await page.goto(url);
  await page.getByLabel("仿人声预设", { exact: true }).waitFor();
  await page.getByLabel("仿人声预设", { exact: true }).selectOption("child-strong");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${out}/live-mobile.png`, fullPage: true });
  passed.push("Live and audition pages fit a 390px mobile viewport");
  assert.deepEqual(errors, []);
  passed.push("No browser console or page errors");
  writeFileSync(`${out}/report.json`, JSON.stringify({ passed, errors }, null, 2));
  console.info(JSON.stringify({ passed, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passed, errors }, null, 2));
  const page = browser.contexts().flatMap((c) => c.pages())[0];
  if (page) {
    console.error(await page.locator("body").innerText());
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  }
  throw error;
} finally {
  await browser.close();
}
