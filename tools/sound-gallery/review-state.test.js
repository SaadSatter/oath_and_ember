import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  defaultReview,
  emptyReview,
  validateReview,
  withTracks,
} from "./review-state.mjs";
import { createGalleryServer } from "./server.mjs";
const catalog = JSON.parse(
  await readFile(new URL("./catalog.json", import.meta.url), "utf8"),
);
const event = catalog.events.find((e) => e.phase1),
  silent = catalog.events.find((e) => e.silent);
describe("isolated sound review decisions", () => {
  it("starts Pending and preserves reviewed mix / notes through JSON export/import", () => {
    const state = emptyReview(catalog);
    state.events[event.id] = {
      ...defaultReview(event),
      status: "Approved",
      notes: "Use this warm version.",
    };
    state.assets.click = { status: "Needs Revision", notes: "Too bright." };
    expect(validateReview(JSON.parse(JSON.stringify(state)), catalog)).toEqual(
      state,
    );
    expect(defaultReview(silent).tracks).toEqual([]);
  });
  it("invalidates approval after changing an audition selection", () => {
    expect(
      withTracks({ ...defaultReview(event), status: "Approved" }, [
        { assetId: "click", gain: 0.15, delay: 0, rate: 1, loop: false },
      ]).status,
    ).toBe("Pending");
  });
  it("rejects an asset assignment to a protected silence row", () => {
    const state = emptyReview(catalog);
    state.events[silent.id] = { ...defaultReview(event) };
    expect(() => validateReview(state, catalog)).toThrow(/protected silence/);
  });
  it("rejects cross-plan reviews, unknown clips and unsafe gain without partial acceptance", () => {
    const state = emptyReview(catalog);
    expect(() =>
      validateReview({ ...state, planSha256: "other" }, catalog),
    ).toThrow(/different plan/);
    state.events[event.id] = defaultReview(event);
    state.events[event.id].tracks[0].assetId = "nonexistent";
    expect(() => validateReview(state, catalog)).toThrow(/Unknown source/);
    state.events[event.id].tracks[0].assetId = "click";
    state.events[event.id].tracks[0].gain = 2;
    expect(() => validateReview(state, catalog)).toThrow(/invalid layer/);
    expect(emptyReview(catalog).events).toEqual({});
  });
});
describe("development-only media server", () => {
  it("serves seekable source audio but no gameplay routes, write APIs or repository traversal", async () => {
    const server = await createGalleryServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const url = `http://127.0.0.1:${server.address().port}`;
      const range = await fetch(`${url}/assets/click.ogg`, {
        headers: { Range: "bytes=0-3" },
      });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer()).toString()).toBe("OggS");
      expect(range.headers.get("content-range")).toMatch(/^bytes 0-3\//);
      expect(range.headers.get("content-security-policy")).toContain(
        "connect-src 'self'",
      );
      expect(
        (
          await fetch(`${url}/assets/click.ogg`, {
            headers: { Range: "bytes=99999999-" },
          })
        ).status,
      ).toBe(416);
      expect(
        (await fetch(`${url}/reference/SOUND_DESIGN_PLAN.md`)).status,
      ).toBe(200);
      expect((await fetch(`${url}/socket.io/`)).status).toBe(404);
      expect((await fetch(`${url}/package.json`)).status).toBe(404);
      expect((await fetch(`${url}/%2e%2e%2fpackage.json`)).status).toBe(404);
      expect(
        (await fetch(`${url}/catalog.json`, { method: "POST", body: "{}" }))
          .status,
      ).toBe(405);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
