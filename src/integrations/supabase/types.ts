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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          accepted_at: string | null
          created_at: string
          disappearing_seconds: number
          id: string
          requester_id: string
          status: string
          user_a: string
          user_b: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          disappearing_seconds?: number
          id?: string
          requester_id: string
          status?: string
          user_a: string
          user_b: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          disappearing_seconds?: number
          id?: string
          requester_id?: string
          status?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          cipher_body: string
          cipher_key_a: string
          cipher_key_b: string
          cipher_nonce: string
          connection_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          kind: string
          media_meta: Json | null
          media_path: string | null
          read_at: string | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          cipher_body: string
          cipher_key_a: string
          cipher_key_b: string
          cipher_nonce: string
          connection_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          media_meta?: Json | null
          media_path?: string | null
          read_at?: string | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          cipher_body?: string
          cipher_key_a?: string
          cipher_key_b?: string
          cipher_nonce?: string
          connection_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          media_meta?: Json | null
          media_path?: string | null
          read_at?: string | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_confirmed: boolean
          created_at: string
          display_name: string
          id: string
          last_seen_at: string
          notify_mode: string
          public_key: string | null
          stress_id: string
        }
        Insert: {
          age_confirmed?: boolean
          created_at?: string
          display_name?: string
          id: string
          last_seen_at?: string
          notify_mode?: string
          public_key?: string | null
          stress_id: string
        }
        Update: {
          age_confirmed?: boolean
          created_at?: string
          display_name?: string
          id?: string
          last_seen_at?: string
          notify_mode?: string
          public_key?: string | null
          stress_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_id: string
          reporter_id: string
          submitted_excerpt: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_id: string
          reporter_id: string
          submitted_excerpt?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string
          reporter_id?: string
          submitted_excerpt?: string | null
        }
        Relationships: []
      }
      room_members: {
        Row: {
          created_at: string
          display_name: string
          id: string
          room_id: string
          stress_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          room_id: string
          stress_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          room_id?: string
          stress_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          room_id: string
          sender_stress_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room_id: string
          sender_stress_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room_id?: string
          sender_stress_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          stress_id_a: string
          stress_id_b: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          stress_id_a: string
          stress_id_b: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          stress_id_a?: string
          stress_id_b?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_by_stress_id: {
        Args: { _stress_id: string }
        Returns: {
          display_name: string
          id: string
          public_key: string
          stress_id: string
        }[]
      }
      is_accepted_member: {
        Args: { _connection_id: string; _uid: string }
        Returns: boolean
      }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_connection_member: {
        Args: { _connection_id: string; _uid: string }
        Returns: boolean
      }
      shares_connection: {
        Args: { _other: string; _uid: string }
        Returns: boolean
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
  public: {
    Enums: {},
  },
} as const
