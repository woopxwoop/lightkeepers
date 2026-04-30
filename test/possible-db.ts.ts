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
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      abyss_versions: {
        Row: {
          created_at: string;
          version_name: string | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          version_name?: string | null;
          version_number: number;
        };
        Update: {
          created_at?: string;
          version_name?: string | null;
          version_number?: number;
        };
        Relationships: [];
      };
      character_stats_abyss: {
        Row: {
          character_id: number;
          created_at: string;
          ownership: number | null;
          usage: number | null;
          version_number: number;
        };
        Insert: {
          character_id: number;
          created_at?: string;
          ownership?: number | null;
          usage?: number | null;
          version_number: number;
        };
        Update: {
          character_id?: number;
          created_at?: string;
          ownership?: number | null;
          usage?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "character_stats_abyss_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "character_stats_abyss_version_number_fkey";
            columns: ["version_number"];
            isOneToOne: false;
            referencedRelation: "abyss_versions";
            referencedColumns: ["version_number"];
          },
        ];
      };
      character_stats_stygian: {
        Row: {
          character_id: number;
          created_at: string;
          ownership: number | null;
          usage: number | null;
          version_number: number;
        };
        Insert: {
          character_id: number;
          created_at?: string;
          ownership?: number | null;
          usage?: number | null;
          version_number: number;
        };
        Update: {
          character_id?: number;
          created_at?: string;
          ownership?: number | null;
          usage?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "character_stats_stygian_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "character_stats_stygian_version_number_fkey";
            columns: ["version_number"];
            isOneToOne: false;
            referencedRelation: "stygian_versions";
            referencedColumns: ["version_number"];
          },
        ];
      };
      characters: {
        Row: {
          created_at: string;
          element: string | null;
          game_id: number;
          name: string | null;
          name_id: string;
          rarity: number | null;
          weapon_type: string | null;
        };
        Insert: {
          created_at?: string;
          element?: string | null;
          game_id: number;
          name?: string | null;
          name_id: string;
          rarity?: number | null;
          weapon_type?: string | null;
        };
        Update: {
          created_at?: string;
          element?: string | null;
          game_id?: number;
          name?: string | null;
          name_id?: string;
          rarity?: number | null;
          weapon_type?: string | null;
        };
        Relationships: [];
      };
      enemies: {
        Row: {
          asset: string | null;
          created_at: string;
          description: string | null;
          enemy_name: string | null;
          id: number;
        };
        Insert: {
          asset?: string | null;
          created_at?: string;
          description?: string | null;
          enemy_name?: string | null;
          id: number;
        };
        Update: {
          asset?: string | null;
          created_at?: string;
          description?: string | null;
          enemy_name?: string | null;
          id?: number;
        };
        Relationships: [];
      };
      stygian_version_enemies: {
        Row: {
          enemy_id: number;
          slot_index: number;
          version_number: number;
        };
        Insert: {
          enemy_id: number;
          slot_index: number;
          version_number: number;
        };
        Update: {
          enemy_id?: number;
          slot_index?: number;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_version_enemies_enemy_id_fkey";
            columns: ["enemy_id"];
            isOneToOne: false;
            referencedRelation: "enemies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stygian_version_enemies_version_number_fkey";
            columns: ["version_number"];
            isOneToOne: false;
            referencedRelation: "stygian_versions";
            referencedColumns: ["version_number"];
          },
        ];
      };
      stygian_versions: {
        Row: {
          created_at: string;
          version_name: string | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          version_name?: string | null;
          version_number: number;
        };
        Update: {
          created_at?: string;
          version_name?: string | null;
          version_number?: number;
        };
        Relationships: [];
      };
      team_characters: {
        Row: {
          character_id: number;
          team_key: string;
        };
        Insert: {
          character_id: number;
          team_key: string;
        };
        Update: {
          character_id?: number;
          team_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_characters_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["game_id"];
          },
          {
            foreignKeyName: "team_characters_team_key_fkey";
            columns: ["team_key"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_key"];
          },
        ];
      };
      team_stats_abyss: {
        Row: {
          created_at: string;
          field_1_rate: number | null;
          field_2_rate: number | null;
          has_total: number | null;
          team_key: string;
          usage_rate: number | null;
          usage_total: number | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          field_1_rate?: number | null;
          field_2_rate?: number | null;
          has_total?: number | null;
          team_key: string;
          usage_rate?: number | null;
          usage_total?: number | null;
          version_number: number;
        };
        Update: {
          created_at?: string;
          field_1_rate?: number | null;
          field_2_rate?: number | null;
          has_total?: number | null;
          team_key?: string;
          usage_rate?: number | null;
          usage_total?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_stats_abyss_team_key_fkey";
            columns: ["team_key"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_key"];
          },
          {
            foreignKeyName: "team_stats_abyss_version_number_fkey";
            columns: ["version_number"];
            isOneToOne: false;
            referencedRelation: "abyss_versions";
            referencedColumns: ["version_number"];
          },
        ];
      };
      team_stats_stygian: {
        Row: {
          created_at: string;
          field_1_rate: number | null;
          field_2_rate: number | null;
          field_3_rate: number | null;
          has_total: number | null;
          team_key: string;
          usage_rate: number | null;
          usage_total: number | null;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          field_1_rate?: number | null;
          field_2_rate?: number | null;
          field_3_rate?: number | null;
          has_total?: number | null;
          team_key: string;
          usage_rate?: number | null;
          usage_total?: number | null;
          version_number: number;
        };
        Update: {
          created_at?: string;
          field_1_rate?: number | null;
          field_2_rate?: number | null;
          field_3_rate?: number | null;
          has_total?: number | null;
          team_key?: string;
          usage_rate?: number | null;
          usage_total?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_stats_stygian_team_key_fkey";
            columns: ["team_key"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["team_key"];
          },
          {
            foreignKeyName: "team_stats_stygian_version_number_fkey";
            columns: ["version_number"];
            isOneToOne: false;
            referencedRelation: "stygian_versions";
            referencedColumns: ["version_number"];
          },
        ];
      };
      teams: {
        Row: {
          created_at: string;
          team_key: string;
        };
        Insert: {
          created_at?: string;
          team_key: string;
        };
        Update: {
          created_at?: string;
          team_key?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
