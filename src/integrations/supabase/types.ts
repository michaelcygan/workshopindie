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
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_broadcasts: {
        Row: {
          audience: Json
          body: string
          id: string
          recipients_count: number
          sent_at: string
          sent_by: string
          title: string
        }
        Insert: {
          audience?: Json
          body: string
          id?: string
          recipients_count?: number
          sent_at?: string
          sent_by: string
          title: string
        }
        Update: {
          audience?: Json
          body?: string
          id?: string
          recipients_count?: number
          sent_at?: string
          sent_by?: string
          title?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          country: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          slug: string
          state_region: string | null
          timezone: string | null
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          slug: string
          state_region?: string | null
          timezone?: string | null
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          slug?: string
          state_region?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      collab_boosts: {
        Row: {
          collab_post_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          collab_post_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          collab_post_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_boosts_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_contact_events: {
        Row: {
          collab_post_id: string
          collab_role_id: string | null
          id: string
          message_preview: string | null
          sender_user_id: string
          sent_at: string
        }
        Insert: {
          collab_post_id: string
          collab_role_id?: string | null
          id?: string
          message_preview?: string | null
          sender_user_id: string
          sent_at?: string
        }
        Update: {
          collab_post_id?: string
          collab_role_id?: string | null
          id?: string
          message_preview?: string | null
          sender_user_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_contact_events_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_contact_events_collab_role_id_fkey"
            columns: ["collab_role_id"]
            isOneToOne: false
            referencedRelation: "collab_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_contact_events_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_dm_allowances: {
        Row: {
          applicant_user_id: string
          collab_post_id: string
          created_at: string
          owner_user_id: string
        }
        Insert: {
          applicant_user_id: string
          collab_post_id: string
          created_at?: string
          owner_user_id: string
        }
        Update: {
          applicant_user_id?: string
          collab_post_id?: string
          created_at?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_dm_allowances_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_guest_applications: {
        Row: {
          claim_token: string | null
          claim_token_expires_at: string | null
          collab_post_id: string
          collab_role_id: string | null
          contacted_at: string | null
          created_at: string
          email: string
          id: string
          instagram_handle: string | null
          ip_hash: string | null
          matched_at: string | null
          matched_user_id: string | null
          message: string
          name: string
          phone: string | null
          portfolio_url: string | null
          reel_url: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          claim_token?: string | null
          claim_token_expires_at?: string | null
          collab_post_id: string
          collab_role_id?: string | null
          contacted_at?: string | null
          created_at?: string
          email: string
          id?: string
          instagram_handle?: string | null
          ip_hash?: string | null
          matched_at?: string | null
          matched_user_id?: string | null
          message: string
          name: string
          phone?: string | null
          portfolio_url?: string | null
          reel_url?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          claim_token?: string | null
          claim_token_expires_at?: string | null
          collab_post_id?: string
          collab_role_id?: string | null
          contacted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          instagram_handle?: string | null
          ip_hash?: string | null
          matched_at?: string | null
          matched_user_id?: string | null
          message?: string
          name?: string
          phone?: string | null
          portfolio_url?: string | null
          reel_url?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_guest_applications_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_guest_applications_collab_role_id_fkey"
            columns: ["collab_role_id"]
            isOneToOne: false
            referencedRelation: "collab_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_invites: {
        Row: {
          accepted_terms_version: number | null
          collab_post_id: string
          collab_role_id: string | null
          created_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["collab_invite_status"]
        }
        Insert: {
          accepted_terms_version?: number | null
          collab_post_id: string
          collab_role_id?: string | null
          created_at?: string
          id?: string
          invitee_user_id: string
          inviter_user_id: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collab_invite_status"]
        }
        Update: {
          accepted_terms_version?: number | null
          collab_post_id?: string
          collab_role_id?: string | null
          created_at?: string
          id?: string
          invitee_user_id?: string
          inviter_user_id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["collab_invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "collab_invites_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_invites_collab_role_id_fkey"
            columns: ["collab_role_id"]
            isOneToOne: false
            referencedRelation: "collab_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_posts: {
        Row: {
          also_cities: string[]
          boost_count: number
          category: Database["public"]["Enums"]["category"]
          city_id: string | null
          close_nudge_dismissed_at: string | null
          closed_at: string | null
          compensation_type: Database["public"]["Enums"]["compensation_type"]
          contact_email_encrypted: string | null
          contact_mode: Database["public"]["Enums"]["contact_mode"]
          created_at: string
          description: string | null
          ends_on: string | null
          external_contact_url: string | null
          id: string
          live_workshop_id: string | null
          location_mode: Database["public"]["Enums"]["location_type"]
          resulting_work_id: string | null
          rights_arrangement: string | null
          slug: string
          starts_on: string | null
          status: Database["public"]["Enums"]["collab_post_status"]
          subcategories: string[]
          terms_version: number
          timeline_mode: Database["public"]["Enums"]["timeline_mode"]
          timeline_text: string | null
          title: string
          updated_at: string
          user_id: string
          vouch_count: number
        }
        Insert: {
          also_cities?: string[]
          boost_count?: number
          category: Database["public"]["Enums"]["category"]
          city_id?: string | null
          close_nudge_dismissed_at?: string | null
          closed_at?: string | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          contact_email_encrypted?: string | null
          contact_mode?: Database["public"]["Enums"]["contact_mode"]
          created_at?: string
          description?: string | null
          ends_on?: string | null
          external_contact_url?: string | null
          id?: string
          live_workshop_id?: string | null
          location_mode?: Database["public"]["Enums"]["location_type"]
          resulting_work_id?: string | null
          rights_arrangement?: string | null
          slug: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["collab_post_status"]
          subcategories?: string[]
          terms_version?: number
          timeline_mode?: Database["public"]["Enums"]["timeline_mode"]
          timeline_text?: string | null
          title: string
          updated_at?: string
          user_id: string
          vouch_count?: number
        }
        Update: {
          also_cities?: string[]
          boost_count?: number
          category?: Database["public"]["Enums"]["category"]
          city_id?: string | null
          close_nudge_dismissed_at?: string | null
          closed_at?: string | null
          compensation_type?: Database["public"]["Enums"]["compensation_type"]
          contact_email_encrypted?: string | null
          contact_mode?: Database["public"]["Enums"]["contact_mode"]
          created_at?: string
          description?: string | null
          ends_on?: string | null
          external_contact_url?: string | null
          id?: string
          live_workshop_id?: string | null
          location_mode?: Database["public"]["Enums"]["location_type"]
          resulting_work_id?: string | null
          rights_arrangement?: string | null
          slug?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["collab_post_status"]
          subcategories?: string[]
          terms_version?: number
          timeline_mode?: Database["public"]["Enums"]["timeline_mode"]
          timeline_text?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          vouch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "collab_posts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "collab_posts_live_workshop_id_fkey"
            columns: ["live_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_roles: {
        Row: {
          collab_post_id: string
          description: string | null
          id: string
          quantity: number
          role_name: string
          sort_order: number
        }
        Insert: {
          collab_post_id: string
          description?: string | null
          id?: string
          quantity?: number
          role_name: string
          sort_order?: number
        }
        Update: {
          collab_post_id?: string
          description?: string | null
          id?: string
          quantity?: number
          role_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collab_roles_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_share_events: {
        Row: {
          channel: string
          collab_post_id: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          channel: string
          collab_post_id: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          collab_post_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_share_events_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_vouches: {
        Row: {
          collab_post_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          collab_post_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          collab_post_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_vouches_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          hidden: boolean
          id: string
          updated_at: string
          user_id: string
          work_id: string
        }
        Insert: {
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
          user_id: string
          work_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      comp_memberships: {
        Row: {
          code: string
          created_at: string
          duration_months: number
          expires_at: string | null
          granted_by: string | null
          granted_to: string | null
          id: string
          note: string | null
          redeemed_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_months?: number
          expires_at?: string | null
          granted_by?: string | null
          granted_to?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_months?: number
          expires_at?: string | null
          granted_by?: string | null
          granted_to?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "comp_memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comp_memberships_granted_to_fkey"
            columns: ["granted_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          context_collab_post_id: string | null
          context_workshop_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          context_collab_post_id?: string | null
          context_workshop_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          context_collab_post_id?: string | null
          context_workshop_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_context_collab_post_id_fkey"
            columns: ["context_collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_context_workshop_id_fkey"
            columns: ["context_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_lineup_signups: {
        Row: {
          created_at: string
          event_id: string
          id: string
          note: string | null
          position: number
          status: Database["public"]["Enums"]["lineup_signup_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          position: number
          status?: Database["public"]["Enums"]["lineup_signup_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          position?: number
          status?: Database["public"]["Enums"]["lineup_signup_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_lineup_signups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          created_at: string
          event_id: string
          height: number | null
          id: string
          storage_path: string
          uploader_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          height?: number | null
          id?: string
          storage_path: string
          uploader_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          height?: number | null
          id?: string
          storage_path?: string
          uploader_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_showcase_items: {
        Row: {
          collab_id: string | null
          created_at: string
          event_id: string
          id: string
          note: string | null
          user_id: string
          work_id: string | null
        }
        Insert: {
          collab_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          note?: string | null
          user_id: string
          work_id?: string | null
        }
        Update: {
          collab_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          note?: string | null
          user_id?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_showcase_items_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_showcase_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_showcase_items_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          notes: string | null
          rollout_pct: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          notes?: string | null
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          notes?: string | null
          rollout_pct?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followed_user_id: string
          follower_user_id: string
        }
        Insert: {
          created_at?: string
          followed_user_id: string
          follower_user_id: string
        }
        Update: {
          created_at?: string
          followed_user_id?: string
          follower_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_user_id_fkey"
            columns: ["follower_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_collabs: {
        Row: {
          added_by: string | null
          collab_post_id: string
          created_at: string
          group_id: string
        }
        Insert: {
          added_by?: string | null
          collab_post_id: string
          created_at?: string
          group_id: string
        }
        Update: {
          added_by?: string | null
          collab_post_id?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_collabs_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_collabs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_event_cohosts: {
        Row: {
          created_at: string
          event_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_cohosts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_event_comments: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "group_event_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      group_event_rsvps: {
        Row: {
          checked_in_at: string | null
          created_at: string
          event_id: string
          note: string | null
          plus_ones: number
          promo_pass_granted_at: string | null
          status: Database["public"]["Enums"]["group_event_rsvp_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          note?: string | null
          plus_ones?: number
          promo_pass_granted_at?: string | null
          status?: Database["public"]["Enums"]["group_event_rsvp_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          note?: string | null
          plus_ones?: number
          promo_pass_granted_at?: string | null
          status?: Database["public"]["Enums"]["group_event_rsvp_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_event_updates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          event_id: string
          id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          event_id: string
          id?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_event_updates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "group_events"
            referencedColumns: ["id"]
          },
        ]
      }
      group_events: {
        Row: {
          accent_color: string | null
          capacity: number | null
          cover_url: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          ends_at: string
          featured_at: string | null
          format: Database["public"]["Enums"]["group_event_format"]
          going_count: number
          group_id: string
          id: string
          is_official: boolean
          kind: Database["public"]["Enums"]["group_event_kind"]
          lineup_capacity: number | null
          lineup_reminder_sent_at: string | null
          maybe_count: number
          notified_24h_at: string | null
          notified_2h_at: string | null
          notified_recap_at: string | null
          online_url: string | null
          promo_pass_months: number
          rsvp_mode: Database["public"]["Enums"]["group_event_rsvp_mode"]
          series_key: string | null
          short_code: string | null
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["group_event_status"]
          tagline: string | null
          timezone: string
          title: string
          updated_at: string
          venue_address: string | null
          venue_city_id: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
          visibility: Database["public"]["Enums"]["group_event_visibility"]
          waitlist_count: number
          waitlist_enabled: boolean
        }
        Insert: {
          accent_color?: string | null
          capacity?: number | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          ends_at: string
          featured_at?: string | null
          format?: Database["public"]["Enums"]["group_event_format"]
          going_count?: number
          group_id: string
          id?: string
          is_official?: boolean
          kind?: Database["public"]["Enums"]["group_event_kind"]
          lineup_capacity?: number | null
          lineup_reminder_sent_at?: string | null
          maybe_count?: number
          notified_24h_at?: string | null
          notified_2h_at?: string | null
          notified_recap_at?: string | null
          online_url?: string | null
          promo_pass_months?: number
          rsvp_mode?: Database["public"]["Enums"]["group_event_rsvp_mode"]
          series_key?: string | null
          short_code?: string | null
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["group_event_status"]
          tagline?: string | null
          timezone?: string
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_city_id?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["group_event_visibility"]
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Update: {
          accent_color?: string | null
          capacity?: number | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string
          featured_at?: string | null
          format?: Database["public"]["Enums"]["group_event_format"]
          going_count?: number
          group_id?: string
          id?: string
          is_official?: boolean
          kind?: Database["public"]["Enums"]["group_event_kind"]
          lineup_capacity?: number | null
          lineup_reminder_sent_at?: string | null
          maybe_count?: number
          notified_24h_at?: string | null
          notified_2h_at?: string | null
          notified_recap_at?: string | null
          online_url?: string | null
          promo_pass_months?: number
          rsvp_mode?: Database["public"]["Enums"]["group_event_rsvp_mode"]
          series_key?: string | null
          short_code?: string | null
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["group_event_status"]
          tagline?: string | null
          timezone?: string
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_city_id?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          visibility?: Database["public"]["Enums"]["group_event_visibility"]
          waitlist_count?: number
          waitlist_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "group_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_venue_city_id_fkey"
            columns: ["venue_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_events_venue_city_id_fkey"
            columns: ["venue_city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_seed_links: {
        Row: {
          click_count: number
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          is_active: boolean
          join_count: number
          label: string | null
          signup_count: number
          token: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          join_count?: number
          label?: string | null
          signup_count?: number
          token: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          click_count?: number
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          join_count?: number
          label?: string | null
          signup_count?: number
          token?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_seed_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_today_pins: {
        Row: {
          collab_id: string
          created_at: string
          expires_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          collab_id: string
          created_at?: string
          expires_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          collab_id?: string
          created_at?: string
          expires_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_today_pins_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_today_pins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_today_posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          expires_at: string | null
          group_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          expires_at?: string | null
          group_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          expires_at?: string | null
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_today_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_works: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          work_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          work_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_works_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      group_workshops: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          workshop_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          workshop_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_workshops_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_workshops_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          category: Database["public"]["Enums"]["group_category"] | null
          city_id: string | null
          collab_count: number
          cover_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          featured_at: string | null
          id: string
          is_official: boolean
          join_mode: Database["public"]["Enums"]["group_join_mode"]
          kind: Database["public"]["Enums"]["group_kind"]
          member_count: number
          name: string
          news_feed_url: string | null
          parent_group_id: string | null
          slug: string
          tagline: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["group_visibility"]
          work_count: number
          workshop_count: number
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["group_category"] | null
          city_id?: string | null
          collab_count?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          featured_at?: string | null
          id?: string
          is_official?: boolean
          join_mode?: Database["public"]["Enums"]["group_join_mode"]
          kind: Database["public"]["Enums"]["group_kind"]
          member_count?: number
          name: string
          news_feed_url?: string | null
          parent_group_id?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
          work_count?: number
          workshop_count?: number
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["group_category"] | null
          city_id?: string | null
          collab_count?: number
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          featured_at?: string | null
          id?: string
          is_official?: boolean
          join_mode?: Database["public"]["Enums"]["group_join_mode"]
          kind?: Database["public"]["Enums"]["group_kind"]
          member_count?: number
          name?: string
          news_feed_url?: string | null
          parent_group_id?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["group_visibility"]
          work_count?: number
          workshop_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "groups_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_activity: {
        Row: {
          actor_display_name: string | null
          created_at: string
          id: string
          kind: string
          medium: Database["public"]["Enums"]["category"] | null
          title: string
        }
        Insert: {
          actor_display_name?: string | null
          created_at?: string
          id?: string
          kind: string
          medium?: Database["public"]["Enums"]["category"] | null
          title: string
        }
        Update: {
          actor_display_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          medium?: Database["public"]["Enums"]["category"] | null
          title?: string
        }
        Relationships: []
      }
      instant_board_items: {
        Row: {
          content: Json
          created_at: string
          h: number
          id: string
          kind: string
          room_id: string
          rotation: number
          updated_at: string
          user_id: string
          w: number
          x: number
          y: number
          z: number
        }
        Insert: {
          content?: Json
          created_at?: string
          h?: number
          id?: string
          kind: string
          room_id: string
          rotation?: number
          updated_at?: string
          user_id: string
          w?: number
          x?: number
          y?: number
          z?: number
        }
        Update: {
          content?: Json
          created_at?: string
          h?: number
          id?: string
          kind?: string
          room_id?: string
          rotation?: number
          updated_at?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
      }
      instant_doc_comments: {
        Row: {
          anchor: Json | null
          author_id: string | null
          body: string
          created_at: string
          doc_id: string
          id: string
          parent_id: string | null
          resolved_at: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          anchor?: Json | null
          author_id?: string | null
          body: string
          created_at?: string
          doc_id: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          anchor?: Json | null
          author_id?: string | null
          body?: string
          created_at?: string
          doc_id?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_doc_comments_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "instant_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_doc_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "instant_doc_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_doc_comments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_docs: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          room_id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          room_id: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          room_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_docs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_drive_file_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          file_id: string
          id: string
          room_id: string
          timecode_ms: number | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          file_id: string
          id?: string
          room_id: string
          timecode_ms?: number | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          file_id?: string
          id?: string
          room_id?: string
          timecode_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instant_drive_file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "instant_drive_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_drive_file_comments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_drive_files: {
        Row: {
          byte_size: number | null
          created_at: string
          duration_ms: number | null
          filename: string
          height: number | null
          id: string
          linked_take_owner_user_id: string | null
          mime_type: string | null
          note: string | null
          persona_id: string | null
          room_id: string
          storage_path: string
          take_id: string | null
          updated_at: string
          uploader_id: string | null
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          duration_ms?: number | null
          filename: string
          height?: number | null
          id?: string
          linked_take_owner_user_id?: string | null
          mime_type?: string | null
          note?: string | null
          persona_id?: string | null
          room_id: string
          storage_path: string
          take_id?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          duration_ms?: number | null
          filename?: string
          height?: number | null
          id?: string
          linked_take_owner_user_id?: string | null
          mime_type?: string | null
          note?: string | null
          persona_id?: string | null
          room_id?: string
          storage_path?: string
          take_id?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instant_drive_files_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "recorder_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_drive_files_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_drive_links: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          note: string | null
          provider: string
          room_id: string
          title: string | null
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          provider?: string
          room_id: string
          title?: string | null
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          provider?: string
          room_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_drive_links_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "instant_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_message_reactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_messages: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          id: string
          mentions: string[]
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string
          id?: string
          mentions?: string[]
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          id?: string
          mentions?: string[]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_presence: {
        Row: {
          first_seen_at: string
          last_seen_at: string
          room_id: string
          status: string
          user_id: string
        }
        Insert: {
          first_seen_at?: string
          last_seen_at?: string
          room_id: string
          status?: string
          user_id: string
        }
        Update: {
          first_seen_at?: string
          last_seen_at?: string
          room_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_presence_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_room_claim_cooldowns: {
        Row: {
          room_id: string
          until: string
          user_id: string
        }
        Insert: {
          room_id: string
          until: string
          user_id: string
        }
        Update: {
          room_id?: string
          until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_room_claim_cooldowns_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_room_pins: {
        Row: {
          collab_post_id: string
          created_at: string
          id: string
          is_host_pin: boolean
          pinned_by_user_id: string
          room_id: string
          sort_order: number
        }
        Insert: {
          collab_post_id: string
          created_at?: string
          id?: string
          is_host_pin?: boolean
          pinned_by_user_id: string
          room_id: string
          sort_order?: number
        }
        Update: {
          collab_post_id?: string
          created_at?: string
          id?: string
          is_host_pin?: boolean
          pinned_by_user_id?: string
          room_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "instant_room_pins_collab_post_id_fkey"
            columns: ["collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_room_pins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_room_removals: {
        Row: {
          created_at: string
          removed_by: string | null
          room_id: string
          until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          removed_by?: string | null
          room_id: string
          until: string
          user_id: string
        }
        Update: {
          created_at?: string
          removed_by?: string | null
          room_id?: string
          until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_room_removals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_room_work_pins: {
        Row: {
          created_at: string
          id: string
          is_host_pin: boolean
          pinned_by_user_id: string
          room_id: string
          sort_order: number
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_host_pin?: boolean
          pinned_by_user_id: string
          room_id: string
          sort_order?: number
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_host_pin?: boolean
          pinned_by_user_id?: string
          room_id?: string
          sort_order?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_room_work_pins_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_room_work_pins_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_rooms: {
        Row: {
          category: Database["public"]["Enums"]["category"] | null
          city_id: string | null
          claim_started_at: string | null
          claim_user_id: string | null
          claim_vetoed: boolean
          collab_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          ended_by_user_id: string | null
          ends_at: string | null
          focus_message: string | null
          group_id: string | null
          host_user_id: string | null
          id: string
          kind: string
          link_token: string | null
          locked: boolean
          medium: Database["public"]["Enums"]["category"] | null
          note: string | null
          note_updated_at: string | null
          note_updated_by: string | null
          participant_cap: number
          promoted_at: string | null
          prompt: string | null
          slug: string | null
          source_workshop_id: string | null
          status: Database["public"]["Enums"]["instant_status"]
          title: string
          visibility: string
          workshop_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["category"] | null
          city_id?: string | null
          claim_started_at?: string | null
          claim_user_id?: string | null
          claim_vetoed?: boolean
          collab_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ended_by_user_id?: string | null
          ends_at?: string | null
          focus_message?: string | null
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          kind?: string
          link_token?: string | null
          locked?: boolean
          medium?: Database["public"]["Enums"]["category"] | null
          note?: string | null
          note_updated_at?: string | null
          note_updated_by?: string | null
          participant_cap?: number
          promoted_at?: string | null
          prompt?: string | null
          slug?: string | null
          source_workshop_id?: string | null
          status?: Database["public"]["Enums"]["instant_status"]
          title: string
          visibility?: string
          workshop_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["category"] | null
          city_id?: string | null
          claim_started_at?: string | null
          claim_user_id?: string | null
          claim_vetoed?: boolean
          collab_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ended_by_user_id?: string | null
          ends_at?: string | null
          focus_message?: string | null
          group_id?: string | null
          host_user_id?: string | null
          id?: string
          kind?: string
          link_token?: string | null
          locked?: boolean
          medium?: Database["public"]["Enums"]["category"] | null
          note?: string | null
          note_updated_at?: string | null
          note_updated_by?: string | null
          participant_cap?: number
          promoted_at?: string | null
          prompt?: string | null
          slug?: string | null
          source_workshop_id?: string | null
          status?: Database["public"]["Enums"]["instant_status"]
          title?: string
          visibility?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instant_rooms_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_rooms_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "instant_rooms_collab_id_fkey"
            columns: ["collab_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_rooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_rooms_source_workshop_id_fkey"
            columns: ["source_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instant_rooms_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_tool_items: {
        Row: {
          body: string | null
          created_at: string
          created_by_user_id: string | null
          done: boolean
          id: string
          position: number
          title: string | null
          tool_id: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by_user_id?: string | null
          done?: boolean
          id?: string
          position?: number
          title?: string | null
          tool_id: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by_user_id?: string | null
          done?: boolean
          id?: string
          position?: number
          title?: string | null
          tool_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instant_tool_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "instant_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_tools: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          enabled: boolean
          id: string
          room_id: string
          tool_type: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          enabled?: boolean
          id?: string
          room_id: string
          tool_type: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          enabled?: boolean
          id?: string
          room_id?: string
          tool_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "instant_tools_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      instant_whiteboard_assets: {
        Row: {
          created_at: string
          id: string
          room_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          bytes: number | null
          created_at: string
          duration_s: number | null
          hls_url: string | null
          id: string
          kind: string
          meta: Json
          mp4_fallback_url: string | null
          owner_id: string
          provider: string | null
          provider_uid: string | null
          ready_at: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          work_id: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          hls_url?: string | null
          id?: string
          kind: string
          meta?: Json
          mp4_fallback_url?: string | null
          owner_id: string
          provider?: string | null
          provider_uid?: string | null
          ready_at?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          hls_url?: string | null
          id?: string
          kind?: string
          meta?: Json
          mp4_fallback_url?: string | null
          owner_id?: string
          provider?: string | null
          provider_uid?: string | null
          ready_at?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_occurrences: {
        Row: {
          ends_at: string | null
          id: string
          standing_meetup_id: string
          starts_at: string
          status: string
          workshop_id: string | null
        }
        Insert: {
          ends_at?: string | null
          id?: string
          standing_meetup_id: string
          starts_at: string
          status?: string
          workshop_id?: string | null
        }
        Update: {
          ends_at?: string | null
          id?: string
          standing_meetup_id?: string
          starts_at?: string
          status?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetup_occurrences_standing_meetup_id_fkey"
            columns: ["standing_meetup_id"]
            isOneToOne: false
            referencedRelation: "standing_meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_occurrences_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mod_rules: {
        Row: {
          action: string
          enabled: boolean
          id: string
          key: string
          notes: string | null
          threshold: number | null
          updated_at: string
          window_seconds: number | null
        }
        Insert: {
          action: string
          enabled?: boolean
          id?: string
          key: string
          notes?: string | null
          threshold?: number | null
          updated_at?: string
          window_seconds?: number | null
        }
        Update: {
          action?: string
          enabled?: boolean
          id?: string
          key?: string
          notes?: string | null
          threshold?: number | null
          updated_at?: string
          window_seconds?: number | null
        }
        Relationships: []
      }
      moderation_terms: {
        Row: {
          category: string
          created_at: string
          id: string
          notes: string | null
          severity: string
          term: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string
          term: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          severity?: string
          term?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_collab_activity: boolean
          email_credits: boolean
          email_follows: boolean
          email_friend_online: boolean
          email_messages: boolean
          email_product_news: boolean
          email_workshop_updates: boolean
          inapp_collab_activity: boolean
          inapp_credits: boolean
          inapp_follows: boolean
          inapp_friend_online: boolean
          inapp_messages: boolean
          inapp_workshop_updates: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_collab_activity?: boolean
          email_credits?: boolean
          email_follows?: boolean
          email_friend_online?: boolean
          email_messages?: boolean
          email_product_news?: boolean
          email_workshop_updates?: boolean
          inapp_collab_activity?: boolean
          inapp_credits?: boolean
          inapp_follows?: boolean
          inapp_friend_online?: boolean
          inapp_messages?: boolean
          inapp_workshop_updates?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_collab_activity?: boolean
          email_credits?: boolean
          email_follows?: boolean
          email_friend_online?: boolean
          email_messages?: boolean
          email_product_news?: boolean
          email_workshop_updates?: boolean
          inapp_collab_activity?: boolean
          inapp_credits?: boolean
          inapp_follows?: boolean
          inapp_friend_online?: boolean
          inapp_messages?: boolean
          inapp_workshop_updates?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          payload: Json
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          payload?: Json
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          payload?: Json
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_filter_min: number | null
          aliases: string[]
          avatar_url: string | null
          bio: string | null
          birthdate: string | null
          categories: Database["public"]["Enums"]["category"][]
          cc_consent_ack: boolean
          cc_consent_ack_at: string | null
          city_id: string | null
          cover_url: string | null
          created_at: string
          creator_status: Database["public"]["Enums"]["creator_status"]
          deleted_at: string | null
          deletion_requested_at: string | null
          discoverable: boolean
          display_name: string | null
          dm_policy: string
          event_visibility: Database["public"]["Enums"]["event_visibility"]
          external_links: Json
          first_name: string | null
          follower_count: number
          following_count: number
          headline: string | null
          hide_group_memberships: boolean
          home_city_changed_at: string | null
          home_city_id: string | null
          id: string
          indexable: boolean
          instagram_handle: string | null
          last_active_at: string | null
          last_name: string | null
          mediums: string[]
          onboarded: boolean
          pinned_work_ids: string[]
          preferred_language: string
          referred_by: string | null
          show_online: boolean
          tools: string[]
          tour_completed_at: string | null
          updated_at: string
          username: string | null
          work_count: number
          worked_with_count: number
        }
        Insert: {
          age_filter_min?: number | null
          aliases?: string[]
          avatar_url?: string | null
          bio?: string | null
          birthdate?: string | null
          categories?: Database["public"]["Enums"]["category"][]
          cc_consent_ack?: boolean
          cc_consent_ack_at?: string | null
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          deleted_at?: string | null
          deletion_requested_at?: string | null
          discoverable?: boolean
          display_name?: string | null
          dm_policy?: string
          event_visibility?: Database["public"]["Enums"]["event_visibility"]
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          hide_group_memberships?: boolean
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id: string
          indexable?: boolean
          instagram_handle?: string | null
          last_active_at?: string | null
          last_name?: string | null
          mediums?: string[]
          onboarded?: boolean
          pinned_work_ids?: string[]
          preferred_language?: string
          referred_by?: string | null
          show_online?: boolean
          tools?: string[]
          tour_completed_at?: string | null
          updated_at?: string
          username?: string | null
          work_count?: number
          worked_with_count?: number
        }
        Update: {
          age_filter_min?: number | null
          aliases?: string[]
          avatar_url?: string | null
          bio?: string | null
          birthdate?: string | null
          categories?: Database["public"]["Enums"]["category"][]
          cc_consent_ack?: boolean
          cc_consent_ack_at?: string | null
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          deleted_at?: string | null
          deletion_requested_at?: string | null
          discoverable?: boolean
          display_name?: string | null
          dm_policy?: string
          event_visibility?: Database["public"]["Enums"]["event_visibility"]
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          hide_group_memberships?: boolean
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id?: string
          indexable?: boolean
          instagram_handle?: string | null
          last_active_at?: string | null
          last_name?: string | null
          mediums?: string[]
          onboarded?: boolean
          pinned_work_ids?: string[]
          preferred_language?: string
          referred_by?: string | null
          show_online?: boolean
          tools?: string[]
          tour_completed_at?: string | null
          updated_at?: string
          username?: string | null
          work_count?: number
          worked_with_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          key: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          key: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      recorder_persona_members: {
        Row: {
          joined_at: string
          persona_id: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          persona_id: string
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          persona_id?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recorder_persona_members_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "recorder_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      recorder_personas: {
        Row: {
          control_mode: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          privacy: string
          room_id: string | null
          updated_at: string
          workshop_id: string | null
        }
        Insert: {
          control_mode?: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          privacy?: string
          room_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Update: {
          control_mode?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          privacy?: string
          room_id?: string | null
          updated_at?: string
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recorder_personas_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recorder_personas_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_credits: {
        Row: {
          applied_at: string
          created_at: string
          id: string
          months_granted: number
          referred_user_id: string
          source: string
          status: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string
          created_at?: string
          id?: string
          months_granted?: number
          referred_user_id: string
          source?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string
          created_at?: string
          id?: string
          months_granted?: number
          referred_user_id?: string
          source?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      relationship_edges: {
        Row: {
          expires_at: string | null
          last_interaction_at: string
          last_shared_work_id: string | null
          other_user_id: string
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          shared_work_count: number
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          last_interaction_at?: string
          last_shared_work_id?: string | null
          other_user_id: string
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          shared_work_count?: number
          user_id: string
        }
        Update: {
          expires_at?: string | null
          last_interaction_at?: string
          last_shared_work_id?: string | null
          other_user_id?: string
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          shared_work_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationship_edges_last_shared_work_id_fkey"
            columns: ["last_shared_work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_edges_other_user_id_fkey"
            columns: ["other_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_edges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_user_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_user_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_user_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_events: {
        Row: {
          channel: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      standing_meetups: {
        Row: {
          city_id: string
          created_at: string
          default_category: Database["public"]["Enums"]["category"] | null
          default_location_text: string | null
          description: string | null
          host_user_id: string
          id: string
          recurrence_rule: string | null
          status: Database["public"]["Enums"]["meetup_status"]
          title: string
        }
        Insert: {
          city_id: string
          created_at?: string
          default_category?: Database["public"]["Enums"]["category"] | null
          default_location_text?: string | null
          description?: string | null
          host_user_id: string
          id?: string
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["meetup_status"]
          title: string
        }
        Update: {
          city_id?: string
          created_at?: string
          default_category?: Database["public"]["Enums"]["category"] | null
          default_location_text?: string | null
          description?: string | null
          host_user_id?: string
          id?: string
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["meetup_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_meetups_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_meetups_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "standing_meetups_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: Database["public"]["Enums"]["stripe_environment"]
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: Database["public"]["Enums"]["stripe_environment"]
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: Database["public"]["Enums"]["stripe_environment"]
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      turn_credential_grants: {
        Row: {
          granted_at: string
          id: string
          room_id: string | null
          ttl_seconds: number
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          room_id?: string | null
          ttl_seconds: number
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          room_id?: string | null
          ttl_seconds?: number
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
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
      work_agreement_signatures: {
        Row: {
          agreement_id: string
          id: string
          signed_at: string
          user_id: string
        }
        Insert: {
          agreement_id: string
          id?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          agreement_id?: string
          id?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_agreement_signatures_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "work_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_agreement_signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_agreements: {
        Row: {
          commercial_use: string
          content_hash: string
          created_at: string
          created_by: string
          credit_template: string | null
          id: string
          license: Database["public"]["Enums"]["work_license"]
          license_custom: string | null
          splits: Json
          version: number
          work_id: string
        }
        Insert: {
          commercial_use?: string
          content_hash: string
          created_at?: string
          created_by: string
          credit_template?: string | null
          id?: string
          license?: Database["public"]["Enums"]["work_license"]
          license_custom?: string | null
          splits?: Json
          version?: number
          work_id: string
        }
        Update: {
          commercial_use?: string
          content_hash?: string
          created_at?: string
          created_by?: string
          credit_template?: string | null
          id?: string
          license?: Database["public"]["Enums"]["work_license"]
          license_custom?: string | null
          splits?: Json
          version?: number
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_agreements_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_applications: {
        Row: {
          applicant_user_id: string
          created_at: string
          id: string
          pitch: string | null
          status: string
          updated_at: string
          work_id: string
        }
        Insert: {
          applicant_user_id: string
          created_at?: string
          id?: string
          pitch?: string | null
          status?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          applicant_user_id?: string
          created_at?: string
          id?: string
          pitch?: string | null
          status?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_applications_applicant_user_id_fkey"
            columns: ["applicant_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_applications_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_boosts: {
        Row: {
          created_at: string
          id: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_boosts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_collaborators: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          role: string
          signed_agreement_id: string | null
          splits_pct: number
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          role?: string
          signed_agreement_id?: string | null
          splits_pct?: number
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          role?: string
          signed_agreement_id?: string | null
          splits_pct?: number
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_collaborators_signed_agreement_fk"
            columns: ["signed_agreement_id"]
            isOneToOne: false
            referencedRelation: "work_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_collaborators_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_credits: {
        Row: {
          created_at: string
          display_name: string | null
          hidden_from_profile: boolean
          id: string
          pinned_at: string | null
          role_label: string
          sort_order: number
          user_id: string | null
          work_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          hidden_from_profile?: boolean
          id?: string
          pinned_at?: string | null
          role_label: string
          sort_order?: number
          user_id?: string | null
          work_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          hidden_from_profile?: boolean
          id?: string
          pinned_at?: string | null
          role_label?: string
          sort_order?: number
          user_id?: string | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_credits_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_invite_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          token: string
          uses_remaining: number | null
          work_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          token: string
          uses_remaining?: number | null
          work_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          token?: string
          uses_remaining?: number | null
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_invite_tokens_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invitee_handle: string | null
          invitee_user_id: string | null
          role: string
          status: string
          updated_at: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invitee_handle?: string | null
          invitee_user_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invitee_handle?: string | null
          invitee_user_id?: string | null
          role?: string
          status?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_invites_invitee_user_id_fkey"
            columns: ["invitee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_invites_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_reactions: {
        Row: {
          created_at: string
          id: string
          reaction: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_reactions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_vouches: {
        Row: {
          created_at: string
          id: string
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_vouches_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          book_author: string | null
          book_buy_links: Json
          book_excerpt_url: string | null
          book_isbn: string | null
          book_page_count: number | null
          book_published_on: string | null
          book_publisher: string | null
          boost_count: number
          category: Database["public"]["Enums"]["category"]
          city_id: string | null
          comment_count: number
          commercial_use: string
          cover_url: string | null
          created_at: string
          created_by: string
          credit_template: string | null
          description: string | null
          embed_url: string | null
          excerpt: string | null
          featured: boolean
          id: string
          is_collaborative: boolean
          license_type: Database["public"]["Enums"]["work_license"]
          like_count: number
          ownership_certified_at: string | null
          popularity_score: number
          primary_url: string | null
          published_at: string | null
          save_count: number
          slug: string
          source_collab_post_id: string | null
          source_meetup_id: string | null
          source_type: Database["public"]["Enums"]["work_source_type"]
          source_workshop_id: string | null
          status: Database["public"]["Enums"]["work_status"]
          subcategories: string[]
          subtype: string | null
          title: string
          updated_at: string
          view_count: number
          visibility: Database["public"]["Enums"]["visibility"]
          vouch_count: number
        }
        Insert: {
          book_author?: string | null
          book_buy_links?: Json
          book_excerpt_url?: string | null
          book_isbn?: string | null
          book_page_count?: number | null
          book_published_on?: string | null
          book_publisher?: string | null
          boost_count?: number
          category: Database["public"]["Enums"]["category"]
          city_id?: string | null
          comment_count?: number
          commercial_use?: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          credit_template?: string | null
          description?: string | null
          embed_url?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          is_collaborative?: boolean
          license_type?: Database["public"]["Enums"]["work_license"]
          like_count?: number
          ownership_certified_at?: string | null
          popularity_score?: number
          primary_url?: string | null
          published_at?: string | null
          save_count?: number
          slug: string
          source_collab_post_id?: string | null
          source_meetup_id?: string | null
          source_type?: Database["public"]["Enums"]["work_source_type"]
          source_workshop_id?: string | null
          status?: Database["public"]["Enums"]["work_status"]
          subcategories?: string[]
          subtype?: string | null
          title: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
          vouch_count?: number
        }
        Update: {
          book_author?: string | null
          book_buy_links?: Json
          book_excerpt_url?: string | null
          book_isbn?: string | null
          book_page_count?: number | null
          book_published_on?: string | null
          book_publisher?: string | null
          boost_count?: number
          category?: Database["public"]["Enums"]["category"]
          city_id?: string | null
          comment_count?: number
          commercial_use?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          credit_template?: string | null
          description?: string | null
          embed_url?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          is_collaborative?: boolean
          license_type?: Database["public"]["Enums"]["work_license"]
          like_count?: number
          ownership_certified_at?: string | null
          popularity_score?: number
          primary_url?: string | null
          published_at?: string | null
          save_count?: number
          slug?: string
          source_collab_post_id?: string | null
          source_meetup_id?: string | null
          source_type?: Database["public"]["Enums"]["work_source_type"]
          source_workshop_id?: string | null
          status?: Database["public"]["Enums"]["work_status"]
          subcategories?: string[]
          subtype?: string | null
          title?: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
          vouch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "works_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "works_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "works_source_workshop_id_fkey"
            columns: ["source_workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_applications: {
        Row: {
          checked_in_at: string | null
          confirmed_at: string | null
          id: string
          note: string | null
          role_id: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          user_id: string
          workshop_id: string
        }
        Insert: {
          checked_in_at?: string | null
          confirmed_at?: string | null
          id?: string
          note?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
          workshop_id: string
        }
        Update: {
          checked_in_at?: string | null
          confirmed_at?: string | null
          id?: string
          note?: string | null
          role_id?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_applications_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workshop_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_applications_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_board_assets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          payload: Json
          position: Json
          updated_at: string
          workshop_id: string
          z_index: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          payload?: Json
          position?: Json
          updated_at?: string
          workshop_id: string
          z_index?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          payload?: Json
          position?: Json
          updated_at?: string
          workshop_id?: string
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workshop_board_assets_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_doc_comments: {
        Row: {
          anchor: Json | null
          author_id: string | null
          body: string
          created_at: string
          doc_id: string
          id: string
          parent_id: string | null
          resolved_at: string | null
          updated_at: string
          workshop_id: string
        }
        Insert: {
          anchor?: Json | null
          author_id?: string | null
          body: string
          created_at?: string
          doc_id: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          updated_at?: string
          workshop_id: string
        }
        Update: {
          anchor?: Json | null
          author_id?: string | null
          body?: string
          created_at?: string
          doc_id?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_doc_comments_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "workshop_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_doc_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "workshop_doc_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_doc_comments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_docs: {
        Row: {
          content_md: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          template: string | null
          title: string
          updated_at: string
          workshop_id: string
          ydoc: string | null
        }
        Insert: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          template?: string | null
          title?: string
          updated_at?: string
          workshop_id: string
          ydoc?: string | null
        }
        Update: {
          content_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          template?: string | null
          title?: string
          updated_at?: string
          workshop_id?: string
          ydoc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_docs_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_drive_file_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          file_id: string
          id: string
          timecode_ms: number | null
          workshop_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          file_id: string
          id?: string
          timecode_ms?: number | null
          workshop_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          file_id?: string
          id?: string
          timecode_ms?: number | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_drive_file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "workshop_drive_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_drive_file_comments_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_drive_files: {
        Row: {
          byte_size: number | null
          created_at: string
          duration_ms: number | null
          filename: string
          height: number | null
          id: string
          linked_take_owner_user_id: string | null
          mime_type: string | null
          note: string | null
          persona_id: string | null
          storage_path: string
          take_id: string | null
          updated_at: string
          uploader_id: string | null
          width: number | null
          workshop_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          duration_ms?: number | null
          filename: string
          height?: number | null
          id?: string
          linked_take_owner_user_id?: string | null
          mime_type?: string | null
          note?: string | null
          persona_id?: string | null
          storage_path: string
          take_id?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
          workshop_id: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          duration_ms?: number | null
          filename?: string
          height?: number | null
          id?: string
          linked_take_owner_user_id?: string | null
          mime_type?: string | null
          note?: string | null
          persona_id?: string | null
          storage_path?: string
          take_id?: string | null
          updated_at?: string
          uploader_id?: string | null
          width?: number | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_drive_files_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "recorder_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_drive_files_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_drive_links: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          note: string | null
          provider: string
          title: string | null
          url: string
          workshop_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          provider?: string
          title?: string | null
          url: string
          workshop_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          provider?: string
          title?: string | null
          url?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_drive_links_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_join_invites: {
        Row: {
          created_at: string
          id: string
          invitee_user_id: string
          inviter_user_id: string | null
          responded_at: string | null
          source_room_id: string | null
          status: string
          workshop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_user_id: string
          inviter_user_id?: string | null
          responded_at?: string | null
          source_room_id?: string | null
          status?: string
          workshop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_user_id?: string
          inviter_user_id?: string | null
          responded_at?: string | null
          source_room_id?: string | null
          status?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_join_invites_source_room_id_fkey"
            columns: ["source_room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_join_invites_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_links: {
        Row: {
          category: Database["public"]["Enums"]["category"] | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          participant_cap: number
          prompt: string | null
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["category"] | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          participant_cap?: number
          prompt?: string | null
          title: string
          token: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["category"] | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          participant_cap?: number
          prompt?: string | null
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      workshop_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          user_id: string
          workshop_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          user_id: string
          workshop_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_messages_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_participants: {
        Row: {
          checked_in_at: string | null
          id: string
          joined_at: string
          participant_status: Database["public"]["Enums"]["participant_status"]
          role_id: string | null
          user_id: string
          workshop_id: string
        }
        Insert: {
          checked_in_at?: string | null
          id?: string
          joined_at?: string
          participant_status?: Database["public"]["Enums"]["participant_status"]
          role_id?: string | null
          user_id: string
          workshop_id: string
        }
        Update: {
          checked_in_at?: string | null
          id?: string
          joined_at?: string
          participant_status?: Database["public"]["Enums"]["participant_status"]
          role_id?: string | null
          user_id?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_participants_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "workshop_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_participants_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_poll_votes: {
        Row: {
          choice_index: number
          created_at: string
          poll_id: string
          voter_hash: string
        }
        Insert: {
          choice_index: number
          created_at?: string
          poll_id: string
          voter_hash: string
        }
        Update: {
          choice_index?: number
          created_at?: string
          poll_id?: string
          voter_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "workshop_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_polls: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          last_vote_at: string
          message_id: string | null
          mode: string
          options: Json
          question: string
          status: string
          vote_salt: string
          workshop_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_vote_at?: string
          message_id?: string | null
          mode?: string
          options: Json
          question: string
          status?: string
          vote_salt?: string
          workshop_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_vote_at?: string
          message_id?: string | null
          mode?: string
          options?: Json
          question?: string
          status?: string
          vote_salt?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_polls_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_roles: {
        Row: {
          allows_alternates: boolean
          application_required: boolean
          created_at: string
          id: string
          quantity: number
          role_name: string
          sort_order: number
          workshop_id: string
        }
        Insert: {
          allows_alternates?: boolean
          application_required?: boolean
          created_at?: string
          id?: string
          quantity?: number
          role_name: string
          sort_order?: number
          workshop_id: string
        }
        Update: {
          allows_alternates?: boolean
          application_required?: boolean
          created_at?: string
          id?: string
          quantity?: number
          role_name?: string
          sort_order?: number
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_roles_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_session_demos: {
        Row: {
          clip_file_id: string | null
          created_at: string
          id: string
          label: string | null
          session_id: string
          t_ms: number
          user_id: string
        }
        Insert: {
          clip_file_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          session_id: string
          t_ms: number
          user_id: string
        }
        Update: {
          clip_file_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          session_id?: string
          t_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_session_demos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_session_demos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_session_tracks: {
        Row: {
          bytes: number
          created_at: string
          duration_ms: number
          file_id: string | null
          id: string
          kind: string
          session_id: string
          status: string
          storage_path: string | null
          t0_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes?: number
          created_at?: string
          duration_ms?: number
          file_id?: string | null
          id?: string
          kind: string
          session_id: string
          status?: string
          storage_path?: string | null
          t0_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes?: number
          created_at?: string
          duration_ms?: number
          file_id?: string | null
          id?: string
          kind?: string
          session_id?: string
          status?: string
          storage_path?: string | null
          t0_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_session_tracks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workshop_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_session_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_sessions: {
        Row: {
          consent: Json
          created_at: string
          ended_at: string | null
          id: string
          promoted_to_work_id: string | null
          started_at: string
          started_by: string
          status: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          consent?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          promoted_to_work_id?: string | null
          started_at?: string
          started_by: string
          status?: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          consent?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          promoted_to_work_id?: string | null
          started_at?: string
          started_by?: string
          status?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_sessions_promoted_to_work_id_fkey"
            columns: ["promoted_to_work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_sessions_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_tasks: {
        Row: {
          assignee_id: string | null
          body: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_by: string | null
          id: string
          mentioned_user_ids: string[]
          sort_order: number
          status: string
          title: string
          updated_at: string
          workshop_id: string
        }
        Insert: {
          assignee_id?: string | null
          body?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_by?: string | null
          id?: string
          mentioned_user_ids?: string[]
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          workshop_id: string
        }
        Update: {
          assignee_id?: string | null
          body?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_by?: string | null
          id?: string
          mentioned_user_ids?: string[]
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_tasks_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_tool_items: {
        Row: {
          body: string | null
          created_at: string
          created_by_user_id: string
          id: string
          metadata_json: Json
          sort_order: number
          title: string | null
          tool_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          metadata_json?: Json
          sort_order?: number
          title?: string | null
          tool_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          metadata_json?: Json
          sort_order?: number
          title?: string | null
          tool_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_tool_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshop_tool_items_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "workshop_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_tools: {
        Row: {
          config_json: Json
          created_at: string
          enabled: boolean
          id: string
          tool_type: Database["public"]["Enums"]["tool_type"]
          workshop_id: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          tool_type: Database["public"]["Enums"]["tool_type"]
          workshop_id: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          tool_type?: Database["public"]["Enums"]["tool_type"]
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_tools_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          acting_leader_user_id: string | null
          application_count: number
          archive_at: string | null
          archive_notified_24h_at: string | null
          archive_notified_3d_at: string | null
          archive_notified_6h_at: string | null
          archive_notified_7d_at: string | null
          archive_zip_url: string | null
          archived_at: string | null
          audience_city_ids: string[]
          auto_converted_at: string | null
          category: Database["public"]["Enums"]["category"]
          check_in_closes_at: string | null
          check_in_opens_at: string | null
          city_id: string | null
          confirmed_count: number
          created_at: string
          ends_at: string | null
          external_call_url: string | null
          finalization_deadline_at: string | null
          hide_from_ineligible: boolean
          host_user_id: string
          id: string
          is_lobby: boolean
          is_pinned: boolean
          last_activity_at: string
          license_type: Database["public"]["Enums"]["work_license"]
          lobby_discoverable: boolean
          location_text: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          max_age: number | null
          min_age: number | null
          mode: Database["public"]["Enums"]["workshop_mode"]
          participant_cap: number | null
          pinned_at: string | null
          prompt: string | null
          published_work_id: string | null
          slug: string
          source_instant_room_id: string | null
          starting_notified_at: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["workshop_status"]
          subcategories: string[]
          title: string
          topic_collab_post_id: string | null
          updated_at: string
          venue_address: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
          venue_osm_ref: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          acting_leader_user_id?: string | null
          application_count?: number
          archive_at?: string | null
          archive_notified_24h_at?: string | null
          archive_notified_3d_at?: string | null
          archive_notified_6h_at?: string | null
          archive_notified_7d_at?: string | null
          archive_zip_url?: string | null
          archived_at?: string | null
          audience_city_ids?: string[]
          auto_converted_at?: string | null
          category: Database["public"]["Enums"]["category"]
          check_in_closes_at?: string | null
          check_in_opens_at?: string | null
          city_id?: string | null
          confirmed_count?: number
          created_at?: string
          ends_at?: string | null
          external_call_url?: string | null
          finalization_deadline_at?: string | null
          hide_from_ineligible?: boolean
          host_user_id: string
          id?: string
          is_lobby?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          license_type?: Database["public"]["Enums"]["work_license"]
          lobby_discoverable?: boolean
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          max_age?: number | null
          min_age?: number | null
          mode?: Database["public"]["Enums"]["workshop_mode"]
          participant_cap?: number | null
          pinned_at?: string | null
          prompt?: string | null
          published_work_id?: string | null
          slug: string
          source_instant_room_id?: string | null
          starting_notified_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          subcategories?: string[]
          title: string
          topic_collab_post_id?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          venue_osm_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          acting_leader_user_id?: string | null
          application_count?: number
          archive_at?: string | null
          archive_notified_24h_at?: string | null
          archive_notified_3d_at?: string | null
          archive_notified_6h_at?: string | null
          archive_notified_7d_at?: string | null
          archive_zip_url?: string | null
          archived_at?: string | null
          audience_city_ids?: string[]
          auto_converted_at?: string | null
          category?: Database["public"]["Enums"]["category"]
          check_in_closes_at?: string | null
          check_in_opens_at?: string | null
          city_id?: string | null
          confirmed_count?: number
          created_at?: string
          ends_at?: string | null
          external_call_url?: string | null
          finalization_deadline_at?: string | null
          hide_from_ineligible?: boolean
          host_user_id?: string
          id?: string
          is_lobby?: boolean
          is_pinned?: boolean
          last_activity_at?: string
          license_type?: Database["public"]["Enums"]["work_license"]
          lobby_discoverable?: boolean
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          max_age?: number | null
          min_age?: number | null
          mode?: Database["public"]["Enums"]["workshop_mode"]
          participant_cap?: number | null
          pinned_at?: string | null
          prompt?: string | null
          published_work_id?: string | null
          slug?: string
          source_instant_room_id?: string | null
          starting_notified_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          subcategories?: string[]
          title?: string
          topic_collab_post_id?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          venue_osm_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "workshops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "vw_city_activity_7d"
            referencedColumns: ["city_id"]
          },
          {
            foreignKeyName: "workshops_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_published_work_id_fkey"
            columns: ["published_work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_source_instant_room_id_fkey"
            columns: ["source_instant_room_id"]
            isOneToOne: false
            referencedRelation: "instant_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workshops_topic_collab_post_id_fkey"
            columns: ["topic_collab_post_id"]
            isOneToOne: false
            referencedRelation: "collab_posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_acquisition_funnel: {
        Row: {
          first_action: number | null
          onboarded: number | null
          retained_d7: number | null
          share_clicks: number | null
          signups: number | null
        }
        Relationships: []
      }
      vw_city_activity_7d: {
        Row: {
          active_users: number | null
          city_id: string | null
          collabs_7d: number | null
          country: string | null
          latitude: number | null
          longitude: number | null
          members: number | null
          name: string | null
          works_7d: number | null
          workshops_7d: number | null
        }
        Insert: {
          active_users?: never
          city_id?: string | null
          collabs_7d?: never
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          members?: never
          name?: string | null
          works_7d?: never
          workshops_7d?: never
        }
        Update: {
          active_users?: never
          city_id?: string | null
          collabs_7d?: never
          country?: string | null
          latitude?: number | null
          longitude?: number | null
          members?: never
          name?: string | null
          works_7d?: never
          workshops_7d?: never
        }
        Relationships: []
      }
      vw_collab_funnel: {
        Row: {
          applications_30d: number | null
          closed_total: number | null
          converted_to_work_90d: number | null
          guest_applications_30d: number | null
          open_now: number | null
          posts_30d: number | null
        }
        Relationships: []
      }
      vw_country_activity_7d: {
        Row: {
          active_users: number | null
          collabs_7d: number | null
          country: string | null
          members: number | null
          works_7d: number | null
          workshops_7d: number | null
        }
        Relationships: []
      }
      vw_daily_signups: {
        Row: {
          day: string | null
          signups: number | null
        }
        Relationships: []
      }
      vw_dau_series: {
        Row: {
          dau: number | null
          day: string | null
        }
        Relationships: []
      }
      vw_engagement_by_surface_7d: {
        Row: {
          actions: number | null
          active_users: number | null
          surface: string | null
        }
        Relationships: []
      }
      vw_failed_payments: {
        Row: {
          current_period_end: string | null
          display_name: string | null
          environment: string | null
          id: string | null
          status: string | null
          stripe_customer_id: string | null
          tier: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      vw_kpi_now: {
        Row: {
          active_subs: number | null
          collab_applications_7d: number | null
          collab_guest_applications_7d: number | null
          collabs_posted_7d: number | null
          collabs_total: number | null
          dau: number | null
          event_rsvps_7d: number | null
          follows_7d: number | null
          mau: number | null
          open_reports: number | null
          signups_30d: number | null
          signups_7d: number | null
          total_users: number | null
          wau: number | null
          works_published_7d: number | null
          works_total: number | null
          workshop_apps_7d: number | null
          workshops_created_7d: number | null
          workshops_total: number | null
        }
        Relationships: []
      }
      vw_marketplace_health: {
        Row: {
          avg_time_to_close_days: number | null
          avg_time_to_first_app_hours: number | null
          collabs_closed: number | null
          collabs_open: number | null
          collabs_total: number | null
          pct_with_vouches_90d: number | null
        }
        Relationships: []
      }
      vw_mrr_series: {
        Row: {
          active_subs: number | null
          week: string | null
        }
        Relationships: []
      }
      vw_referral_leaderboard: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          paid_conversions: number | null
          signups: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      vw_signup_cohort_retention: {
        Row: {
          cohort_size: number | null
          cohort_week: string | null
          retained: number | null
          retained_pct: number | null
          week_n: number | null
        }
        Relationships: []
      }
      vw_subscription_status_counts: {
        Row: {
          environment: string | null
          n: number | null
          status: string | null
          tier: string | null
        }
        Relationships: []
      }
      vw_works_funnel: {
        Row: {
          collaborative_published_30d: number | null
          drafts_30d: number | null
          published_30d: number | null
          works_created_30d: number | null
        }
        Relationships: []
      }
      vw_workshop_funnel: {
        Row: {
          apps_30d: number | null
          avg_fill_pct_90d: number | null
          confirmed_30d: number | null
          created_30d: number | null
          live_now: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_log: {
        Args: {
          _action: string
          _payload?: Json
          _target_id: string
          _target_type: string
        }
        Returns: string
      }
      blocked_user_ids: { Args: { _viewer: string }; Returns: string[] }
      bump_work_view: {
        Args: { _key: string; _work_id: string }
        Returns: undefined
      }
      can_access_collab_lounge: {
        Args: { _collab_id: string; _user_id: string }
        Returns: boolean
      }
      can_dm: { Args: { _a: string; _b: string }; Returns: boolean }
      cast_workshop_poll_vote: {
        Args: { _choice_index: number; _poll_id: string }
        Returns: undefined
      }
      check_and_bump: {
        Args: { _action: string; _key: string; _max: number; _window_s: number }
        Returns: boolean
      }
      contains_blocked_term: { Args: { _text: string }; Returns: string }
      finalize_host_claim: { Args: { _room_id: string }; Returns: undefined }
      gen_event_short_code: { Args: never; Returns: string }
      get_referral_stats: {
        Args: { _user_id: string }
        Returns: {
          months_earned: number
          paid_count: number
          pending_months: number
          signed_up_count: number
        }[]
      }
      grant_promo_pass: {
        Args: { _months: number; _reason: string; _user_id: string }
        Returns: boolean
      }
      has_max_age: {
        Args: { _max: number; _user_id: string }
        Returns: boolean
      }
      has_min_age: {
        Args: { _min: number; _user_id: string }
        Returns: boolean
      }
      has_plus: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_adult: { Args: { _user_id: string }; Returns: boolean }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_event_host: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_follow: { Args: { _a: string; _b: string }; Returns: boolean }
      is_mutual_follow: { Args: { _a: string; _b: string }; Returns: boolean }
      is_persona_member: {
        Args: { _persona_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_work_member: {
        Args: { _user_id: string; _work_id: string }
        Returns: boolean
      }
      is_work_owner: {
        Args: { _user_id: string; _work_id: string }
        Returns: boolean
      }
      is_workshop_host: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
      is_workshop_lobby_invitee: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
      is_workshop_member: {
        Args: { _user_id: string; _workshop_id: string }
        Returns: boolean
      }
      is_workshop_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      join_link_workshop: {
        Args: { _exclude_room_ids?: string[]; _token: string; _user_id: string }
        Returns: string
      }
      join_lounge:
        | { Args: { _user_id: string }; Returns: string }
        | {
            Args: { _exclude_room_ids?: string[]; _user_id: string }
            Returns: string
          }
      join_medium_lounge:
        | {
            Args: {
              _medium: Database["public"]["Enums"]["category"]
              _user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _exclude_room_ids?: string[]
              _medium: Database["public"]["Enums"]["category"]
              _user_id: string
            }
            Returns: string
          }
      list_active_instant_rooms: {
        Args: { _viewer: string }
        Returns: {
          created_at: string
          id: string
          live_count: number
          medium: Database["public"]["Enums"]["category"]
          title: string
        }[]
      }
      lounge_minutes_today: { Args: { _user_id: string }; Returns: number }
      next_local_midnight_utc: { Args: { _tz: string }; Returns: string }
      object_host_claim: { Args: { _room_id: string }; Returns: undefined }
      realtime_can_access_dm: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      realtime_can_access_instant_room: {
        Args: { _room_id: string }
        Returns: boolean
      }
      realtime_can_access_persona: {
        Args: { _persona_id: string }
        Returns: boolean
      }
      realtime_can_access_workshop: {
        Args: { _workshop_id: string }
        Returns: boolean
      }
      realtime_can_access_workshop_host: {
        Args: { _workshop_id: string }
        Returns: boolean
      }
      realtime_topic_allowed: { Args: { _topic: string }; Returns: boolean }
      redeem_group_seed_link: {
        Args: { _token: string }
        Returns: {
          already_member: boolean
          group_id: string
          joined: boolean
        }[]
      }
      resolve_group_seed_link: {
        Args: { _token: string }
        Returns: {
          group_id: string
          group_name: string
          group_slug: string
          is_active: boolean
        }[]
      }
      set_room_note: {
        Args: { _room_id: string; _text: string }
        Returns: undefined
      }
      slugify: { Args: { _in: string }; Returns: string }
      start_host_claim: { Args: { _room_id: string }; Returns: undefined }
      toggle_work_reaction: {
        Args: { _reaction: string; _work_id: string }
        Returns: {
          like_count: number
          liked: boolean
          save_count: number
          saved: boolean
        }[]
      }
      user_age: { Args: { _user_id: string }; Returns: number }
      user_attended_event: {
        Args: { _event: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status:
        | "applied"
        | "confirmed"
        | "alternate"
        | "declined"
        | "withdrawn"
        | "checked_in"
        | "no_show"
      category:
        | "film"
        | "music"
        | "writing"
        | "build"
        | "visual"
        | "critique"
        | "business"
        | "mentorship"
        | "coworking"
        | "office_hours"
        | "pitch"
        | "roundtable"
        | "listen_party"
        | "open_mic"
        | "jam"
        | "standup"
        | "writing_book"
      collab_invite_status:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "left"
      collab_post_status: "open" | "closed" | "archived" | "removed" | "draft"
      compensation_type:
        | "paid"
        | "unpaid"
        | "credit"
        | "negotiable"
        | "unspecified"
      contact_mode: "email_relay" | "external_link"
      creator_status:
        | "standard"
        | "founding_creator"
        | "city_host"
        | "verified_creator"
        | "admin"
      event_visibility: "public" | "group_only" | "hidden"
      group_category:
        | "music"
        | "film_video"
        | "writing"
        | "visual_art"
        | "games_tech"
        | "performance"
        | "audio"
        | "scene_life"
        | "city"
      group_event_format: "in_person" | "online" | "hybrid"
      group_event_kind:
        | "open_mic"
        | "listening_party"
        | "networking"
        | "screening"
        | "workshop_irl"
        | "online"
        | "other"
        | "lineup"
      group_event_rsvp_mode: "open" | "approval" | "invite_only"
      group_event_rsvp_status:
        | "going"
        | "maybe"
        | "waitlist"
        | "declined"
        | "canceled"
      group_event_status:
        | "draft"
        | "scheduled"
        | "live"
        | "completed"
        | "canceled"
      group_event_visibility: "public" | "group_only" | "unlisted"
      group_join_mode: "open" | "gated"
      group_kind: "city" | "genre" | "micro" | "scene"
      group_member_role: "member" | "steward" | "owner"
      group_visibility: "public" | "unlisted"
      instant_status: "active" | "archived"
      lineup_signup_status: "confirmed" | "waitlist" | "released"
      location_type: "online" | "in_person" | "hybrid"
      meetup_status: "active" | "paused" | "archived"
      participant_status:
        | "confirmed"
        | "checked_in"
        | "dropped"
        | "removed"
        | "completed"
      relationship_type: "worked_with" | "made_with_at_event" | "recently_met"
      report_status: "open" | "reviewed" | "dismissed" | "action_taken"
      stripe_environment: "sandbox" | "live"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
      subscription_tier: "free" | "plus"
      timeline_mode: "asap" | "by_date" | "window" | "ongoing" | "flexible"
      tool_type:
        | "pinboard"
        | "external_call_link"
        | "shot_list"
        | "track_list"
        | "outline"
        | "repo_links"
        | "moodboard"
        | "list"
        | "drive"
        | "docs"
        | "board"
        | "screen_share"
        | "recorder"
        | "pip"
      visibility: "public" | "unlisted" | "invite_only" | "private"
      work_license:
        | "cc_by"
        | "rights_managed_externally"
        | "portfolio_credit_only"
        | "private"
      work_source_type:
        | "workshop"
        | "collab_board"
        | "meetup"
        | "instant"
        | "manual"
      work_status: "draft" | "published" | "hidden" | "removed"
      workshop_mode: "scheduled" | "irl" | "hybrid" | "instant_spawned"
      workshop_status:
        | "draft"
        | "open"
        | "check_in"
        | "active"
        | "finalizing"
        | "shipped"
        | "archived"
        | "canceled"
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
      app_role: ["admin", "moderator", "user"],
      application_status: [
        "applied",
        "confirmed",
        "alternate",
        "declined",
        "withdrawn",
        "checked_in",
        "no_show",
      ],
      category: [
        "film",
        "music",
        "writing",
        "build",
        "visual",
        "critique",
        "business",
        "mentorship",
        "coworking",
        "office_hours",
        "pitch",
        "roundtable",
        "listen_party",
        "open_mic",
        "jam",
        "standup",
        "writing_book",
      ],
      collab_invite_status: [
        "pending",
        "accepted",
        "declined",
        "withdrawn",
        "left",
      ],
      collab_post_status: ["open", "closed", "archived", "removed", "draft"],
      compensation_type: [
        "paid",
        "unpaid",
        "credit",
        "negotiable",
        "unspecified",
      ],
      contact_mode: ["email_relay", "external_link"],
      creator_status: [
        "standard",
        "founding_creator",
        "city_host",
        "verified_creator",
        "admin",
      ],
      event_visibility: ["public", "group_only", "hidden"],
      group_category: [
        "music",
        "film_video",
        "writing",
        "visual_art",
        "games_tech",
        "performance",
        "audio",
        "scene_life",
        "city",
      ],
      group_event_format: ["in_person", "online", "hybrid"],
      group_event_kind: [
        "open_mic",
        "listening_party",
        "networking",
        "screening",
        "workshop_irl",
        "online",
        "other",
        "lineup",
      ],
      group_event_rsvp_mode: ["open", "approval", "invite_only"],
      group_event_rsvp_status: [
        "going",
        "maybe",
        "waitlist",
        "declined",
        "canceled",
      ],
      group_event_status: [
        "draft",
        "scheduled",
        "live",
        "completed",
        "canceled",
      ],
      group_event_visibility: ["public", "group_only", "unlisted"],
      group_join_mode: ["open", "gated"],
      group_kind: ["city", "genre", "micro", "scene"],
      group_member_role: ["member", "steward", "owner"],
      group_visibility: ["public", "unlisted"],
      instant_status: ["active", "archived"],
      lineup_signup_status: ["confirmed", "waitlist", "released"],
      location_type: ["online", "in_person", "hybrid"],
      meetup_status: ["active", "paused", "archived"],
      participant_status: [
        "confirmed",
        "checked_in",
        "dropped",
        "removed",
        "completed",
      ],
      relationship_type: ["worked_with", "made_with_at_event", "recently_met"],
      report_status: ["open", "reviewed", "dismissed", "action_taken"],
      stripe_environment: ["sandbox", "live"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
      ],
      subscription_tier: ["free", "plus"],
      timeline_mode: ["asap", "by_date", "window", "ongoing", "flexible"],
      tool_type: [
        "pinboard",
        "external_call_link",
        "shot_list",
        "track_list",
        "outline",
        "repo_links",
        "moodboard",
        "list",
        "drive",
        "docs",
        "board",
        "screen_share",
        "recorder",
        "pip",
      ],
      visibility: ["public", "unlisted", "invite_only", "private"],
      work_license: [
        "cc_by",
        "rights_managed_externally",
        "portfolio_credit_only",
        "private",
      ],
      work_source_type: [
        "workshop",
        "collab_board",
        "meetup",
        "instant",
        "manual",
      ],
      work_status: ["draft", "published", "hidden", "removed"],
      workshop_mode: ["scheduled", "irl", "hybrid", "instant_spawned"],
      workshop_status: [
        "draft",
        "open",
        "check_in",
        "active",
        "finalizing",
        "shipped",
        "archived",
        "canceled",
      ],
    },
  },
} as const
