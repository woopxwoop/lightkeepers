export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  pgbouncer: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth: {
        Args: { p_usename: string }
        Returns: {
          password: string
          username: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      abyss_versions: {
        Row: {
          created_at: string
          version_name: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          version_name?: string | null
          version_number: number
        }
        Update: {
          created_at?: string
          version_name?: string | null
          version_number?: number
        }
        Relationships: []
      }
      account: {
        Row: {
          accessToken: string | null
          accessTokenExpiresAt: string | null
          accountId: string
          createdAt: string
          id: string
          idToken: string | null
          password: string | null
          providerId: string
          refreshToken: string | null
          refreshTokenExpiresAt: string | null
          scope: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId: string
          createdAt?: string
          id: string
          idToken?: string | null
          password?: string | null
          providerId: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt: string
          userId: string
        }
        Update: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId?: string
          createdAt?: string
          id?: string
          idToken?: string | null
          password?: string | null
          providerId?: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_userId_fkey"
            columns: ["userId"]
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      character_stats_abyss: {
        Row: {
          character_id: number
          created_at: string
          ownership: number | null
          ownership_rate: number | null
          usage: number | null
          usage_rate: number | null
          version_number: number
        }
        Insert: {
          character_id: number
          created_at?: string
          ownership?: number | null
          ownership_rate?: number | null
          usage?: number | null
          usage_rate?: number | null
          version_number: number
        }
        Update: {
          character_id?: number
          created_at?: string
          ownership?: number | null
          ownership_rate?: number | null
          usage?: number | null
          usage_rate?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_stats_abyss_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "character_stats_abyss_version_number_fkey"
            columns: ["version_number"]
            referencedRelation: "abyss_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      character_stats_stygian: {
        Row: {
          character_id: number
          created_at: string
          ownership: number | null
          ownership_rate: number | null
          usage: number | null
          usage_rate: number | null
          version_number: number
        }
        Insert: {
          character_id: number
          created_at?: string
          ownership?: number | null
          ownership_rate?: number | null
          usage?: number | null
          usage_rate?: number | null
          version_number: number
        }
        Update: {
          character_id?: number
          created_at?: string
          ownership?: number | null
          ownership_rate?: number | null
          usage?: number | null
          usage_rate?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_stats_stygian_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "character_stats_stygian_version_number_fkey"
            columns: ["version_number"]
            referencedRelation: "stygian_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      characters: {
        Row: {
          created_at: string
          element: string | null
          game_id: number
          name: string | null
          name_id: string
          rarity: number | null
          released_at: string | null
          weapon_type: string | null
        }
        Insert: {
          created_at?: string
          element?: string | null
          game_id: number
          name?: string | null
          name_id: string
          rarity?: number | null
          released_at?: string | null
          weapon_type?: string | null
        }
        Update: {
          created_at?: string
          element?: string | null
          game_id?: number
          name?: string | null
          name_id?: string
          rarity?: number | null
          released_at?: string | null
          weapon_type?: string | null
        }
        Relationships: []
      }
      enemies: {
        Row: {
          asset: string | null
          created_at: string
          description: string | null
          enemy_name: string | null
          icon_path: string | null
          id: number
        }
        Insert: {
          asset?: string | null
          created_at?: string
          description?: string | null
          enemy_name?: string | null
          icon_path?: string | null
          id: number
        }
        Update: {
          asset?: string | null
          created_at?: string
          description?: string | null
          enemy_name?: string | null
          icon_path?: string | null
          id?: number
        }
        Relationships: []
      }
      lunaris_abyss_versions: {
        Row: {
          buff_name: string | null
          close_time: string
          created_at: string
          floors: Json | null
          open_time: string
          schedule_id: number
          ys_abyss_version: number | null
        }
        Insert: {
          buff_name?: string | null
          close_time: string
          created_at?: string
          floors?: Json | null
          open_time: string
          schedule_id?: number
          ys_abyss_version?: number | null
        }
        Update: {
          buff_name?: string | null
          close_time?: string
          created_at?: string
          floors?: Json | null
          open_time?: string
          schedule_id?: number
          ys_abyss_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lunaris_abyss_versions_ys_abyss_version_fkey"
            columns: ["ys_abyss_version"]
            referencedRelation: "abyss_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      lunaris_stygian_versions: {
        Row: {
          challenge_name: string | null
          close_time: string
          created_at: string
          levels: Json | null
          open_time: string
          schedule_id: number
          ys_stygian_version: number | null
        }
        Insert: {
          challenge_name?: string | null
          close_time: string
          created_at?: string
          levels?: Json | null
          open_time: string
          schedule_id?: number
          ys_stygian_version?: number | null
        }
        Update: {
          challenge_name?: string | null
          close_time?: string
          created_at?: string
          levels?: Json | null
          open_time?: string
          schedule_id?: number
          ys_stygian_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lunaris_stygian_versions_ys_stygian_version_fkey"
            columns: ["ys_stygian_version"]
            referencedRelation: "stygian_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      session: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          ipAddress: string | null
          token: string
          updatedAt: string
          userAgent: string | null
          userId: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          ipAddress?: string | null
          token: string
          updatedAt: string
          userAgent?: string | null
          userId: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          ipAddress?: string | null
          token?: string
          updatedAt?: string
          userAgent?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_userId_fkey"
            columns: ["userId"]
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      stygian_version_enemies: {
        Row: {
          enemy_id: number
          slot_index: number
          version_number: number
        }
        Insert: {
          enemy_id: number
          slot_index: number
          version_number: number
        }
        Update: {
          enemy_id?: number
          slot_index?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "stygian_version_enemies_enemy_id_fkey"
            columns: ["enemy_id"]
            referencedRelation: "enemies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stygian_version_enemies_version_number_fkey"
            columns: ["version_number"]
            referencedRelation: "stygian_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      stygian_versions: {
        Row: {
          created_at: string
          version_name: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          version_name?: string | null
          version_number: number
        }
        Update: {
          created_at?: string
          version_name?: string | null
          version_number?: number
        }
        Relationships: []
      }
      team_characters: {
        Row: {
          character_id: number
          team_key: string
        }
        Insert: {
          character_id: number
          team_key: string
        }
        Update: {
          character_id?: number
          team_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_characters_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "team_characters_team_key_fkey"
            columns: ["team_key"]
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
        ]
      }
      team_stats_abyss: {
        Row: {
          created_at: string
          field_1_rate: number
          field_2_rate: number
          has_total: number
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }
        Insert: {
          created_at?: string
          field_1_rate: number
          field_2_rate: number
          has_total: number
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }
        Update: {
          created_at?: string
          field_1_rate?: number
          field_2_rate?: number
          has_total?: number
          team_key?: string
          usage_rate?: number
          usage_total?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_abyss_team_key_fkey"
            columns: ["team_key"]
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
          {
            foreignKeyName: "team_stats_abyss_version_number_fkey"
            columns: ["version_number"]
            referencedRelation: "abyss_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      team_stats_stygian: {
        Row: {
          created_at: string
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          has_total: number
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }
        Insert: {
          created_at?: string
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          has_total: number
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }
        Update: {
          created_at?: string
          field_1_rate?: number
          field_2_rate?: number
          field_3_rate?: number
          has_total?: number
          team_key?: string
          usage_rate?: number
          usage_total?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_stygian_team_key_fkey"
            columns: ["team_key"]
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
          {
            foreignKeyName: "team_stats_stygian_version_number_fkey"
            columns: ["version_number"]
            referencedRelation: "stygian_versions"
            referencedColumns: ["version_number"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          team_key: string
        }
        Insert: {
          created_at?: string
          team_key: string
        }
        Update: {
          created_at?: string
          team_key?: string
        }
        Relationships: []
      }
      user: {
        Row: {
          createdAt: string
          email: string
          emailVerified: boolean
          id: string
          image: string | null
          name: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          emailVerified: boolean
          id: string
          image?: string | null
          name: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          email?: string
          emailVerified?: boolean
          id?: string
          image?: string | null
          name?: string
          updatedAt?: string
        }
        Relationships: []
      }
      user_rosters: {
        Row: {
          id: string
          roster: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          roster?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          roster?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rosters_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      verification: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          identifier: string
          updatedAt: string
          value: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          identifier: string
          updatedAt?: string
          value: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          identifier?: string
          updatedAt?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      character_usage_avg_abyss: {
        Row: {
          avg_usage_rate: number | null
          character_id: number | null
          cycles: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_stats_abyss_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
        ]
      }
      character_usage_avg_stygian: {
        Row: {
          avg_usage_rate: number | null
          character_id: number | null
          cycles: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_stats_stygian_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
        ]
      }
      stygian_avg_teams: {
        Row: {
          avg_usage_rate: number | null
          members: string[] | null
          members_names: string[] | null
          team_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_stygian_team_key_fkey"
            columns: ["team_key"]
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
        ]
      }
      stygian_character_pair_pmi: {
        Row: {
          char_a: string | null
          char_b: string | null
          p_a: number | null
          p_ab: number | null
          p_b: number | null
          pmi: number | null
        }
        Relationships: []
      }
      stygian_team_avg_usage: {
        Row: {
          avg_usage_rate: number | null
          team_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_stats_stygian_team_key_fkey"
            columns: ["team_key"]
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
        ]
      }
    }
    Functions: {
      get_character_top_teams_by_version_abyss: {
        Args: { p_limit?: number; p_name_id: string }
        Returns: {
          field_1_rate: number
          field_2_rate: number
          has_total: number
          members: string[]
          members_names: string[]
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }[]
      }
      get_character_top_teams_by_version_stygian: {
        Args: { p_limit?: number; p_name_id: string }
        Returns: {
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          has_total: number
          members: string[]
          members_names: string[]
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }[]
      }
      get_character_usage_series_abyss: {
        Args: { p_name_id: string }
        Returns: {
          ownership: number
          ownership_rate: number
          usage: number
          usage_rate: number
          version_name: string
          version_number: number
        }[]
      }
      get_character_usage_series_stygian: {
        Args: { p_name_id: string }
        Returns: {
          ownership: number
          ownership_rate: number
          usage: number
          usage_rate: number
          version_name: string
          version_number: number
        }[]
      }
      get_near_miss_stygian_pairs: {
        Args: {
          p_min_pmi?: number
          p_name_ids: string[]
          p_version_number: number
        }
        Returns: {
          avg_usage_rate: number
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          members: string[]
          members_names: string[]
          missing_character_a: string
          missing_character_a_name: string
          missing_character_b: string
          missing_character_b_name: string
          pmi: number
          team_key: string
          usage_rate: number
          usage_total: number
        }[]
      }
      get_near_miss_stygian_teams: {
        Args: { p_name_ids: string[]; p_version_number: number }
        Returns: {
          avg_usage_rate: number
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          members: string[]
          members_names: string[]
          missing_character: string
          missing_character_name: string
          team_key: string
          usage_rate: number
          usage_total: number
        }[]
      }
      get_teams_with_characters_subset: {
        Args: { p_name_ids: string[]; p_version_number: number }
        Returns: {
          field_1_rate: number
          field_2_rate: number
          has_total: number
          members: string[]
          members_names: string[]
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }[]
      }
      get_teams_with_characters_subset_stygian: {
        Args: { p_name_ids: string[]; p_version_number: number }
        Returns: {
          avg_usage_rate: number
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          has_total: number
          members: string[]
          members_names: string[]
          team_key: string
          usage_rate: number
          usage_total: number
          version_number: number
        }[]
      }
      get_top_teams_for_stygian_enemy: {
        Args: { p_enemy_id: number; p_limit: number }
        Returns: {
          field_1_rate: number
          field_2_rate: number
          field_3_rate: number
          field_rate: number
          has_total: number
          members: string[]
          members_names: string[]
          slot_index: number
          team_key: string
          usage_rate: number
          usage_total: number
          version_name: string
          version_number: number
        }[]
      }
      refresh_stygian_views: { Args: never; Returns: undefined }
      upsert_abyss_team_batch: {
        Args: { p_members: Json; p_stats: Json; p_teams: Json }
        Returns: undefined
      }
      upsert_stygian_team_batch: {
        Args: { p_members: Json; p_stats: Json; p_teams: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  pgbouncer: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
