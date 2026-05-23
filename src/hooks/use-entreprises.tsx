import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type Entreprise = {
  id: string;
  raison_sociale: string;
  sigle: string | null;
  niu: string | null;
  devise: string;
  subscription_status: string;
  trial_ends_at: string;
};

type Ctx = {
  entreprises: Entreprise[];
  current: Entreprise | null;
  loading: boolean;
  setCurrent: (id: string) => void;
  refresh: () => Promise<void>;
};

const EntreprisesContext = createContext<Ctx>({
  entreprises: [],
  current: null,
  loading: true,
  setCurrent: () => {},
  refresh: async () => {},
});

const STORAGE_KEY = "kompta.current_entreprise_id";

export function EntreprisesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setEntreprises([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("entreprises")
      .select("id, raison_sociale, sigle, niu, devise, subscription_status, trial_ends_at")
      .order("created_at", { ascending: true });
    if (!error && data) setEntreprises(data as Entreprise[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const current = useMemo(() => {
    if (entreprises.length === 0) return null;
    const found = entreprises.find((e) => e.id === currentId);
    return found ?? entreprises[0];
  }, [entreprises, currentId]);

  const setCurrent = (id: string) => {
    setCurrentId(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <EntreprisesContext.Provider value={{ entreprises, current, loading, setCurrent, refresh }}>
      {children}
    </EntreprisesContext.Provider>
  );
}

export function useEntreprises() {
  return useContext(EntreprisesContext);
}
