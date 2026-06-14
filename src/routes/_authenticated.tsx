import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  // Les routes authentifiées sont rendues CÔTÉ CLIENT uniquement. Le serveur ne
  // produit donc jamais de contenu authentifié : pas de flash de coquille vide
  // pour un visiteur non connecté, et aucune requête SSR sous l'identité anon.
  // La frontière de sécurité des données reste la RLS PostgreSQL et les server
  // functions authentifiées par Bearer token (voir docs/runbook.md §11).
  ssr: false,
  beforeLoad: async ({ location }) => {
    // La session est persistée côté navigateur (localStorage). On conserve le
    // garde SSR par sécurité, même si avec ssr:false beforeLoad s'exécute déjà
    // côté client. Ne pas retirer : vérifié par scripts/check-auth-ssr.mjs.
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();

  // Tant que l'état d'authentification n'est pas résolu — ou si aucune session
  // n'est présente (beforeLoad redirige alors vers /login) — on n'affiche aucun
  // contenu authentifié, seulement un état neutre. Cela supprime le flash.
  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Chargement…</span>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
