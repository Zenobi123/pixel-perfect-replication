import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const source = globSync("src/**/*.{ts,tsx}")
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const used = (pattern) => [...source.matchAll(pattern)].map((match) => match[1]);
const missing = [
  ...new Set(
    [...used(/\.from\(["']([^"']+)/g), ...used(/\.rpc\(["']([^"']+)/g)].filter(
      (name) => !new RegExp(`^\\s{6}${name}: \\{`, "m").test(types),
    ),
  ),
];
if (missing.length) {
  console.error(`Types Supabase manquants : ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Contrat Supabase synchronisé avec les tables et RPC utilisées.");
