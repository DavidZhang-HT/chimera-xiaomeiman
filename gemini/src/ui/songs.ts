import { DEMO_SONGS as ENGINE_SONGS, type DemoSong } from "../wasm/engine.ts";

export type SingingSong = Omit<DemoSong, "octave">;

export const TWINKLE_FULL = "小星星 · 完整版（英文）";
// Traditional public-domain melody and English first verse; rests allow a breath per line.
const phrases = [
  [60, 60, 67, 67, 69, 69, 67],
  [65, 65, 64, 64, 62, 62, 60],
  [67, 67, 65, 65, 64, 64, 62],
  [67, 67, 65, 65, 64, 64, 62],
  [60, 60, 67, 67, 69, 69, 67],
  [65, 65, 64, 64, 62, 62, 60],
];
// Body-specific octave metadata belongs to the legacy engine demos, not the song player.
export const DEMO_SONGS: readonly SingingSong[] = [...ENGINE_SONGS.map(({ octave, ...song }) => song), {
  name: TWINKLE_FULL,
  bpm: 96,
  lyrics: "Twinkle twinkle little star, how I wonder what you are. Up above the world so high, like a diamond in the sky. Twinkle twinkle little star, how I wonder what you are.",
  notes: phrases.flatMap((line, i): [number, number][] => [
    ...line.map((midi, j): [number, number] => [midi, j === 6 ? 2 : 1]),
    ...(i < phrases.length - 1 ? [[0, 0.256] as [number, number]] : []),
  ]),
}];
