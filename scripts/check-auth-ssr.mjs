import { readFileSync } from "node:fs";

const route = readFileSync("src/routes/_authenticated.tsx", "utf8");
const serverGuard = route.indexOf('if (typeof window === "undefined") return;');
const sessionRead = route.indexOf("supabase.auth.getSession()");
if (serverGuard < 0 || sessionRead < 0 || serverGuard > sessionRead) {
  console.error("Le garde SSR doit précéder la lecture de la session navigateur.");
  process.exit(1);
}
console.log("Le SSR ne redirige pas sur la seule absence de session navigateur.");
