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
      ai_limits: {
        Row: {
          cache_ttl_seconds: number
          daily_limit: number
          enabled: boolean
          max_concurrent: number
          min_interval_seconds: number
          monthly_limit: number
          operation: string
          premium_daily_limit: number
          premium_monthly_limit: number
          updated_at: string
        }
        Insert: {
          cache_ttl_seconds?: number
          daily_limit: number
          enabled?: boolean
          max_concurrent?: number
          min_interval_seconds?: number
          monthly_limit: number
          operation: string
          premium_daily_limit: number
          premium_monthly_limit: number
          updated_at?: string
        }
        Update: {
          cache_ttl_seconds?: number
          daily_limit?: number
          enabled?: boolean
          max_concurrent?: number
          min_interval_seconds?: number
          monthly_limit?: number
          operation?: string
          premium_daily_limit?: number
          premium_monthly_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          hit_count: number
          last_hit_at: string | null
          model: string
          operation: string
          response_text: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          hit_count?: number
          last_hit_at?: string | null
          model: string
          operation: string
          response_text: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          last_hit_at?: string | null
          model?: string
          operation?: string
          response_text?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          estimated_cost: number | null
          id: string
          input_tokens: number | null
          model: string
          operation: string
          output_tokens: number | null
          request_hash: string | null
          status: string
          success: boolean | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          operation: string
          output_tokens?: number | null
          request_hash?: string | null
          status?: string
          success?: boolean | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          operation?: string
          output_tokens?: number | null
          request_hash?: string | null
          status?: string
          success?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      assessment_evidence: {
        Row: {
          assessment_session_id: string
          created_at: string
          evaluated_by: string
          evidence_quality: number
          evidence_type: string | null
          id: string
          item_cefr: string | null
          metadata: Json
          model_version: string | null
          polarity: string | null
          raw_score: number
          rubric_version: string
          sample_weight: number
          skill: string
          source_id: string | null
          source_item_id: string | null
          source_reliability: number
          source_type: string
          subskill: string | null
          user_id: string
        }
        Insert: {
          assessment_session_id: string
          created_at?: string
          evaluated_by: string
          evidence_quality: number
          evidence_type?: string | null
          id?: string
          item_cefr?: string | null
          metadata?: Json
          model_version?: string | null
          polarity?: string | null
          raw_score: number
          rubric_version: string
          sample_weight?: number
          skill: string
          source_id?: string | null
          source_item_id?: string | null
          source_reliability: number
          source_type: string
          subskill?: string | null
          user_id: string
        }
        Update: {
          assessment_session_id?: string
          created_at?: string
          evaluated_by?: string
          evidence_quality?: number
          evidence_type?: string | null
          id?: string
          item_cefr?: string | null
          metadata?: Json
          model_version?: string | null
          polarity?: string | null
          raw_score?: number
          rubric_version?: string
          sample_weight?: number
          skill?: string
          source_id?: string | null
          source_item_id?: string | null
          source_reliability?: number
          source_type?: string
          subskill?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_evidence_session_owner_fkey"
            columns: ["assessment_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "assessment_evidence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          assessment_type: string
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          overall_cefr: string | null
          overall_confidence: number | null
          overall_score: number | null
          rubric_version: string
          ruleset_version: string
          source_id: string | null
          source_type: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_type: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          overall_cefr?: string | null
          overall_confidence?: number | null
          overall_score?: number | null
          rubric_version: string
          ruleset_version: string
          source_id?: string | null
          source_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_type?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          overall_cefr?: string | null
          overall_confidence?: number | null
          overall_score?: number | null
          rubric_version?: string
          ruleset_version?: string
          source_id?: string | null
          source_type?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_skill_results: {
        Row: {
          assessed_at: string
          assessment_session_id: string
          cefr_level: string
          confidence_score: number | null
          created_at: string
          evidence_count: number
          id: string
          rule_version: string
          score: number | null
          skill: string
          user_id: string
        }
        Insert: {
          assessed_at?: string
          assessment_session_id: string
          cefr_level: string
          confidence_score?: number | null
          created_at?: string
          evidence_count?: number
          id?: string
          rule_version: string
          score?: number | null
          skill: string
          user_id: string
        }
        Update: {
          assessed_at?: string
          assessment_session_id?: string
          cefr_level?: string
          confidence_score?: number | null
          created_at?: string
          evidence_count?: number
          id?: string
          rule_version?: string
          score?: number | null
          skill?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_skill_results_session_owner_fkey"
            columns: ["assessment_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "assessment_skill_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      learning_errors: {
        Row: {
          assessment_evidence_id: string | null
          assessment_session_id: string | null
          category: string
          corrected_text: string
          error_type: string
          explanation: string
          first_detected: string
          frequency: number
          id: string
          last_detected: string
          original_text: string
          severity: string
          skill: string
          source: string
          user_id: string
        }
        Insert: {
          assessment_evidence_id?: string | null
          assessment_session_id?: string | null
          category: string
          corrected_text: string
          error_type: string
          explanation?: string
          first_detected?: string
          frequency?: number
          id?: string
          last_detected?: string
          original_text: string
          severity?: string
          skill: string
          source?: string
          user_id: string
        }
        Update: {
          assessment_evidence_id?: string | null
          assessment_session_id?: string | null
          category?: string
          corrected_text?: string
          error_type?: string
          explanation?: string
          first_detected?: string
          frequency?: number
          id?: string
          last_detected?: string
          original_text?: string
          severity?: string
          skill?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_errors_assessment_evidence_owner_fkey"
            columns: ["assessment_evidence_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assessment_evidence"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "learning_errors_assessment_session_owner_fkey"
            columns: ["assessment_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id", "user_id"]
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
      pedagogical_dual_write_failures: {
        Row: {
          attempt_count: number
          completed_at: string | null
          error_code: string
          first_failed_at: string
          id: string
          idempotency_key: string
          last_error_message: string | null
          last_failed_at: string
          next_retry_at: string | null
          processing_started_at: string | null
          resolved_at: string | null
          source_id: string | null
          source_type: string
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          error_code: string
          first_failed_at?: string
          id?: string
          idempotency_key: string
          last_error_message?: string | null
          last_failed_at?: string
          next_retry_at?: string | null
          processing_started_at?: string | null
          resolved_at?: string | null
          source_id?: string | null
          source_type: string
          stage: string
          status?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          error_code?: string
          first_failed_at?: string
          id?: string
          idempotency_key?: string
          last_error_message?: string | null
          last_failed_at?: string
          next_retry_at?: string | null
          processing_started_at?: string | null
          resolved_at?: string | null
          source_id?: string | null
          source_type?: string
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedagogical_dual_write_failures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
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
          phone: string | null
          plan: string
          plan_expires_at: string | null
          plan_interval: string | null
          plan_started_at: string | null
          streak_days: number
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
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
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_interval?: string | null
          plan_started_at?: string | null
          streak_days?: number
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
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
          phone?: string | null
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
          attempt_key: string | null
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
          attempt_key?: string | null
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
          attempt_key?: string | null
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
          pedagogical_skill: string | null
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
          pedagogical_skill?: string | null
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
          pedagogical_skill?: string | null
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
      writing_submissions: {
        Row: {
          clarity_score: number
          corrected_text: string
          created_at: string
          explanations: Json
          grammar_score: number
          id: string
          idempotency_key: string
          model_version: string
          natural_text: string
          original_text: string
          prompt: string
          rubric_version: string
          suggestions: Json
          user_id: string
          vocabulary_score: number
        }
        Insert: {
          clarity_score: number
          corrected_text: string
          created_at?: string
          explanations?: Json
          grammar_score: number
          id?: string
          idempotency_key: string
          model_version: string
          natural_text: string
          original_text: string
          prompt: string
          rubric_version: string
          suggestions?: Json
          user_id: string
          vocabulary_score: number
        }
        Update: {
          clarity_score?: number
          corrected_text?: string
          created_at?: string
          explanations?: Json
          grammar_score?: number
          id?: string
          idempotency_key?: string
          model_version?: string
          natural_text?: string
          original_text?: string
          prompt?: string
          rubric_version?: string
          suggestions?: Json
          user_id?: string
          vocabulary_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "writing_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_skill_profile: {
        Row: {
          assessed_at: string | null
          assessment_session_id: string | null
          cefr_level: string | null
          confidence_score: number | null
          evidence_count: number | null
          rule_version: string | null
          score: number | null
          skill: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_skill_results_session_owner_fkey"
            columns: ["assessment_session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "assessment_skill_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claim_pedagogical_retries: {
        Args: { p_limit?: number; p_stale_seconds?: number; p_user_id: string }
        Returns: {
          attempt_count: number
          claimed_at: string
          id: string
          idempotency_key: string
          source_id: string
          source_type: string
        }[]
      }
      persist_pedagogical_bundle: {
        Args: {
          p_evidence: Json
          p_idempotency_key: string
          p_results: Json
          p_rubric_version: string
          p_session_id: string
          p_source_id: string
          p_source_type: string
          p_user_id: string
        }
        Returns: Json
      }
      reserve_ai_usage: {
        Args: {
          p_daily_limit: number
          p_max_concurrent: number
          p_min_interval_seconds: number
          p_model: string
          p_monthly_limit: number
          p_operation: string
          p_premium_daily_limit: number
          p_premium_monthly_limit: number
          p_request_hash: string
          p_user_id: string
        }
        Returns: {
          allowed: boolean
          event_id: string
          reason: string
          retry_after_seconds: number
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
