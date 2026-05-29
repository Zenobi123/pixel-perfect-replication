import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/support")({
  head: () => ({ meta: [{ title: "Support — Kompta" }] }),
  component: SupportPage,
});

type TicketStatut = "ouvert" | "en_cours" | "resolu" | "ferme";
type TicketPriorite = "basse" | "normale" | "haute";
type Ticket = {
  id: string;
  sujet: string;
  description: string | null;
  statut: TicketStatut;
  priorite: TicketPriorite;
  created_at: string;
};
type Message = { id: string; message: string; auteur: string; created_at: string };

const STATUTS: { value: TicketStatut; label: string }[] = [
  { value: "ouvert", label: "Ouvert" },
  { value: "en_cours", label: "En cours" },
  { value: "resolu", label: "Résolu" },
  { value: "ferme", label: "Fermé" },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.value, s.label])) as Record<
  TicketStatut,
  string
>;

function statutBadge(s: TicketStatut) {
  const variant = s === "resolu" ? undefined : s === "ferme" ? "outline" : "secondary";
  return <Badge variant={variant as "secondary" | "outline" | undefined}>{STATUT_LABEL[s]}</Badge>;
}

function SupportPage() {
  const { current } = useEntreprises();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sujet: "",
    description: "",
    priorite: "normale" as TicketPriorite,
  });
  const [reply, setReply] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, sujet, description, statut, priorite, created_at")
        .eq("entreprise_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["support-messages", active?.id],
    enabled: !!active?.id,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, message, auteur, created_at")
        .eq("ticket_id", active!.id)
        .order("created_at");
      if (error) throw error;
      return data as Message[];
    },
  });

  async function createTicket() {
    if (!current) return;
    if (!form.sujet.trim()) {
      toast.error("Le sujet est requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("support_tickets").insert({
      entreprise_id: current.id,
      sujet: form.sujet.trim(),
      description: form.description || null,
      priorite: form.priorite,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket créé");
    setOpenNew(false);
    setForm({ sujet: "", description: "", priorite: "normale" });
    qc.invalidateQueries({ queryKey: ["support-tickets", current.id] });
  }

  async function changerStatut(t: Ticket, statut: TicketStatut) {
    const { error } = await supabase.from("support_tickets").update({ statut }).eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setActive({ ...t, statut });
    qc.invalidateQueries({ queryKey: ["support-tickets", current?.id] });
  }

  async function envoyer() {
    if (!current || !active || !reply.trim()) return;
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: active.id,
      entreprise_id: current.id,
      message: reply.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReply("");
    qc.invalidateQueries({ queryKey: ["support-messages", active.id] });
  }

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-4xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">Vos demandes d'assistance.</p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau ticket
        </Button>
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Sujet</th>
                <th className="px-4 py-2">Priorité</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : tickets?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun ticket. Ouvrez votre première demande.
                  </td>
                </tr>
              ) : (
                tickets?.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setActive(t)}
                  >
                    <td className="px-4 py-2">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-2 font-medium">{t.sujet}</td>
                    <td className="px-4 py-2 capitalize">{t.priorite}</td>
                    <td className="px-4 py-2">{statutBadge(t.statut)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Création */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau ticket</DialogTitle>
            <DialogDescription>
              Décrivez votre demande, l'équipe vous répondra ici.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sujet</Label>
              <Input
                value={form.sujet}
                onChange={(e) => setForm({ ...form, sujet: e.target.value })}
              />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select
                value={form.priorite}
                onValueChange={(v) => setForm({ ...form, priorite: v as TicketPriorite })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basse">Basse</SelectItem>
                  <SelectItem value="normale">Normale</SelectItem>
                  <SelectItem value="haute">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNew(false)}>
              Annuler
            </Button>
            <Button onClick={createTicket} disabled={saving}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fil de discussion */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.sujet}</DialogTitle>
            <DialogDescription>
              {active && (
                <span className="flex items-center gap-2">
                  Statut :
                  <Select
                    value={active.statut}
                    onValueChange={(v) => changerStatut(active, v as TicketStatut)}
                  >
                    <SelectTrigger className="h-7 w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUTS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {active?.description && (
            <p className="text-sm text-muted-foreground border-l-2 pl-3">{active.description}</p>
          )}

          <div className="max-h-72 overflow-y-auto space-y-2">
            {messages?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message pour l'instant.</p>
            ) : (
              messages?.map((m) => (
                <div key={m.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">
                    {formatDate(m.created_at)}
                  </div>
                  {m.message}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Votre message…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && reply.trim()) void envoyer();
              }}
            />
            <Button size="icon" onClick={envoyer} disabled={!reply.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
