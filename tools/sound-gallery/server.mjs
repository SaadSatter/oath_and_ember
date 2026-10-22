import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
const root = fileURLToPath(new URL(".", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
export async function createGalleryServer() {
  const catalog = JSON.parse(
    await readFile(resolve(root, "catalog.json"), "utf8"),
  );
  const allowed = new Set([
    "/",
    "/index.html",
    "/gallery.css",
    "/gallery.js",
    "/review-state.mjs",
    "/catalog.json",
    ...catalog.assets.map((a) => a.url),
    ...[
      "SOUND_DESIGN_PLAN.md",
      "SOUND_ASSET_VERIFICATION.json",
      "interface-License.txt",
      "impact-License.txt",
      "rpg-License.txt",
    ].map((f) => "/reference/" + f),
  ]);
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (!allowed.has(path)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const file = resolve(root, path === "/" ? "index.html" : path.slice(1));
    try {
      const info = await stat(file);
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Accept-Ranges", "bytes");
      let start = 0,
        end = info.size - 1;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
          res.end();
          return;
        }
        start = match[1]
          ? Number(match[1])
          : Math.max(0, info.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= info.size
        ) {
          res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
          res.end();
          return;
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader("Content-Length", end - start + 1);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = createReadStream(file, { start, end });
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.SOUND_GALLERY_PORT || 3022);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Invalid SOUND_GALLERY_PORT");
  const server = await createGalleryServer();
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Sound Gallery: http://127.0.0.1:${port} — review only; no game connection`,
    ),
  );
}
