import { describe, it, expect } from "vitest";
import { formatXAF, formatDate } from "./format";

// Intl insère des espaces insécables (U+202F / U+00A0) comme séparateurs de
// milliers ; \s les couvre, on normalise en espace simple pour des comparaisons
// stables et sans caractères irréguliers dans le source.
const norm = (s: string) => s.replace(/\s/g, " ");

describe("formatXAF", () => {
  it("formate un entier avec séparateur de milliers et suffixe XAF", () => {
    expect(norm(formatXAF(1192500))).toBe("1 192 500 XAF");
  });

  it("n'affiche aucune décimale (montants OHADA en unités entières)", () => {
    expect(norm(formatXAF(1000.4))).toBe("1 000 XAF");
    expect(norm(formatXAF(1000.9))).toBe("1 001 XAF");
  });

  it("traite null / undefined comme 0", () => {
    expect(formatXAF(null)).toBe("0 XAF");
    expect(formatXAF(undefined)).toBe("0 XAF");
  });

  it("accepte une chaîne numérique", () => {
    expect(norm(formatXAF("600000"))).toBe("600 000 XAF");
  });
});

describe("formatDate", () => {
  it("retourne un tiret pour une date absente", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formate une date ISO au format fr-FR", () => {
    expect(formatDate("2026-01-15")).toBe("15/01/2026");
  });
});
