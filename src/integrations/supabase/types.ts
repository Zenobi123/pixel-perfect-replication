export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achats: {
        Row: {
          compte_charge_id: string | null
          created_at: string
          created_by: string
          date_echeance: string | null
          date_facture: string
          ecriture_id: string | null
          entreprise_id: string
          exercice_id: string
          id: string
          montant_paye: number
          numero: number | null
          objet: string | null
          reference_fournisseur: string | null
          statut: Database["public"]["Enums"]["achat_statut"]
          tiers_id: string | null
          total_ht: number
          total_ttc: number
          total_tva: number
          updated_at: string
          validee_le: string | null
        }
        Insert: {
          compte_charge_id?: string | null
          created_at?: string
          created_by?: string
          date_echeance?: string | null
          date_facture?: string
          ecriture_id?: string | null
          entreprise_id: string
          exercice_id: string
          id?: string
          montant_paye?: number
          numero?: number | null
          objet?: string | null
          reference_fournisseur?: string | null
          statut?: Database["public"]["Enums"]["achat_statut"]
          tiers_id?: string | null
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validee_le?: string | null
        }
        Update: {
          compte_charge_id?: string | null
          created_at?: string
          created_by?: string
          date_echeance?: string | null
          date_facture?: string
          ecriture_id?: string | null
          entreprise_id?: string
          exercice_id?: string
          id?: string
          montant_paye?: number
          numero?: number | null
          objet?: string | null
          reference_fournisseur?: string | null
          statut?: Database["public"]["Enums"]["achat_statut"]
          tiers_id?: string | null
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          updated_at?: string
          validee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achats_compte_charge_id_fkey"
            columns: ["compte_charge_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_ecriture_id_fkey"
            columns: ["ecriture_id"]
            isOneToOne: false
            referencedRelation: "ecritures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_tiers_id_fkey"
            columns: ["tiers_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entreprise_id: string | null
          id: string
          payload: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entreprise_id?: string | null
          id?: string
          payload?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entreprise_id?: string | null
          id?: string
          payload?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      comptes: {
        Row: {
          actif: boolean
          classe: number
          created_at: string
          entreprise_id: string
          est_collectif: boolean
          id: string
          libelle: string
          numero: string
          parent_id: string | null
          sens: Database["public"]["Enums"]["compte_sens"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          classe: number
          created_at?: string
          entreprise_id: string
          est_collectif?: boolean
          id?: string
          libelle: string
          numero: string
          parent_id?: string | null
          sens?: Database["public"]["Enums"]["compte_sens"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          classe?: number
          created_at?: string
          entreprise_id?: string
          est_collectif?: boolean
          id?: string
          libelle?: string
          numero?: string
          parent_id?: string | null
          sens?: Database["public"]["Enums"]["compte_sens"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comptes_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comptes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
        ]
      }
      comptes_ohada_template: {
        Row: {
          classe: number
          created_at: string
          est_collectif: boolean
          libelle: string
          numero: string
          sens: Database["public"]["Enums"]["compte_sens"]
        }
        Insert: {
          classe: number
          created_at?: string
          est_collectif?: boolean
          libelle: string
          numero: string
          sens?: Database["public"]["Enums"]["compte_sens"]
        }
        Update: {
          classe?: number
          created_at?: string
          est_collectif?: boolean
          libelle?: string
          numero?: string
          sens?: Database["public"]["Enums"]["compte_sens"]
        }
        Relationships: []
      }
      compteurs_achat: {
        Row: {
          dernier_numero: number
          entreprise_id: string
          exercice_id: string
        }
        Insert: {
          dernier_numero?: number
          entreprise_id: string
          exercice_id: string
        }
        Update: {
          dernier_numero?: number
          entreprise_id?: string
          exercice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compteurs_achat_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compteurs_achat_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs_ecriture: {
        Row: {
          dernier_numero: number
          entreprise_id: string
          exercice_id: string
          journal_id: string
        }
        Insert: {
          dernier_numero?: number
          entreprise_id: string
          exercice_id: string
          journal_id: string
        }
        Update: {
          dernier_numero?: number
          entreprise_id?: string
          exercice_id?: string
          journal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compteurs_ecriture_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compteurs_ecriture_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compteurs_ecriture_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journaux"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs_facture: {
        Row: {
          dernier_numero: number
          entreprise_id: string
          exercice_id: string
          type: Database["public"]["Enums"]["facture_type"]
        }
        Insert: {
          dernier_numero?: number
          entreprise_id: string
          exercice_id: string
          type: Database["public"]["Enums"]["facture_type"]
        }
        Update: {
          dernier_numero?: number
          entreprise_id?: string
          exercice_id?: string
          type?: Database["public"]["Enums"]["facture_type"]
        }
        Relationships: [
          {
            foreignKeyName: "compteurs_facture_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compteurs_facture_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chemin: string
          created_at: string
          created_by: string
          ecriture_id: string | null
          entreprise_id: string
          id: string
          mime: string | null
          nom_fichier: string
          taille: number | null
          type: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          chemin: string
          created_at?: string
          created_by?: string
          ecriture_id?: string | null
          entreprise_id: string
          id?: string
          mime?: string | null
          nom_fichier: string
          taille?: number | null
          type?: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          chemin?: string
          created_at?: string
          created_by?: string
          ecriture_id?: string | null
          entreprise_id?: string
          id?: string
          mime?: string | null
          nom_fichier?: string
          taille?: number | null
          type?: Database["public"]["Enums"]["document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_ecriture_id_fkey"
            columns: ["ecriture_id"]
            isOneToOne: false
            referencedRelation: "ecritures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      ecritures: {
        Row: {
          contrepasse_par: string | null
          created_at: string
          created_by: string
          date_piece: string
          entreprise_id: string
          exercice_id: string
          id: string
          journal_id: string
          libelle: string
          numero: number | null
          reference: string | null
          statut: Database["public"]["Enums"]["ecriture_statut"]
          updated_at: string
          validee_le: string | null
          validee_par: string | null
        }
        Insert: {
          contrepasse_par?: string | null
          created_at?: string
          created_by?: string
          date_piece: string
          entreprise_id: string
          exercice_id: string
          id?: string
          journal_id: string
          libelle: string
          numero?: number | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["ecriture_statut"]
          updated_at?: string
          validee_le?: string | null
          validee_par?: string | null
        }
        Update: {
          contrepasse_par?: string | null
          created_at?: string
          created_by?: string
          date_piece?: string
          entreprise_id?: string
          exercice_id?: string
          id?: string
          journal_id?: string
          libelle?: string
          numero?: number | null
          reference?: string | null
          statut?: Database["public"]["Enums"]["ecriture_statut"]
          updated_at?: string
          validee_le?: string | null
          validee_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecritures_contrepasse_par_fkey"
            columns: ["contrepasse_par"]
            isOneToOne: false
            referencedRelation: "ecritures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journaux"
            referencedColumns: ["id"]
          },
        ]
      }
      entreprises: {
        Row: {
          abonnement_jusqu_au: string | null
          adresse: string | null
          created_at: string
          created_by: string
          devise: string
          email: string | null
          id: string
          logo_url: string | null
          niu: string | null
          raison_sociale: string
          rccm: string | null
          regime_fiscal: Database["public"]["Enums"]["regime_fiscal"]
          sigle: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          telephone: string | null
          trial_ends_at: string
          updated_at: string
          ville: string | null
        }
        Insert: {
          abonnement_jusqu_au?: string | null
          adresse?: string | null
          created_at?: string
          created_by: string
          devise?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          niu?: string | null
          raison_sociale: string
          rccm?: string | null
          regime_fiscal?: Database["public"]["Enums"]["regime_fiscal"]
          sigle?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          telephone?: string | null
          trial_ends_at?: string
          updated_at?: string
          ville?: string | null
        }
        Update: {
          abonnement_jusqu_au?: string | null
          adresse?: string | null
          created_at?: string
          created_by?: string
          devise?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          niu?: string | null
          raison_sociale?: string
          rccm?: string | null
          regime_fiscal?: Database["public"]["Enums"]["regime_fiscal"]
          sigle?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          telephone?: string | null
          trial_ends_at?: string
          updated_at?: string
          ville?: string | null
        }
        Relationships: []
      }
      exercices: {
        Row: {
          cloture_le: string | null
          cloture_par: string | null
          created_at: string
          date_debut: string
          date_fin: string
          entreprise_id: string
          id: string
          libelle: string
          statut: Database["public"]["Enums"]["exercice_statut"]
          updated_at: string
        }
        Insert: {
          cloture_le?: string | null
          cloture_par?: string | null
          created_at?: string
          date_debut: string
          date_fin: string
          entreprise_id: string
          id?: string
          libelle: string
          statut?: Database["public"]["Enums"]["exercice_statut"]
          updated_at?: string
        }
        Update: {
          cloture_le?: string | null
          cloture_par?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string
          entreprise_id?: string
          id?: string
          libelle?: string
          statut?: Database["public"]["Enums"]["exercice_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercices_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          created_at: string
          created_by: string
          date_echeance: string | null
          date_facture: string
          ecriture_id: string | null
          entreprise_id: string
          exercice_id: string
          facture_origine_id: string | null
          id: string
          montant_paye: number
          numero: number | null
          objet: string | null
          statut: Database["public"]["Enums"]["facture_statut"]
          tiers_id: string | null
          total_ht: number
          total_ttc: number
          total_tva: number
          type: Database["public"]["Enums"]["facture_type"]
          updated_at: string
          validee_le: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          date_echeance?: string | null
          date_facture?: string
          ecriture_id?: string | null
          entreprise_id: string
          exercice_id: string
          facture_origine_id?: string | null
          id?: string
          montant_paye?: number
          numero?: number | null
          objet?: string | null
          statut?: Database["public"]["Enums"]["facture_statut"]
          tiers_id?: string | null
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type?: Database["public"]["Enums"]["facture_type"]
          updated_at?: string
          validee_le?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          date_echeance?: string | null
          date_facture?: string
          ecriture_id?: string | null
          entreprise_id?: string
          exercice_id?: string
          facture_origine_id?: string | null
          id?: string
          montant_paye?: number
          numero?: number | null
          objet?: string | null
          statut?: Database["public"]["Enums"]["facture_statut"]
          tiers_id?: string | null
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          type?: Database["public"]["Enums"]["facture_type"]
          updated_at?: string
          validee_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factures_ecriture_id_fkey"
            columns: ["ecriture_id"]
            isOneToOne: false
            referencedRelation: "ecritures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_facture_origine_id_fkey"
            columns: ["facture_origine_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_tiers_id_fkey"
            columns: ["tiers_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      journaux: {
        Row: {
          actif: boolean
          code: string
          compte_contrepartie_id: string | null
          created_at: string
          entreprise_id: string
          id: string
          libelle: string
          type: Database["public"]["Enums"]["journal_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          code: string
          compte_contrepartie_id?: string | null
          created_at?: string
          entreprise_id: string
          id?: string
          libelle: string
          type: Database["public"]["Enums"]["journal_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          code?: string
          compte_contrepartie_id?: string | null
          created_at?: string
          entreprise_id?: string
          id?: string
          libelle?: string
          type?: Database["public"]["Enums"]["journal_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journaux_compte_contrepartie_id_fkey"
            columns: ["compte_contrepartie_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journaux_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_achat: {
        Row: {
          achat_id: string
          created_at: string
          designation: string
          entreprise_id: string
          id: string
          montant_ht: number
          ordre: number
          prix_unitaire: number
          quantite: number
          taux_tva: number
        }
        Insert: {
          achat_id: string
          created_at?: string
          designation: string
          entreprise_id: string
          id?: string
          montant_ht?: number
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          taux_tva?: number
        }
        Update: {
          achat_id?: string
          created_at?: string
          designation?: string
          entreprise_id?: string
          id?: string
          montant_ht?: number
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          taux_tva?: number
        }
        Relationships: [
          {
            foreignKeyName: "lignes_achat_achat_id_fkey"
            columns: ["achat_id"]
            isOneToOne: false
            referencedRelation: "achats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_achat_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_ecriture: {
        Row: {
          compte_id: string
          created_at: string
          credit: number
          debit: number
          ecriture_id: string
          entreprise_id: string
          id: string
          lettrage: string | null
          libelle: string | null
          ordre: number
          tiers_id: string | null
        }
        Insert: {
          compte_id: string
          created_at?: string
          credit?: number
          debit?: number
          ecriture_id: string
          entreprise_id: string
          id?: string
          lettrage?: string | null
          libelle?: string | null
          ordre?: number
          tiers_id?: string | null
        }
        Update: {
          compte_id?: string
          created_at?: string
          credit?: number
          debit?: number
          ecriture_id?: string
          entreprise_id?: string
          id?: string
          lettrage?: string | null
          libelle?: string | null
          ordre?: number
          tiers_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lignes_ecriture_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_ecriture_ecriture_id_fkey"
            columns: ["ecriture_id"]
            isOneToOne: false
            referencedRelation: "ecritures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_ecriture_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_ecriture_tiers_id_fkey"
            columns: ["tiers_id"]
            isOneToOne: false
            referencedRelation: "tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      lignes_facture: {
        Row: {
          created_at: string
          designation: string
          entreprise_id: string
          facture_id: string
          id: string
          montant_ht: number
          ordre: number
          prix_unitaire: number
          quantite: number
          taux_tva: number
        }
        Insert: {
          created_at?: string
          designation: string
          entreprise_id: string
          facture_id: string
          id?: string
          montant_ht?: number
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          taux_tva?: number
        }
        Update: {
          created_at?: string
          designation?: string
          entreprise_id?: string
          facture_id?: string
          id?: string
          montant_ht?: number
          ordre?: number
          prix_unitaire?: number
          quantite?: number
          taux_tva?: number
        }
        Relationships: [
          {
            foreignKeyName: "lignes_facture_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lignes_facture_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          entreprise_id: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          entreprise_id: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          entreprise_id?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      periodes: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string
          entreprise_id: string
          exercice_id: string
          id: string
          libelle: string
          statut: Database["public"]["Enums"]["periode_statut"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin: string
          entreprise_id: string
          exercice_id: string
          id?: string
          libelle: string
          statut?: Database["public"]["Enums"]["periode_statut"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string
          entreprise_id?: string
          exercice_id?: string
          id?: string
          libelle?: string
          statut?: Database["public"]["Enums"]["periode_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodes_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodes_exercice_id_fkey"
            columns: ["exercice_id"]
            isOneToOne: false
            referencedRelation: "exercices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tiers: {
        Row: {
          actif: boolean
          adresse: string | null
          code: string
          compte_id: string | null
          created_at: string
          email: string | null
          entreprise_id: string
          id: string
          niu: string | null
          raison_sociale: string
          telephone: string | null
          type: Database["public"]["Enums"]["tiers_type"]
          updated_at: string
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          code: string
          compte_id?: string | null
          created_at?: string
          email?: string | null
          entreprise_id: string
          id?: string
          niu?: string | null
          raison_sociale: string
          telephone?: string | null
          type: Database["public"]["Enums"]["tiers_type"]
          updated_at?: string
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          code?: string
          compte_id?: string | null
          created_at?: string
          email?: string | null
          entreprise_id?: string
          id?: string
          niu?: string | null
          raison_sociale?: string
          telephone?: string | null
          type?: Database["public"]["Enums"]["tiers_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiers_compte_id_fkey"
            columns: ["compte_id"]
            isOneToOne: false
            referencedRelation: "comptes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiers_entreprise_id_fkey"
            columns: ["entreprise_id"]
            isOneToOne: false
            referencedRelation: "entreprises"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activer_abonnement: {
        Args: {
          _entreprise_id: string
          _jusqu_au?: string
          _statut: Database["public"]["Enums"]["subscription_status"]
        }
        Returns: undefined
      }
      attribuer_numero_achat: {
        Args: { _entreprise_id: string; _exercice_id: string }
        Returns: number
      }
      attribuer_numero_ecriture: {
        Args: {
          _entreprise_id: string
          _exercice_id: string
          _journal_id: string
        }
        Returns: number
      }
      attribuer_numero_facture: {
        Args: {
          _entreprise_id: string
          _exercice_id: string
          _type: Database["public"]["Enums"]["facture_type"]
        }
        Returns: number
      }
      cloturer_periode: { Args: { _periode_id: string }; Returns: undefined }
      contrepasser_ecriture: {
        Args: { _date?: string; _ecriture_id: string }
        Returns: string
      }
      create_entreprise_with_owner: {
        Args: {
          _devise?: string
          _exercice_debut?: string
          _exercice_fin?: string
          _niu?: string
          _raison_sociale: string
          _regime?: Database["public"]["Enums"]["regime_fiscal"]
        }
        Returns: string
      }
      enregistrer_paiement_achat: {
        Args: { _achat_id: string; _montant: number }
        Returns: undefined
      }
      enregistrer_reglement: {
        Args: { _facture_id: string; _montant: number }
        Returns: undefined
      }
      generer_periodes: { Args: { _exercice_id: string }; Returns: number }
      has_membership_role: {
        Args: {
          _entreprise_id: string
          _roles: Database["public"]["Enums"]["membership_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: {
        Args: { _entreprise_id: string; _user_id: string }
        Returns: boolean
      }
      membership_role_of: {
        Args: { _entreprise_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["membership_role"]
      }
      mettre_en_revue_periode: {
        Args: { _periode_id: string }
        Returns: undefined
      }
      next_ecriture_numero: {
        Args: {
          _entreprise_id: string
          _exercice_id: string
          _journal_id: string
        }
        Returns: number
      }
      rouvrir_periode: {
        Args: { _motif: string; _periode_id: string }
        Returns: undefined
      }
      seed_plan_ohada: { Args: { _entreprise_id: string }; Returns: undefined }
      validate_ecriture: { Args: { _ecriture_id: string }; Returns: undefined }
      valider_achat: { Args: { _achat_id: string }; Returns: undefined }
      valider_facture: { Args: { _facture_id: string }; Returns: undefined }
      verrouiller_periode: { Args: { _periode_id: string }; Returns: undefined }
    }
    Enums: {
      achat_statut:
        | "brouillon"
        | "validee"
        | "partiellement_payee"
        | "payee"
        | "annulee"
      app_role: "super_admin"
      compte_sens: "debit" | "credit" | "mixte"
      document_type:
        | "facture_client"
        | "facture_fournisseur"
        | "recu"
        | "releve_bancaire"
        | "contrat"
        | "declaration"
        | "quittance"
        | "document_social"
        | "autre"
      ecriture_statut: "brouillon" | "validee" | "contrepassee"
      exercice_statut: "ouvert" | "cloture"
      facture_statut:
        | "brouillon"
        | "validee"
        | "envoyee"
        | "partiellement_payee"
        | "payee"
        | "annulee"
      facture_type: "devis" | "facture" | "avoir"
      journal_type: "achats" | "ventes" | "banque" | "caisse" | "od" | "an"
      membership_role: "owner" | "admin" | "comptable" | "lecteur"
      periode_statut: "ouverte" | "en_revue" | "verrouillee" | "cloturee"
      regime_fiscal: "reel" | "simplifie" | "liberatoire" | "non_assujetti"
      subscription_status: "trial" | "actif" | "suspendu" | "expire"
      tiers_type: "client" | "fournisseur" | "salarie" | "autre"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achat_statut: [
        "brouillon",
        "validee",
        "partiellement_payee",
        "payee",
        "annulee",
      ],
      app_role: ["super_admin"],
      compte_sens: ["debit", "credit", "mixte"],
      document_type: [
        "facture_client",
        "facture_fournisseur",
        "recu",
        "releve_bancaire",
        "contrat",
        "declaration",
        "quittance",
        "document_social",
        "autre",
      ],
      ecriture_statut: ["brouillon", "validee", "contrepassee"],
      exercice_statut: ["ouvert", "cloture"],
      facture_statut: [
        "brouillon",
        "validee",
        "envoyee",
        "partiellement_payee",
        "payee",
        "annulee",
      ],
      facture_type: ["devis", "facture", "avoir"],
      journal_type: ["achats", "ventes", "banque", "caisse", "od", "an"],
      membership_role: ["owner", "admin", "comptable", "lecteur"],
      periode_statut: ["ouverte", "en_revue", "verrouillee", "cloturee"],
      regime_fiscal: ["reel", "simplifie", "liberatoire", "non_assujetti"],
      subscription_status: ["trial", "actif", "suspendu", "expire"],
      tiers_type: ["client", "fournisseur", "salarie", "autre"],
    },
  },
} as const
