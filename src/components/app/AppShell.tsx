import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, BookOpen, FileText, Wallet, Users, Settings, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

const NAV = [
  { to: "/app", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/app/comptabilite", label: "Comptabilité", icon: BookOpen, soon: true },
  { to: "/app/ventes", label: "Ventes", icon: FileText, soon: true },
  { to: "/app/tresorerie", label: "Trésorerie", icon: Wallet, soon: true },
  { to: "/app/tiers", label: "Tiers", icon: Users, soon: true },
  { to: "/app/parametres", label: "Paramètres", icon: Settings, soon: true },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entreprises, current, setCurrent } = useEntreprises();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <div className="p-4 border-b">
          <Link to="/app" className="text-xl font-bold tracking-tight">Kompta</Link>
        </div>

        <div className="p-3 border-b space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Entreprise
          </div>
          {entreprises.length > 0 ? (
            <Select value={current?.id ?? ""} onValueChange={setCurrent}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {entreprises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.raison_sociale}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Link to="/onboarding" className="block text-sm text-primary hover:underline">
              + Créer une entreprise
            </Link>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to as never}
              activeOptions={{ exact: item.exact ?? false }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors [&.active]:bg-accent [&.active]:text-foreground"
              disabled={item.soon}
              onClick={(e) => { if (item.soon) e.preventDefault(); }}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.soon && <Badge variant="outline" className="text-[10px] px-1">bientôt</Badge>}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t space-y-2">
          <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
