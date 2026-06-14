import { describe, it, expect, vi, afterEach } from "vitest";
import { serializeError, reportError, logger } from "./observability";

describe("serializeError", () => {
  it("extrait nom, message et stack d'une Error", () => {
    const err = new TypeError("boom");
    const s = serializeError(err);
    expect(s.name).toBe("TypeError");
    expect(s.message).toBe("boom");
    expect(typeof s.stack).toBe("string");
  });

  it("sérialise un objet non-Error en JSON", () => {
    const s = serializeError({ code: 42 });
    expect(s.name).toBe("NonError");
    expect(s.message).toBe(JSON.stringify({ code: 42 }));
  });

  it("gère les valeurs primitives", () => {
    expect(serializeError("oops").message).toBe("oops");
    expect(serializeError(null).message).toBe("null");
  });
});

describe("reportError / logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("émet un log JSON structuré de niveau error sur la console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("panne SSR"), { scope: "ssr" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.level).toBe("error");
    expect(payload.error.message).toBe("panne SSR");
    expect(payload.context).toEqual({ scope: "ssr" });
    expect(payload.timestamp).toBeDefined();
    expect(payload.runtime).toBeDefined();
  });

  it("ne transmet rien à un endpoint externe quand aucun n'est configuré", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("attention");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
