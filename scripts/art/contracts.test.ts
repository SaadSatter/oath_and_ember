import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import {
  contractRegistry,
  applyContract,
  resolveContract,
  assetContractSchema,
  validateRuntimeCapability,
} from "./contracts.js";
import {
  effectLayout,
  normalizeGeneratedAsset,
  normalizeGrid,
  OpenAISpriteProvider,
} from "./generation.js";
import { inspectAtlas } from "./png.js";
import { providerConfigSchema } from "./provider-config.js";
import { prepareMaskRecovery } from "./recovery.js";
import { runAgent } from "./agent.js";
import type { Asset } from "./model.js";
const repo = resolve(import.meta.dirname, "../..");
const registry = contractRegistry();
function asset(key: string, overrides: Partial<Asset> = {}): Asset {
  const [character, animation] = key.split(":");
  const a: Asset = {
    asset_id: `${character}_${animation}_v1`,
    version: 1,
    status: "WAITING_FOR_ART",
    character,
    animation,
    source_file: `art/incoming/${character}_${animation}_v1`,
    canonical_references: [],
    runtime_files: [],
    directions: [],
    frame_count: 1,
    frame_dimensions: [128, 128],
    anchor: [64, 64],
    palette_behavior: {},
    qa_status: "NOT_RUN",
    iteration: 0,
    approved_at: null,
    target: null,
    mask_target: null,
    reports: [],
  };
  applyContract(a, registry[key]);
  return { ...a, ...overrides };
}
function canvas(a: Asset, source: Buffer) {
  const l = effectLayout(a),
    p = PNG.sync.read(source),
    raw = new PNG({ width: 1024, height: 1024 });
  for (let y = 0; y < l.regionHeight; y++)
    for (let x = 0; x < l.regionWidth; x++) {
      const from =
        (Math.floor(y / l.scale) * p.width + Math.floor(x / l.scale)) * 4;
      raw.data.set(p.data.subarray(from, from + 4), (y * 1024 + x) * 4);
    }
  return PNG.sync.write(raw);
}
describe("declarative asset capabilities", () => {
  it.each(["coco:ward", "coco:projectile"])(
    "preserves %s grid, pixels, anchor and safe alpha mask",
    (key) => {
      const a = asset(key),
        source = readFileSync(join(repo, "apps/client/public", a.target!));
      const n = normalizeGeneratedAsset(canvas(a, source), a);
      expect(
        PNG.sync.read(n.atlas).data.equals(PNG.sync.read(source).data),
      ).toBe(true);
      expect(n.layout.columns).toBe(a.contract!.columns);
      const image = PNG.sync.read(n.atlas),
        mask = PNG.sync.read(n.mask);
      for (let i = 0; i < image.data.length; i += 4)
        expect(mask.data[i + 3] > 0).toBe(image.data[i + 3] > 0);
    },
  );
  it("accepts a new compatible fixture through a contract without central generation changes", () => {
    const a = asset("coco:ward", {
      character: "test_guardian",
      animation: "aura",
      asset_id: "test_guardian_aura_v1",
    });
    const source = readFileSync(join(repo, "apps/client/public", a.target!));
    expect(
      normalizeGeneratedAsset(canvas(a, source), a).atlas.length,
    ).toBeGreaterThan(0);
    expect(resolveContract(a).pixel_content).toBe("effect_only");
    expect(() => validateRuntimeCapability(a.contract!)).not.toThrow();
  });
  it("never derives an alpha mask for character/equipment or no-recolor contracts", () => {
    const mixed = asset("coco:ward");
    mixed.contract = {
      ...mixed.contract!,
      pixel_content: "character_equipment",
      mask: { strategy: "alpha_effect", channels: ["green"] },
    };
    expect(() => effectLayout(mixed)).toThrow("Alpha masks require");
    const shield = asset("sieg:shield"),
      source = readFileSync(join(repo, "apps/client/public", shield.target!));
    expect(() =>
      normalizeGeneratedAsset(canvas(shield, source), shield),
    ).toThrow("Semantic mask is required");
    const plain = asset("coco:ward");
    plain.mask_target = null;
    plain.contract = {
      ...plain.contract!,
      asset_type: "equipment",
      pixel_content: "character_equipment",
      mask_target: null,
      mask: { strategy: "none", channels: [] },
    };
    const n = normalizeGeneratedAsset(
      canvas(
        plain,
        readFileSync(join(repo, "apps/client/public", plain.target!)),
      ),
      plain,
    );
    expect(PNG.sync.read(n.mask).data.every((v) => v === 0)).toBe(true);
  });
  it("validates existing Sieg Guard as character/equipment with multi-row frames and a semantic cloth mask", () => {
    const a = asset("sieg:shield"),
      source = readFileSync(join(repo, "apps/client/public", a.target!)),
      mask = readFileSync(join(repo, "apps/client/public", a.mask_target!));
    const n = normalizeGeneratedAsset(canvas(a, source), a, canvas(a, mask));
    expect(PNG.sync.read(n.atlas).data.equals(PNG.sync.read(source).data)).toBe(
      true,
    );
    expect(PNG.sync.read(n.mask).data.equals(PNG.sync.read(mask).data)).toBe(
      true,
    );
    expect([n.layout.columns, n.layout.rows]).toEqual([8, 6]);
    expect(() => validateRuntimeCapability(a.contract!)).not.toThrow();
    expect(
      prepareMaskRecovery(repo, a, [
        {
          id: "effect_mask",
          result: "FAIL",
          category: "ART",
          evidence: "mask.png",
          feedback: "mask missing alpha coverage",
        },
      ]),
    ).toBeNull();
    const padded = PNG.sync.read(canvas(a, source));
    padded.data.set([1, 2, 3, 255], (767 * 1024 + 1023) * 4);
    expect(() =>
      normalizeGeneratedAsset(PNG.sync.write(padded), a, canvas(a, mask)),
    ).toThrow("outside");
    const opaqueFrame = PNG.sync.read(canvas(a, source));
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        opaqueFrame.data[(y * 1024 + x) * 4 + 3] = 255;
    expect(() =>
      normalizeGeneratedAsset(PNG.sync.write(opaqueFrame), a, canvas(a, mask)),
    ).toThrow("Every active artwork frame");
  });
  it("repairs only bounded alpha-one padding noise without changing artwork or semantic masks", () => {
    const a = asset("sieg:shield");
    const source = readFileSync(join(repo, "apps/client/public", a.target!));
    const clean = canvas(a, source);
    const noisy = PNG.sync.read(clean);
    noisy.data.set([23, 42, 64, 1], (900 * 1024 + 20) * 4);
    noisy.data.set([23, 42, 64, 1], (700 * 1024 + 1000) * 4);
    const repaired = normalizeGrid(PNG.sync.write(noisy), a);
    expect(repaired.paddingRepair.clearedPixels).toBe(2);
    expect(repaired.paddingRepair.activePixelsChanged).toBe(0);
    expect(repaired.atlas.equals(normalizeGrid(clean, a).atlas)).toBe(true);
    expect(() => normalizeGrid(PNG.sync.write(noisy), a, false)).toThrow(
      "outside",
    );
    expect(() => normalizeGeneratedAsset(PNG.sync.write(noisy), a)).toThrow(
      "Semantic mask is required",
    );
    noisy.data[(900 * 1024 + 20) * 4 + 3] = 2;
    expect(() => normalizeGrid(PNG.sync.write(noisy), a)).toThrow("outside");
    const excessive = PNG.sync.read(clean);
    for (let x = 0; x < 1025; x++) excessive.data[(800 * 1024 + x) * 4 + 3] = 1;
    expect(() => normalizeGrid(PNG.sync.write(excessive), a)).toThrow(
      "outside",
    );
  });
  it("requires an actual runtime capability, not merely a declared target file", () => {
    const c = {
      ...registry["coco:ward"],
      target: "assets/effects/new/halo.png",
      mask_target: "assets/effects/new/halo-mask.png",
    };
    expect(() => validateRuntimeCapability(c)).toThrow(
      "Missing runtime capability",
    );
    const none = {
      ...registry["coco:ward"],
      mask: { strategy: "none" as const, channels: [] },
      mask_target: null,
    };
    expect(() => validateRuntimeCapability(none)).toThrow(
      "requires its companion mask binding",
    );
  });
  it("generates and preserves separate Sieg semantic-mask attempts without whole-alpha fallback", async () => {
    const root = mkdtempSync(join(tmpdir(), "shield-contract-"));
    try {
      const a = asset("sieg:shield");
      mkdirSync(join(root, "art/briefs"), { recursive: true });
      mkdirSync(join(root, "apps/client/public/assets/characters/oath"), {
        recursive: true,
      });
      copyFileSync(
        join(repo, "art/ART_SPEC.md"),
        join(root, "art/ART_SPEC.md"),
      );
      for (const f of [a.target!, a.mask_target!])
        copyFileSync(
          join(repo, "apps/client/public", f),
          join(root, "apps/client/public", f),
        );
      writeFileSync(
        join(root, "art/briefs", `${a.asset_id}.json`),
        JSON.stringify(a),
      );
      const raw = canvas(
          a,
          readFileSync(join(root, "apps/client/public", a.target!)),
        ),
        mask = canvas(
          a,
          readFileSync(join(root, "apps/client/public", a.mask_target!)),
        );
      const calls: FormData[] = [];
      const fetcher: typeof fetch = async (_url, options) => {
        calls.push(options!.body as FormData);
        return new Response(
          JSON.stringify({
            data: [
              {
                b64_json: (calls.length === 1 ? raw : mask).toString("base64"),
              },
            ],
          }),
          { status: 200, headers: { "x-request-id": `test-${calls.length}` } },
        );
      };
      const destination = join(root, a.source_file, "generated/attempt-01");
      const settings = providerConfigSchema.parse({
        schema_version: 1,
        sprite_artist: { provider: "openai" },
      }).sprite_artist;
      await new OpenAISpriteProvider(
        root,
        a,
        destination,
        settings,
        "test-key",
        fetcher,
      ).generate({
        assetId: a.asset_id,
        briefPath: `art/briefs/${a.asset_id}.json`,
        referencePaths: [],
        feedback: [],
      });
      expect(calls).toHaveLength(2);
      expect(calls[0].get("prompt")).toContain("47 frames");
      expect(calls[1].get("prompt")).toContain(
        "do NOT mask all nontransparent pixels",
      );
      expect(existsSync(join(destination, "mask-request.json"))).toBe(true);
      expect(existsSync(join(destination, "mask-response.json"))).toBe(true);
      expect(
        inspectAtlas(
          join(destination, "atlas.png"),
          join(destination, "mask.png"),
          a.frame_dimensions,
          a.frame_count,
          a.contract,
        ).every((c) => c.result === "PASS"),
      ).toBe(true);
      const repair = join(root, "mask-repair");
      mkdirSync(repair);
      writeFileSync(join(repair, "raw.png"), raw);
      const repairedMask = await new OpenAISpriteProvider(
        root,
        a,
        repair,
        settings,
        "test-key",
        fetcher,
      ).generateSemanticMask(raw);
      expect(calls).toHaveLength(3);
      expect(calls[2].get("prompt")).toContain("SEMANTIC MASK");
      expect(readFileSync(join(repair, "raw.png")).equals(raw)).toBe(true);
      expect(
        normalizeGeneratedAsset(raw, a, repairedMask).atlas.equals(
          readFileSync(join(destination, "atlas.png")),
        ),
      ).toBe(true);
      const defective = PNG.sync.read(mask);
      defective.data.set([255, 0, 0, 14], (900 * 1024 + 20) * 4);
      expect(() =>
        normalizeGeneratedAsset(raw, a, PNG.sync.write(defective)),
      ).toThrow("Semantic mask validation failed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 15000);
  it("routes a missing capability to engineering and resumes the same request when its contract is declared", () => {
    const root = mkdtempSync(join(tmpdir(), "contract-resume-"));
    try {
      mkdirSync(join(root, "art"), { recursive: true });
      copyFileSync(
        join(repo, "art/ART_SPEC.md"),
        join(root, "art/ART_SPEC.md"),
      );
      const cli = (...args: string[]) =>
        spawnSync(
          process.execPath,
          ["--import", "tsx", join(repo, "scripts/art/cli.ts"), ...args],
          {
            cwd: repo,
            env: {
              ...process.env,
              ART_WORKSPACE_ROOT: root,
              OPENAI_API_KEY: "",
            },
            encoding: "utf8",
          },
        );
      const get = () =>
        JSON.parse(readFileSync(join(root, "art/manifest.json"), "utf8")).assets
          .test_guardian_aura_v1 as Asset;
      writeFileSync(
        join(root, "art/contracts.json"),
        JSON.stringify({
          ...registry,
          "test_guardian:aura": {
            ...registry["coco:ward"],
            normalization: "unimplemented_v2",
          },
        }),
      );
      expect(cli("brief", "test_guardian", "aura").status).toBe(0);
      expect(get().status).toBe("WAITING_FOR_IMPLEMENTATION");
      expect(get().capability_handoff!.reason).toContain("normalization");
      expect(contractRegistry(root)["coco:ward"]).toEqual(
        registry["coco:ward"],
      );
      expect(cli("run", "test_guardian_aura_v1").stdout).toContain(
        "Game Engineer",
      );
      const request = readFileSync(
        join(root, get().capability_handoff!.request_file),
      );
      writeFileSync(
        join(root, "art/contracts.json"),
        JSON.stringify({
          ...registry,
          "test_guardian:aura": registry["coco:ward"],
        }),
      );
      mkdirSync(join(root, "apps/client/public/assets/characters/ember"), {
        recursive: true,
      });
      for (const f of ["defense.png", "defense-mask.png"])
        copyFileSync(
          join(repo, "apps/client/public/assets/characters/ember", f),
          join(root, "apps/client/public/assets/characters/ember", f),
        );
      const commands: string[][] = [];
      const result = runAgent(
        root,
        { assetId: "test_guardian_aura_v1", text: "RESUME" },
        (args) => {
          commands.push(args);
          const r = cli(...args);
          if (r.status) throw Error(r.stderr);
        },
      );
      expect(result.clarification).toBeUndefined();
      expect(get().status).toBe("WAITING_FOR_ART");
      expect(get().capability_handoff).toBeUndefined();
      expect(get().asset_id).toBe("test_guardian_aura_v1");
      expect(get().generation_attempts).toBeUndefined();
      expect(
        readFileSync(
          join(
            root,
            "art/handoffs/test_guardian_aura_v1/capability-request.json",
          ),
        ),
      ).toEqual(request);
      expect(commands.some((c) => c[0] === "brief")).toBe(false);
      expect(assetContractSchema.parse(get().contract).mask.strategy).toBe(
        "alpha_effect",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 15000);
});
