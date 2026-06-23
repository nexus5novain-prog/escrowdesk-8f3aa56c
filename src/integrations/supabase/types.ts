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
      ad_banners: {
        Row: {
          clicks: number
          created_at: string
          created_by: string
          cta_label: string | null
          ends_at: string | null
          height: number | null
          html_content: string | null
          id: string
          impressions: number
          is_active: boolean
          link_url: string | null
          media_type: string
          media_url: string | null
          placements: string[]
          priority: number
          size_preset: string | null
          starts_at: string | null
          title: string
          updated_at: string
          width: number | null
        }
        Insert: {
          clicks?: number
          created_at?: string
          created_by: string
          cta_label?: string | null
          ends_at?: string | null
          height?: number | null
          html_content?: string | null
          id?: string
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          media_type: string
          media_url?: string | null
          placements?: string[]
          priority?: number
          size_preset?: string | null
          starts_at?: string | null
          title: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          clicks?: number
          created_at?: string
          created_by?: string
          cta_label?: string | null
          ends_at?: string | null
          height?: number | null
          html_content?: string | null
          id?: string
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          media_type?: string
          media_url?: string | null
          placements?: string[]
          priority?: number
          size_preset?: string | null
          starts_at?: string | null
          title?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      ad_events: {
        Row: {
          ad_id: string
          created_at: string
          id: number
          kind: string
          placement: string
          viewer_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: number
          kind: string
          placement: string
          viewer_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: number
          kind?: string
          placement?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ad_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_appeals: {
        Row: {
          appellant_id: string
          case_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          reason: string
          status: string
        }
        Insert: {
          appellant_id: string
          case_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason: string
          status?: string
        }
        Update: {
          appellant_id?: string
          case_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_appeals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          case_id: string | null
          created_at: string
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_cases: {
        Row: {
          category: string
          closed_at: string | null
          created_at: string
          escrow_group_id: string | null
          id: string
          mediator_id: string | null
          opened_at: string
          opener_id: string
          outcome: string | null
          outcome_note: string | null
          respondent_id: string | null
          ruled_at: string | null
          status: string
          summary: string
          trade_id: string | null
          updated_at: string
          value_usd: number
        }
        Insert: {
          category: string
          closed_at?: string | null
          created_at?: string
          escrow_group_id?: string | null
          id?: string
          mediator_id?: string | null
          opened_at?: string
          opener_id: string
          outcome?: string | null
          outcome_note?: string | null
          respondent_id?: string | null
          ruled_at?: string | null
          status?: string
          summary: string
          trade_id?: string | null
          updated_at?: string
          value_usd?: number
        }
        Update: {
          category?: string
          closed_at?: string | null
          created_at?: string
          escrow_group_id?: string | null
          id?: string
          mediator_id?: string | null
          opened_at?: string
          opener_id?: string
          outcome?: string | null
          outcome_note?: string | null
          respondent_id?: string | null
          ruled_at?: string | null
          status?: string
          summary?: string
          trade_id?: string | null
          updated_at?: string
          value_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_cases_escrow_group_id_fkey"
            columns: ["escrow_group_id"]
            isOneToOne: false
            referencedRelation: "escrow_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arbitration_cases_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_evidence: {
        Row: {
          case_id: string
          created_at: string
          file_path: string
          id: string
          mime: string | null
          note: string | null
          sha256: string
          size_bytes: number | null
          uploader_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          file_path: string
          id?: string
          mime?: string | null
          note?: string | null
          sha256: string
          size_bytes?: number | null
          uploader_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          file_path?: string
          id?: string
          mime?: string | null
          note?: string | null
          sha256?: string
          size_bytes?: number | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_messages: {
        Row: {
          body: string
          case_id: string
          created_at: string
          id: string
          sender_id: string
          staff_only: boolean
        }
        Insert: {
          body: string
          case_id: string
          created_at?: string
          id?: string
          sender_id: string
          staff_only?: boolean
        }
        Update: {
          body?: string
          case_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          staff_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_notes: {
        Row: {
          author_id: string
          body: string
          case_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          case_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          case_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_signoffs: {
        Row: {
          case_id: string
          created_at: string
          id: string
          signer_id: string
          signer_role: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          signer_id: string
          signer_role: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          signer_id?: string
          signer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_signoffs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitration_timeline: {
        Row: {
          actor_id: string | null
          body: string | null
          case_id: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          case_id: string
          created_at?: string
          id?: string
          kind: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          case_id?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitration_timeline_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "arbitration_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_metadata: {
        Row: {
          bin_number: string
          card_address: string | null
          card_bank: string | null
          card_brand: string | null
          card_country: string | null
          card_type: string | null
          created_at: string
          description: string | null
          updated_at: string
        }
        Insert: {
          bin_number: string
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_type?: string | null
          created_at?: string
          description?: string | null
          updated_at?: string
        }
        Update: {
          bin_number?: string
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_type?: string | null
          created_at?: string
          description?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bins: {
        Row: {
          bank: string
          bin: string
          brand: string
          card_level: string | null
          card_type: string | null
          country: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          bank: string
          bin: string
          brand: string
          card_level?: string | null
          card_type?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          bank?: string
          bin?: string
          brand?: string
          card_level?: string | null
          card_type?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount_sats: number | null
          btcpay_invoice_id: string | null
          confirmations: number
          confirmations_required: number
          created_at: string
          destination: string
          detected_at: string | null
          expires_at: string | null
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["deposit_method"]
          payment_hash: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_sats?: number | null
          btcpay_invoice_id?: string | null
          confirmations?: number
          confirmations_required?: number
          created_at?: string
          destination: string
          detected_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          method: Database["public"]["Enums"]["deposit_method"]
          payment_hash?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_sats?: number | null
          btcpay_invoice_id?: string | null
          confirmations?: number
          confirmations_required?: number
          created_at?: string
          destination?: string
          detected_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["deposit_method"]
          payment_hash?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_balances"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          id: string
          opened_by: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          trade_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened_by: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          trade_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opened_by?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_events: {
        Row: {
          created_at: string
          id: string
          invoice_id: string | null
          kind: string
          payload: Json
          trade_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind: string
          payload?: Json
          trade_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string | null
          kind?: string
          payload?: Json
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "escrow_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_events_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_group_members: {
        Row: {
          accepted_at: string | null
          declined_at: string | null
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["escrow_member_role"]
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          declined_at?: string | null
          group_id: string
          joined_at?: string
          role: Database["public"]["Enums"]["escrow_member_role"]
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          declined_at?: string | null
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["escrow_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "escrow_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_group_messages: {
        Row: {
          body: string
          created_at: string
          from_telegram: boolean
          group_id: string
          id: string
          is_system: boolean
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          from_telegram?: boolean
          group_id: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          from_telegram?: boolean
          group_id?: string
          id?: string
          is_system?: boolean
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escrow_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "escrow_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_groups: {
        Row: {
          amount: number
          asset: Database["public"]["Enums"]["asset_type"]
          bin_number: string | null
          card_address: string | null
          card_bank: string | null
          card_brand: string | null
          card_country: string | null
          card_number: string | null
          card_type: string | null
          card_user: string | null
          counterparty_id: string | null
          created_at: string
          creator_id: string
          cvv: string | null
          deposit_tx_hash: string | null
          deposit_verified_at: string | null
          escrow_address: string | null
          escrow_address_chain: string | null
          expire_date: string | null
          fiat_amount: number | null
          fiat_currency: string
          id: string
          invited_telegram: string | null
          invited_username: string | null
          listing_category: string | null
          listing_id: string | null
          listing_name: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["escrow_group_status"]
          telegram_chat_id: number | null
          telegram_link_token: string | null
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          asset: Database["public"]["Enums"]["asset_type"]
          bin_number?: string | null
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_number?: string | null
          card_type?: string | null
          card_user?: string | null
          counterparty_id?: string | null
          created_at?: string
          creator_id: string
          cvv?: string | null
          deposit_tx_hash?: string | null
          deposit_verified_at?: string | null
          escrow_address?: string | null
          escrow_address_chain?: string | null
          expire_date?: string | null
          fiat_amount?: number | null
          fiat_currency?: string
          id?: string
          invited_telegram?: string | null
          invited_username?: string | null
          listing_category?: string | null
          listing_id?: string | null
          listing_name?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_group_status"]
          telegram_chat_id?: number | null
          telegram_link_token?: string | null
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asset?: Database["public"]["Enums"]["asset_type"]
          bin_number?: string | null
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_number?: string | null
          card_type?: string | null
          card_user?: string | null
          counterparty_id?: string | null
          created_at?: string
          creator_id?: string
          cvv?: string | null
          deposit_tx_hash?: string | null
          deposit_verified_at?: string | null
          escrow_address?: string | null
          escrow_address_chain?: string | null
          expire_date?: string | null
          fiat_amount?: number | null
          fiat_currency?: string
          id?: string
          invited_telegram?: string | null
          invited_username?: string | null
          listing_category?: string | null
          listing_id?: string | null
          listing_name?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_group_status"]
          telegram_chat_id?: number | null
          telegram_link_token?: string | null
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      escrow_invoices: {
        Row: {
          amount_btc: number
          bitcoin_address: string | null
          btcpay_invoice_id: string
          confirmations: number
          created_at: string
          expires_at: string | null
          id: string
          lightning_invoice: string | null
          paid_amount_btc: number
          settled_at: string | null
          status: string
          trade_id: string
          updated_at: string
        }
        Insert: {
          amount_btc: number
          bitcoin_address?: string | null
          btcpay_invoice_id: string
          confirmations?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          lightning_invoice?: string | null
          paid_amount_btc?: number
          settled_at?: string | null
          status?: string
          trade_id: string
          updated_at?: string
        }
        Update: {
          amount_btc?: number
          bitcoin_address?: string | null
          btcpay_invoice_id?: string
          confirmations?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          lightning_invoice?: string | null
          paid_amount_btc?: number
          settled_at?: string | null
          status?: string
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_invoices_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_sats: number
          bucket: Database["public"]["Enums"]["ledger_bucket"]
          created_at: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          metadata: Json
          ref_id: string | null
          ref_type: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_sats: number
          bucket: Database["public"]["Enums"]["ledger_bucket"]
          created_at?: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          metadata?: Json
          ref_id?: string | null
          ref_type?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_sats?: number
          bucket?: Database["public"]["Enums"]["ledger_bucket"]
          created_at?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          metadata?: Json
          ref_id?: string | null
          ref_type?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_balances"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      link_previews: {
        Row: {
          description: string | null
          fetched_at: string
          image_url: string | null
          media_kind: string | null
          site_name: string | null
          title: string | null
          url: string
          video_url: string | null
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          image_url?: string | null
          media_kind?: string | null
          site_name?: string | null
          title?: string | null
          url: string
          video_url?: string | null
        }
        Update: {
          description?: string | null
          fetched_at?: string
          image_url?: string | null
          media_kind?: string | null
          site_name?: string | null
          title?: string | null
          url?: string
          video_url?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          amount: number | null
          card_style: number
          category: string
          contact_telegram: string | null
          contact_website: string | null
          created_at: string
          currency: string | null
          description: string
          id: string
          kind: Database["public"]["Enums"]["listing_kind"]
          name: string
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          card_style?: number
          category: string
          contact_telegram?: string | null
          contact_website?: string | null
          created_at?: string
          currency?: string | null
          description: string
          id?: string
          kind: Database["public"]["Enums"]["listing_kind"]
          name: string
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          card_style?: number
          category?: string
          contact_telegram?: string | null
          contact_website?: string | null
          created_at?: string
          currency?: string | null
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["listing_kind"]
          name?: string
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_products: {
        Row: {
          bin_number: string | null
          card_address: string | null
          card_bank: string | null
          card_brand: string | null
          card_country: string | null
          card_number: string | null
          card_style: number
          card_type: string | null
          card_user: string | null
          category: string
          created_at: string
          created_by: string
          currency: string
          cvv: string | null
          description: string
          expire_date: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_seeded: boolean
          name: string
          price: number
          seller_wallet_address: string | null
          seller_wallet_asset: string | null
          status: string
          stock: number
          updated_at: string
        }
        Insert: {
          bin_number?: string | null
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_number?: string | null
          card_style?: number
          card_type?: string | null
          card_user?: string | null
          category: string
          created_at?: string
          created_by: string
          currency?: string
          cvv?: string | null
          description: string
          expire_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_seeded?: boolean
          name: string
          price: number
          seller_wallet_address?: string | null
          seller_wallet_asset?: string | null
          status?: string
          stock?: number
          updated_at?: string
        }
        Update: {
          bin_number?: string | null
          card_address?: string | null
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_number?: string | null
          card_style?: number
          card_type?: string | null
          card_user?: string | null
          category?: string
          created_at?: string
          created_by?: string
          currency?: string
          cvv?: string | null
          description?: string
          expire_date?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_seeded?: boolean
          name?: string
          price?: number
          seller_wallet_address?: string | null
          seller_wallet_asset?: string | null
          status?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          in_app: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          telegram: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          in_app?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          telegram?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          in_app?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          telegram?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          payload: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          asset: Database["public"]["Enums"]["asset_type"]
          available_crypto: number
          created_at: string
          fiat_currency: string
          id: string
          maker_id: string
          max_amount: number
          min_amount: number
          payment_method_types: string[]
          price: number
          side: Database["public"]["Enums"]["offer_side"]
          status: Database["public"]["Enums"]["offer_status"]
          terms: string | null
          updated_at: string
        }
        Insert: {
          asset: Database["public"]["Enums"]["asset_type"]
          available_crypto: number
          created_at?: string
          fiat_currency: string
          id?: string
          maker_id: string
          max_amount: number
          min_amount: number
          payment_method_types?: string[]
          price: number
          side: Database["public"]["Enums"]["offer_side"]
          status?: Database["public"]["Enums"]["offer_status"]
          terms?: string | null
          updated_at?: string
        }
        Update: {
          asset?: Database["public"]["Enums"]["asset_type"]
          available_crypto?: number
          created_at?: string
          fiat_currency?: string
          id?: string
          maker_id?: string
          max_amount?: number
          min_amount?: number
          payment_method_types?: string[]
          price?: number
          side?: Database["public"]["Enums"]["offer_side"]
          status?: Database["public"]["Enums"]["offer_status"]
          terms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          details: string
          id: string
          is_active: boolean
          label: string
          method_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details: string
          id?: string
          is_active?: boolean
          label: string
          method_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          is_active?: boolean
          label?: string
          method_type?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_btc: number
          approved_by: string | null
          btcpay_payout_id: string | null
          created_at: string
          destination_address: string
          id: string
          kind: string
          note: string | null
          requested_by: string | null
          status: string
          trade_id: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount_btc: number
          approved_by?: string | null
          btcpay_payout_id?: string | null
          created_at?: string
          destination_address: string
          id?: string
          kind: string
          note?: string | null
          requested_by?: string | null
          status?: string
          trade_id: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount_btc?: number
          approved_by?: string | null
          btcpay_payout_id?: string | null
          created_at?: string
          destination_address?: string
          id?: string
          kind?: string
          note?: string | null
          requested_by?: string | null
          status?: string
          trade_id?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fees: {
        Row: {
          created_at: string
          fee_sats: number
          id: string
          metadata: Json
          source: string
          trade_id: string | null
        }
        Insert: {
          created_at?: string
          fee_sats: number
          id?: string
          metadata?: Json
          source: string
          trade_id?: string | null
        }
        Update: {
          created_at?: string
          fee_sats?: number
          id?: string
          metadata?: Json
          source?: string
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          bio: string | null
          btc_volume_usd: number
          created_at: string
          display_name: string
          distinct_partners: number
          five_star_count: number
          id: string
          is_banned: boolean
          is_premium: boolean
          is_trusted: boolean
          rating_count: number
          rating_sum: number
          telegram_user_id: number | null
          telegram_username: string | null
          trades_completed: number
          updated_at: string
          user_id: string
          wallet_address_btc: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          bio?: string | null
          btc_volume_usd?: number
          created_at?: string
          display_name: string
          distinct_partners?: number
          five_star_count?: number
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          is_trusted?: boolean
          rating_count?: number
          rating_sum?: number
          telegram_user_id?: number | null
          telegram_username?: string | null
          trades_completed?: number
          updated_at?: string
          user_id: string
          wallet_address_btc?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          bio?: string | null
          btc_volume_usd?: number
          created_at?: string
          display_name?: string
          distinct_partners?: number
          five_star_count?: number
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          is_trusted?: boolean
          rating_count?: number
          rating_sum?: number
          telegram_user_id?: number | null
          telegram_username?: string | null
          trades_completed?: number
          updated_at?: string
          user_id?: string
          wallet_address_btc?: string | null
        }
        Relationships: []
      }
      shoutbox_messages: {
        Row: {
          body: string
          btc_confirmations: number
          created_at: string
          display_name: string
          id: string
          is_hidden: boolean
          is_pinned: boolean
          paid_amount_usd: number | null
          payment_method: string | null
          payment_txid: string | null
          report_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          body: string
          btc_confirmations?: number
          created_at?: string
          display_name: string
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          paid_amount_usd?: number | null
          payment_method?: string | null
          payment_txid?: string | null
          report_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          btc_confirmations?: number
          created_at?: string
          display_name?: string
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          paid_amount_usd?: number | null
          payment_method?: string | null
          payment_txid?: string | null
          report_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      shoutbox_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoutbox_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "shoutbox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trade_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_system: boolean
          sender_id: string
          trade_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id: string
          trade_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_system?: boolean
          sender_id?: string
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_messages_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          stars: number
          trade_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          stars: number
          trade_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          stars?: number
          trade_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset: Database["public"]["Enums"]["asset_type"]
          buyer_id: string
          buyer_payout_address: string | null
          cancelled_at: string | null
          created_at: string
          crypto_amount: number
          deposit_confirmed_at: string | null
          deposit_tx_hash: string | null
          fee_amount: number
          fiat_amount: number
          fiat_currency: string
          id: string
          offer_id: string
          paid_at: string | null
          payment_method_id: string | null
          payment_window_minutes: number
          price: number
          released_at: string | null
          seller_id: string
          seller_payout_address: string | null
          signature_buyer: string | null
          signature_seller: string | null
          signed_by_buyer_at: string | null
          signed_by_seller_at: string | null
          status: Database["public"]["Enums"]["trade_status"]
          terms_buyer: string | null
          terms_seller: string | null
          updated_at: string
        }
        Insert: {
          asset: Database["public"]["Enums"]["asset_type"]
          buyer_id: string
          buyer_payout_address?: string | null
          cancelled_at?: string | null
          created_at?: string
          crypto_amount: number
          deposit_confirmed_at?: string | null
          deposit_tx_hash?: string | null
          fee_amount?: number
          fiat_amount: number
          fiat_currency: string
          id?: string
          offer_id: string
          paid_at?: string | null
          payment_method_id?: string | null
          payment_window_minutes?: number
          price: number
          released_at?: string | null
          seller_id: string
          seller_payout_address?: string | null
          signature_buyer?: string | null
          signature_seller?: string | null
          signed_by_buyer_at?: string | null
          signed_by_seller_at?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          terms_buyer?: string | null
          terms_seller?: string | null
          updated_at?: string
        }
        Update: {
          asset?: Database["public"]["Enums"]["asset_type"]
          buyer_id?: string
          buyer_payout_address?: string | null
          cancelled_at?: string | null
          created_at?: string
          crypto_amount?: number
          deposit_confirmed_at?: string | null
          deposit_tx_hash?: string | null
          fee_amount?: number
          fiat_amount?: number
          fiat_currency?: string
          id?: string
          offer_id?: string
          paid_at?: string | null
          payment_method_id?: string | null
          payment_window_minutes?: number
          price?: number
          released_at?: string | null
          seller_id?: string
          seller_payout_address?: string | null
          signature_buyer?: string | null
          signature_seller?: string | null
          signed_by_buyer_at?: string | null
          signed_by_seller_at?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          terms_buyer?: string | null
          terms_seller?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          created_at: string
          freeze_reason: string | null
          id: string
          is_frozen: boolean
          updated_at: string
          user_id: string
          wallet_code: string
        }
        Insert: {
          created_at?: string
          freeze_reason?: string | null
          id?: string
          is_frozen?: boolean
          updated_at?: string
          user_id: string
          wallet_code?: string
        }
        Update: {
          created_at?: string
          freeze_reason?: string | null
          id?: string
          is_frozen?: boolean
          updated_at?: string
          user_id?: string
          wallet_code?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          issued_by: string
          reason: string
          severity: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by: string
          reason: string
          severity?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string
          reason?: string
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: unknown
          payload: Json
          ref_id: string | null
          ref_type: string | null
          risk_score: number
          user_agent: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip?: unknown
          payload?: Json
          ref_id?: string | null
          ref_type?: string | null
          risk_score?: number
          user_agent?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: unknown
          payload?: Json
          ref_id?: string | null
          ref_type?: string | null
          risk_score?: number
          user_agent?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_audit_log_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_audit_log_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_balances"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          asset: Database["public"]["Enums"]["asset_type"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          note: string | null
          trade_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asset: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["tx_kind"]
          note?: string | null
          trade_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asset?: Database["public"]["Enums"]["asset_type"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          note?: string | null
          trade_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          asset: Database["public"]["Enums"]["asset_type"]
          available: number
          created_at: string
          escrow: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset: Database["public"]["Enums"]["asset_type"]
          available?: number
          created_at?: string
          escrow?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: Database["public"]["Enums"]["asset_type"]
          available?: number
          created_at?: string
          escrow?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_sats: number
          approved_at: string | null
          approved_by: string | null
          btcpay_payout_id: string | null
          created_at: string
          destination: string
          fee_sats: number
          id: string
          metadata: Json
          method: Database["public"]["Enums"]["withdrawal_method"]
          payment_hash: string | null
          rejected_reason: string | null
          requires_2fa: boolean
          risk_score: number
          status: Database["public"]["Enums"]["withdrawal_status"]
          two_fa_verified_at: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_sats: number
          approved_at?: string | null
          approved_by?: string | null
          btcpay_payout_id?: string | null
          created_at?: string
          destination: string
          fee_sats?: number
          id?: string
          metadata?: Json
          method: Database["public"]["Enums"]["withdrawal_method"]
          payment_hash?: string | null
          rejected_reason?: string | null
          requires_2fa?: boolean
          risk_score?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          two_fa_verified_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_sats?: number
          approved_at?: string | null
          approved_by?: string | null
          btcpay_payout_id?: string | null
          created_at?: string
          destination?: string
          fee_sats?: number
          id?: string
          metadata?: Json
          method?: Database["public"]["Enums"]["withdrawal_method"]
          payment_hash?: string | null
          rejected_reason?: string | null
          requires_2fa?: boolean
          risk_score?: number
          status?: Database["public"]["Enums"]["withdrawal_status"]
          two_fa_verified_at?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "v_wallet_balances"
            referencedColumns: ["wallet_id"]
          },
        ]
      }
    }
    Views: {
      v_wallet_balances: {
        Row: {
          available_sats: number | null
          locked_escrow_sats: number | null
          pending_deposit_sats: number | null
          pending_withdrawal_sats: number | null
          user_id: string | null
          wallet_code: string | null
          wallet_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _ledger_insert: {
        Args: {
          _amount_sats: number
          _bucket: Database["public"]["Enums"]["ledger_bucket"]
          _direction: Database["public"]["Enums"]["ledger_direction"]
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _metadata: Json
          _ref_id: string
          _ref_type: string
          _user_id: string
          _wallet_id: string
        }
        Returns: string
      }
      ad_analytics: {
        Args: { _since?: string }
        Returns: {
          ad_id: string
          clicks: number
          ctr: number
          impressions: number
          placements: string[]
          title: string
        }[]
      }
      assign_role: {
        Args: {
          _caller: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      ban_user: {
        Args: { _caller: string; _reason: string; _target: string }
        Returns: undefined
      }
      cancel_trade: {
        Args: { _caller: string; _trade_id: string }
        Returns: undefined
      }
      compute_fee_bps: { Args: { _fiat_amount: number }; Returns: number }
      confirm_buyer_deposit: {
        Args: { _caller: string; _trade_id: string }
        Returns: undefined
      }
      credit_wallet: {
        Args: {
          _amount: number
          _asset: Database["public"]["Enums"]["asset_type"]
          _note: string
          _user: string
        }
        Returns: undefined
      }
      debit_wallet: {
        Args: {
          _amount: number
          _asset: Database["public"]["Enums"]["asset_type"]
          _note: string
          _user: string
        }
        Returns: undefined
      }
      get_my_private_profile: {
        Args: never
        Returns: {
          telegram_user_id: number
          telegram_username: string
          wallet_address_btc: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_arbiter: { Args: { _user_id: string }; Returns: boolean }
      is_case_party: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      ledger_credit: {
        Args: {
          _amount_sats: number
          _bucket: Database["public"]["Enums"]["ledger_bucket"]
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _metadata?: Json
          _ref_id: string
          _ref_type: string
          _user_id: string
        }
        Returns: string
      }
      ledger_debit: {
        Args: {
          _amount_sats: number
          _bucket: Database["public"]["Enums"]["ledger_bucket"]
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _metadata?: Json
          _ref_id: string
          _ref_type: string
          _user_id: string
        }
        Returns: string
      }
      ledger_transfer_bucket: {
        Args: {
          _amount_sats: number
          _from: Database["public"]["Enums"]["ledger_bucket"]
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _metadata?: Json
          _ref_id: string
          _ref_type: string
          _to: Database["public"]["Enums"]["ledger_bucket"]
          _user_id: string
        }
        Returns: undefined
      }
      ledger_transfer_user: {
        Args: {
          _amount_sats: number
          _from_bucket: Database["public"]["Enums"]["ledger_bucket"]
          _from_user: string
          _kind: Database["public"]["Enums"]["ledger_kind"]
          _metadata?: Json
          _ref_id: string
          _ref_type: string
          _to_bucket: Database["public"]["Enums"]["ledger_bucket"]
          _to_user: string
        }
        Returns: undefined
      }
      mark_trade_paid: {
        Args: { _caller: string; _trade_id: string }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _body?: string
          _kind: Database["public"]["Enums"]["notification_kind"]
          _link?: string
          _payload?: Json
          _title: string
          _user: string
        }
        Returns: string
      }
      open_dispute: {
        Args: { _caller: string; _reason: string; _trade_id: string }
        Returns: string
      }
      recompute_user_badges: { Args: { _user: string }; Returns: undefined }
      release_trade: {
        Args: { _caller: string; _trade_id: string }
        Returns: undefined
      }
      resolve_dispute: {
        Args: {
          _award_to: string
          _caller: string
          _note: string
          _trade_id: string
        }
        Returns: undefined
      }
      revoke_role: {
        Args: {
          _caller: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      sign_terms: {
        Args: {
          _caller: string
          _signature: string
          _terms: string
          _trade_id: string
        }
        Returns: undefined
      }
      start_trade: {
        Args: {
          _buyer: string
          _fiat_amount: number
          _offer_id: string
          _payment_method_id: string
        }
        Returns: string
      }
      unban_user: {
        Args: { _caller: string; _target: string }
        Returns: undefined
      }
      wallet_audit: {
        Args: {
          _action: string
          _ip?: unknown
          _payload?: Json
          _ref_id?: string
          _ref_type?: string
          _risk_score?: number
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      warn_user: {
        Args: {
          _caller: string
          _reason: string
          _severity: string
          _target: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "judge"
        | "finance"
        | "support"
        | "mediator"
        | "senior_arbitrator"
        | "super_admin"
      asset_type: "BTC"
      deposit_method: "btc_onchain" | "lightning" | "flutterwave"
      deposit_status:
        | "new"
        | "detected"
        | "confirming"
        | "settled"
        | "expired"
        | "invalid"
      dispute_status: "open" | "resolved_buyer" | "resolved_seller"
      escrow_group_status:
        | "awaiting_counterparty"
        | "active"
        | "funded"
        | "released"
        | "cancelled"
        | "disputed"
      escrow_member_role: "buyer" | "seller" | "moderator"
      ledger_bucket:
        | "available"
        | "locked_escrow"
        | "pending_deposit"
        | "pending_withdrawal"
      ledger_direction: "credit" | "debit"
      ledger_kind:
        | "deposit"
        | "withdrawal"
        | "escrow_funding"
        | "escrow_release"
        | "refund"
        | "marketplace_purchase"
        | "marketplace_sale"
        | "fee"
        | "bonus"
        | "admin_adjustment"
        | "bucket_transfer"
      listing_kind: "selling" | "seeking"
      listing_status: "active" | "inactive" | "sold"
      notification_kind:
        | "escrow_invoice_created"
        | "escrow_payment_detected"
        | "escrow_settled"
        | "escrow_expired"
        | "trade_signed"
        | "trade_paid"
        | "trade_released"
        | "trade_cancelled"
        | "dispute_opened"
        | "dispute_resolved"
        | "arbitration_update"
        | "wallet_credit"
        | "wallet_debit"
        | "admin_warning"
        | "admin_ban"
        | "system"
      offer_side: "buy" | "sell"
      offer_status: "active" | "paused" | "closed"
      trade_status:
        | "pending_payment"
        | "paid"
        | "released"
        | "cancelled"
        | "disputed"
        | "awaiting_agreement"
        | "awaiting_deposit"
        | "awaiting_seller_confirm"
      tx_kind:
        | "deposit"
        | "withdraw"
        | "escrow_lock"
        | "escrow_release"
        | "escrow_refund"
        | "fee"
        | "adjustment"
      withdrawal_method: "btc_onchain" | "lightning" | "flutterwave"
      withdrawal_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "judge",
        "finance",
        "support",
        "mediator",
        "senior_arbitrator",
        "super_admin",
      ],
      asset_type: ["BTC"],
      deposit_method: ["btc_onchain", "lightning", "flutterwave"],
      deposit_status: [
        "new",
        "detected",
        "confirming",
        "settled",
        "expired",
        "invalid",
      ],
      dispute_status: ["open", "resolved_buyer", "resolved_seller"],
      escrow_group_status: [
        "awaiting_counterparty",
        "active",
        "funded",
        "released",
        "cancelled",
        "disputed",
      ],
      escrow_member_role: ["buyer", "seller", "moderator"],
      ledger_bucket: [
        "available",
        "locked_escrow",
        "pending_deposit",
        "pending_withdrawal",
      ],
      ledger_direction: ["credit", "debit"],
      ledger_kind: [
        "deposit",
        "withdrawal",
        "escrow_funding",
        "escrow_release",
        "refund",
        "marketplace_purchase",
        "marketplace_sale",
        "fee",
        "bonus",
        "admin_adjustment",
        "bucket_transfer",
      ],
      listing_kind: ["selling", "seeking"],
      listing_status: ["active", "inactive", "sold"],
      notification_kind: [
        "escrow_invoice_created",
        "escrow_payment_detected",
        "escrow_settled",
        "escrow_expired",
        "trade_signed",
        "trade_paid",
        "trade_released",
        "trade_cancelled",
        "dispute_opened",
        "dispute_resolved",
        "arbitration_update",
        "wallet_credit",
        "wallet_debit",
        "admin_warning",
        "admin_ban",
        "system",
      ],
      offer_side: ["buy", "sell"],
      offer_status: ["active", "paused", "closed"],
      trade_status: [
        "pending_payment",
        "paid",
        "released",
        "cancelled",
        "disputed",
        "awaiting_agreement",
        "awaiting_deposit",
        "awaiting_seller_confirm",
      ],
      tx_kind: [
        "deposit",
        "withdraw",
        "escrow_lock",
        "escrow_release",
        "escrow_refund",
        "fee",
        "adjustment",
      ],
      withdrawal_method: ["btc_onchain", "lightning", "flutterwave"],
      withdrawal_status: [
        "pending_review",
        "approved",
        "rejected",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
