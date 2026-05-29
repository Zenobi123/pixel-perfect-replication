import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

const BUCKET = "pieces";
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo, aligné sur file_size_limit du bucket
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

type Document = {
  id: string;
  nom_fichier: string;
  chemin: string;
  taille: number | null;
  mime: string | null;
  created_at: string;
};

// Pièces justificatives d'une écriture, stockées dans un bucket PRIVÉ. L'accès
// passe par des URLs signées à durée de vie courte (cahier v1.1, §Module 16).
// Le chemin est préfixé par l'entreprise_id : l'isolation est imposée par le
// RLS de storage.objects, pas par le frontend.
export function PiecesJointes({
  entrepriseId,
  ecritureId,
}: {
  entrepriseId: string;
  ecritureId: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ["documents", ecritureId],
    queryFn: async (): Promise<Document[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, nom_fichier, chemin, taille, mime, created_at")
        .eq("ecriture_id", ecritureId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
  });

  async function handleFile(file: File) {
    if (!ACCEPT.includes(file.type)) {
      toast.error("Format non autorisé (PDF, PNG, JPEG ou WebP).");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux (10 Mo maximum).");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const chemin = `${entrepriseId}/${ecritureId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(chemin, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("documents").insert({
        entreprise_id: entrepriseId,
        ecriture_id: ecritureId,
        nom_fichier: file.name,
        chemin,
        taille: file.size,
        mime: file.type,
      });
      if (insErr) {
        // Compensation : on retire le fichier orphelin si l'insert échoue.
        await supabase.storage.from(BUCKET).remove([chemin]);
        throw insErr;
      }
      toast.success("Pièce jointe ajoutée");
      qc.invalidateQueries({ queryKey: ["documents", ecritureId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function ouvrir(chemin: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Impossible d'ouvrir la pièce");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function supprimer(doc: Document) {
    if (!window.confirm(`Supprimer « ${doc.nom_fichier} » ?`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([doc.chemin]);
    toast.success("Pièce supprimée");
    qc.invalidateQueries({ queryKey: ["documents", ecritureId] });
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Pièces justificatives
        </h3>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" /> {uploading ? "Envoi…" : "Joindre un fichier"}
        </Button>
      </div>

      {documents && documents.length > 0 ? (
        <ul className="divide-y text-sm">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <button
                onClick={() => ouvrir(d.chemin)}
                className="flex items-center gap-2 hover:underline text-left"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{d.nom_fichier}</span>
                <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
              </button>
              <Button variant="ghost" size="icon" onClick={() => supprimer(d)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune pièce jointe. PDF ou image, 10 Mo max.
        </p>
      )}
    </Card>
  );
}
