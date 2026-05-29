import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Un « mouvement » est une ligne d'écriture VALIDÉE, enrichie de son compte et
// de son écriture/journal. C'est la brique commune des restitutions OHADA :
// journal général, grand livre et balance générale (cahier v1.1, module 15).
// Les écritures en brouillon ou contre-passées (statut <> 'validee') sont
// volontairement exclues : seules les écritures comptabilisées alimentent les états.

export type Mouvement = {
  id: string;
  debit: number;
  credit: number;
  lettrage: string | null;
  compte: { id: string; numero: string; libelle: string; classe: number };
  ecriture: {
    id: string;
    numero: number | null;
    date_piece: string;
    libelle: string;
    reference: string | null;
    journal_id: string;
    journal_code: string;
    journal_libelle: string;
  };
};

export type MouvementFilters = {
  from?: string;
  to?: string;
  journalId?: string;
};

type RawRow = {
  id: string;
  debit: number | string;
  credit: number | string;
  lettrage: string | null;
  comptes: { id: string; numero: string; libelle: string; classe: number } | null;
  ecritures: {
    id: string;
    numero: number | null;
    date_piece: string;
    libelle: string;
    reference: string | null;
    journal_id: string;
    journaux: { code: string; libelle: string } | null;
  } | null;
};

export function useMouvements(entrepriseId: string | undefined, filters: MouvementFilters) {
  return useQuery({
    queryKey: ["mouvements", entrepriseId, filters],
    enabled: !!entrepriseId,
    queryFn: async (): Promise<Mouvement[]> => {
      let q = supabase
        .from("lignes_ecriture")
        .select(
          "id, debit, credit, lettrage, comptes!inner(id, numero, libelle, classe), ecritures!inner(id, numero, date_piece, libelle, reference, statut, journal_id, journaux!inner(code, libelle))",
        )
        .eq("entreprise_id", entrepriseId!)
        .eq("ecritures.statut", "validee");
      if (filters.from) q = q.gte("ecritures.date_piece", filters.from);
      if (filters.to) q = q.lte("ecritures.date_piece", filters.to);
      if (filters.journalId && filters.journalId !== "all") {
        q = q.eq("ecritures.journal_id", filters.journalId);
      }
      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as unknown as RawRow[];
      return rows
        .filter((r) => r.comptes && r.ecritures)
        .map((r) => ({
          id: r.id,
          debit: Number(r.debit) || 0,
          credit: Number(r.credit) || 0,
          lettrage: r.lettrage,
          compte: {
            id: r.comptes!.id,
            numero: r.comptes!.numero,
            libelle: r.comptes!.libelle,
            classe: r.comptes!.classe,
          },
          ecriture: {
            id: r.ecritures!.id,
            numero: r.ecritures!.numero,
            date_piece: r.ecritures!.date_piece,
            libelle: r.ecritures!.libelle,
            reference: r.ecritures!.reference,
            journal_id: r.ecritures!.journal_id,
            journal_code: r.ecritures!.journaux?.code ?? "",
            journal_libelle: r.ecritures!.journaux?.libelle ?? "",
          },
        }));
    },
  });
}
