/** Browser acceptance for selecting a song and singing it with the live timbre controls. */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const url = process.argv[2] ?? "http://127.0.0.1:5318/";
const out = "out/song-playback";
mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:["--autoplay-policy=no-user-gesture-required"]});
const passed: string[] = [], errors: string[] = [];
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });
  await page.goto(url);
  const song = page.getByLabel("选择歌曲",{exact:true});
  const preset = page.getByLabel("仿人声预设",{exact:true});
  const stop = page.getByRole("button",{name:"停止唱歌",exact:true});
  const play = () => page.getByRole("button",{name:"开始唱歌",exact:true}).click();
  const audible = () => page.waitForFunction(() => {
    const e = (window as any).__chimeraEngine;
    if(!e?.analyser) return false;
    const a = new Float32Array(e.analyser.fftSize); e.analyser.getFloatTimeDomainData(a);
    return Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length)>0.002;
  });
  const silent = () => page.waitForFunction(() => {
    const e=(window as any).__chimeraEngine;
    const a=new Float32Array(e.analyser.fftSize); e.analyser.getFloatTimeDomainData(a);
    return Math.max(...a.map(Math.abs))<0.0001;
  });
  assert.equal(await song.inputValue(), "小星星 · 完整版（英文）");
  assert((await page.getByLabel("Lyrics to sing", {exact:true}).inputValue()).startsWith("Twinkle twinkle"));
  assert(await stop.isDisabled());
  await preset.selectOption("child-strong");
  await play();
  await audible();
  await page.waitForFunction(() => document.querySelectorAll(".syllables .syl").length===42);
  assert.equal(await page.getByRole("radio",{name:"童声 Child",exact:true}).getAttribute("aria-checked"),"true");
  passed.push("One click starts audio and the complete 42-note Twinkle with the child preset");
  // Every preset applies to the actual singing voice; body-changing presets restart the song.
  for(const id of ["original","warm","airy","clear","husky","female-strong","child-strong"]) {
    await preset.selectOption(id);
    await audible();
    assert(await stop.isEnabled());
    assert.equal(await song.inputValue(),"小星星 · 完整版（英文）");
  }
  passed.push("All seven timbres work during song playback, including female/child tract rebuilds");
  await page.getByLabel("音色强度",{exact:true}).fill("0.5");
  await audible();
  await page.getByRole("button",{name:"旁路 · 听原声",exact:true}).click();
  await audible();
  await page.getByRole("button",{name:"旁路 · 听原声",exact:true}).click();
  await page.getByLabel("音色强度",{exact:true}).fill("1");
  await stop.click();
  await silent();
  passed.push("Intensity and bypass work during singing; stop releases the voice to silence");
  await play(); await audible();
  await song.selectOption("Made of air");
  assert((await page.getByLabel("Lyrics to sing", {exact:true}).inputValue()).startsWith("Breathe in"));
  await silent();
  assert(await stop.isDisabled());
  await play(); await audible();
  await page.getByRole("radio",{name:"Play",exact:true}).click();
  await silent();
  assert.equal(await song.count(),0);
  await page.getByRole("radio",{name:"Sing",exact:true}).click();
  assert.equal(await song.inputValue(),"Made of air");
  passed.push("Song and mode switches stop the old performance and preserve song selection");
  await song.selectOption("小星星 · 完整版（英文）");
  await play(); await audible();
  await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${out}/mobile.png`,fullPage:true});
  // Let the full first verse finish; the stop button must reset and the engine must go quiet.
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="停止唱歌" && b.disabled),{},{timeout:45000});
  await silent();
  passed.push("The complete song ends naturally, resets playback controls and becomes silent");
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/report.json`,JSON.stringify({passed,errors},null,2));
  console.info(JSON.stringify({passed,errors},null,2));
} catch(e) {
  console.error(JSON.stringify({passed,errors},null,2));
  const p=browser.contexts().flatMap(c=>c.pages())[0];
  if(p) await p.screenshot({path:`${out}/failure.png`,fullPage:true});
  throw e;
} finally { await browser.close(); }
