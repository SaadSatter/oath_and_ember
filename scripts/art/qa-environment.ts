// Orchestration intent belongs to the outer art command, never nested tests/builds.
export function qaEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const result = { ...env };
  delete result.ART_AGENT_INTENT_FILE;
  return result;
}
