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
      activities: {
        Row: {
          activity_type: string
          created_at: string
          duration_minutes: number
          id: string
          level: string | null
          score: number | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          duration_minutes?: number
          id?: string
          level?: string | null
          score?: number | null
          title?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          level?: string | null
          score?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          feedback: string | null
          fluency_score: number | null
          grammar_score: number | null
          id: string
          messages: Json
          scenario: string
          topic: string
          updated_at: string
          user_id: string
          vocabulary_score: number | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          messages?: Json
          scenario?: string
          topic?: string
          updated_at?: string
          user_id: string
          vocabulary_score?: number | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          fluency_score?: number | null
          grammar_score?: number | null
          id?: string
          messages?: Json
          scenario?: string
          topic?: string
          updated_at?: string
          user_id?: string
          vocabulary_score?: number | null
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          answer: string | null
          card_type: string | null
          created_at: string
          created_by: string | null
          definition: string
          difficulty: string
          example: string
          id: string
          lesson_id: string | null
          listen_text: string | null
          prompt: string | null
          pronunciation: string
          sort_order: number | null
          translation: string
          word: string
        }
        Insert: {
          answer?: string | null
          card_type?: string | null
          created_at?: string
          created_by?: string | null
          definition?: string
          difficulty?: string
          example?: string
          id?: string
          lesson_id?: string | null
          listen_text?: string | null
          prompt?: string | null
          pronunciation?: string
          sort_order?: number | null
          translation: string
          word: string
        }
        Update: {
          answer?: string | null
          card_type?: string | null
          created_at?: string
          created_by?: string | null
          definition?: string
          difficulty?: string
          example?: string
          id?: string
          lesson_id?: string | null
          listen_text?: string | null
          prompt?: string | null
          pronunciation?: string
          sort_order?: number | null
          translation?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_profile: {
        Row: {
          common_errors: string[]
          created_at: string
          id: string
          learning_preferences: Json
          strengths: string[]
          updated_at: string
          user_id: string
          weaknesses: string[]
        }
        Insert: {
          common_errors?: string[]
          created_at?: string
          id?: string
          learning_preferences?: Json
          strengths?: string[]
          updated_at?: string
          user_id: string
          weaknesses?: string[]
        }
        Update: {
          common_errors?: string[]
          created_at?: string
          id?: string
          learning_preferences?: Json
          strengths?: string[]
          updated_at?: string
          user_id?: string
          weaknesses?: string[]
        }
        Relationships: []
      }
      lessons: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          curriculum_key: string | null
          generated: boolean
          id: string
          level: string
          objective: string
          position_in_unit: number
          skill: string
          sort_order: number
          summary: string
          title: string
          transcript: string
          transcript_pt: string
          unit_number: number
          updated_at: string
          video_duration_seconds: number
          video_url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          curriculum_key?: string | null
          generated?: boolean
          id?: string
          level?: string
          objective?: string
          position_in_unit?: number
          skill?: string
          sort_order?: number
          summary?: string
          title: string
          transcript?: string
          transcript_pt?: string
          unit_number?: number
          updated_at?: string
          video_duration_seconds?: number
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          curriculum_key?: string | null
          generated?: boolean
          id?: string
          level?: string
          objective?: string
          position_in_unit?: number
          skill?: string
          sort_order?: number
          summary?: string
          title?: string
          transcript?: string
          transcript_pt?: string
          unit_number?: number
          updated_at?: string
          video_duration_seconds?: number
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_minutes: number
          email: string | null
          goal: string
          id: string
          last_activity_date: string | null
          level: string
          max_level: string
          name: string
          onboarding_completed: boolean
          plan: string
          plan_expires_at: string | null
          plan_interval: string | null
          plan_started_at: string | null
          streak_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_minutes?: number
          email?: string | null
          goal?: string
          id: string
          last_activity_date?: string | null
          level?: string
          max_level?: string
          name?: string
          onboarding_completed?: boolean
          plan?: string
          plan_expires_at?: string | null
          plan_interval?: string | null
          plan_started_at?: string | null
          streak_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_minutes?: number
          email?: string | null
          goal?: string
          id?: string
          last_activity_date?: string | null
          level?: string
          max_level?: string
          name?: string
          onboarding_completed?: boolean
          plan?: string
          plan_expires_at?: string | null
          plan_interval?: string | null
          plan_started_at?: string | null
          streak_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      progress: {
        Row: {
          grammar_score: number
          id: string
          level: string | null
          listening_score: number
          reading_score: number
          recorded_at: string
          speaking_score: number
          user_id: string
          vocabulary_score: number
          writing_score: number
        }
        Insert: {
          grammar_score?: number
          id?: string
          level?: string | null
          listening_score?: number
          reading_score?: number
          recorded_at?: string
          speaking_score?: number
          user_id: string
          vocabulary_score?: number
          writing_score?: number
        }
        Update: {
          grammar_score?: number
          id?: string
          level?: string | null
          listening_score?: number
          reading_score?: number
          recorded_at?: string
          speaking_score?: number
          user_id?: string
          vocabulary_score?: number
          writing_score?: number
        }
        Relationships: []
      }
      quiz_results: {
        Row: {
          correct_count: number
          created_at: string
          details: Json
          id: string
          lesson_id: string | null
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          details?: Json
          id?: string
          lesson_id?: string | null
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          details?: Json
          id?: string
          lesson_id?: string | null
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          correct_answer: string
          created_at: string
          created_by: string | null
          explanation: string
          id: string
          lesson_id: string
          options: Json
          question: string
          question_type: string
          sort_order: number
        }
        Insert: {
          correct_answer: string
          created_at?: string
          created_by?: string | null
          explanation?: string
          id?: string
          lesson_id: string
          options?: Json
          question: string
          question_type?: string
          sort_order?: number
        }
        Update: {
          correct_answer?: string
          created_at?: string
          created_by?: string | null
          explanation?: string
          id?: string
          lesson_id?: string
          options?: Json
          question?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flashcards: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          interval_days: number
          last_rating: string | null
          last_reviewed_at: string | null
          mastery_level: number
          next_review_date: string
          times_reviewed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          interval_days?: number
          last_rating?: string | null
          last_reviewed_at?: string | null
          mastery_level?: number
          next_review_date?: string
          times_reviewed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          interval_days?: number
          last_rating?: string | null
          last_reviewed_at?: string | null
          mastery_level?: number
          next_review_date?: string
          times_reviewed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flashcards_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lessons: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lesson_id: string
          progress: number
          updated_at: string
          user_id: string
          video_completed_at: string | null
          video_progress: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          progress?: number
          updated_at?: string
          user_id: string
          video_completed_at?: string | null
          video_progress?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          progress?: number
          updated_at?: string
          user_id?: string
          video_completed_at?: string | null
          video_progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_lessons_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vocabulary: {
        Row: {
          created_at: string
          id: string
          is_difficult: boolean
          last_reviewed_at: string | null
          mastery_level: number
          times_reviewed: number
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_difficult?: boolean
          last_reviewed_at?: string | null
          mastery_level?: number
          times_reviewed?: number
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_difficult?: boolean
          last_reviewed_at?: string | null
          mastery_level?: number
          times_reviewed?: number
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocabulary_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "vocabulary"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary: {
        Row: {
          batch_key: string | null
          category: string
          created_at: string
          created_by: string | null
          difficulty: string
          example: string
          id: string
          lesson_id: string | null
          level: string | null
          meaning: string
          offered_for: string | null
          pronunciation: string
          translation: string
          word: string
        }
        Insert: {
          batch_key?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          difficulty?: string
          example?: string
          id?: string
          lesson_id?: string | null
          level?: string | null
          meaning?: string
          offered_for?: string | null
          pronunciation?: string
          translation: string
          word: string
        }
        Update: {
          batch_key?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          difficulty?: string
          example?: string
          id?: string
          lesson_id?: string | null
          level?: string | null
          meaning?: string
          offered_for?: string | null
          pronunciation?: string
          translation?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
