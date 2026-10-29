// Terminal helpers for the evaluation CLIs: typed confirmations and a hidden
// credential prompt. Nothing typed at a hidden prompt is echoed or stored.

/** Ask for a line on an interactive terminal. Refuses when stdin is not a TTY. */
export async function ask(question: string, hidden = false): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) throw Error("This step needs an interactive terminal.");
  process.stderr.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const done = (fn: () => void) => {
      input.setRawMode(wasRaw);
      input.pause();
      input.off("data", onData);
      process.stderr.write("\n");
      fn();
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(() => resolve(value));
        if (ch === "\u0003") return done(() => reject(Object.assign(Error("Cancelled."), { code: "cancelled" })));
        if (ch === "\u007f" || ch === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            if (!hidden) process.stderr.write("\b \b");
          }
          continue;
        }
        if (ch < " ") continue;
        value += ch;
        if (!hidden) process.stderr.write(ch);
      }
    };
    input.on("data", onData);
  });
}

/** Require the operator to type `phrase` exactly. */
export async function confirmTyped(prompt: string, phrase: string) {
  const typed = await ask(`${prompt}\nType "${phrase}" to continue: `);
  if (typed.trim() !== phrase) throw Error("Confirmation did not match; nothing was changed.");
}

/** Command-line arguments that look like they carry a credential. */
export function credentialArgs(argv: readonly string[]) {
  return argv.filter((a) => /^--?(api[-_]?key|key|token|secret|(?:anthropic|openai)[-_]api[-_]key)(=|$)/i.test(a) || /sk-ant-|sk-[A-Za-z0-9]{20,}/.test(a));
}

/**
 * Model-supplied text made safe for a terminal line (re-review L1): control
 * characters (C0, DEL, C1, so no ANSI/OSC escape sequences), line breaks and
 * bidirectional overrides are shown as \u{..} escapes instead of acting.
 */
export function safeText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, (c) => `\\u{${c.codePointAt(0)!.toString(16)}}`);
}

/**
 * Replace a secret in everything this process writes to stdout and stderr
 * (re-review L2). Returns a function that reports whether it was ever seen.
 */
export function redactStreams(secret: string) {
  let seen = false;
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (typeof chunk === "string" && chunk.includes(secret)) {
        seen = true;
        chunk = chunk.split(secret).join("[REDACTED]");
      } else if (chunk instanceof Uint8Array && Buffer.from(chunk).includes(secret)) {
        seen = true;
        chunk = Buffer.from(Buffer.from(chunk).toString("utf8").split(secret).join("[REDACTED]"));
      }
      return write(chunk, ...rest);
    }) as typeof stream.write;
  }
  return () => seen;
}
