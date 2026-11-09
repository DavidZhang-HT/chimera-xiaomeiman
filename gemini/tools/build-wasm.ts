/** Keep compiler artifacts off removable filesystems; only publish a validated, complete WASM. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUT_VERSION } from "../src/wasm/wire.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const key = createHash("sha256").update(root).digest("hex").slice(0, 12);
// Every checkout gets its own cache. An explicit caller-provided target directory is respected.
const target = process.env.CARGO_TARGET_DIR ?? resolve(tmpdir(), `chimera-wasm-${key}`);
const proc = Bun.spawnSync(["cargo", "build", "-p", "chimera-wasm", "--release", "--target", "wasm32-unknown-unknown"], {
  cwd: root, env: { ...process.env, CARGO_TARGET_DIR: target }, stdout: "inherit", stderr: "inherit",
});
if (proc.exitCode !== 0) process.exit(proc.exitCode);
const bytes = readFileSync(resolve(root, target, "wasm32-unknown-unknown/release/chimera_wasm.wasm"));
const module = new WebAssembly.Module(bytes);
const instance = new WebAssembly.Instance(module, {});
if ((instance.exports.chimera_layout_version as () => number)() !== LAYOUT_VERSION) throw new Error("Built WASM has the wrong source ABI");
const destination = resolve(root, "src/wasm/chimera.wasm");
const temporary = `${destination}.${process.pid}.tmp`;
writeFileSync(temporary, bytes);
if (!readFileSync(temporary).equals(bytes)) throw new Error("WASM copy verification failed");
renameSync(temporary, destination);
if (!readFileSync(destination).equals(bytes)) throw new Error("Published WASM verification failed");
console.info(`[wasm] Published ${bytes.length} validated bytes (ABI ${LAYOUT_VERSION}) from ${target}`);
