import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync("worker.js", "utf8");
const open = source.indexOf("<script>");
const close = source.indexOf("</script>", open + 8);
if (open < 0 || close < 0 || source.indexOf("<script>", open + 8) >= 0) {
  console.error("Expected exactly one inline app script.");
  process.exit(1);
}
writeFileSync("/tmp/rentalos-inline.js", source.slice(open + 8, close), "utf8");
console.log("Extracted inline RentalOS script for syntax validation.");
