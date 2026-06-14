import { describe, it, expect } from "vitest";
import { toCsv } from "./export";

const BOM = "﻿";

describe("toCsv", () => {
  it("préfixe un BOM UTF-8 et sépare les lignes en CRLF (ouverture Excel fr)", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(`${BOM}a;b\r\n1;2`);
  });

  it("échappe les cellules contenant le séparateur point-virgule", () => {
    const csv = toCsv(["compte"], [["Achats; divers"]]);
    expect(csv).toBe(`${BOM}compte\r\n"Achats; divers"`);
  });

  it("double les guillemets internes et entoure la cellule", () => {
    const csv = toCsv(["lib"], [['Société "Alpha"']]);
    expect(csv).toBe(`${BOM}lib\r\n"Société ""Alpha"""`);
  });

  it("échappe les retours à la ligne dans une cellule", () => {
    const csv = toCsv(["note"], [["ligne1\nligne2"]]);
    expect(csv).toBe(`${BOM}note\r\n"ligne1\nligne2"`);
  });

  it("rend les valeurs nulles/indéfinies comme des cellules vides", () => {
    const csv = toCsv(["x", "y"], [[null, undefined]]);
    expect(csv).toBe(`${BOM}x;y\r\n;`);
  });
});
