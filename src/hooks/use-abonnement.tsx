import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { AbonnementEtat } from "@/lib/abonnement";

/** État d'abonnement du compte courant (essai créé paresseusement côté serveur). */
export function useAbonnement() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mon-abonnement", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AbonnementEtat> => {
      const { data, error } = await supabase.rpc("mon_abonnement");
      if (error) throw error;
      return data as unknown as AbonnementEtat;
    },
  });
}

/** Indique si l'utilisateur courant est administrateur plateforme (super_admin). */
export function useEstAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["est-admin", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}
