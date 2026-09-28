import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("worker.js", "utf8");
const scripts = [...source.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
if (scripts.length !== 1) {
  console.error(`Expected exactly one inline app script, found ${scripts.length}.`);
  process.exit(1);
}
writeFileSync("/tmp/rentalos-inline.js", scripts[0][1], "utf8");
console.log("Extracted inline RentalOS script for syntax validation.");
