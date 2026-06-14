import { Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  LayoutDashboard,
  BookOpen,
  FileText,
  Wallet,
  Users,
  Settings,
  Building2,
  Archive,
  ShoppingCart,
  Landmark,
  LifeBuoy,
  CreditCard,
  ShieldCheck,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useAbonnement, useEstAdmin } from "@/hooks/use-abonnement";
import { bandeauAbonnement } from "@/lib/abonnement";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { to: "/app", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/app/comptabilite/ecritures", label: "Comptabilité", icon: BookOpen },
  { to: "/app/ventes", label: "Ventes", icon: FileText },
  { to: "/app/achats", label: "Achats", icon: ShoppingCart },
  { to: "/app/tresorerie", label: "Trésorerie", icon: Wallet },
  { to: "/app/fiscalite", label: "Fiscalité", icon: Landmark },
  { to: "/app/tiers", label: "Tiers", icon: Users },
  { to: "/app/abonnement", label: "Abonnement", icon: CreditCard },
  { to: "/app/export", label: "Sauvegarde", icon: Archive },
  { to: "/app/support", label: "Support", icon: LifeBuoy },
  { to: "/app/parametres", label: "Paramètres", icon: Settings, soon: true },
];

/** Contenu commun à la barre latérale (desktop) et au tiroir (mobile). */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entreprises, current, setCurrent } = useEntreprises();
  const { data: estAdmin } = useEstAdmin();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onNavigate?.();
    navigate({ to: "/login" as never });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b">
        <Link
          to={"/app" as never}
          className="text-xl font-bold tracking-tight"
          onClick={onNavigate}
        >
          Kompta
        </Link>
      </div>

      <div className="p-3 border-b space-y-2">
        <div className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Entreprise
        </div>
        {entreprises.length > 0 ? (
          <Select value={current?.id ?? ""} onValueChange={setCurrent}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {entreprises.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.raison_sociale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Link
            to={"/onboarding" as never}
            className="block text-sm text-primary hover:underline"
            onClick={onNavigate}
          >
            + Créer une entreprise
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (item.soon) {
            return (
              <div
                key={item.to}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground/60 cursor-not-allowed"
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <Badge variant="outline" className="text-[10px] px-1">
                  bientôt
                </Badge>
              </div>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to as never}
              activeOptions={{ exact: item.exact ?? false }}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors [&.active]:bg-accent [&.active]:text-foreground"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}

        {estAdmin && (
          <Link
            to={"/app/admin/paiements" as never}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors [&.active]:bg-accent [&.active]:text-foreground"
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="flex-1">Validation paiements</span>
          </Link>
        )}
      </nav>

      <div className="p-3 border-t space-y-2">
        <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Se déconnecter
        </Button>
      </div>
    </div>
  );
}

/** Bandeau global incitant au paiement (essai bientôt fini, accès suspendu…). */
function AbonnementBanner() {
  const { data: abonnement } = useAbonnement();
  if (!abonnement) return null;
  const info = bandeauAbonnement(abonnement);
  if (!info) return null;
  return (
    <div
      className={
        info.ton === "alerte"
          ? "border-b bg-destructive/10 px-4 py-2 text-sm text-destructive"
          : "border-b bg-primary/5 px-4 py-2 text-sm text-foreground"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{info.texte}</span>
        <Link to={"/app/abonnement" as never} className="font-medium text-primary hover:underline">
          Gérer l'abonnement
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Barre latérale — desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 min-w-0 flex-col">
        {/* Barre supérieure — mobile / tablette */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to={"/app" as never} className="text-lg font-bold tracking-tight">
            Kompta
          </Link>
        </header>

        <AbonnementBanner />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
