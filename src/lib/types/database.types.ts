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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "character_stats_abyss_version_number_fkey"
            columns: ["version_number"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "character_stats_stygian_version_number_fkey"
            columns: ["version_number"]
            isOneToOne: false
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
            isOneToOne: true
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
            isOneToOne: true
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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "enemies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stygian_version_enemies_version_number_fkey"
            columns: ["version_number"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "team_characters_team_key_fkey"
            columns: ["team_key"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
          {
            foreignKeyName: "team_stats_abyss_version_number_fkey"
            columns: ["version_number"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
          {
            foreignKeyName: "team_stats_stygian_version_number_fkey"
            columns: ["version_number"]
            isOneToOne: false
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
        Relationships: []
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
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_key"]
          },
        ]
      }
    }
    Functions: {
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
  public: {
    Enums: {},
  },
} as const
