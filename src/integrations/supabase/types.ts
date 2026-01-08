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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      certificate_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      logbook_crew: {
        Row: {
          created_at: string
          id: string
          logbook_id: string
          profile_id: string
          role: Database["public"]["Enums"]["crew_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          logbook_id: string
          profile_id: string
          role: Database["public"]["Enums"]["crew_role"]
        }
        Update: {
          created_at?: string
          id?: string
          logbook_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["crew_role"]
        }
        Relationships: [
          {
            foreignKeyName: "logbook_crew_logbook_id_fkey"
            columns: ["logbook_id"]
            isOneToOne: false
            referencedRelation: "logbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_crew_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_engine_hours: {
        Row: {
          created_at: string
          id: string
          logbook_id: string
          notes: string | null
          operational_status: string | null
          start_hours: number | null
          stop_hours: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          logbook_id: string
          notes?: string | null
          operational_status?: string | null
          start_hours?: number | null
          stop_hours?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          logbook_id?: string
          notes?: string | null
          operational_status?: string | null
          start_hours?: number | null
          stop_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logbook_engine_hours_logbook_id_fkey"
            columns: ["logbook_id"]
            isOneToOne: false
            referencedRelation: "logbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      logbooks: {
        Row: {
          arrival_time: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          date: string
          departure_time: string | null
          from_location: string | null
          general_notes: string | null
          id: string
          passenger_count: number | null
          status: Database["public"]["Enums"]["logbook_status"]
          to_location: string | null
          updated_at: string
          vessel_id: string
          weather: string | null
          wind: string | null
        }
        Insert: {
          arrival_time?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          date: string
          departure_time?: string | null
          from_location?: string | null
          general_notes?: string | null
          id?: string
          passenger_count?: number | null
          status?: Database["public"]["Enums"]["logbook_status"]
          to_location?: string | null
          updated_at?: string
          vessel_id: string
          weather?: string | null
          wind?: string | null
        }
        Update: {
          arrival_time?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          departure_time?: string | null
          from_location?: string | null
          general_notes?: string | null
          id?: string
          passenger_count?: number | null
          status?: Database["public"]["Enums"]["logbook_status"]
          to_location?: string | null
          updated_at?: string
          vessel_id?: string
          weather?: string | null
          wind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logbooks_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_external: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_external?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_external?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_certificates: {
        Row: {
          certificate_type_id: string
          created_at: string
          expiry_date: string
          file_url: string | null
          id: string
          issue_date: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          certificate_type_id: string
          created_at?: string
          expiry_date: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          certificate_type_id?: string
          created_at?: string
          expiry_date?: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_certificates_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certificates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_vessel_inductions: {
        Row: {
          created_at: string
          document_url: string | null
          id: string
          inducted_at: string
          profile_id: string
          vessel_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          id?: string
          inducted_at?: string
          profile_id: string
          vessel_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          id?: string
          inducted_at?: string
          profile_id?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vessel_inductions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vessel_inductions_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_crew_requirements: {
        Row: {
          created_at: string
          id: string
          minimum_count: number
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minimum_count?: number
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Update: {
          created_at?: string
          id?: string
          minimum_count?: number
          role?: Database["public"]["Enums"]["crew_role"]
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_crew_requirements_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_role_certificates: {
        Row: {
          certificate_type_id: string
          created_at: string
          group_name: string | null
          id: string
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Insert: {
          certificate_type_id: string
          created_at?: string
          group_name?: string | null
          id?: string
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Update: {
          certificate_type_id?: string
          created_at?: string
          group_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["crew_role"]
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_role_certificates_certificate_type_id_fkey"
            columns: ["certificate_type_id"]
            isOneToOne: false
            referencedRelation: "certificate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessel_role_certificates_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_skeppare: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_new_data?: Json
          p_old_data?: Json
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "skeppare" | "readonly"
      crew_role:
        | "befalhavare"
        | "matros"
        | "jungman"
        | "restaurangpersonal"
        | "styrman"
      logbook_status: "oppen" | "stangd"
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
      app_role: ["admin", "skeppare", "readonly"],
      crew_role: [
        "befalhavare",
        "matros",
        "jungman",
        "restaurangpersonal",
        "styrman",
      ],
      logbook_status: ["oppen", "stangd"],
    },
  },
} as const
