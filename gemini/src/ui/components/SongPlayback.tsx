import { useStore } from "../store.ts";
import { DEMO_SONGS, playDemo, stopSinging, useSing } from "../singing.ts";
import { SOURCE_TIMBRES } from "../../audio/sourceTimbres.ts";
import { bodyLabel } from "../body.ts";
import { Chip } from "./Screen.tsx";

/** One-click song playback through the same live source controls as the keys. */
export function SongPlayback() {
  const song = useSing((s) => s.selectedSong);
  const setSong = useSing((s) => s.setSelectedSong);
  const demo = useSing((s) => s.demo);
  const pending = useSing((s) => s.pendingDemo);
  const error = useSing((s) => s.demoError);
  const at = useSing((s) => s.demoAt);
  const count = useSing((s) => s.syllables.length);
  const body = useStore((s) => s.body);
  const timbre = useStore((s) => s.sourceTimbre);
  const preset = SOURCE_TIMBRES.find((p) => p.id === timbre.id)!;
  const active = !!(demo || pending);
  return <div className="song-playback" role="group" aria-label="歌曲播放">
    <div className="song-playback-row">
      <label>歌曲
        <select aria-label="选择歌曲" value={song} onChange={(e) => setSong(e.target.value)}>
          {DEMO_SONGS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </label>
      <button type="button" className="primary" disabled={active} onClick={() => {
        const s = useStore.getState();
        void playDemo(song, s.body, async () => {
          await s.start();
          const current = useStore.getState();
          if (!current.started) throw new Error(current.startError ?? "无法启动音频，请重试");
        });
      }}>{pending ? "正在准备…" : demo ? "正在唱歌" : "开始唱歌"}</button>
      <Chip toggle={false} disabled={!active} onClick={stopSinging}>停止唱歌</Chip>
      <span className="song-playback-status" role="status">
        {error ? `播放失败：${error}` : pending ? "正在准备声音，可随时停止" : demo ? `${demo} · ${Math.max(0, at + 1)} / ${count} 音节` : "选好歌曲和下方音色，点击开始唱歌"}
      </span>
    </div>
    <p className="song-playback-note">{bodyLabel(body)} · {timbre.bypass || timbre.amount === 0 ? "原声（旁路 / 零强度）" : preset.name} · 播放中可调音色和强度；切换声道时从头演唱。切换歌曲后点击开始。</p>
  </div>;
}
