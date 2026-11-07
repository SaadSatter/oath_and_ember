// Post-run credential scan for scripts/midterm/live.ts.
//
// The launcher checks that the API key appears in no file the run wrote. It
// used to read each file whole as a UTF-8 string. A recorded run's
// unfinished video (.recording-tmp/*.webm, 306 MB after the S2 seed 0 OpenAI
// run) was read that way too, which stalls the process and throws past V8's
// string limit (about 512 MB). This reads files in fixed-size chunks and
// searches the raw bytes, so any size is safe and nothing is skipped.

import { closeSync, openSync, readdirSync, readSync } from "node:fs";
import { join } from "node:path";

const CHUNK = 1 << 20;

/** Whether `path` contains the UTF-8 bytes of `needle`, read in chunks. */
export function fileContains(path: string, needle: string, chunkBytes = CHUNK): boolean {
  const target = Buffer.from(needle, "utf8");
  if (!target.length) return false;
  const keep = target.length - 1;
  const buf = Buffer.alloc(chunkBytes + keep);
  const fd = openSync(path, "r");
  try {
    let carry = 0;
    for (;;) {
      const read = readSync(fd, buf, carry, chunkBytes, null);
      if (!read) return false;
      const len = carry + read;
      if (buf.subarray(0, len).includes(target)) return true;
      // Keep the last bytes so a match across two chunks is still found.
      carry = Math.min(keep, len);
      buf.copy(buf, 0, len - carry, len);
    }
  } finally {
    closeSync(fd);
  }
}

/** Every regular file under `dir` that contains `needle`. */
export function filesContaining(dir: string, needle: string): string[] {
  const found: string[] = [];
  const scan = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.isFile() && fileContains(p, needle)) found.push(p);
    }
  };
  scan(dir);
  return found;
}
