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
      booking_audit_logs: {
        Row: {
          action: string
          booking_id: string
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          booking_id: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          booking_id?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_crew: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          role_type: Database["public"]["Enums"]["booking_crew_role"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          role_type: Database["public"]["Enums"]["booking_crew_role"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          role_type?: Database["public"]["Enums"]["booking_crew_role"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_crew_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crew_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_drinks: {
        Row: {
          booking_id: string
          created_at: string
          drink_package_id: string | null
          extras: string[] | null
          id: string
          is_a_la_carte: boolean | null
          notes: string | null
          package_name_snapshot: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          drink_package_id?: string | null
          extras?: string[] | null
          id?: string
          is_a_la_carte?: boolean | null
          notes?: string | null
          package_name_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          drink_package_id?: string | null
          extras?: string[] | null
          id?: string
          is_a_la_carte?: boolean | null
          notes?: string | null
          package_name_snapshot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_drinks_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_drinks_drink_package_id_fkey"
            columns: ["drink_package_id"]
            isOneToOne: false
            referencedRelation: "drink_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_food: {
        Row: {
          booking_id: string
          created_at: string
          dietary_notes: string | null
          dietary_tags: string[] | null
          id: string
          kitchen_notes: string | null
          menu_deadline: string | null
          menu_id: string | null
          menu_name_snapshot: string | null
          portions: number | null
          serving_times: Json | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          dietary_notes?: string | null
          dietary_tags?: string[] | null
          id?: string
          kitchen_notes?: string | null
          menu_deadline?: string | null
          menu_id?: string | null
          menu_name_snapshot?: string | null
          portions?: number | null
          serving_times?: Json | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          dietary_notes?: string | null
          dietary_tags?: string[] | null
          id?: string
          kitchen_notes?: string | null
          menu_deadline?: string | null
          menu_id?: string | null
          menu_name_snapshot?: string | null
          portions?: number | null
          serving_times?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_food_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_food_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pms: {
        Row: {
          booking_id: string
          content: Json
          created_at: string
          created_by: string
          id: string
          is_latest: boolean
          pm_type: Database["public"]["Enums"]["pm_type"]
          version: number
        }
        Insert: {
          booking_id: string
          content: Json
          created_at?: string
          created_by: string
          id?: string
          is_latest?: boolean
          pm_type: Database["public"]["Enums"]["pm_type"]
          version?: number
        }
        Update: {
          booking_id?: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_latest?: boolean
          pm_type?: Database["public"]["Enums"]["pm_type"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_pms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          arrival_harbor: string | null
          blocking_reason: Database["public"]["Enums"]["blocking_reason"] | null
          booking_date: string
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          contact_company: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          departure_harbor: string | null
          end_time: string
          event_layout: Database["public"]["Enums"]["event_layout"] | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          guest_count: number | null
          id: string
          internal_notes: string | null
          max_guest_warning: boolean | null
          route_notes: string | null
          safety_notes: string | null
          schedule: Json | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          tech_equipment: string[] | null
          updated_at: string
          vessel_id: string
        }
        Insert: {
          arrival_harbor?: string | null
          blocking_reason?:
            | Database["public"]["Enums"]["blocking_reason"]
            | null
          booking_date: string
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          contact_company?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          departure_harbor?: string | null
          end_time: string
          event_layout?: Database["public"]["Enums"]["event_layout"] | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          guest_count?: number | null
          id?: string
          internal_notes?: string | null
          max_guest_warning?: boolean | null
          route_notes?: string | null
          safety_notes?: string | null
          schedule?: Json | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          tech_equipment?: string[] | null
          updated_at?: string
          vessel_id: string
        }
        Update: {
          arrival_harbor?: string | null
          blocking_reason?:
            | Database["public"]["Enums"]["blocking_reason"]
            | null
          booking_date?: string
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          contact_company?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          departure_harbor?: string | null
          end_time?: string
          event_layout?: Database["public"]["Enums"]["event_layout"] | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          guest_count?: number | null
          id?: string
          internal_notes?: string | null
          max_guest_warning?: boolean | null
          route_notes?: string | null
          safety_notes?: string | null
          schedule?: Json | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          tech_equipment?: string[] | null
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          checklist_template_id: string
          completed_at: string | null
          created_at: string
          id: string
          next_due_at: string | null
          started_at: string
          started_by: string
          status: Database["public"]["Enums"]["checklist_execution_status"]
          vessel_id: string
        }
        Insert: {
          checklist_template_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          next_due_at?: string | null
          started_at?: string
          started_by: string
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          vessel_id: string
        }
        Update: {
          checklist_template_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          next_due_at?: string | null
          started_at?: string
          started_by?: string
          status?: Database["public"]["Enums"]["checklist_execution_status"]
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_step_results: {
        Row: {
          checklist_execution_id: string
          checklist_step_id: string
          comment: string | null
          confirmed_at: string
          confirmed_by: string
          created_at: string
          id: string
          photo_url: string | null
          value: string
        }
        Insert: {
          checklist_execution_id: string
          checklist_step_id: string
          comment?: string | null
          confirmed_at?: string
          confirmed_by: string
          created_at?: string
          id?: string
          photo_url?: string | null
          value: string
        }
        Update: {
          checklist_execution_id?: string
          checklist_step_id?: string
          comment?: string | null
          confirmed_at?: string
          confirmed_by?: string
          created_at?: string
          id?: string
          photo_url?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_step_results_checklist_execution_id_fkey"
            columns: ["checklist_execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_step_results_checklist_step_id_fkey"
            columns: ["checklist_step_id"]
            isOneToOne: false
            referencedRelation: "checklist_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_steps: {
        Row: {
          checklist_template_id: string
          confirmation_type: string
          created_at: string
          help_text: string | null
          id: string
          instruction: string
          requires_comment: boolean
          requires_photo: boolean
          step_order: number
          title: string
        }
        Insert: {
          checklist_template_id: string
          confirmation_type?: string
          created_at?: string
          help_text?: string | null
          id?: string
          instruction: string
          requires_comment?: boolean
          requires_photo?: boolean
          step_order: number
          title: string
        }
        Update: {
          checklist_template_id?: string
          confirmation_type?: string
          created_at?: string
          help_text?: string | null
          id?: string
          instruction?: string
          requires_comment?: boolean
          requires_photo?: boolean
          step_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_steps_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_vessels: {
        Row: {
          checklist_template_id: string
          created_at: string
          id: string
          vessel_id: string
        }
        Insert: {
          checklist_template_id: string
          created_at?: string
          id?: string
          vessel_id: string
        }
        Update: {
          checklist_template_id?: string
          created_at?: string
          id?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_vessels_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_vessels_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          applies_to_all_vessels: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          interval_days: number | null
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          applies_to_all_vessels?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          interval_days?: number | null
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          applies_to_all_vessels?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          interval_days?: number | null
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_point_attachments: {
        Row: {
          file_name: string
          file_url: string
          id: string
          organization_id: string
          record_id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          organization_id: string
          record_id: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          organization_id?: string
          record_id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_point_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_point_attachments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "control_point_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_point_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      control_point_records: {
        Row: {
          control_point_id: string
          created_at: string
          engine_hours_at_perform: number | null
          engine_id: string | null
          id: string
          notes: string | null
          performed_at: string
          performed_by: string
          vessel_id: string
        }
        Insert: {
          control_point_id: string
          created_at?: string
          engine_hours_at_perform?: number | null
          engine_id?: string | null
          id?: string
          notes?: string | null
          performed_at: string
          performed_by: string
          vessel_id: string
        }
        Update: {
          control_point_id?: string
          created_at?: string
          engine_hours_at_perform?: number | null
          engine_id?: string | null
          id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_point_records_control_point_id_fkey"
            columns: ["control_point_id"]
            isOneToOne: false
            referencedRelation: "control_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_point_records_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "vessel_engine_hours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_point_records_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "control_point_records_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      control_point_vessels: {
        Row: {
          control_point_id: string
          created_at: string
          id: string
          vessel_id: string
        }
        Insert: {
          control_point_id: string
          created_at?: string
          id?: string
          vessel_id: string
        }
        Update: {
          control_point_id?: string
          created_at?: string
          id?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_point_vessels_control_point_id_fkey"
            columns: ["control_point_id"]
            isOneToOne: false
            referencedRelation: "control_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_point_vessels_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      control_points: {
        Row: {
          applies_to_all_vessels: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          interval_engine_hours: number | null
          interval_months: number | null
          is_active: boolean
          machine_name: string | null
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["control_type"]
          updated_at: string
        }
        Insert: {
          applies_to_all_vessels?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interval_engine_hours?: number | null
          interval_months?: number | null
          is_active?: boolean
          machine_name?: string | null
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["control_type"]
          updated_at?: string
        }
        Update: {
          applies_to_all_vessels?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          interval_engine_hours?: number | null
          interval_months?: number | null
          is_active?: boolean
          machine_name?: string | null
          name?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["control_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_actions: {
        Row: {
          action_text: string
          created_at: string
          created_by: string
          deviation_id: string
          id: string
        }
        Insert: {
          action_text: string
          created_at?: string
          created_by: string
          deviation_id: string
          id?: string
        }
        Update: {
          action_text?: string
          created_at?: string
          created_by?: string
          deviation_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deviation_actions_deviation_id_fkey"
            columns: ["deviation_id"]
            isOneToOne: false
            referencedRelation: "deviations"
            referencedColumns: ["id"]
          },
        ]
      }
      deviation_attachments: {
        Row: {
          deviation_id: string
          file_name: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          deviation_id: string
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          deviation_id?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_attachments_deviation_id_fkey"
            columns: ["deviation_id"]
            isOneToOne: false
            referencedRelation: "deviations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deviation_responses: {
        Row: {
          deviation_id: string
          id: string
          responded_at: string
          responded_by: string
          response_text: string
        }
        Insert: {
          deviation_id: string
          id?: string
          responded_at?: string
          responded_by: string
          response_text: string
        }
        Update: {
          deviation_id?: string
          id?: string
          responded_at?: string
          responded_by?: string
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviation_responses_deviation_id_fkey"
            columns: ["deviation_id"]
            isOneToOne: false
            referencedRelation: "deviations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviation_responses_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deviations: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          logbook_id: string | null
          severity: Database["public"]["Enums"]["deviation_severity"]
          status: Database["public"]["Enums"]["deviation_status"]
          title: string
          type: Database["public"]["Enums"]["deviation_type"]
          updated_at: string
          vessel_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          date: string
          description: string
          id?: string
          logbook_id?: string | null
          severity: Database["public"]["Enums"]["deviation_severity"]
          status?: Database["public"]["Enums"]["deviation_status"]
          title: string
          type: Database["public"]["Enums"]["deviation_type"]
          updated_at?: string
          vessel_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          logbook_id?: string | null
          severity?: Database["public"]["Enums"]["deviation_severity"]
          status?: Database["public"]["Enums"]["deviation_status"]
          title?: string
          type?: Database["public"]["Enums"]["deviation_type"]
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deviations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "deviations_logbook_id_fkey"
            columns: ["logbook_id"]
            isOneToOne: false
            referencedRelation: "logbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deviations_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_extras: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_extras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      drink_packages: {
        Row: {
          contents: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          contents?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          contents?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drink_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_attachments: {
        Row: {
          comment_id: string | null
          fault_case_id: string
          file_name: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          comment_id?: string | null
          fault_case_id: string
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          comment_id?: string | null
          fault_case_id?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fault_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "fault_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_attachments_fault_case_id_fkey"
            columns: ["fault_case_id"]
            isOneToOne: false
            referencedRelation: "fault_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fault_cases: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["fault_priority"]
          status: Database["public"]["Enums"]["fault_status"]
          title: string
          updated_at: string
          vessel_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["fault_priority"]
          status?: Database["public"]["Enums"]["fault_status"]
          title: string
          updated_at?: string
          vessel_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["fault_priority"]
          status?: Database["public"]["Enums"]["fault_status"]
          title?: string
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fault_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fault_cases_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_comments: {
        Row: {
          comment_text: string
          created_at: string
          fault_case_id: string
          id: string
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string
          fault_case_id: string
          id?: string
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string
          fault_case_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fault_comments_fault_case_id_fkey"
            columns: ["fault_case_id"]
            isOneToOne: false
            referencedRelation: "fault_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      intranet_documents: {
        Row: {
          created_at: string
          display_name: string
          file_name: string
          file_url: string
          id: string
          message_id: string
          organization_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          display_name: string
          file_name: string
          file_url: string
          id?: string
          message_id: string
          organization_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          display_name?: string
          file_name?: string
          file_url?: string
          id?: string
          message_id?: string
          organization_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_documents_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "intranet_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intranet_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intranet_messages: {
        Row: {
          content: string | null
          created_at: string
          created_by: string
          document_name: string | null
          document_url: string | null
          id: string
          message_date: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          message_date: string
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          message_date?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intranet_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          engine_name: string | null
          engine_number: number | null
          engine_type: string | null
          id: string
          logbook_id: string
          notes: string | null
          operational_status: string | null
          start_hours: number | null
          stop_hours: number | null
        }
        Insert: {
          created_at?: string
          engine_name?: string | null
          engine_number?: number | null
          engine_type?: string | null
          id?: string
          logbook_id: string
          notes?: string | null
          operational_status?: string | null
          start_hours?: number | null
          stop_hours?: number | null
        }
        Update: {
          created_at?: string
          engine_name?: string | null
          engine_number?: number | null
          engine_type?: string | null
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
      logbook_exercises: {
        Row: {
          created_at: string
          exercise_type: string
          id: string
          logbook_id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          exercise_type: string
          id?: string
          logbook_id: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          exercise_type?: string
          id?: string
          logbook_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logbook_exercises_logbook_id_fkey"
            columns: ["logbook_id"]
            isOneToOne: false
            referencedRelation: "logbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_signatures: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          ip_address: string | null
          logbook_id: string
          signature_type: string
          signed_at: string
          signed_by: string
          user_agent: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          ip_address?: string | null
          logbook_id: string
          signature_type?: string
          signed_at?: string
          signed_by: string
          user_agent?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          logbook_id?: string
          signature_type?: string
          signed_at?: string
          signed_by?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_signed_by"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "logbook_signatures_logbook_id_fkey"
            columns: ["logbook_id"]
            isOneToOne: false
            referencedRelation: "logbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_stops: {
        Row: {
          arrival_location: string | null
          arrival_time: string | null
          created_at: string
          departure_location: string | null
          departure_time: string | null
          id: string
          logbook_id: string
          notes: string | null
          passenger_count: number | null
          pax_off: number | null
          pax_on: number | null
          stop_order: number
        }
        Insert: {
          arrival_location?: string | null
          arrival_time?: string | null
          created_at?: string
          departure_location?: string | null
          departure_time?: string | null
          id?: string
          logbook_id: string
          notes?: string | null
          passenger_count?: number | null
          pax_off?: number | null
          pax_on?: number | null
          stop_order: number
        }
        Update: {
          arrival_location?: string | null
          arrival_time?: string | null
          created_at?: string
          departure_location?: string | null
          departure_time?: string | null
          id?: string
          logbook_id?: string
          notes?: string | null
          passenger_count?: number | null
          pax_off?: number | null
          pax_on?: number | null
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "logbook_stops_logbook_id_fkey"
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
          bunker_liters: number | null
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
          bunker_liters?: number | null
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
          bunker_liters?: number | null
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
      menus: {
        Row: {
          allergen_info: string | null
          courses: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          season: string | null
          updated_at: string
        }
        Insert: {
          allergen_info?: string | null
          courses?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          season?: string | null
          updated_at?: string
        }
        Update: {
          allergen_info?: string | null
          courses?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          season?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          module?: Database["public"]["Enums"]["app_module"]
          organization_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_number: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_number?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          path: string
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          path: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          path?: string
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          preferred_vessel_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_external?: boolean
          organization_id?: string | null
          preferred_vessel_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_external?: boolean
          organization_id?: string | null
          preferred_vessel_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_preferred_vessel_id_fkey"
            columns: ["preferred_vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      superadmins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
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
      vessel_certificates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          expiry_date: string | null
          file_url: string | null
          id: string
          is_indefinite: boolean
          issue_date: string | null
          name: string
          updated_at: string
          vessel_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          is_indefinite?: boolean
          issue_date?: string | null
          name: string
          updated_at?: string
          vessel_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          is_indefinite?: boolean
          issue_date?: string | null
          name?: string
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_certificates_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      vessel_control_point_state: {
        Row: {
          control_point_id: string
          engine_id: string | null
          id: string
          last_done_at_engine_hours: number | null
          last_done_date: string | null
          next_due_at_engine_hours: number | null
          next_due_date: string | null
          status: Database["public"]["Enums"]["control_status"]
          updated_at: string
          vessel_id: string
        }
        Insert: {
          control_point_id: string
          engine_id?: string | null
          id?: string
          last_done_at_engine_hours?: number | null
          last_done_date?: string | null
          next_due_at_engine_hours?: number | null
          next_due_date?: string | null
          status?: Database["public"]["Enums"]["control_status"]
          updated_at?: string
          vessel_id: string
        }
        Update: {
          control_point_id?: string
          engine_id?: string | null
          id?: string
          last_done_at_engine_hours?: number | null
          last_done_date?: string | null
          next_due_at_engine_hours?: number | null
          next_due_date?: string | null
          status?: Database["public"]["Enums"]["control_status"]
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_control_point_state_control_point_id_fkey"
            columns: ["control_point_id"]
            isOneToOne: false
            referencedRelation: "control_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessel_control_point_state_engine_id_fkey"
            columns: ["engine_id"]
            isOneToOne: false
            referencedRelation: "vessel_engine_hours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vessel_control_point_state_vessel_id_fkey"
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
          requirement_group: string | null
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          minimum_count?: number
          requirement_group?: string | null
          role: Database["public"]["Enums"]["crew_role"]
          vessel_id: string
        }
        Update: {
          created_at?: string
          id?: string
          minimum_count?: number
          requirement_group?: string | null
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
      vessel_engine_hours: {
        Row: {
          current_hours: number
          engine_number: number
          engine_type: string
          id: string
          name: string | null
          updated_at: string
          vessel_id: string
        }
        Insert: {
          current_hours?: number
          engine_number?: number
          engine_type: string
          id?: string
          name?: string | null
          updated_at?: string
          vessel_id: string
        }
        Update: {
          current_hours?: number
          engine_number?: number
          engine_type?: string
          id?: string
          name?: string | null
          updated_at?: string
          vessel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessel_engine_hours_vessel_id_fkey"
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
          auxiliary_engine_count: number
          created_at: string
          description: string | null
          id: string
          main_engine_count: number
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auxiliary_engine_count?: number
          created_at?: string
          description?: string | null
          id?: string
          main_engine_count?: number
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auxiliary_engine_count?: number
          created_at?: string
          description?: string | null
          id?: string
          main_engine_count?: number
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vessels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_modules: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_module"][]
      }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_skeppare: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
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
      org_has_module: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _org_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_module:
        | "logbook"
        | "deviations"
        | "fault_cases"
        | "self_control"
        | "checklists"
        | "bookings"
      app_role: "admin" | "skeppare" | "readonly"
      blocking_reason:
        | "service"
        | "privat"
        | "vaderreserv"
        | "personalbrist"
        | "ovrigt"
      booking_crew_role:
        | "kapten"
        | "matros"
        | "serveringsansvarig"
        | "kock"
        | "bartender"
      booking_status:
        | "forfragen"
        | "preliminar"
        | "bekraftad"
        | "avbokad"
        | "genomford"
        | "blockerad"
      checklist_execution_status: "in_progress" | "completed" | "failed"
      control_status: "ok" | "kommande" | "forfallen"
      control_type: "calendar" | "engine_hours"
      crew_role:
        | "befalhavare"
        | "matros"
        | "jungman"
        | "restaurangpersonal"
        | "styrman"
      deviation_severity: "lag" | "medel" | "hog"
      deviation_status:
        | "oppen"
        | "under_utredning"
        | "aterrapporterad"
        | "stangd"
      deviation_type: "incident" | "tillbud" | "avvikelse" | "ovrigt"
      event_layout: "sittning" | "mingel" | "konferens" | "blandat"
      event_type:
        | "middag"
        | "foretagsevent"
        | "brollop"
        | "transport"
        | "privat"
        | "konferens"
        | "ovrigt"
      fault_priority: "lag" | "normal" | "hog" | "kritisk"
      fault_status:
        | "ny"
        | "varvsatgard"
        | "arbete_pagar"
        | "atgardad"
        | "avslutad"
      logbook_status: "oppen" | "stangd"
      org_role: "org_admin" | "org_user"
      pm_type: "besattning" | "servering" | "kok" | "bar"
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
      app_module: [
        "logbook",
        "deviations",
        "fault_cases",
        "self_control",
        "checklists",
        "bookings",
      ],
      app_role: ["admin", "skeppare", "readonly"],
      blocking_reason: [
        "service",
        "privat",
        "vaderreserv",
        "personalbrist",
        "ovrigt",
      ],
      booking_crew_role: [
        "kapten",
        "matros",
        "serveringsansvarig",
        "kock",
        "bartender",
      ],
      booking_status: [
        "forfragen",
        "preliminar",
        "bekraftad",
        "avbokad",
        "genomford",
        "blockerad",
      ],
      checklist_execution_status: ["in_progress", "completed", "failed"],
      control_status: ["ok", "kommande", "forfallen"],
      control_type: ["calendar", "engine_hours"],
      crew_role: [
        "befalhavare",
        "matros",
        "jungman",
        "restaurangpersonal",
        "styrman",
      ],
      deviation_severity: ["lag", "medel", "hog"],
      deviation_status: [
        "oppen",
        "under_utredning",
        "aterrapporterad",
        "stangd",
      ],
      deviation_type: ["incident", "tillbud", "avvikelse", "ovrigt"],
      event_layout: ["sittning", "mingel", "konferens", "blandat"],
      event_type: [
        "middag",
        "foretagsevent",
        "brollop",
        "transport",
        "privat",
        "konferens",
        "ovrigt",
      ],
      fault_priority: ["lag", "normal", "hog", "kritisk"],
      fault_status: [
        "ny",
        "varvsatgard",
        "arbete_pagar",
        "atgardad",
        "avslutad",
      ],
      logbook_status: ["oppen", "stangd"],
      org_role: ["org_admin", "org_user"],
      pm_type: ["besattning", "servering", "kok", "bar"],
    },
  },
} as const
