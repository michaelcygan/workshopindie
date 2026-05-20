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
      collab_guest_applications: {
        Row: {
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
          location_mode: Database["public"]["Enums"]["location_type"]
          resulting_work_id: string | null
          slug: string
          starts_on: string | null
          status: Database["public"]["Enums"]["collab_post_status"]
          subcategories: string[]
          timeline_mode: Database["public"]["Enums"]["timeline_mode"]
          timeline_text: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          also_cities?: string[]
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
          location_mode?: Database["public"]["Enums"]["location_type"]
          resulting_work_id?: string | null
          slug: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["collab_post_status"]
          subcategories?: string[]
          timeline_mode?: Database["public"]["Enums"]["timeline_mode"]
          timeline_text?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          also_cities?: string[]
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
          location_mode?: Database["public"]["Enums"]["location_type"]
          resulting_work_id?: string | null
          slug?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["collab_post_status"]
          subcategories?: string[]
          timeline_mode?: Database["public"]["Enums"]["timeline_mode"]
          timeline_text?: string | null
          title?: string
          updated_at?: string
          user_id?: string
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
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
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
      instant_rooms: {
        Row: {
          category: Database["public"]["Enums"]["category"] | null
          city_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          ends_at: string | null
          id: string
          kind: string
          medium: Database["public"]["Enums"]["category"] | null
          participant_cap: number
          prompt: string | null
          slug: string | null
          status: Database["public"]["Enums"]["instant_status"]
          title: string
          workshop_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["category"] | null
          city_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          medium?: Database["public"]["Enums"]["category"] | null
          participant_cap?: number
          prompt?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["instant_status"]
          title: string
          workshop_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["category"] | null
          city_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          medium?: Database["public"]["Enums"]["category"] | null
          participant_cap?: number
          prompt?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["instant_status"]
          title?: string
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
            foreignKeyName: "instant_rooms_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
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
          mp4_fallback_url: string | null
          owner_id: string
          provider: string | null
          status: string
          work_id: string | null
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          hls_url?: string | null
          id?: string
          kind: string
          mp4_fallback_url?: string | null
          owner_id: string
          provider?: string | null
          status?: string
          work_id?: string | null
        }
        Update: {
          bytes?: number | null
          created_at?: string
          duration_s?: number | null
          hls_url?: string | null
          id?: string
          kind?: string
          mp4_fallback_url?: string | null
          owner_id?: string
          provider?: string | null
          status?: string
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
          avatar_url: string | null
          bio: string | null
          categories: Database["public"]["Enums"]["category"][]
          city_id: string | null
          cover_url: string | null
          created_at: string
          creator_status: Database["public"]["Enums"]["creator_status"]
          display_name: string | null
          external_links: Json
          first_name: string | null
          follower_count: number
          following_count: number
          headline: string | null
          home_city_changed_at: string | null
          home_city_id: string | null
          id: string
          instagram_handle: string | null
          last_name: string | null
          onboarded: boolean
          pinned_work_ids: string[]
          tour_completed_at: string | null
          updated_at: string
          username: string | null
          work_count: number
          worked_with_count: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          categories?: Database["public"]["Enums"]["category"][]
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          display_name?: string | null
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id: string
          instagram_handle?: string | null
          last_name?: string | null
          onboarded?: boolean
          pinned_work_ids?: string[]
          tour_completed_at?: string | null
          updated_at?: string
          username?: string | null
          work_count?: number
          worked_with_count?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          categories?: Database["public"]["Enums"]["category"][]
          city_id?: string | null
          cover_url?: string | null
          created_at?: string
          creator_status?: Database["public"]["Enums"]["creator_status"]
          display_name?: string | null
          external_links?: Json
          first_name?: string | null
          follower_count?: number
          following_count?: number
          headline?: string | null
          home_city_changed_at?: string | null
          home_city_id?: string | null
          id?: string
          instagram_handle?: string | null
          last_name?: string | null
          onboarded?: boolean
          pinned_work_ids?: string[]
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
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          embed_url: string | null
          excerpt: string | null
          featured: boolean
          id: string
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
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          embed_url?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
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
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          embed_url?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
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
          application_count: number
          category: Database["public"]["Enums"]["category"]
          check_in_closes_at: string | null
          check_in_opens_at: string | null
          city_id: string | null
          confirmed_count: number
          created_at: string
          ends_at: string | null
          external_call_url: string | null
          finalization_deadline_at: string | null
          host_user_id: string
          id: string
          license_type: Database["public"]["Enums"]["work_license"]
          location_text: string | null
          location_type: Database["public"]["Enums"]["location_type"]
          mode: Database["public"]["Enums"]["workshop_mode"]
          participant_cap: number | null
          prompt: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["workshop_status"]
          subcategories: string[]
          title: string
          updated_at: string
          venue_address: string | null
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
          venue_osm_ref: string | null
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          application_count?: number
          category: Database["public"]["Enums"]["category"]
          check_in_closes_at?: string | null
          check_in_opens_at?: string | null
          city_id?: string | null
          confirmed_count?: number
          created_at?: string
          ends_at?: string | null
          external_call_url?: string | null
          finalization_deadline_at?: string | null
          host_user_id: string
          id?: string
          license_type?: Database["public"]["Enums"]["work_license"]
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          mode?: Database["public"]["Enums"]["workshop_mode"]
          participant_cap?: number | null
          prompt?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          subcategories?: string[]
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          venue_osm_ref?: string | null
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          application_count?: number
          category?: Database["public"]["Enums"]["category"]
          check_in_closes_at?: string | null
          check_in_opens_at?: string | null
          city_id?: string | null
          confirmed_count?: number
          created_at?: string
          ends_at?: string | null
          external_call_url?: string | null
          finalization_deadline_at?: string | null
          host_user_id?: string
          id?: string
          license_type?: Database["public"]["Enums"]["work_license"]
          location_text?: string | null
          location_type?: Database["public"]["Enums"]["location_type"]
          mode?: Database["public"]["Enums"]["workshop_mode"]
          participant_cap?: number | null
          prompt?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["workshop_status"]
          subcategories?: string[]
          title?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_dm: { Args: { _a: string; _b: string }; Returns: boolean }
      check_and_bump: {
        Args: { _action: string; _key: string; _max: number; _window_s: number }
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
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_workshop_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      join_lounge: { Args: { _user_id: string }; Returns: string }
      join_medium_lounge: {
        Args: {
          _medium: Database["public"]["Enums"]["category"]
          _user_id: string
        }
        Returns: string
      }
      list_active_instant_rooms: {
        Args: never
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
