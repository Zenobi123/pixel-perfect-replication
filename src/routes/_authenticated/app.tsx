import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { EntreprisesProvider } from "@/hooks/use-entreprises";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ location }) => {
    // Redirige vers onboarding si l'utilisateur n'a aucune entreprise
    const { data: ents } = await supabase
      .from("entreprises")
      .select("id")
      .limit(1);
    if ((!ents || ents.length === 0) && !location.pathname.startsWith("/onboarding")) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <EntreprisesProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </EntreprisesProvider>
  );
}
