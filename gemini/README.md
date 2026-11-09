# CHIMERA

A physical-modeling voice synthesizer in the browser. Every sound comes from a simulated
airway (lungs, vocal folds or syrinx, a branched vocal tract, lips, nose), not from samples.
The engine is Rust, compiled to WebAssembly for an AudioWorklet; the same code runs natively
for tests and the `chimera` CLI.

## What it does

- **Play**: drag the tongue, lips and jaw in a live cutaway of the head; vowel pad, encoders,
  computer keyboard and Web MIDI.
- **Speak**: English text (CMUdict with a letter-to-sound fallback) or IPA, turned into
  gestures and prosody, with the gestural score and a consonant chart on screen.
- **Sing**: piano roll with lyrics per note; consonants land before the beat.
- **Beatbox**: pads and a step sequencer, every drum an articulatory gesture.
- **Bestiary**: songbird (two-voice syrinx), seal, alligator and elephant.
- **Duet** (`?show=<id>`): two 3D heads replay a pre-rendered song.

Male, female and child bodies blend continuously. Everything on screen animates from live
engine state: pressure in the airway, airflow, the vocal folds, spectra and formants.

## Run it

Needs Rust with the `wasm32-unknown-unknown` target, and Bun.

```sh
bun install
bun run dev        # builds the wasm, then Vite on 127.0.0.1:5317
bun run test       # wasm build, cargo test --workspace, bun test tests
```

The AudioWorklet needs a secure context, so open it on localhost or over HTTPS (for example
`tailscale serve`). Vercel builds it with `vercel.json`.

Offline renders and measurement:

```sh
cargo run --release -p chimera-cli -- render speech|text|song|notes|beatbox|creature|vowels …
cargo run --release -p chimera-cli -- diagnose       # nasal leakage, formants, bandwidths, pitch
cargo run --release -p chimera-cli -- compare csd    # against a real singer (docs/csd-comparison.md)
cargo run --release -p chimera-cli -- compare tsp    # against 23 real speakers (docs/speech-comparison.md)
bun tools/spectrogram.ts in.wav out.png
```

## Docs

- [docs/architecture.md](docs/architecture.md): the acoustic model (FDTD airway, sources,
  anatomy, gestures).
- [docs/rust-engine.md](docs/rust-engine.md): the engine's real-time and determinism contract,
  and the browser boundary.
- [docs/ui-redesign.md](docs/ui-redesign.md) and [docs/mockups/](docs/mockups/): the vector
  display look.
- [docs/csd-comparison.md](docs/csd-comparison.md): scoring the voice against the Children's
  Song Dataset.
- [docs/speech-comparison.md](docs/speech-comparison.md): scoring the speech against real
  speakers, phone by phone (the TSP speech database).
- [docs/hill-climb/](docs/hill-climb/): the rules and log for tuning the voice one measured
  step at a time.

Agents: see [AGENTS.md](AGENTS.md).

## 声源音色、女声与童音强替代（2026-11-09）

主界面顶部的「声源音色」（Sing 模式下为「可选音色唱歌」）支持原声、温润、轻气声、清亮、微沙哑、女声强替代和童音强替代。
原始旋钮设置独立保留；强度 0% 或旁路恢复原始声源，切换不累积覆盖参数。
强替代自动换体型时，基础音高沿用既有体型切换规则重置为对应体型默认值；旁路不撤销体型切换。

### 网页选音色唱歌

打开主页面，在顶部选择歌曲和仿人声预设，再点击「开始唱歌」。首次点击会启动音频；
「停止唱歌」也能取消尚未完成的启动。播放中可调强度、旁路和音色；切换声道时从头演唱。
更换歌曲会先停止当前演唱，再由「开始唱歌」启动新歌。状态栏显示正在演唱的音节及总数。

新加《小星星 · 完整版（英文）》第一段六句，共 42 个音符，96 BPM，约 32 秒；
采用低八度乐谱，为强替代升调留出空间。现有《小美满》与其他演示歌曲仍可选择。
歌曲目录在 `src/ui/songs.ts`，使用实时 WASM 合成，不依赖上一轮生成的 WAV。
浏览器验收：`CHROME_BIN=<已安装 Chromium 路径> bun tools/song-playback-e2e.ts <预览地址>`。

### 为什么原来的女声仍然偏低

第一版试听让所有体型唱同一组 G3 B3 D4 G3，四种滤镜也全部保持基频不变。
引擎在 `HumanVoice::control` 中将乐谱音高与基础音高混合，乐谱占主导；因此只调
`source.f0` 不能可靠地改变正在唱的音。这些是已确认的机制，不能据此断言音高是
“男声感”的唯一原因；声道共鸣、声源波形与咬字仍影响听感。

### 新增的强替代

- **基频：** `pitchShiftSemitones` 在乐谱/基础音高混合之后生效，默认 0。
  女声强替代在 100% 强度时升高 7 半音（约 ×1.498），实时乐谱、持续音和离线渲染使用同一引擎路径。
  保留音程和节奏，改变调性；并非锁死为单一频率。沿用原来的平滑滑音。
- **声源：** breathiness 0.22、tension 0.36、brightness 0.18、roughness 0.025、drift 2，
  渐进关闭 fry。与原始设置按强度混合，避免仅升高音调而完全保留原有发声方式。
- **声道：** 实时界面选择强替代时自动切到成人女性声道。若体型改变，已有演示歌曲会从头重新播放；
  此后仍可主动换体型比较。旁路保持当前声道，只恢复声源/基频。
- **兼容性：** WASM 源参数区追加第 12 槽，布局版本升为 2，手势记录仍为 272 字节。
  主线程和 AudioWorklet 检查版本，避免旧 WASM 静默忽略升调。原默认音色黄金样本保持通过。

这是物理合成女声试验，不是从真人录音提取声纹，也不是神经声纹克隆。
不能用“基频确实升高”代替“已达到真实女性音色”的主观验证。

### 童音强替代 · 空灵

沿用同一升调引擎：100% 强度时升高 12 半音，50% 升高 6 半音，0% 或旁路恢复原声源。
选择此预设自动使用童声声道；更换体型时原演示歌曲按既有规则从头播放。
参数为 breathiness 0.18、tension 0.30、brightness 0.22、roughness 0.01、drift 1.2，
渐进关闭 fry；不额外添加混响或合唱。目标是清澈、轻柔、稳定的合成童声。

找到的可对照曲目是 [Libera《Far Away》，收录于 Angel Voices](https://libera.org.uk/music/angel-voices/)。
它仅作为可供用户聆听的参考链接；没有下载、分析、采样或克隆参考录音，没有提取任何孩子的声纹。
这些参数是手工设计，不代表已测得与该录音相似，也不代表“天籁”听感已被客观验证。

### 音色在哪里产生

`voice/human_voice.rs::apply_source` 映射声源参数，`sources/glottis.rs::next` 生成声门面积波形。
`voice/human_airway.rs`、`anatomy/human.rs` 和 `airway/network.rs` 共同计算气流、声道共鸣、鼻腔耦合与辅音湍流。
唇鼻辐射后还有降采样、去直流和限幅；Beatbox 可开启输出近讲 EQ/压缩。因此声源端不能决定全部音色。

### 试听与复现

```sh
bun run timbre:render
# 打开 http://127.0.0.1:5317/timbre-lab/index.html
```

`public/timbre-lab/` 是忽略入 Git 的生成制品：四种声道体型 × 九组对照，共 36 段 WAV。
页面默认选中童声声道和童音强替代。建议比较「原声 → 只升一个八度 → 童音强替代」。
女声强替代与原有预设仍保留，可独立切换体型比较。
「只换基频」同样升高 7 半音，但保留原声带参数，帮助分离音高和发声方式的贡献。
所有版本使用相同 ma mi mu la 和 90 bpm，匹配整段 RMS；这不等同严格感知响度匹配。
报告保存引擎哈希、源参数、首个元音的独立自相关基频估计、频谱重心、峰值和匹配增益。
女声首元音测得：原声约 196.18 Hz，强替代约 293.92 Hz，仅升调约 294.24 Hz。
童声首元音测得：原声约 196.16 Hz，童音强替代约 391.81 Hz，仅升八度约 391.89 Hz。

`?show=xiaomeiman` 仍播放预录 WAV，实时参数不改变已有文件；需要重新渲染歌曲和遥测才能应用。

本机可用构建环境（只作用于当前命令，不修改系统开发者设置）：

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools \
SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk \
RUSTC=/Users/zhangjunhui/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
bun run build
```

Homebrew Rust 未装 WASM target；上面显式选用已安装 WASM target 的工具链。
`tools/build-wasm.ts` 默认把编译缓存放在按当前 checkout 路径隔离的本机临时目录，避免本次遇到的
外置盘重复构建产物变成全零的问题。写回前校验 WASM 可实例化及 ABI，写回采用临时文件与原子替换，
并逐字节核验内容；显式设置 `CARGO_TARGET_DIR` 可覆盖缓存位置。
运行完整 `bun run test` 时还应将 `RUSTDOC` 指向同一工具链的 `bin/rustdoc`，避免与 Homebrew 的旧版文档编译器混用。测试目录在 ExFAT 上有 `._*.test.ts` 元数据文件，
Bun 目录扫描会误当代码，`bun run test` 已改为显式 glob，只匹配真实测试文件。文件 URL 使用 `fileURLToPath` 支持带空格路径。
浏览器回归：`CHROME_BIN=<已安装 Chromium 路径> bun run timbre:test`。

本次原生检查 114 项通过（2 项原有忽略），WASM/前端 37 项通过，包含原生与 WASM 默认音频逐样本一致。
默认声源未变，原黄金样本无需改写。非并行基准中 2× 采样负载约 22.4% → 23.0%；
1× 约 10.4% → 10.1%，本机单次结果仅用于排查明显性能回退。


## License

[MIT](LICENSE). Bundled third-party files keep their own licenses: the CMU Pronouncing
Dictionary ([public/data/CMUDICT-LICENSE.txt](public/data/CMUDICT-LICENSE.txt)) and the fonts
([public/fonts/](public/fonts/)).
