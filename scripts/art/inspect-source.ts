import { readFileSync } from "node:fs";
import { inspectExternalSource } from "./external-source.js";

const [file, columns, rows, count] = process.argv.slice(2);
if (!file)
  throw new Error(
    "Usage: npm run art:inspect -- SOURCE [COLUMNS ROWS FRAME_COUNT]",
  );
const grid = columns
  ? { columns: Number(columns), rows: Number(rows), frame_count: Number(count) }
  : undefined;
const report = inspectExternalSource(readFileSync(file), grid);
console.log(JSON.stringify({ source: file, ...report }, null, 2));
if (!report.ready) process.exitCode = 2;
