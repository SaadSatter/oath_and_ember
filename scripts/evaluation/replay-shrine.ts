/** Replay is the same runner with --mode replay --replay <source directory>.
 * This wrapper forwards only explicit args and never loads a model or solver. */
process.argv.splice(2, 0, "--mode", "replay");
await import("./run-shrine.js");
