export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      abyss_team_members: {
        Row: {
          character_id: string;
          team_id: string;
        };
        Insert: {
          character_id: string;
          team_id: string;
        };
        Update: {
          character_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abyss_team_members_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abyss_team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "abyss_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      abyss_teams: {
        Row: {
          created_at: string | null;
          id: string;
          team_key: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          team_key: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          team_key?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          character_id: number | null;
          element: string | null;
          enka_icon: string | null;
          icon: string | null;
          id: string;
          name: string;
          name_id: string | null;
          rarity: number | null;
          weapon_type: string | null;
        };
        Insert: {
          character_id?: number | null;
          element?: string | null;
          enka_icon?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          name_id?: string | null;
          rarity?: number | null;
          weapon_type?: string | null;
        };
        Update: {
          character_id?: number | null;
          element?: string | null;
          enka_icon?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          name_id?: string | null;
          rarity?: number | null;
          weapon_type?: string | null;
        };
        Relationships: [];
      };
      enemies: {
        Row: {
          id: number;
          lunaris_asset: string | null;
        };
        Insert: {
          id?: number;
          lunaris_asset?: string | null;
        };
        Update: {
          id?: number;
          lunaris_asset?: string | null;
        };
        Relationships: [];
      };
      ranked_combinations: {
        Row: {
          game_type: string;
          id: string;
          rank: number;
          score: number;
          slot_assignments: Json;
          version_number: number;
        };
        Insert: {
          game_type: string;
          id?: string;
          rank: number;
          score: number;
          slot_assignments: Json;
          version_number: number;
        };
        Update: {
          game_type?: string;
          id?: string;
          rank?: number;
          score?: number;
          slot_assignments?: Json;
          version_number?: number;
        };
        Relationships: [];
      };
      stygian_team_members: {
        Row: {
          character_id: string;
          team_id: string;
        };
        Insert: {
          character_id: string;
          team_id: string;
        };
        Update: {
          character_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_team_members_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stygian_team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "stygian_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      stygian_team_stats: {
        Row: {
          has: number | null;
          team_id: string;
          usage_rate_bottom: number | null;
          usage_rate_middle: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          use: number | null;
          version_number: number;
        };
        Insert: {
          has?: number | null;
          team_id: string;
          usage_rate_bottom?: number | null;
          usage_rate_middle?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          use?: number | null;
          version_number: number;
        };
        Update: {
          has?: number | null;
          team_id?: string;
          usage_rate_bottom?: number | null;
          usage_rate_middle?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          use?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_team_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "stygian_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      stygian_teams: {
        Row: {
          created_at: string | null;
          id: string;
          team_key: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          team_key: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          team_key?: string;
        };
        Relationships: [];
      };
      stygian_versions: {
        Row: {
          enemy_id_1: number | null;
          enemy_id_2: number | null;
          enemy_id_3: number | null;
          schedule_id: number | null;
          version: string;
          version_number: number;
        };
        Insert: {
          enemy_id_1?: number | null;
          enemy_id_2?: number | null;
          enemy_id_3?: number | null;
          schedule_id?: number | null;
          version: string;
          version_number: number;
        };
        Update: {
          enemy_id_1?: number | null;
          enemy_id_2?: number | null;
          enemy_id_3?: number | null;
          schedule_id?: number | null;
          version?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_versions_enemy_id_1_fkey";
            columns: ["enemy_id_1"];
            isOneToOne: false;
            referencedRelation: "enemies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stygian_versions_enemy_id_2_fkey";
            columns: ["enemy_id_2"];
            isOneToOne: false;
            referencedRelation: "enemies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stygian_versions_enemy_id_3_fkey";
            columns: ["enemy_id_3"];
            isOneToOne: false;
            referencedRelation: "enemies";
            referencedColumns: ["id"];
          },
        ];
      };
      team_stats: {
        Row: {
          has: number | null;
          team_id: string;
          usage_rate_bottom: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          use: number | null;
          version_number: number;
        };
        Insert: {
          has?: number | null;
          team_id: string;
          usage_rate_bottom?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          use?: number | null;
          version_number: number;
        };
        Update: {
          has?: number | null;
          team_id?: string;
          usage_rate_bottom?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          use?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "abyss_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      url_to_character_mapping: {
        Row: {
          character_name: string;
          url: string;
        };
        Insert: {
          character_name: string;
          url: string;
        };
        Update: {
          character_name?: string;
          url?: string;
        };
        Relationships: [];
      };
      versions: {
        Row: {
          version: string;
          version_number: number;
        };
        Insert: {
          version: string;
          version_number: number;
        };
        Update: {
          version?: string;
          version_number?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      stygian_character_pair_pmi: {
        Row: {
          char_a: string | null;
          char_b: string | null;
          p_a: number | null;
          p_ab: number | null;
          p_b: number | null;
          pmi: number | null;
        };
        Relationships: [];
      };
      stygian_character_substitutions_mv: {
        Row: {
          avg_original_usage: number | null;
          avg_substitute_usage: number | null;
          coverage: number | null;
          observed_cores: number | null;
          source_character: string | null;
          substitute_character: string | null;
          substitute_score: number | null;
          usage_ratio: number | null;
        };
        Relationships: [];
      };
      stygian_team_avg_usage: {
        Row: {
          avg_usage_total: number | null;
          team_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_team_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "stygian_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      top_100_abyss_teams: {
        Row: {
          members: string[] | null;
          team_key: string | null;
          usage_rate_bottom: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number | null;
        };
        Relationships: [];
      };
      top_100_stygian_teams: {
        Row: {
          members: string[] | null;
          team_key: string | null;
          usage_rate_bottom: number | null;
          usage_rate_middle: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_character_substitutes_abyss_v2: {
        Args: {
          p_character_name: string;
          p_limit?: number;
          p_min_cores?: number;
          p_version_number: number;
        };
        Returns: {
          avg_original_usage: number;
          avg_substitute_usage: number;
          coverage: number;
          example_core: string[];
          observed_cores: number;
          source_character: string;
          substitute_character: string;
          substitute_score: number;
          usage_ratio: number;
        }[];
      };
      get_character_substitutes_stygian: {
        Args: { p_character_name: string; p_version_number: number };
        Returns: {
          avg_original_usage: number;
          avg_substitute_usage: number;
          example_core: string[];
          observed_cores: number;
          substitute_character: string;
          usage_ratio: number;
        }[];
      };
      get_character_substitutes_stygian_v2: {
        Args: {
          p_character_name: string;
          p_limit?: number;
          p_min_cores?: number;
          p_version_number: number;
        };
        Returns: {
          avg_original_usage: number;
          avg_substitute_usage: number;
          coverage: number;
          example_core: string[];
          observed_cores: number;
          source_character: string;
          substitute_character: string;
          substitute_score: number;
          usage_ratio: number;
        }[];
      };
      get_element_substitutes: {
        Args: {
          p_limit?: number;
          p_missing_character: string;
          p_owned_characters: string[];
          p_version_number: number;
        };
        Returns: {
          appearances: number;
          avg_usage: number;
          element: string;
          substitute_character: string;
        }[];
      };
      get_near_miss_stygian_pairs: {
        Args: {
          p_character_names: string[];
          p_min_pmi?: number;
          p_version_number: number;
        };
        Returns: {
          avg_usage_total: number;
          members: string[];
          missing_char_a: string;
          missing_char_b: string;
          pmi: number;
          ret_version_number: number;
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_middle: number;
          usage_rate_top: number;
          usage_total: number;
        }[];
      };
      get_near_miss_stygian_teams: {
        Args: { p_character_names: string[]; p_version_number: number };
        Returns: {
          avg_usage_total: number;
          members: string[];
          missing_character: string;
          ret_version_number: number;
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_middle: number;
          usage_rate_top: number;
          usage_total: number;
        }[];
      };
      get_pmi_core_teams_stygian: {
        Args: {
          p_character_names: string[];
          p_min_pmi?: number;
          p_top_pairs?: number;
          p_version_number: number;
        };
        Returns: {
          char_a: string;
          char_b: string;
          members: string[];
          missing_member: string;
          owned_member_count: number;
          pair_frequency: number;
          pmi: number;
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_middle: number;
          usage_rate_top: number;
          usage_total: number;
        }[];
      };
      get_ranked_combinations_abyss: {
        Args: { p_version_number: number };
        Returns: {
          rank: number;
          score: number;
          slot_assignments: Json;
        }[];
      };
      get_ranked_combinations_stygian: {
        Args: { p_version_number: number };
        Returns: {
          rank: number;
          score: number;
          slot_assignments: Json;
        }[];
      };
      get_teams_by_character: {
        Args: { p_character_name: string; p_version_number: number };
        Returns: {
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      get_teams_with_characters_subset: {
        Args: { p_character_names: string[]; p_version_number: number };
        Returns: {
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      get_teams_with_characters_subset_stygian: {
        Args: { p_character_names: string[]; p_version_number: number };
        Returns: {
          avg_usage_total: number;
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_middle: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      refresh_abyss_views: { Args: never; Returns: undefined };
      refresh_stygian_character_substitutions_mv: {
        Args: never;
        Returns: undefined;
      };
      refresh_stygian_pair_pmi: { Args: never; Returns: undefined };
      refresh_stygian_views: { Args: never; Returns: undefined };
      upsert_abyss_team: {
        Args: {
          p_character_names: string[];
          p_team_key: string;
          p_usage_rate_bottom: number;
          p_usage_rate_top: number;
          p_usage_total: number;
          p_version_number: number;
        };
        Returns: string;
      };
      upsert_abyss_teams_batch: {
        Args: { p_teams: Json[] };
        Returns: undefined;
      };
      upsert_characters: { Args: { p_characters: Json }; Returns: undefined };
      upsert_stygian_teams_batch: {
        Args: { p_teams: Json[] };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
