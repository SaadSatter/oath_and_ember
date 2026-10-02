import { describe, it, expect, vi } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";
import {
  OpenAISpriteProvider,
  normalizeGeneratedEffect,
  digest,
  GeneratedArtError,
} from "./generation.js";
import {
  OpenAIVisionReviewer,
  collectVisionEvidence,
  validateVisionReview,
  rubricIds,
  viewports,
  captureStates,
  type VisionEvidence,
} from "./vision.js";
import {
  providerConfigSchema,
  requireApiKey,
  postOpenAI,
  type ApiFetch,
} from "./provider-config.js";
import { advanceAsset, type PipelineStages } from "./runner.js";
import { route, type Asset } from "./model.js";
import { inspectAtlas } from "./png.js";
const repository = resolve(import.meta.dirname, "../..");
const config = providerConfigSchema.parse({
  schema_version: 1,
  sprite_artist: { provider: "openai" },
  visual_qa: { provider: "openai" },
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "art-provider-test-"));
  for (const d of ["art/briefs", "apps/client/public/assets/characters/ember"])
    mkdirSync(join(root, d), { recursive: true });
  for (const f of ["ART_SPEC.md", "VISUAL_QA.md"])
    copyFileSync(join(repository, "art", f), join(root, "art", f));
  for (const f of ["defense.png", "defense-mask.png"])
    copyFileSync(
      join(repository, "apps/client/public/assets/characters/ember", f),
      join(root, "apps/client/public/assets/characters/ember", f),
    );
  const a: Asset = {
    asset_id: "coco_ward_v1",
    version: 1,
    status: "WAITING_FOR_ART",
    character: "coco",
    animation: "ward",
    source_file: "art/incoming/coco_ward_v1",
    canonical_references: [],
    runtime_files: [],
    directions: ["omnidirectional"],
    frame_count: 1,
    frame_dimensions: [128, 128],
    anchor: [64, 70],
    palette_behavior: { runtime_recolor: true },
    qa_status: "NOT_RUN",
    iteration: 0,
    approved_at: null,
    target: "assets/characters/ember/defense.png",
    mask_target: "assets/characters/ember/defense-mask.png",
    reports: [],
  };
  writeFileSync(join(root, "art/briefs/coco_ward_v1.json"), JSON.stringify(a));
  return {
    root,
    a,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};
function rawWard(root: string) {
  const src = PNG.sync.read(
      readFileSync(
        join(root, "apps/client/public/assets/characters/ember/defense.png"),
      ),
    ),
    raw = new PNG({ width: 1024, height: 1024 });
  for (let y = 0; y < 1024; y++)
    for (let x = 0; x < 1024; x++) {
      const from = (Math.floor(y / 8) * 128 + Math.floor(x / 8)) * 4;
      raw.data.set(src.data.subarray(from, from + 4), (y * 1024 + x) * 4);
    }
  return PNG.sync.write(raw);
}
function seedEvidence(root: string, a: Asset) {
  const directory = `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}`,
    dir = join(root, directory);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(root, a.runtime_files[0]), join(dir, "contact-sheet.png"));
  for (const size of viewports) {
    const [width, height] = size.split("x").map(Number);
    const screen = PNG.sync.write(new PNG({ width, height }));
    for (const c of [1, 2])
      for (const state of captureStates)
        writeFileSync(join(dir, `${size}-client-${c}-${state}.png`), screen);
    writeFileSync(join(dir, `${size}-states.json`), "[]");
  }
  writeFileSync(
    join(dir, "qa-report.json"),
    JSON.stringify({
      checks: [
        { id: "typecheck", result: "PASS" },
        { id: "visual_rubric", result: "REVIEW" },
      ],
    }),
  );
  a.reports.push(`${directory}/qa-report.json`);
}
function stageCandidate(root: string, a: Asset, source: string) {
  a.iteration++;
  const directory = `art/qa/${a.asset_id}/iteration-${String(a.iteration).padStart(2, "0")}/candidate`;
  mkdirSync(join(root, directory), { recursive: true });
  for (const file of ["atlas.png", "mask.png"])
    copyFileSync(join(root, source, file), join(root, directory, file));
  a.runtime_files = [`${directory}/atlas.png`, `${directory}/mask.png`];
  a.source_hash = digest(join(root, a.runtime_files[0]));
  a.integration_hash = digest(join(root, a.runtime_files[1]));
  a.status = "READY_FOR_QA";
}
function reviewResult(packet: VisionEvidence) {
  return {
    checks: rubricIds.map((id) => ({
      id,
      result: "PASS",
      category: null,
      confidence: 0.95,
      evidence: [
        packet.images.find((i) => i.role === "source")!.path,
        packet.images.find((i) => i.role === "runtime")!.path,
      ],
      feedback: "Test-only fixture evaluation.",
    })),
  };
}
function visionResponse(value: unknown) {
  return new Response(
    JSON.stringify({
      id: "resp_test",
      model: "gpt-4.1",
      status: "completed",
      usage: { input_tokens: 100 },
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(value) }],
        },
      ],
    }),
    { status: 200, headers: { "x-request-id": "request_test" } },
  );
}
describe("AI art and vision adapters", () => {
  it("keeps credentials optional and rejects unsafe/unknown provider configuration", () => {
    expect(
      providerConfigSchema.parse({ schema_version: 1 }).sprite_artist.provider,
    ).toBe("manual");
    expect(() => requireApiKey({})).toThrow("OPENAI_API_KEY");
    expect(() =>
      providerConfigSchema.parse({ schema_version: 1, api_key: "secret" }),
    ).toThrow();
  });
  it("normalizes declared cells without anchor drift and rejects opaque or off-grid art", () => {
    const f = fixture();
    try {
      const raw = rawWard(f.root),
        out = normalizeGeneratedEffect(raw, f.a);
      expect(PNG.sync.read(out.atlas).data).toEqual(
        PNG.sync.read(
          readFileSync(
            join(
              f.root,
              "apps/client/public/assets/characters/ember/defense.png",
            ),
          ),
        ).data,
      );
      const opaque = PNG.sync.read(raw);
      for (let i = 3; i < opaque.data.length; i += 4) opaque.data[i] = 255;
      expect(() =>
        normalizeGeneratedEffect(PNG.sync.write(opaque), f.a),
      ).toThrow(GeneratedArtError);
      const projectile = {
        ...f.a,
        animation: "projectile",
        frame_count: 4,
        frame_dimensions: [64, 64] as [number, number],
        anchor: [32, 32] as [number, number],
      };
      const sheet = new PNG({ width: 1024, height: 1024 });
      sheet.data.set([255, 155, 50, 255], (512 * 1024 + 2) * 4);
      expect(() =>
        normalizeGeneratedEffect(PNG.sync.write(sheet), projectile),
      ).toThrow("outside");
    } finally {
      f.cleanup();
    }
  });
  it("calls the documented Images edit endpoint with references and saves source/provenance without credentials", async () => {
    const f = fixture();
    try {
      const request = vi.fn<ApiFetch>(async (url, init) => {
        expect(String(url)).toBe("https://api.openai.com/v1/images/edits");
        const form = init!.body as FormData;
        expect(form.get("background")).toBe("transparent");
        expect(form.getAll("image[]").length).toBe(1);
        expect(String(form.get("prompt"))).toContain("Frames must stay hollow");
        return new Response(
          JSON.stringify({
            data: [{ b64_json: rawWard(f.root).toString("base64") }],
          }),
          { status: 200 },
        );
      });
      const p = new OpenAISpriteProvider(
        f.root,
        f.a,
        join(f.root, "art/incoming/coco_ward_v1/generated/attempt-01"),
        config.sprite_artist,
        "fake_test_secret",
        request,
      );
      const output = await p.generate({
        assetId: f.a.asset_id,
        briefPath: "art/briefs/coco_ward_v1.json",
        referencePaths: [],
        feedback: [
          {
            id: "vfx",
            result: "FAIL",
            category: "ART",
            evidence: "source.png",
            feedback: "Frames must stay hollow",
          },
        ],
      });
      expect(
        inspectAtlas(
          join(f.root, output.submissionDirectory, "atlas.png"),
          join(f.root, output.submissionDirectory, "mask.png"),
          [128, 128],
          1,
        ).every((c) => c.result === "PASS"),
      ).toBe(true);
      expect(
        readFileSync(
          join(f.root, output.submissionDirectory, "request.json"),
          "utf8",
        ),
      ).not.toContain("fake_test_secret");
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      f.cleanup();
    }
  });
  it("does not repeat failed/billable HTTP calls and suppresses provider error bodies", async () => {
    const fetcher = vi.fn<ApiFetch>(
      async () => new Response("fake-secret-in-error-body", { status: 429 }),
    );
    await expect(
      postOpenAI("responses", "{}", "fake_key", 1000, fetcher),
    ).rejects.toThrow("HTTP 429");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("vision submits all 64 screenshots and schema, validates evidence, and gates confidence", async () => {
    const f = fixture();
    try {
      const source = "art/incoming/coco_ward_v1";
      mkdirSync(join(f.root, source), { recursive: true });
      const n = normalizeGeneratedEffect(rawWard(f.root), f.a);
      writeFileSync(join(f.root, source, "atlas.png"), n.atlas);
      writeFileSync(join(f.root, source, "mask.png"), n.mask);
      stageCandidate(f.root, f.a, source);
      seedEvidence(f.root, f.a);
      const packet = collectVisionEvidence(f.root, f.a);
      expect(packet.images.filter((i) => i.role === "runtime")).toHaveLength(
        64,
      );
      const fetcher = vi.fn<ApiFetch>(async (_url, init) => {
        const body = JSON.parse(init!.body as string);
        expect(body.store).toBe(false);
        expect(body.text.format.type).toBe("json_schema");
        expect(body.text.format.strict).toBe(true);
        expect(
          body.input[0].content.filter(
            (c: { type: string }) => c.type === "input_image",
          ),
        ).toHaveLength(packet.images.length);
        return visionResponse(reviewResult(packet));
      });
      const reviewer = new OpenAIVisionReviewer(
        f.root,
        config.visual_qa,
        "fake_key",
        fetcher,
      );
      const result = await reviewer.review(f.a, join(f.root, "review"));
      expect(route(result.checks, 1)).toBe("AWAITING_APPROVAL");
      const low = reviewResult(packet);
      low.checks[0].confidence = 0.2;
      expect(route(validateVisionReview(low, packet, 0.85), 1)).toBe(
        "NEEDS_HUMAN_REVIEW",
      );
      const bad = reviewResult(packet);
      bad.checks[0].evidence = ["invented-file.png"];
      expect(() => validateVisionReview(bad, packet, 0.85)).toThrow("unseen");
      const duplicate = reviewResult(packet);
      duplicate.checks[0].id = duplicate.checks[1].id;
      expect(() => validateVisionReview(duplicate, packet, 0.85)).toThrow(
        "exactly once",
      );
      writeFileSync(join(f.root, f.a.runtime_files[0]), Buffer.from("changed"));
      expect(() => collectVisionEvidence(f.root, f.a)).toThrow(
        "changed after capture",
      );
    } finally {
      f.cleanup();
    }
  });
  it("routes ART vs IMPLEMENTATION and demands evidence of the cause", () => {
    const source = "candidate.png",
      runtime = "runtime.png";
    const packet = {
      images: [
        { path: source, role: "source" },
        { path: runtime, role: "runtime" },
      ],
    } as VisionEvidence;
    const art = reviewResult(packet) as {
      checks: {
        id: (typeof rubricIds)[number];
        result: string;
        category: string | null;
        confidence: number;
        evidence: string[];
        feedback: string;
      }[];
    };
    art.checks[0] = {
      ...art.checks[0],
      result: "FAIL",
      category: "ART",
      evidence: [source],
      feedback: "Embedded staff design changes in source.",
    };
    expect(route(validateVisionReview(art, packet, 0.85), 1)).toBe(
      "QA_FAILED_ART",
    );
    art.checks[0].category = "IMPLEMENTATION";
    art.checks[0].evidence = [runtime];
    expect(route(validateVisionReview(art, packet, 0.85), 1)).toBe(
      "QA_FAILED_IMPLEMENTATION",
    );
    art.checks[0].evidence = [source];
    expect(() => validateVisionReview(art, packet, 0.85)).toThrow("runtime");
  });
  it("runs a mocked ART regeneration loop through both real adapters and stops at human approval", async () => {
    const f = fixture();
    try {
      let generated = 0,
        reviewed = 0;
      const stages: PipelineStages = {
        artistEnabled: true,
        visionEnabled: true,
        maxIterations: 3,
        hasSubmission: () => false,
        canReview: () => true,
        generate: async (a) => {
          generated++;
          const dest = `art/incoming/${a.asset_id}/generated/attempt-${generated}`;
          const provider = new OpenAISpriteProvider(
            f.root,
            a,
            join(f.root, dest),
            config.sprite_artist,
            "fake_key",
            async () =>
              new Response(
                JSON.stringify({
                  data: [{ b64_json: rawWard(f.root).toString("base64") }],
                }),
                { status: 200 },
              ),
          );
          const result = await provider.generate({
            assetId: a.asset_id,
            briefPath: `art/briefs/${a.asset_id}.json`,
            referencePaths: [],
            feedback: [],
          });
          a.source_file = result.submissionDirectory;
          a.status = "READY_FOR_INTEGRATION";
        },
        integrate: async (a) => stageCandidate(f.root, a, a.source_file),
        qa: async (a) => {
          seedEvidence(f.root, a);
          a.status = "NEEDS_HUMAN_REVIEW";
        },
        vision: async (a) => {
          reviewed++;
          const packet = collectVisionEvidence(f.root, a);
          const output = reviewResult(packet) as ReturnType<
            typeof reviewResult
          > & {
            checks: ({ result: string; category: string | null } & ReturnType<
              typeof reviewResult
            >["checks"][number])[];
          };
          if (reviewed === 1) {
            Object.assign(output.checks[3], {
              result: "FAIL",
              category: "ART",
              feedback: "Source fixture defect; regenerate.",
            });
          }
          const reviewer = new OpenAIVisionReviewer(
            f.root,
            config.visual_qa,
            "fake_key",
            async () => visionResponse(output),
          );
          const result = await reviewer.review(
            a,
            join(f.root, `vision-${reviewed}`),
          );
          a.status = route(result.checks, a.iteration);
        },
      };
      await advanceAsset(f.a, stages);
      expect(generated).toBe(2);
      expect(reviewed).toBe(2);
      expect(f.a.iteration).toBe(2);
      expect(f.a.status).toBe("AWAITING_APPROVAL");
      expect(
        readFileSync(
          join(f.root, "art/incoming/coco_ward_v1/generated/attempt-1/raw.png"),
        ),
      ).toBeTruthy();
    } finally {
      f.cleanup();
    }
  }, 15000);
  it("stops at implementation/design failures and bounds repeated ART failures", async () => {
    const f = fixture();
    try {
      for (const status of [
        "QA_FAILED_IMPLEMENTATION",
        "NEEDS_HUMAN_REVIEW",
      ] as const) {
        f.a.status = status;
        const generate = vi.fn();
        await advanceAsset(f.a, {
          artistEnabled: true,
          visionEnabled: true,
          maxIterations: 3,
          hasSubmission: () => true,
          canReview: () => false,
          generate,
          integrate: vi.fn(),
          qa: vi.fn(),
          vision: vi.fn(),
        });
        expect(generate).not.toHaveBeenCalled();
      }
      f.a.status = "QA_FAILED_ART";
      f.a.iteration = 1;
      const generate = vi.fn(async (a: Asset) => {
        a.status = "READY_FOR_INTEGRATION";
      });
      await advanceAsset(f.a, {
        artistEnabled: true,
        visionEnabled: false,
        maxIterations: 3,
        hasSubmission: () => true,
        canReview: () => false,
        generate,
        integrate: async (a) => {
          a.iteration++;
          a.status = route(
            [
              {
                id: "art",
                result: "FAIL",
                category: "ART",
                evidence: "source.png",
                feedback: "Invalid source",
              },
            ],
            a.iteration,
          );
        },
        qa: vi.fn(),
        vision: vi.fn(),
      });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(f.a.status).toBe("NEEDS_HUMAN_REVIEW");
    } finally {
      f.cleanup();
    }
  });
});
