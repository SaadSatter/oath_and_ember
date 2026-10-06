import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Asset, Manifest } from "./model.js";
import {
  classifyFeedback,
  selectAsset,
  type Classification,
} from "./feedback.js";
import { planPresentation, applyPresentation } from "./engineer.js";
import {
  buildReviewCard,
  writeReviewPage,
  formatReviewCard,
  type ReviewCard,
} from "./review-card.js";
import { iterationLimit } from "./human-decisions.js";
import { loadProviderConfig } from "./provider-config.js";
import { digest } from "./generation.js";
export interface AgentOptions {
  text: string;
  assetId?: string;
  route?: "art" | "implementation";
  allowProviderUpload?: boolean;
  retryProvider?: boolean;
  retryQa?: boolean;
  localQaOnly?: boolean;
}
export type Execute = (args: string[], intentFile?: string) => void;
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
function write(p: string, v: unknown) {
  mkdirSync(resolve(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
}
export function runAgent(
  root: string,
  options: AgentOptions,
  execute?: Execute,
): { card?: ReviewCard; clarification?: string; journal?: string } {
  const manifest = () =>
    existsSync(join(root, "art/manifest.json"))
      ? (json(join(root, "art/manifest.json")) as Manifest)
      : { schema_version: 1 as const, max_iterations: 3, assets: {} };
  const stateFile = join(root, "art/agent-session.json");
  const previous = existsSync(stateFile) ? json(stateFile) : {};
  const text = options.text.trim();
  if (!text)
    throw Error(
      "Give a request, REVIEW, RESUME, APPROVE, IMPROVE: feedback, or REJECT: reason",
    );
  const parsed = selectAsset(
    manifest(),
    text,
    options.assetId,
    previous.assetId,
  );
  if (parsed.clarification) return { clarification: parsed.clarification };
  const cli = join(root, "scripts/art/cli.ts");
  const call: Execute =
    execute ||
    ((args, intentFile) => {
      const r = spawnSync(process.execPath, ["--import", "tsx", cli, ...args], {
        cwd: root,
        env: {
          ...process.env,
          ART_WORKSPACE_ROOT: root,
          ...(intentFile ? { ART_AGENT_INTENT_FILE: intentFile } : {}),
        },
        stdio: "inherit",
      });
      if (r.status !== 0)
        throw Error(
          `Existing art:${args[0]} stopped (${r.status}); inspect preserved stage evidence.`,
        );
    });
  let selected = parsed.asset;
  if (
    selected &&
    /\b(?:new version|new creative direction|create new)\b/i.test(text)
  ) {
    call(["brief", selected.character, selected.animation]);
    selected = Object.values(manifest().assets)
      .filter(
        (a) =>
          a.character === selected!.character &&
          a.animation === selected!.animation,
      )
      .sort((a, b) => b.version - a.version)[0];
  }
  if (!selected && parsed.target) {
    call(["brief", parsed.target.character, parsed.target.animation]);
    selected = Object.values(manifest().assets)
      .filter(
        (a) =>
          a.character === parsed.target!.character &&
          a.animation === parsed.target!.animation,
      )
      .sort((a, b) => b.version - a.version)[0];
  }
  if (!selected) throw Error("Director did not create an asset");
  const id = selected.asset_id;
  const asset = () => manifest().assets[id];
  const authorization =
    !!options.allowProviderUpload ||
    (previous.assetId === id && previous.providerUploadsAuthorized === true);
  const journalDir = join(root, "art/sessions", id);
  mkdirSync(journalDir, { recursive: true });
  const journal = join(
    journalDir,
    `request-${String(readdirSync(journalDir).filter((f) => /^request-\d+\.json$/.test(f)).length + 1).padStart(4, "0")}.json`,
  );
  if (existsSync(journal))
    throw Error("Session journal collision; preserve history");
  const verb = /^(APPROVE|IMPROVE|REJECT|REVIEW|RESUME)\b/i
    .exec(text)?.[1]
    .toUpperCase();
  const feedback =
    verb === "IMPROVE" || verb === "REJECT"
      ? text.replace(/^(?:IMPROVE|REJECT)\b\s*:?\s*/i, "")
      : text;
  const classification: Classification = classifyFeedback(
    feedback,
    options.route,
  );
  if (
    !verb &&
    asset().iteration === 0 &&
    /\b(create|make|generate|build)\b/i.test(text) &&
    classification.route === "AMBIGUOUS"
  ) {
    classification.route = "ART";
    classification.reason =
      "Explicit creation request uses the existing Director asset contract.";
  }
  const presentationPlan =
    classification.route === "COMBINED"
      ? planPresentation(root, asset(), classification.tasks!.implementation)
      : undefined;
  write(journal, {
    assetId: id,
    text: options.text,
    feedback,
    classification,
    presentationPlan,
    decision: verb || "REQUEST",
    providerUploadsAuthorized: authorization,
    created_at: new Date().toISOString(),
    iteration: asset().iteration,
  });
  const directorRequest =
    !verb || verb === "IMPROVE"
      ? journal
      : previous.assetId === id
        ? previous.directorRequest
        : undefined;
  const providerIntent =
    verb === "RESUME" ? directorRequest || journal : journal;
  const save = () => {
    write(stateFile + ".tmp", {
      assetId: id,
      providerUploadsAuthorized: authorization,
      lastRequest: journal,
      directorRequest,
      iteration: asset().iteration,
      candidateHashes: [asset().source_hash, asset().integration_hash],
    });
    renameSync(stateFile + ".tmp", stateFile);
  };
  const card = () => {
    save();
    return { card: writeReviewPage(root, asset()), journal };
  };
  if (
    verb === "APPROVE" &&
    !options.assetId &&
    previous.assetId === id &&
    (previous.iteration !== asset().iteration ||
      previous.candidateHashes?.some(
        (h: string, i: number) =>
          h !== [asset().source_hash, asset().integration_hash][i],
      ))
  )
    return {
      clarification:
        "Candidate changed since the last review card; REVIEW it before APPROVE.",
    };
  save();
  if (verb === "REVIEW") return card();
  if (verb === "APPROVE") {
    if (asset().status !== "APPROVED") call(["approve", id], journal);
    const published = join(root, `art/approved/${id}/previous-runtime`);
    if (!existsSync(published)) call(["publish", id], journal);
    else {
      const a = asset();
      if (
        !a.target ||
        digest(join(root, "apps/client/public", a.target)) !== a.source_hash ||
        !a.mask_target ||
        digest(join(root, "apps/client/public", a.mask_target)) !==
          a.integration_hash
      )
        throw Error(
          "Previously published runtime changed; explicit investigation required",
        );
    }
    return card();
  }
  if (verb === "REJECT") {
    if (!feedback) return { clarification: "Give a reason for rejection." };
    call(["reject", id, feedback], journal);
    return card();
  }
  if (asset().status === "REJECTED" || asset().status === "APPROVED")
    return {
      clarification:
        "This version is immutable. REVIEW it, or request a new named version/direction explicitly.",
    };
  if (
    verb !== "RESUME" &&
    (verb === "IMPROVE" ||
      [
        "NEEDS_HUMAN_REVIEW",
        "AWAITING_APPROVAL",
        "QA_FAILED_ART",
        "QA_FAILED_IMPLEMENTATION",
      ].includes(asset().status))
  ) {
    if (
      classification.route === "COMBINED" &&
      presentationPlan &&
      "clarification" in presentationPlan
    )
      return { ...card(), clarification: presentationPlan.clarification };
    if (classification.route === "AMBIGUOUS") {
      save();
      return { clarification: classification.reason, journal };
    }
    let plan: ReturnType<typeof planPresentation> | undefined;
    if (classification.route === "IMPLEMENTATION") {
      plan = planPresentation(root, asset(), feedback);
      // Unsupported engineering still records/routes the exact authorized feedback.
      // It never edits code or spends a generation call.
    }
    call(
      [
        "revise",
        id,
        classification.route === "IMPLEMENTATION"
          ? "--implementation"
          : "--art",
        classification.tasks?.art || feedback,
      ],
      journal,
    );
    if (plan) {
      if ("clarification" in plan) {
        save();
        return { ...card(), clarification: plan.clarification };
      }
      applyPresentation(root, asset(), plan);
      call(["integrate", id], journal);
    }
  } else if (
    !verb &&
    classification.route !== "ART" &&
    asset().iteration === 0
  ) {
    save();
    return {
      clarification:
        "For a new asset, describe the source art to create. Presentation-only work requires an integrated candidate.",
      journal,
    };
  }
  if (options.retryQa) call(["retry-qa", id], journal);
  const config = loadProviderConfig(root);
  for (
    let step = 0;
    step < iterationLimit(asset(), manifest().max_iterations) * 2 + 2;
    step++
  ) {
    let a = asset();
    if (
      options.localQaOnly &&
      ["BRIEF", "WAITING_FOR_ART", "QA_FAILED_ART", "GENERATING_ART"].includes(
        a.status,
      )
    )
      return {
        ...card(),
        clarification: "Local QA mode cannot generate or upload artwork.",
      };
    const lastGeneration = a.generation_history?.at(-1);
    const failedGeneration =
      lastGeneration &&
      existsSync(join(root, lastGeneration, "error.json")) &&
      json(join(root, lastGeneration, "error.json")).status ===
        "PROVIDER_FAILURE";
    if (
      a.status === "GENERATING_ART" ||
      (a.status === "NEEDS_HUMAN_REVIEW" &&
        (a.pending_revision ||
          (failedGeneration &&
            !existsSync(
              join(
                root,
                `art/qa/${id}/iteration-${String(a.iteration).padStart(2, "0")}/qa-report.json`,
              ),
            ))))
    ) {
      if (options.localQaOnly)
        return {
          ...card(),
          clarification: "Local QA mode cannot retry provider calls.",
        };
      if (!options.retryProvider)
        return {
          ...card(),
          clarification:
            "Interrupted/provider-failed generation: inspect the saved attempt first. RESUME --retry-provider is an explicit potentially billed retry; automatic retries are disabled.",
        };
      if (!authorization)
        return {
          ...card(),
          clarification:
            "Provider upload needs explicit --allow-provider-upload authorization.",
        };
      call(["generate", id], providerIntent);
      if (asset().status === "NEEDS_HUMAN_REVIEW") return card();
    }
    a = asset();
    if (a.status === "WAITING_FOR_IMPLEMENTATION") {
      const baseline = a.pending_revision
        ? json(join(root, a.pending_revision.request_file))
            .implementation_baseline
        : {};
      if (
        !Object.entries(baseline || {}).some(
          ([p, h]) => existsSync(join(root, p)) && digest(join(root, p)) !== h,
        )
      )
        return {
          ...card(),
          clarification:
            "Game Engineer handoff remains pending. Complete the recorded code change; RESUME will integrate and rerun QA.",
        };
      call(["integrate", id], journal);
      a = asset();
    }
    if (
      (a.status === "WAITING_FOR_ART" ||
        a.status === "BRIEF" ||
        a.status === "QA_FAILED_ART") &&
      config.sprite_artist.provider === "openai" &&
      !authorization
    )
      return {
        ...card(),
        clarification:
          "Generation uploads candidate/canonical art to OpenAI. Use --allow-provider-upload to authorize this asset workflow (including its QA evidence).",
      };
    const workflow = json(providerIntent);
    if (workflow.classification?.route === "COMBINED") {
      if (
        !workflow.presentationPlan ||
        "clarification" in workflow.presentationPlan
      )
        return {
          ...card(),
          clarification:
            workflow.presentationPlan?.clarification ||
            "Combined presentation plan is missing; review the original request.",
        };
      if (["BRIEF", "WAITING_FOR_ART", "QA_FAILED_ART"].includes(a.status)) {
        if (a.iteration >= iterationLimit(a, manifest().max_iterations))
          return card();
        if (!existsSync(join(root, a.source_file, "submission.json"))) {
          if (config.sprite_artist.provider !== "openai")
            return {
              ...card(),
              clarification:
                "Combined request preserved; supply its art submission before presentation and QA.",
            };
          call(["generate", id], providerIntent);
          a = asset();
        }
      }
      if (
        ["READY_FOR_INTEGRATION", "WAITING_FOR_ART"].includes(a.status) &&
        existsSync(join(root, a.source_file, "submission.json"))
      ) {
        call(["integrate", id], providerIntent);
        a = asset();
      }
      if (a.status === "READY_FOR_QA") {
        const engineering = join(
          root,
          `art/qa/${id}/iteration-${String(a.iteration).padStart(2, "0")}/engineer-change.json`,
        );
        if (!existsSync(engineering)) {
          const p = workflow.presentationPlan;
          // Automatic ART retries carry the same presentation setting, never compound it.
          const previousChange = a.human_decisions
            ?.map((request) =>
              join(root, request, "..", "engineer-change.json"),
            )
            .find(
              (path) =>
                existsSync(path) && json(path).authorization === providerIntent,
            );
          if (
            previousChange &&
            digest(join(root, p.file)) === json(previousChange).afterHash
          ) {
            write(engineering, {
              ...json(previousChange),
              inherited_from: previousChange,
            });
          } else applyPresentation(root, a, p, providerIntent);
        }
      }
      if (
        ["NEEDS_HUMAN_REVIEW", "GENERATING_ART"].includes(a.status) &&
        a.pending_revision
      )
        return card();
    }
    const before = `${a.iteration}:${a.status}:${a.generation_attempts || 0}`;
    call(
      [
        "run",
        id,
        "--defer-vision",
        ...(options.localQaOnly ? ["--no-artist"] : []),
      ],
      providerIntent,
    );
    a = asset();
    const dir = `art/qa/${id}/iteration-${String(a.iteration).padStart(2, "0")}`;
    const qa = join(root, dir, "qa-report.json");
    const objectivePassed =
      existsSync(qa) &&
      !json(qa).checks.some(
        (c: { id: string; result: string }) =>
          c.id !== "visual_rubric" && c.result !== "PASS",
      );
    if (
      objectivePassed &&
      existsSync(join(root, dir, "temporal/index.json")) &&
      !existsSync(join(root, dir, "temporal/frames-v1/manifest.json"))
    )
      call(["temporal", id], journal);
    const attempted =
      existsSync(join(root, dir)) &&
      readdirSync(join(root, dir)).some((f) => /^vision-attempt-\d+$/.test(f));
    const reviewed = a.reports.some((p) => p.startsWith(dir + "/vision"));
    const failedVision =
      existsSync(join(root, dir)) &&
      readdirSync(join(root, dir))
        .filter((f) => /^vision-attempt-\d+$/.test(f))
        .some((f) => existsSync(join(root, dir, f, "error.json")));
    if (
      objectivePassed &&
      !options.localQaOnly &&
      config.visual_qa.provider === "openai" &&
      ((!reviewed && !attempted) || (options.retryProvider && failedVision))
    ) {
      if (!authorization)
        return {
          ...card(),
          clarification:
            "Vision uploads this asset's source/reference and QA images. Use --allow-provider-upload to continue.",
        };
      call(["vision", id], journal);
      a = asset();
    }
    if (a.status !== "QA_FAILED_ART") return card();
    if (`${a.iteration}:${a.status}:${a.generation_attempts || 0}` === before)
      return card();
  }
  throw Error(
    "Conversational wrapper reached its bounded stage limit; inspect saved evidence",
  );
}
export function parseAgentArgs(args: string[]): AgentOptions {
  const result: AgentOptions = { text: "" },
    words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--asset") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw Error("--asset requires an asset ID");
      result.assetId = value;
    } else if (arg === "--route") {
      const value = args[++i];
      if (value !== "art" && value !== "implementation")
        throw Error("--route must be art or implementation");
      result.route = value;
    } else if (arg === "--allow-provider-upload")
      result.allowProviderUpload = true;
    else if (arg === "--retry-provider") result.retryProvider = true;
    else if (arg === "--retry-qa") result.retryQa = true;
    else if (arg === "--local-qa-only") result.localQaOnly = true;
    else if (arg.startsWith("--")) throw Error(`Unknown option ${arg}`);
    else words.push(arg);
  }
  result.text = words.join(" ");
  return result;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const root = resolve(
    process.env.ART_WORKSPACE_ROOT || join(import.meta.dirname, "../.."),
  );
  const lock = join(root, "art/.agent-lock");
  mkdirSync(join(root, "art"), { recursive: true });
  try {
    mkdirSync(lock);
  } catch {
    throw Error(
      "Another art:agent is running. Inspect art/.agent-lock before removing a stale lock.",
    );
  }
  try {
    const result = runAgent(root, parseAgentArgs(process.argv.slice(2)));
    if (result.clarification)
      console.log(`Human input required: ${result.clarification}`);
    if (result.card) console.log(formatReviewCard(root, result.card));
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
