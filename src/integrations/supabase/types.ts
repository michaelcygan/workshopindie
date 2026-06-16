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
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          context_collab_post_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          context_collab_post_id?: string | null
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
      instant_messages: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          id?: string
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
          last_seen_at: string
          room_id: string
          status: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          room_id: string
          status?: string
          user_id: string
        }
        Update: {
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
          created_at: string
          creator_id: string | null
          description: string | null
          ended_by_user_id: string | null
          ends_at: string | null
          focus_message: string | null
          host_user_id: string | null
          id: string
          kind: string
          locked: boolean
          medium: Database["public"]["Enums"]["category"] | null
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
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ended_by_user_id?: string | null
          ends_at?: string | null
          focus_message?: string | null
          host_user_id?: string | null
          id?: string
          kind?: string
          locked?: boolean
          medium?: Database["public"]["Enums"]["category"] | null
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
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ended_by_user_id?: string | null
          ends_at?: string | null
          focus_message?: string | null
          host_user_id?: string | null
          id?: string
          kind?: string
          locked?: boolean
          medium?: Database["public"]["Enums"]["category"] | null
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
          email_messages: boolean
          email_product_news: boolean
          email_workshop_updates: boolean
          inapp_collab_activity: boolean
          inapp_credits: boolean
          inapp_follows: boolean
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
          email_messages?: boolean
          email_product_news?: boolean
          email_workshop_updates?: boolean
          inapp_collab_activity?: boolean
          inapp_credits?: boolean
          inapp_follows?: boolean
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
          email_messages?: boolean
          email_product_news?: boolean
          email_workshop_updates?: boolean
          inapp_collab_activity?: boolean
          inapp_credits?: boolean
          inapp_follows?: boolean
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
          city_id: string | null
          cover_url: string | null
          created_at: string
          creator_status: Database["public"]["Enums"]["creator_status"]
          deleted_at: string | null
          discoverable: boolean
          display_name: string | null
          dm_policy: string
          external_links: Json
          first_name: string | null
          follower_count: number
          following_count: number
          headline: string | null
          home_city_changed_at: string | null
          home_city_id: string | null
          id: string
          indexable: boolean
          instagram_handle: string | null
          last_name: string | null
          mediums: string[]
          onboarded: boolean
          pinned_work_ids: string[]
          referred_by: string | null
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
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          deleted_at?: string | null
          discoverable?: boolean
          display_name?: string | null
          dm_policy?: string
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id: string
          indexable?: boolean
          instagram_handle?: string | null
          last_name?: string | null
          mediums?: string[]
          onboarded?: boolean
          pinned_work_ids?: string[]
          referred_by?: string | null
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
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          deleted_at?: string | null
          discoverable?: boolean
          display_name?: string | null
          dm_policy?: string
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id?: string
          indexable?: boolean
          instagram_handle?: string | null
          last_name?: string | null
          mediums?: string[]
          onboarded?: boolean
          pinned_work_ids?: string[]
          referred_by?: string | null
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
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
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
          hidden_from_profile: boolean
          id: string
          role_label: string
          sort_order: number
          user_id: string
          work_id: string
        }
        Insert: {
          created_at?: string
          hidden_from_profile?: boolean
          id?: string
          role_label: string
          sort_order?: number
          user_id: string
          work_id: string
        }
        Update: {
          created_at?: string
          hidden_from_profile?: boolean
          id?: string
          role_label?: string
          sort_order?: number
          user_id?: string
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
      works: {
        Row: {
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
          title: string
          updated_at: string
          view_count: number
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
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
          title: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
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
          title?: string
          updated_at?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["visibility"]
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
      [_ in never]: never
    }
    Functions: {
      blocked_user_ids: { Args: { _viewer: string }; Returns: string[] }
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
      get_referral_stats: {
        Args: { _user_id: string }
        Returns: {
          months_earned: number
          paid_count: number
          pending_months: number
          signed_up_count: number
        }[]
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
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
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
      slugify: { Args: { _in: string }; Returns: string }
      user_age: { Args: { _user_id: string }; Returns: number }
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
      collab_invite_status: "pending" | "accepted" | "declined" | "withdrawn"
      collab_post_status: "open" | "closed" | "archived" | "removed"
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
      instant_status: "active" | "archived"
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
      ],
      collab_invite_status: ["pending", "accepted", "declined", "withdrawn"],
      collab_post_status: ["open", "closed", "archived", "removed"],
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
      instant_status: ["active", "archived"],
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
