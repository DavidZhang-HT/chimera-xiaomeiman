# Chimera Vocal Synth — 《小美满》复现 (Antigravity Light UI & 4 Voices)

本项目位于 [`gemini/`](./gemini) 子目录下，基于物理声道建模合成器 [`chimera-vocal-synth`](https://github.com/jamesondh/chimera-vocal-synth) 复现了《小美满》，并包含以下改进：

- **中文汉字与拼音发音引擎**：在 [`gemini/crates/chimera/src/phonetics/english.rs`](./gemini/crates/chimera/src/phonetics/english.rs) 与 [`gemini/crates/chimera/src/phonetics/syllables.rs`](./gemini/crates/chimera/src/phonetics/syllables.rs) 中内置汉字转拼音与普通话声母/韵母到 IPA 音素的映射。
- **Antigravity 浅色/白底 UI 主题**：全界面及 2D/3D 声道解剖视图重构为白底高对比清爽风格。
- **四声部独立合成与切换**：支持 **男声 (`male`)**、**中性 (`neutral`)**、**女声 (`female`)**、**童声 (`child`)** 四个独立声道体型，可在主合成器与 `?show=xiaomeiman` 3D 舞台模式中随时切换试听。
- **预编译 WASM 与独立音频制品**：已内置编译好的 [`gemini/src/wasm/chimera.wasm`](./gemini/src/wasm/chimera.wasm) 及四声部独立 `.wav` / `.tele` 文件，克隆后可直接启动。

## 快速运行

```bash
cd gemini
bun install
bun run dev
```

- **主合成器界面**：`http://localhost:5317/`
- **《小美满》3D 四声部切换舞台**：`http://localhost:5317/?show=xiaomeiman`
