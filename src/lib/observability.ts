// Observabilité — journalisation structurée + report d'erreurs, vendor-neutral.
//
// Fonctionne côté navigateur ET côté serveur (Cloudflare Workers / SSR).
//   - TOUJOURS : émet un log JSON structuré sur la console. Il est capté tel
//     quel par les logs de la plateforme (Cloudflare Workers Logs / Logpush,
//     logs du conteneur, etc.) et reste donc exploitable sans aucun service
//     tiers — c'est le mécanisme fiable de base.
//   - OPTIONNEL : si un endpoint de collecte est configuré, l'enregistrement
//     est aussi transmis en best-effort par POST JSON (webhook, fonction de
//     collecte, proxy compatible Sentry…). Aucun verrouillage fournisseur.
//
// Configuration (toutes optionnelles) :
//   - VITE_OBSERVABILITY_ENDPOINT  : endpoint de collecte côté navigateur
//   - OBSERVABILITY_ENDPOINT       : endpoint de collecte côté serveur
//   - VITE_APP_ENV / APP_ENV / NODE_ENV : nom de l'environnement
//   - VITE_APP_RELEASE / APP_RELEASE    : version/release pour corréler les logs

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const isBrowser = typeof window !== "undefined";

function fromProcess(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) return process.env[key];
  return undefined;
}

// Les accès `import.meta.env.VITE_*` sont remplacés statiquement par Vite au
// build (client et serveur) ; aucune dépendance runtime à l'objet import.meta.
const ENVIRONMENT =
  (import.meta.env.VITE_APP_ENV as string | undefined) ??
  fromProcess("APP_ENV") ??
  fromProcess("NODE_ENV") ??
  (import.meta.env.MODE as string | undefined) ??
  "development";

const RELEASE =
  (import.meta.env.VITE_APP_RELEASE as string | undefined) ?? fromProcess("APP_RELEASE");

const REPORT_ENDPOINT = isBrowser
  ? (import.meta.env.VITE_OBSERVABILITY_ENDPOINT as string | undefined)
  : (fromProcess("OBSERVABILITY_ENDPOINT") ??
    (import.meta.env.VITE_OBSERVABILITY_ENDPOINT as string | undefined));

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }
  if (typeof error === "object" && error !== null) {
    try {
      return { name: "NonError", message: JSON.stringify(error) };
    } catch {
      return { name: "NonError", message: String(error) };
    }
  }
  return { name: "NonError", message: String(error) };
}

interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  environment: string;
  release?: string;
  runtime: "browser" | "server";
  context?: LogContext;
  error?: SerializedError;
}

function safeStringify(record: LogRecord): string {
  try {
    return JSON.stringify(record);
  } catch {
    // Un contexte non sérialisable (ex. référence circulaire) ne doit jamais
    // empêcher l'émission du log : on retombe sur une version sans contexte.
    return JSON.stringify({ ...record, context: undefined, error: record.error });
  }
}

function emit(record: LogRecord): void {
  const line = safeStringify(record);
  // On conserve la sémantique console pour permettre le filtrage par niveau
  // côté plateforme.
  if (record.level === "error") console.error(line);
  else if (record.level === "warn") console.warn(line);
  else console.log(line);
}

// Transmission best-effort vers un agrégateur externe.
// Ne lève jamais et ne bloque jamais le flux applicatif.
function forward(record: LogRecord): void {
  if (!REPORT_ENDPOINT) return;
  try {
    void fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: safeStringify(record),
      keepalive: isBrowser, // autorise l'envoi pendant un unload navigateur
    }).catch(() => {
      /* l'observabilité ne doit jamais provoquer d'erreur visible */
    });
  } catch {
    /* idem : on avale toute défaillance du transport */
  }
}

function baseRecord(level: LogLevel, message: string, context?: LogContext): LogRecord {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    release: RELEASE,
    runtime: isBrowser ? "browser" : "server",
    context: context && Object.keys(context).length > 0 ? context : undefined,
  };
}

/** Journalise un événement structuré. Les niveaux warn/error sont aussi transmis. */
export function log(level: LogLevel, message: string, context?: LogContext): void {
  const record = baseRecord(level, message, context);
  emit(record);
  if (level === "error" || level === "warn") forward(record);
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

/** Point d'entrée unique pour signaler une erreur (logge + transmet). */
export function reportError(error: unknown, context?: LogContext): void {
  const serialized = serializeError(error);
  const record: LogRecord = {
    ...baseRecord("error", serialized.message || "Erreur non gérée", context),
    error: serialized,
  };
  emit(record);
  forward(record);
}
