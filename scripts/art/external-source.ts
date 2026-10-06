import { createHash } from "node:crypto";
import { PNG } from "pngjs";

export interface SourceGrid {
  columns: number;
  rows: number;
  frame_count: number;
}

// Read source bytes, never filename extensions. This stage never repairs pixels.
export function inspectExternalSource(bytes: Buffer, grid?: SourceGrid) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let format = "unknown",
    width: number | null = null,
    height: number | null = null;
  let decoded: PNG | undefined;
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    format = "png";
    decoded = PNG.sync.read(bytes);
    width = decoded.width;
    height = decoded.height;
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    format = "jpeg";
    for (let offset = 2; offset + 3 < bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      ) {
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  }
  const issues: string[] = [];
  if (format !== "png")
    issues.push(
      "Transparent source PNG required; JPEG/unknown formats cannot supply sprite alpha. Re-export the original source, never remove a baked checkerboard automatically.",
    );
  let transparent_pixels = 0,
    visible_pixels = 0;
  if (format === "jpeg" && width && height) visible_pixels = width * height;
  if (decoded)
    for (let i = 3; i < decoded.data.length; i += 4) {
      if (decoded.data[i] === 0) transparent_pixels++;
      else visible_pixels++;
    }
  if (decoded && (!transparent_pixels || !visible_pixels))
    issues.push(
      "Source PNG requires both visible artwork and actual alpha-zero background; an opaque PNG conversion does not restore transparency.",
    );
  const frames: Array<{
    index: number;
    bounds: [number, number, number, number] | null;
    transparent_pixels: number;
  }> = [];
  if (grid) {
    if (
      ![grid.columns, grid.rows, grid.frame_count].every(
        (n) => Number.isInteger(n) && n > 0,
      ) ||
      grid.frame_count > grid.columns * grid.rows
    )
      issues.push("Invalid declared source grid.");
    else if (!width || !height || width % grid.columns || height % grid.rows)
      issues.push(
        "Source dimensions do not divide evenly into the declared grid.",
      );
    else if (decoded) {
      const w = width / grid.columns,
        h = height / grid.rows;
      for (let index = 0; index < grid.frame_count; index++) {
        let left = w,
          top = h,
          right = -1,
          bottom = -1,
          transparent = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const alpha =
              decoded.data[
                ((Math.floor(index / grid.columns) * h + y) * width +
                  (index % grid.columns) * w +
                  x) *
                  4 +
                  3
              ];
            if (!alpha) transparent++;
            else {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
          }
        frames.push({
          index,
          bounds: right < 0 ? null : [left, top, right + 1, bottom + 1],
          transparent_pixels: transparent,
        });
        if (!transparent || right < 0)
          issues.push(
            `Frame ${index} needs visible art and a real transparent background.`,
          );
      }
    }
  }
  return {
    sha256,
    format,
    width,
    height,
    transparent_pixels,
    visible_pixels,
    frames,
    issues,
    ready: issues.length === 0,
  };
}

export function requireTransparentExternalSource(
  bytes: Buffer,
  grid?: SourceGrid,
) {
  const result = inspectExternalSource(bytes, grid);
  if (!result.ready) throw new Error(result.issues.join(" "));
  return result;
}
