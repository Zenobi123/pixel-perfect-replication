// Garde anti-régression : empêche l'introduction silencieuse de NOUVELLES
// dépendances en pré-version (beta/alpha/rc/canary/next/nightly/dev).
//
// Les pré-versions sont instables par nature ; pour une application comptable,
// chaque dépendance bleeding-edge doit être un choix explicite et justifié.
// Toute pré-version doit donc figurer dans ALLOWLIST avec sa raison. Exécuté
// dans `npm run check` (donc en CI).
import { readFileSync } from "node:fs";

// Motifs d'identifiants de pré-version (suffixe semver après le tiret).
const PRERELEASE = /-(?:beta|alpha|rc|canary|next|nightly|dev|pre|snapshot|insiders)\b/i;

// Pré-versions explicitement acceptées, avec justification et conditions de sortie.
const ALLOWLIST = {
  nitro:
    "Exigé par @lovable.dev/vite-tanstack-config (build serveur de TanStack Start). " +
    "Aucune version stable de Nitro 3 n'est publiée (le dist-tag `latest` reste une beta). " +
    "Pin exact pour rester aligné sur la résolution de la config Lovable. " +
    "Sortie : passer à une version stable dès que TanStack Start / la config Lovable la supporte.",
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

const unexpected = [];
const accepted = [];
for (const [name, spec] of Object.entries(deps)) {
  if (typeof spec === "string" && PRERELEASE.test(spec)) {
    if (ALLOWLIST[name]) accepted.push(`${name}@${spec}`);
    else unexpected.push(`${name}@${spec}`);
  }
}

if (unexpected.length) {
  console.error(
    "Dépendance(s) en pré-version non autorisée(s) : " +
      unexpected.join(", ") +
      "\nStabilisez-les ou ajoutez-les à ALLOWLIST dans scripts/check-prerelease-deps.mjs " +
      "avec une justification (voir docs/runbook.md §13).",
  );
  process.exit(1);
}

const summary = accepted.length
  ? `Pré-versions acceptées (justifiées) : ${accepted.join(", ")}.`
  : "Aucune dépendance en pré-version.";
console.log(`Dépendances : ${summary}`);
