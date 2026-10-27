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
  return argv.filter((a) => /^--?(api[-_]?key|key|token|secret|anthropic[-_]api[-_]key)(=|$)/i.test(a) || /sk-ant-|sk-[A-Za-z0-9]{20,}/.test(a));
}
