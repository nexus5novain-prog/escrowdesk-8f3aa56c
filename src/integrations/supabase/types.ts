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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          link: string | null
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      areas: {
        Row: {
          city_id: string
          id: string
          name: string
          postal_code: string | null
        }
        Insert: {
          city_id: string
          id?: string
          name: string
          postal_code?: string | null
        }
        Update: {
          city_id?: string
          id?: string
          name?: string
          postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_import_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          rows_added: number
          rows_skipped: number
          rows_updated: number
          run_by: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          rows_added?: number
          rows_skipped?: number
          rows_updated?: number
          run_by?: string | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          rows_added?: number
          rows_skipped?: number
          rows_updated?: number
          run_by?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
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
      cities: {
        Row: {
          id: string
          name: string
          state_id: string
        }
        Insert: {
          id?: string
          name: string
          state_id: string
        }
        Update: {
          id?: string
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          currency: string | null
          name: string
          phone_prefix: string | null
          region_code: string
          sort_order: number
        }
        Insert: {
          code: string
          currency?: string | null
          name: string
          phone_prefix?: string | null
          region_code: string
          sort_order?: number
        }
        Update: {
          code?: string
          currency?: string | null
          name?: string
          phone_prefix?: string | null
          region_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "countries_region_code_fkey"
            columns: ["region_code"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["code"]
          },
        ]
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
          tg_chat_id: number | null
          tg_message_id: number | null
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
          tg_chat_id?: number | null
          tg_message_id?: number | null
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
          tg_chat_id?: number | null
          tg_message_id?: number | null
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      escrow_deals: {
        Row: {
          amount: number
          buyer_email: string | null
          buyer_id: string | null
          created_at: string
          creator_id: string
          currency: string
          deal_type: Database["public"]["Enums"]["escrow_deal_type"]
          description: string | null
          expected_delivery_at: string | null
          id: string
          location_city: string | null
          location_country: string | null
          location_state: string | null
          metadata: Json
          reference: string
          seller_email: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["escrow_deal_status"]
          terms: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_email?: string | null
          buyer_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          deal_type: Database["public"]["Enums"]["escrow_deal_type"]
          description?: string | null
          expected_delivery_at?: string | null
          id?: string
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          metadata?: Json
          reference?: string
          seller_email?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["escrow_deal_status"]
          terms?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_email?: string | null
          buyer_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          deal_type?: Database["public"]["Enums"]["escrow_deal_type"]
          description?: string | null
          expected_delivery_at?: string | null
          id?: string
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          metadata?: Json
          reference?: string
          seller_email?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["escrow_deal_status"]
          terms?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          card_bank: string | null
          card_brand: string | null
          card_country: string | null
          card_type: string | null
          card_user: string | null
          counterparty_id: string | null
          created_at: string
          creator_id: string
          deposit_tx_hash: string | null
          deposit_verified_at: string | null
          deprecated_at: string
          escrow_address: string | null
          escrow_address_chain: string | null
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
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_type?: string | null
          card_user?: string | null
          counterparty_id?: string | null
          created_at?: string
          creator_id: string
          deposit_tx_hash?: string | null
          deposit_verified_at?: string | null
          deprecated_at?: string
          escrow_address?: string | null
          escrow_address_chain?: string | null
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
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_type?: string | null
          card_user?: string | null
          counterparty_id?: string | null
          created_at?: string
          creator_id?: string
          deposit_tx_hash?: string | null
          deposit_verified_at?: string | null
          deprecated_at?: string
          escrow_address?: string | null
          escrow_address_chain?: string | null
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
      escrow_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          deal_id: string
          expires_at: string
          id: string
          invited_by: string
          invited_email: string | null
          role: Database["public"]["Enums"]["escrow_party_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          deal_id: string
          expires_at?: string
          id?: string
          invited_by: string
          invited_email?: string | null
          role: Database["public"]["Enums"]["escrow_party_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          deal_id?: string
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["escrow_party_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_invitations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "escrow_deals"
            referencedColumns: ["id"]
          },
        ]
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
          is_pinned: boolean
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
          is_pinned?: boolean
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
          is_pinned?: boolean
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
          card_bank: string | null
          card_brand: string | null
          card_country: string | null
          card_style: number
          card_type: string | null
          card_user: string | null
          category: string
          created_at: string
          created_by: string
          currency: string
          description: string
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
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_style?: number
          card_type?: string | null
          card_user?: string | null
          category: string
          created_at?: string
          created_by: string
          currency?: string
          description: string
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
          card_bank?: string | null
          card_brand?: string | null
          card_country?: string | null
          card_style?: number
          card_type?: string | null
          card_user?: string | null
          category?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
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
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          source: string | null
          subscribed_at: string
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          source?: string | null
          subscribed_at?: string
          unsubscribed_at?: string | null
          user_id?: string | null
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
          default_withdrawal_method: string
          display_name: string
          distinct_partners: number
          email_public: boolean
          five_star_count: number
          id: string
          is_banned: boolean
          is_premium: boolean
          is_trusted: boolean
          locale: string
          preferred_currency: string
          rating_count: number
          rating_sum: number
          show_online_status: boolean
          show_trade_history: boolean
          suspended_until: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          tg_pending_prompts: Json
          tg_withdraw_daily_cap_sats: number | null
          timezone: string
          totp_enabled_at: string | null
          totp_last_step: number | null
          totp_secret: string | null
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
          default_withdrawal_method?: string
          display_name: string
          distinct_partners?: number
          email_public?: boolean
          five_star_count?: number
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          is_trusted?: boolean
          locale?: string
          preferred_currency?: string
          rating_count?: number
          rating_sum?: number
          show_online_status?: boolean
          show_trade_history?: boolean
          suspended_until?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tg_pending_prompts?: Json
          tg_withdraw_daily_cap_sats?: number | null
          timezone?: string
          totp_enabled_at?: string | null
          totp_last_step?: number | null
          totp_secret?: string | null
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
          default_withdrawal_method?: string
          display_name?: string
          distinct_partners?: number
          email_public?: boolean
          five_star_count?: number
          id?: string
          is_banned?: boolean
          is_premium?: boolean
          is_trusted?: boolean
          locale?: string
          preferred_currency?: string
          rating_count?: number
          rating_sum?: number
          show_online_status?: boolean
          show_trade_history?: boolean
          suspended_until?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          tg_pending_prompts?: Json
          tg_withdraw_daily_cap_sats?: number | null
          timezone?: string
          totp_enabled_at?: string | null
          totp_last_step?: number | null
          totp_secret?: string | null
          trades_completed?: number
          updated_at?: string
          user_id?: string
          wallet_address_btc?: string | null
        }
        Relationships: []
      }
      reconciliation_drift: {
        Row: {
          actual_sats: number | null
          created_at: string
          details: Json
          expected_sats: number | null
          id: string
          kind: string
          ref_id: string | null
          ref_type: string | null
          resolution_note: string | null
          resolved_at: string | null
          run_id: string
          severity: string
        }
        Insert: {
          actual_sats?: number | null
          created_at?: string
          details?: Json
          expected_sats?: number | null
          id?: string
          kind: string
          ref_id?: string | null
          ref_type?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          run_id: string
          severity?: string
        }
        Update: {
          actual_sats?: number | null
          created_at?: string
          details?: Json
          expected_sats?: number | null
          id?: string
          kind?: string
          ref_id?: string | null
          ref_type?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          run_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_drift_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          checks_run: number
          drift_count: number
          finished_at: string | null
          id: string
          started_at: string
          status: string
          summary: Json
        }
        Insert: {
          checks_run?: number
          drift_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json
        }
        Update: {
          checks_run?: number
          drift_count?: number
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      regions: {
        Row: {
          code: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          name?: string
          sort_order?: number
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
      states: {
        Row: {
          code: string | null
          country_code: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          country_code: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          country_code?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "states_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          created_at: string
          email: string
          id: string
          message: string
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
      tg_escrow_deals: {
        Row: {
          buyer_address: string | null
          buyer_tg_id: number | null
          buyer_username: string | null
          completed_at: string | null
          created_at: string
          creator_tg_id: number
          creator_username: string | null
          deal_id: string
          deposited_amount: number
          escrow_address: string | null
          funded_at: string | null
          group_id: number | null
          group_link: string | null
          network: string | null
          seller_address: string | null
          seller_tg_id: number | null
          seller_username: string | null
          status: string
          txid: string | null
          updated_at: string
        }
        Insert: {
          buyer_address?: string | null
          buyer_tg_id?: number | null
          buyer_username?: string | null
          completed_at?: string | null
          created_at?: string
          creator_tg_id: number
          creator_username?: string | null
          deal_id: string
          deposited_amount?: number
          escrow_address?: string | null
          funded_at?: string | null
          group_id?: number | null
          group_link?: string | null
          network?: string | null
          seller_address?: string | null
          seller_tg_id?: number | null
          seller_username?: string | null
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Update: {
          buyer_address?: string | null
          buyer_tg_id?: number | null
          buyer_username?: string | null
          completed_at?: string | null
          created_at?: string
          creator_tg_id?: number
          creator_username?: string | null
          deal_id?: string
          deposited_amount?: number
          escrow_address?: string | null
          funded_at?: string | null
          group_id?: number | null
          group_link?: string | null
          network?: string | null
          seller_address?: string | null
          seller_tg_id?: number | null
          seller_username?: string | null
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      totp_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      totp_used_steps: {
        Row: {
          step: number
          used_at: string
          user_id: string
        }
        Insert: {
          step: number
          used_at?: string
          user_id: string
        }
        Update: {
          step?: number
          used_at?: string
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
      user_api_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
          user_id?: string
        }
        Relationships: []
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
      user_security_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          kind: string
          metadata: Json
          severity: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          kind: string
          metadata?: Json
          severity?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          kind?: string
          metadata?: Json
          severity?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_trusted_devices: {
        Row: {
          device_fingerprint: string
          id: string
          ip: string | null
          label: string | null
          last_seen_at: string
          revoked_at: string | null
          trusted_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_fingerprint: string
          id?: string
          ip?: string | null
          label?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          trusted_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_fingerprint?: string
          id?: string
          ip?: string | null
          label?: string | null
          last_seen_at?: string
          revoked_at?: string | null
          trusted_at?: string
          user_agent?: string | null
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
      user_withdrawal_policy: {
        Row: {
          allowed_ip_cidrs: string[]
          cooldown_hours: number
          daily_limit_sats: number
          notify_email: boolean
          notify_telegram: boolean
          per_tx_limit_sats: number
          require_2fa_above_sats: number
          updated_at: string
          user_id: string
          whitelist_addresses: string[]
          whitelist_only: boolean
        }
        Insert: {
          allowed_ip_cidrs?: string[]
          cooldown_hours?: number
          daily_limit_sats?: number
          notify_email?: boolean
          notify_telegram?: boolean
          per_tx_limit_sats?: number
          require_2fa_above_sats?: number
          updated_at?: string
          user_id: string
          whitelist_addresses?: string[]
          whitelist_only?: boolean
        }
        Update: {
          allowed_ip_cidrs?: string[]
          cooldown_hours?: number
          daily_limit_sats?: number
          notify_email?: boolean
          notify_telegram?: boolean
          per_tx_limit_sats?: number
          require_2fa_above_sats?: number
          updated_at?: string
          user_id?: string
          whitelist_addresses?: string[]
          whitelist_only?: boolean
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
      webhook_deliveries: {
        Row: {
          delivery_id: string
          event_type: string | null
          id: string
          invoice_id: string | null
          payload: Json
          processed_at: string
          result: Json | null
          source: string
          webhook_id: string | null
        }
        Insert: {
          delivery_id: string
          event_type?: string | null
          id?: string
          invoice_id?: string | null
          payload?: Json
          processed_at?: string
          result?: Json | null
          source: string
          webhook_id?: string | null
        }
        Update: {
          delivery_id?: string
          event_type?: string | null
          id?: string
          invoice_id?: string | null
          payload?: Json
          processed_at?: string
          result?: Json | null
          source?: string
          webhook_id?: string | null
        }
        Relationships: []
      }
      withdrawal_approvals: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          note: string | null
          withdrawal_id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          note?: string | null
          withdrawal_id: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          note?: string | null
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_approvals_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
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
          tg_chat_id: number | null
          tg_message_id: number | null
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
          tg_chat_id?: number | null
          tg_message_id?: number | null
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
          tg_chat_id?: number | null
          tg_message_id?: number | null
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
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          btc_volume_usd: number | null
          created_at: string | null
          display_name: string | null
          distinct_partners: number | null
          five_star_count: number | null
          is_premium: boolean | null
          is_trusted: boolean | null
          rating_count: number | null
          rating_sum: number | null
          show_online_status: boolean | null
          show_trade_history: boolean | null
          trades_completed: number | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          btc_volume_usd?: number | null
          created_at?: string | null
          display_name?: string | null
          distinct_partners?: number | null
          five_star_count?: number | null
          is_premium?: boolean | null
          is_trusted?: boolean | null
          rating_count?: number | null
          rating_sum?: number | null
          show_online_status?: boolean | null
          show_trade_history?: boolean | null
          trades_completed?: number | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          btc_volume_usd?: number | null
          created_at?: string | null
          display_name?: string | null
          distinct_partners?: number | null
          five_star_count?: number | null
          is_premium?: boolean | null
          is_trusted?: boolean | null
          rating_count?: number | null
          rating_sum?: number | null
          show_online_status?: boolean | null
          show_trade_history?: boolean | null
          trades_completed?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      admin_approve_withdrawal: {
        Args: { _admin: string; _note?: string; _withdrawal_id: string }
        Returns: undefined
      }
      admin_mark_withdrawal_paid: {
        Args: {
          _admin: string
          _payment_hash?: string
          _tx_hash?: string
          _withdrawal_id: string
        }
        Returns: undefined
      }
      admin_reject_withdrawal: {
        Args: { _admin: string; _reason: string; _withdrawal_id: string }
        Returns: undefined
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
      buy_listing: {
        Args: { _btc_rate: number; _buyer: string; _listing_id: string }
        Returns: string
      }
      buy_marketplace_product: {
        Args: { _btc_rate: number; _buyer: string; _product_id: string }
        Returns: string
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      is_user_blocked: { Args: { _user: string }; Returns: boolean }
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
      log_security_event: {
        Args: {
          _ip?: string
          _kind: string
          _metadata?: Json
          _severity?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      mark_trade_paid: {
        Args: { _caller: string; _trade_id: string }
        Returns: undefined
      }
      marketplace_products_fiat_currency_or_default: {
        Args: { _currency: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
      resolve_drift: {
        Args: { _id: string; _note: string }
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
      run_reconciliation: { Args: never; Returns: string }
      settle_deposit_atomic:
        | {
            Args: {
              _confirmations: number
              _delivery_id: string
              _deposit_id: string
              _event_type: string
              _invoice_id: string
              _next_status: string
              _paid_sats: number
              _payload: Json
              _webhook_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              _confirmations: number
              _delivery_id: string
              _deposit_id: string
              _event_type: string
              _invoice_id: string
              _next_status: string
              _paid_sats: number
              _payload: Json
              _payment_hash?: string
              _webhook_id: string
            }
            Returns: Json
          }
      settle_escrow_invoice_atomic: {
        Args: {
          _btcpay_invoice_id: string
          _confirmations: number
          _delivery_id: string
          _event_type: string
          _invoice_id: string
          _next_status: string
          _paid_btc: number
          _paid_sats: number
          _payload: Json
          _webhook_id: string
        }
        Returns: Json
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
      tg_withdrawal_24h_sats: { Args: { _user: string }; Returns: number }
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
      escrow_deal_status:
        | "draft"
        | "invited"
        | "accepted"
        | "terms_pending"
        | "funded"
        | "in_progress"
        | "delivered"
        | "inspecting"
        | "released"
        | "disputed"
        | "cancelled"
        | "refunded"
        | "settled"
      escrow_deal_type:
        | "marketplace"
        | "product"
        | "service"
        | "vehicle"
        | "property"
        | "freelance"
        | "invoice"
        | "business"
        | "import_export"
        | "construction"
        | "milestone"
        | "digital_product"
        | "domain"
        | "website"
        | "software"
        | "crypto"
        | "equipment"
        | "trade"
        | "investment"
        | "custom"
      escrow_group_status:
        | "awaiting_counterparty"
        | "active"
        | "funded"
        | "released"
        | "cancelled"
        | "disputed"
      escrow_member_role: "buyer" | "seller" | "moderator"
      escrow_party_role: "buyer" | "seller" | "mediator" | "observer"
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
        | "withdrawal_cancelled"
        | "escrow_lock"
        | "escrow_refund"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      escrow_deal_status: [
        "draft",
        "invited",
        "accepted",
        "terms_pending",
        "funded",
        "in_progress",
        "delivered",
        "inspecting",
        "released",
        "disputed",
        "cancelled",
        "refunded",
        "settled",
      ],
      escrow_deal_type: [
        "marketplace",
        "product",
        "service",
        "vehicle",
        "property",
        "freelance",
        "invoice",
        "business",
        "import_export",
        "construction",
        "milestone",
        "digital_product",
        "domain",
        "website",
        "software",
        "crypto",
        "equipment",
        "trade",
        "investment",
        "custom",
      ],
      escrow_group_status: [
        "awaiting_counterparty",
        "active",
        "funded",
        "released",
        "cancelled",
        "disputed",
      ],
      escrow_member_role: ["buyer", "seller", "moderator"],
      escrow_party_role: ["buyer", "seller", "mediator", "observer"],
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
        "withdrawal_cancelled",
        "escrow_lock",
        "escrow_refund",
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
