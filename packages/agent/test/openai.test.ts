// Offline only: every provider HTTP request is intercepted; all ledgers scratch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  OpenAIGateway,
  openaiCost,
  openaiPrices,
  openaiSchema,
  OPENAI_PREMIUM,
} from "../src/policies/openai.js";
import {
  AnthropicGateway,
  anthropicPrices,
  replySchema,
  parseReply,
  LLMPlayer,
} from "../src/policies/llm.js";
import { providerConfig } from "../src/policies/providers.js";
import {
  MeteredGateway,
  ModelBudget,
  defaultBudgetLimits,
} from "../src/budget.js";
import { authorizeBudget, authorizedCall } from "./helpers/paid.js";
import { smokeCall } from "../src/harness.js";
import { reconcile, SpendLedger } from "../src/ledger.js";
import { TraceWriter, verifyTrace } from "../src/trace.js";
import { AgentEnvironment } from "../src/environment.js";

const schema = replySchema();
const options = { schema };
const gateway = () =>
  new OpenAIGateway(
    "gpt-6-luna",
    openaiPrices["gpt-6-luna"],
    "offline-fixture",
  );
const good = () => ({
  model: "gpt-6-luna",
  status: "completed",
  service_tier: "default",
  output: [
    { type: "reasoning", summary: [{ text: "PRIVATE-REASONING-FIXTURE" }] },
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: JSON.stringify({
            notes: null,
            actions: [
              {
                type: "wait",
                ticks: 1,
                direction: null,
                item: null,
                ability: null,
                option: null,
                text: null,
              },
            ],
          }),
        },
      ],
    },
  ],
  usage: {
    input_tokens: 10000,
    output_tokens: 200,
    input_tokens_details: { cached_tokens: 2000, cache_write_tokens: 3000 },
    output_tokens_details: { reasoning_tokens: 100 },
  },
});
function stub(body: unknown = good(), status = 200) {
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

it("requires an explicit allowlisted OpenAI model/effort and verified prices", () => {
  for (const model of ["gpt-6-sol", "gpt-5-mini", "__proto__", "toString"])
    expect(() => new OpenAIGateway(model, undefined, "fixture")).toThrow(
      /not approved/,
    );
  expect(
    () => new OpenAIGateway("gpt-6-luna", undefined, "fixture", "high"),
  ).toThrow(/not approved/);
  expect(
    () =>
      new OpenAIGateway(
        "gpt-6-luna",
        { inputPerM: 0, outputPerM: 0, source: "fake" },
        "fixture",
      ),
  ).toThrow(/verified/);
  expect(() => providerConfig("openai", undefined, "medium")).toThrow(
    /required/,
  );
  expect(providerConfig("anthropic", undefined, "medium").model).toBe(
    "claude-haiku-5-5",
  );
  expect(providerConfig("openai", "gpt-6-luna", "low").keyName).toBe(
    "OPENAI_API_KEY",
  );
  expect(() => providerConfig("openai", "gpt-6-luna", "low", true)).toThrow(
    /smoke/,
  );
});

it("converts optional fields to required nullable wire fields without changing the public schema", () => {
  const before = JSON.stringify(schema);
  const wire = openaiSchema(schema);
  function check(v: unknown) {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.type === "object") {
      expect(o.additionalProperties).toBe(false);
      expect(o.required).toEqual(Object.keys(o.properties as object));
    }
    Object.values(o).forEach(check);
  }
  check(wire);
  expect(JSON.stringify(schema)).toBe(before);
});

it("serializes strict Responses requests, normalizes nullable fields, and records safe provider metadata", async () => {
  const fetch = stub();
  const c = await authorizedCall(
    gateway(),
    "PUBLIC SYSTEM",
    "OWN OBSERVATION",
    options,
  );
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: "gpt-6-luna",
    instructions: "PUBLIC SYSTEM",
    input: [{ role: "user", content: "OWN OBSERVATION" }],
    store: false,
    service_tier: "default",
    reasoning: { effort: "medium" },
    max_output_tokens: 4000,
    prompt_cache_options: { ttl: "30m" },
    text: {
      format: {
        type: "json_schema",
        strict: true,
        schema: openaiSchema(schema),
      },
    },
  });
  expect(parseReply(c.text)).toMatchObject({
    ok: true,
    actions: [{ type: "wait", ticks: 1 }],
  });
  expect(c.rawText).toContain('"notes":null');
  expect(c.meta).toMatchObject({
    provider: "openai",
    requestedModel: "gpt-6-luna",
    reasoningTokens: 100,
    stopReason: "end_turn",
    pricingPremium: 1.1,
  });
  expect(JSON.stringify(c)).not.toMatch(/offline-fixture|PRIVATE-REASONING/);
  expect(c.cache).toEqual({ read: 2000, write: 3000 });
  expect(c.tokens).toEqual({ input: 10000, output: 200 });
  expect(c.costUsd).toBeCloseTo(
    ((5000 * 0.1 + 2000 * 0.01 + 3000 * 0.125 + 200 * 0.5) / 1e6) *
      OPENAI_PREMIUM,
    12,
  );
});

it("preserves malformed model text for existing parse-failure handling without inventing an action", async () => {
  const body = good();
  body.output = [
    { type: "message", content: [{ type: "output_text", text: "<broken>" }] },
  ];
  stub(body);
  const c = await authorizedCall(gateway(), "s", "u", options);
  expect(parseReply(c.text).ok).toBe(false);
  expect(c.rawText).toBe("<broken>");
  expect(c.record.status).toBe("ok");
});

it("uses the existing model-history policy and only that hero's observation", async () => {
  stub();
  const budget = new ModelBudget(defaultBudgetLimits);
  authorizeBudget(budget);
  const env = new AgentEnvironment({ preset: "S1" });
  await env.reset(0);
  const p = new LLMPlayer(
    "Sieg",
    "PUBLIC MANUAL",
    new MeteredGateway(gateway(), budget, "sieg"),
  );
  const observation = await env.observe("sieg");
  const result = await p.decide({
    observation,
    legal: await env.legal_actions("sieg"),
  });
  expect(result.action).toEqual({ type: "wait", ticks: 1 });
  const call = vi.mocked(fetch).mock.calls[0]!;
  const payload = JSON.parse(call[1]!.body as string);
  expect(JSON.parse(payload.input[0].content).observation).toEqual(observation);
  expect(JSON.parse(payload.input[0].content)).not.toHaveProperty("world");
});

it.each([401, 429, 500])(
  "accounts for HTTP %i as unknown cost, with no retry or error-body disclosure",
  async (status) => {
    const fetch = stub({ error: { message: "DO-NOT-LOG-ERROR-BODY" } }, status);
    const budget = new ModelBudget(defaultBudgetLimits);
    authorizeBudget(budget);
    await expect(
      new MeteredGateway(gateway(), budget, "sieg").complete("s", "u", options),
    ).rejects.toThrow(`openai_http_${status}`);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(budget.records[0]).toMatchObject({
      status: "error",
      tokens: null,
      costUsd: null,
    });
    expect(budget.records[0].chargedUsd).toBe(budget.records[0].reservedUsd);
    expect(JSON.stringify(budget.records)).not.toContain("DO-NOT-LOG");
  },
);

it.each([
  "missing",
  "negative",
  "nan",
  "cache-overflow",
  "missing-cache",
  "reasoning-overflow",
])("charges the reservation for %s usage", async (kind) => {
  const body = good() as Record<string, any>;
  if (kind === "missing") delete body.usage;
  if (kind === "negative") body.usage.input_tokens = -1;
  if (kind === "nan") body.usage.output_tokens = null;
  if (kind === "cache-overflow")
    body.usage.input_tokens_details.cached_tokens = 99999;
  if (kind === "missing-cache")
    delete body.usage.input_tokens_details.cache_write_tokens;
  if (kind === "reasoning-overflow")
    body.usage.output_tokens_details.reasoning_tokens = 99999;
  stub(body);
  const c = await authorizedCall(gateway(), "s", "u", options);
  expect(c.record.costUsd).toBeNull();
  expect(c.record.chargedUsd).toBe(c.record.reservedUsd);
});

it("applies the higher tier only above 272K total input and reserves serialized schema, framing and premiums", () => {
  expect(
    openaiCost({ input: 272000, output: 100, read: 0, write: 0 }),
  ).toBeCloseTo(((272000 * 0.1 + 100 * 0.5) / 1e6) * 1.1, 12);
  expect(
    openaiCost({ input: 272001, output: 100, read: 100000, write: 100000 }),
  ).toBeCloseTo(
    ((72001 * 0.2 + 100000 * 0.02 + 100000 * 0.25 + 100 * 0.75) / 1e6) * 1.1,
    12,
  );
  const g = gateway();
  expect(g.worstCaseUsd("🦉".repeat(80000), "u", options)).toBeGreaterThan(
    (320000 * 0.25 + 4000 * 0.75) / 1e6,
  );
  expect(
    g.worstCaseUsd("s", "u", {
      schema: { ...schema, description: "x".repeat(10000) },
    }),
  ).toBeGreaterThan(g.worstCaseUsd("s", "u", options));
});

it.each(["model", "tier"])(
  "fails closed for an unexpected %s, preserving reported identity and holding the reservation",
  async (kind) => {
    const body = good();
    if (kind === "model") body.model = "gpt-6-sol";
    else body.service_tier = "priority";
    stub(body);
    const budget = new ModelBudget(defaultBudgetLimits);
    authorizeBudget(budget);
    await expect(
      new MeteredGateway(gateway(), budget, "sieg").complete("s", "u", options),
    ).rejects.toThrow(/unapproved/);
    expect(budget.records[0].costUsd).toBeNull();
    expect(budget.records[0].model).toBe(body.model);
    expect(budget.records[0].chargedUsd).toBe(budget.records[0].reservedUsd);
  },
);

it.each(["refusal", "truncation"])(
  "retains known billed usage for %s and never uses a truncated plan",
  async (kind) => {
    const body = good() as Record<string, any>;
    if (kind === "refusal")
      body.output = [
        { type: "message", content: [{ type: "refusal", refusal: "NO" }] },
      ];
    else {
      body.status = "incomplete";
      body.incomplete_details = { reason: "max_output_tokens" };
    }
    stub(body);
    const budget = new ModelBudget(defaultBudgetLimits);
    authorizeBudget(budget);
    const player = new LLMPlayer(
      "Sieg",
      "manual",
      new MeteredGateway(gateway(), budget, "sieg"),
    );
    const env = new AgentEnvironment({ preset: "S1" });
    await env.reset(0);
    const promise = player.decide({
      observation: await env.observe("sieg"),
      legal: await env.legal_actions("sieg"),
    });
    if (kind === "refusal") await expect(promise).rejects.toThrow(/refusal/);
    else
      expect(await promise).toMatchObject({
        replyProblem: expect.stringMatching(/cut off|truncat|token/i),
      });
    expect(budget.records[0].costUsd).not.toBeNull();
    expect(budget.records[0].meta?.stopReason).toBe(
      kind === "refusal" ? "refusal" : "max_tokens",
    );
  },
);

it("refuses either provider before dispatch without both persistent and per-call admission", async () => {
  const fetch = stub();
  const a = new AnthropicGateway(
    "claude-haiku-5-5",
    anthropicPrices["claude-haiku-5-5"],
    "medium",
    "fixture",
  );
  const sdk = vi.fn();
  a.client.messages.create = sdk;
  for (const g of [gateway(), a]) {
    await expect(
      g.complete("s", "u", new AbortController().signal, options),
    ).rejects.toThrow(/authorization/);
    await expect(
      new MeteredGateway(
        g,
        new ModelBudget(defaultBudgetLimits),
        "sieg",
      ).complete("s", "u", options),
    ).rejects.toThrow(/authorization/);
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(sdk).not.toHaveBeenCalled();
});

it.each(["settled", "closed", "tampered", "lock"])(
  "rejects a %s persistent authorization before network dispatch",
  async (kind) => {
    const fetch = stub();
    const budget = new ModelBudget(defaultBudgetLimits);
    const { ledger, entry } = authorizeBudget(budget);
    if (kind === "settled") ledger.settle(entry, 0);
    if (kind === "closed") ledger.close();
    if (kind === "tampered")
      writeFileSync(
        ledger.path,
        JSON.stringify({
          ...JSON.parse(readFileSync(ledger.path, "utf8")),
          entries: [],
        }),
      );
    if (kind === "lock") writeFileSync(`${ledger.path}.lock`, "0");
    await expect(
      new MeteredGateway(gateway(), budget, "sieg").complete("s", "u", options),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("refuses exhausted budgets without HTTP and protects concurrent hero reservations", async () => {
  const g = gateway(),
    hold = g.worstCaseUsd("s", "u", options);
  const budget = new ModelBudget({
    ...defaultBudgetLimits,
    maxSpendUsd: hold * 1.5,
  });
  authorizeBudget(budget);
  let finish!: (v: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        finish = r;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const first = new MeteredGateway(g, budget, "sieg").complete(
    "s",
    "u",
    options,
  );
  await expect(
    new MeteredGateway(g, budget, "coco").complete("s", "u", options),
  ).rejects.toMatchObject({ reason: "spend_limit" });
  finish(new Response(JSON.stringify(good())));
  await first;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(["timeout", "cancel"])(
  "conservatively settles an interrupted %s request without a retry or late refund",
  async (kind) => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    const budget = new ModelBudget({
      ...defaultBudgetLimits,
      callTimeoutMs: 20,
    });
    const { ledger, entry } = authorizeBudget(budget);
    const promise = new MeteredGateway(gateway(), budget, "sieg").complete(
      "s",
      "u",
      options,
    );
    if (kind === "cancel") budget.abortAll();
    await expect(promise).rejects.toThrow();
    ledger.settle(entry, budget.chargedUsd);
    expect(budget.records[0].status).toBe(
      kind === "cancel" ? "aborted" : "timeout",
    );
    expect(budget.records[0].chargedUsd).toBe(budget.records[0].reservedUsd);
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

it("uses the canonical one-call smoke harness and conservatively recovers a crash-left call", async () => {
  const fetch = stub();
  const budget = new ModelBudget(defaultBudgetLimits);
  const { ledger } = authorizeBudget(budget);
  const trace = new TraceWriter();
  const result = await smokeCall(
    gateway(),
    "manual",
    ledger,
    "offline",
    0.01,
    trace,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.record?.meta?.structured).toBe(true);
  expect(
    ledger.entries().find((e) => e.id === result.ledgerEntry)?.status,
  ).toBe("settled");
  verifyTrace(trace.lines);
  const entry = ledger.entries().find((e) => e.id === result.ledgerEntry)!;
  const lines = trace.lines.filter((l) => l.type !== "model_call");
  // A real crash prefix has intact hashes and no completion record.
  const interrupted = new TraceWriter();
  for (const l of lines.slice(
    0,
    lines.findIndex((l) => l.type === "model_call_start") + 1,
  ))
    interrupted.write({
      type: l.type,
      tick: l.tick,
      ...(l.player ? { player: l.player } : {}),
      data: l.data,
    });
  expect(
    reconcile(entry, {
      path: "offline.jsonl",
      text: interrupted.lines.map((l) => JSON.stringify(l)).join("\n"),
    }).chargedUsd,
  ).toBeGreaterThanOrEqual(result.record!.reservedUsd!);
});

it("keeps both legacy paid entrypoints disabled", () => {
  const source = readFileSync("scripts/midterm/run-episode.ts", "utf8");
  expect(source.indexOf("requireLedgerEntrypoint(policy)")).toBeLessThan(
    source.indexOf("new OpenAIGateway("),
  );
  const mainPath = "../oath_and_ember/scripts/evaluation/run-shrine.ts";
  const main = existsSync(mainPath)
    ? readFileSync(mainPath, "utf8")
    : undefined;
  if (main !== undefined) {
    expect(main).toContain('if (mode === "model")');
    expect(main).toContain("Unmetered paid OpenAI execution is disabled.");
  }
  expect(() =>
    execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/midterm/run-episode.ts",
        "--policy",
        "openai",
      ],
      { stdio: "pipe" },
    ),
  ).toThrow();
});

it("refuses noncanonical scratch ledgers and duplicate persistent budget bindings", async () => {
  const fetch = stub();
  const budget = new ModelBudget(defaultBudgetLimits);
  const { ledger, entry, dir } = authorizeBudget(budget);
  expect(() =>
    new ModelBudget(defaultBudgetLimits).bindLedger(ledger, entry),
  ).toThrow(/already bound/);
  const other = SpendLedger.open(join(dir, "noncanonical.json"));
  try {
    const b = new ModelBudget(defaultBudgetLimits);
    b.bindLedger(other, other.reserve("pilot", "not-canonical", 1));
    await expect(
      new MeteredGateway(gateway(), b, "sieg").complete("s", "u", options),
    ).rejects.toThrow(/canonical/);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    other.close();
  }
});

it("rejects a deleted initialization marker and cannot reuse an admitted signal", async () => {
  const fetch = stub();
  const budget = new ModelBudget(defaultBudgetLimits);
  const { ledger, dir } = authorizeBudget(budget);
  await new MeteredGateway(gateway(), budget, "sieg").complete(
    "s",
    "u",
    options,
  );
  const signal = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
    .signal as AbortSignal;
  await expect(gateway().complete("s", "u", signal, options)).rejects.toThrow(
    /authorization/,
  );
  chmodSync(join(dir, ".git/oath-eval/spend-ledger.init.json"), 0o644);
  writeFileSync(
    join(dir, ".git/oath-eval/spend-ledger.init.json"),
    JSON.stringify({ ledgerId: "changed" }),
  );
  await expect(
    new MeteredGateway(gateway(), budget, "coco").complete("s", "u", options),
  ).rejects.toThrow(/marker/);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each(["network", "invalid-json", "invalid-status"])(
  "records %s errors without retries or leaking provider details",
  async (kind) => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      if (kind === "network") throw Error("NEVER-LOG-TRANSPORT-DETAILS");
      if (kind === "invalid-json") return new Response("broken");
      return new Response(JSON.stringify({ ...good(), status: "failed" }));
    });
    const budget = new ModelBudget(defaultBudgetLimits);
    authorizeBudget(budget);
    await expect(
      new MeteredGateway(gateway(), budget, "sieg").complete("s", "u", options),
    ).rejects.toThrow();
    expect(calls).toBe(1);
    expect(JSON.stringify(budget.records)).not.toContain("NEVER-LOG");
  },
);

it("bounds an unknown-usage call and refuses a second call when its reservation exhausted the episode", async () => {
  const g = gateway();
  const cap = g.worstCaseUsd("s", "u", options);
  const budget = new ModelBudget({ ...defaultBudgetLimits, maxSpendUsd: cap });
  authorizeBudget(budget);
  const body = good() as Record<string, any>;
  delete body.usage;
  const fetch = stub(body);
  const metered = new MeteredGateway(g, budget, "sieg");
  await metered.complete("s", "u", options);
  await expect(metered.complete("s", "u", options)).rejects.toMatchObject({
    reason: "spend_limit",
  });
  expect(budget.chargedUsd).toBe(cap);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("canonical launchers reject unapproved OpenAI configurations and credential arguments before ledger or transport", () => {
  const key = "offline-credential-fixture";
  const cases: [string, string[]][] = [
    [
      "scripts/midterm/evaluate.ts",
      ["--smoke", "--paid", "--gateway", "openai", "--model", "gpt-6-sol"],
    ],
    [
      "scripts/midterm/evaluate.ts",
      [
        "--smoke",
        "--paid",
        "--gateway",
        "openai",
        "--model",
        "gpt-6-luna",
        "--effort",
        "low",
      ],
    ],
    [
      "scripts/midterm/live.ts",
      [
        "--scenario",
        "S1",
        "--gateway",
        "openai",
        "--paid",
        "--model",
        "gpt-6-sol",
        "--max-spend-usd",
        ".1",
      ],
    ],
    [
      "scripts/midterm/live.ts",
      [
        "--scenario",
        "S1",
        "--gateway",
        "openai",
        "--paid",
        "--effort",
        "medium",
        "--max-spend-usd",
        ".1",
      ],
    ],
    ["scripts/midterm/live.ts", ["--openai-api-key", key]],
  ];
  for (const [script, args] of cases) {
    let error: unknown;
    try {
      execFileSync(process.execPath, ["--import", "tsx", script, ...args], {
        stdio: "pipe",
        env: { ...process.env, OPENAI_API_KEY: key },
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    const output =
      String((error as { stdout: Buffer }).stdout) +
      String((error as { stderr: Buffer }).stderr);
    expect(output).toMatch(
      /not approved|smoke configuration|--model is required|credentials are never accepted/i,
    );
    expect(output).not.toContain(key);
  }
}, 30000);

it("guards the actual Anthropic SDK transport, including direct SDK calls, without changing its request", async () => {
  const payload = {
    id: "offline",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    stop_reason: "end_turn",
    stop_sequence: null,
    content: [
      { type: "text", text: '{"actions":[{"type":"wait","ticks":1}]}' },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
  const fetch = stub(payload);
  const g = new AnthropicGateway(
    "claude-haiku-5-5",
    anthropicPrices["claude-haiku-5-5"],
    "medium",
    "offline-fixture",
  );
  await expect(
    g.client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: "u" }],
    }),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
  const c = await authorizedCall(g, "s", "u", options);
  expect(c.meta).toMatchObject({ structured: true, stopReason: "end_turn" });
  expect(fetch).toHaveBeenCalledTimes(1);
  const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: "claude-haiku-5-5",
    max_tokens: 4000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema },
    },
  });
});
