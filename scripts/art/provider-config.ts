import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
export const providerConfigSchema = z
  .object({
    schema_version: z.literal(1),
    sprite_artist: z
      .object({
        provider: z.enum(["manual", "openai"]).default("manual"),
        model: z.string().min(1).default("gpt-image-1.5"),
        quality: z.enum(["low", "medium", "high"]).default("medium"),
        timeout_ms: z.number().int().min(1000).max(300000).default(180000),
      })
      .strict()
      .default({
        provider: "manual",
        model: "gpt-image-1.5",
        quality: "medium",
        timeout_ms: 180000,
      }),
    visual_qa: z
      .object({
        provider: z.enum(["manual", "openai"]).default("manual"),
        model: z.string().min(1).default("gpt-4.1"),
        confidence_threshold: z.number().min(0).max(1).default(0.85),
        timeout_ms: z.number().int().min(1000).max(300000).default(120000),
      })
      .strict()
      .default({
        provider: "manual",
        model: "gpt-4.1",
        confidence_threshold: 0.85,
        timeout_ms: 120000,
      }),
  })
  .strict();
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export function loadProviderConfig(root: string): ProviderConfig {
  const file = join(root, "art/providers.json");
  return providerConfigSchema.parse(
    existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { schema_version: 1 },
  );
}
export class ProviderUnavailableError extends Error {}
export function requireApiKey(env: NodeJS.ProcessEnv = process.env) {
  const key = env.OPENAI_API_KEY;
  if (!key)
    throw new ProviderUnavailableError(
      "Set OPENAI_API_KEY locally to use the configured OpenAI provider; never put credentials in art files.",
    );
  return key;
}
export type ApiFetch = typeof fetch;
export async function postOpenAI(
  endpoint: "images/edits" | "responses",
  body: FormData | string,
  key: string,
  timeout: number,
  fetcher: ApiFetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(`https://api.openai.com/v1/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(typeof body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ProviderUnavailableError(
      "OpenAI request failed or timed out. No automatic HTTP retry was made; inspect the saved attempt before explicitly retrying.",
    );
  }
  if (!response.ok)
    throw new ProviderUnavailableError(
      `OpenAI ${endpoint} returned HTTP ${response.status}; no automatic HTTP retry was made.`,
    );
  return {
    value: await response.json(),
    requestId: response.headers.get("x-request-id"),
  };
}
