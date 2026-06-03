// Exports « de base » CSV (cahier des charges v1.1, module 18 et critères
// d'acceptation globaux n°9). Le séparateur point-virgule et le BOM UTF-8
// assurent une ouverture correcte dans Excel en environnement francophone.

function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(escapeCell).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Sauvegarde logique : export d'un objet quelconque en fichier JSON.
export function downloadJson(filename: string, data: unknown): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export PDF tabulaire — utilisé notamment pour la balance générale après
// clôture de période (cahier v1.1, module 18). On dynamise l'import pour
// éviter d'alourdir le bundle initial.
export async function downloadTablePdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  options?: { footer?: string },
): Promise<void> {
  if (typeof window === "undefined") return;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 58);

  autoTable(doc, {
    startY: 75,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c == null ? "" : String(c)))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  if (options?.footer) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `${options.footer} — page ${i}/${pageCount}`,
        40,
        doc.internal.pageSize.getHeight() - 20,
      );
    }
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
