import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // La session est persistée dans le navigateur. Pendant le SSR, laisser la RLS
    // protéger les données et effectuer le contrôle dès l’hydratation évite une
    // redirection erronée causée par l’absence de localStorage côté serveur.
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: () => <Outlet />,
});
