export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'trucker' | 'provider'
          location: string
          phone: string | null
          truck_type: string | null
          license_number: string | null
          services: string[] | null
          service_radius: number | null
          certifications: string[] | null
          language: string
          rating: number
          join_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: 'trucker' | 'provider'
          location: string
          phone?: string | null
          truck_type?: string | null
          license_number?: string | null
          services?: string[] | null
          service_radius?: number | null
          certifications?: string[] | null
          language?: string
          rating?: number
          join_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'trucker' | 'provider'
          location?: string
          phone?: string | null
          truck_type?: string | null
          license_number?: string | null
          services?: string[] | null
          service_radius?: number | null
          certifications?: string[] | null
          language?: string
          rating?: number
          join_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      requests: {
        Row: {
          id: string
          trucker_id: string
          provider_id: string | null
          location: string
          coordinates: Json
          service_type: 'towing' | 'repair' | 'mechanic' | 'tire_repair' | 'truck_wash' | 'hose_repair'
          status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          urgency: 'low' | 'medium' | 'high'
          description: string
          estimated_cost: number | null
          actual_cost: number | null
          photos: string[] | null
          cancellation_reason: string | null
          cancelled_by: 'trucker' | 'provider' | null
          created_at: string
          accepted_at: string | null
          completed_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          trucker_id: string
          provider_id?: string | null
          location: string
          coordinates: Json
          service_type: 'towing' | 'repair' | 'mechanic' | 'tire_repair' | 'truck_wash' | 'hose_repair'
          status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          urgency?: 'low' | 'medium' | 'high'
          description: string
          estimated_cost?: number | null
          actual_cost?: number | null
          photos?: string[] | null
          cancellation_reason?: string | null
          cancelled_by?: 'trucker' | 'provider' | null
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          id?: string
          trucker_id?: string
          provider_id?: string | null
          location?: string
          coordinates?: Json
          service_type?: 'towing' | 'repair' | 'mechanic' | 'tire_repair' | 'truck_wash' | 'hose_repair'
          status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          urgency?: 'low' | 'medium' | 'high'
          description?: string
          estimated_cost?: number | null
          actual_cost?: number | null
          photos?: string[] | null
          cancellation_reason?: string | null
          cancelled_by?: 'trucker' | 'provider' | null
          created_at?: string
          accepted_at?: string | null
          completed_at?: string | null
          cancelled_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          request_id: string
          sender_id: string
          content: string
          message_type: 'text' | 'location' | 'image' | 'system'
          is_read: boolean
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          sender_id: string
          content: string
          message_type?: 'text' | 'location' | 'image' | 'system'
          is_read?: boolean
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          sender_id?: string
          content?: string
          message_type?: 'text' | 'location' | 'image' | 'system'
          is_read?: boolean
          timestamp?: string
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          request_id: string
          user_id: string
          user_role: 'trucker' | 'provider'
          amount: number
          status: 'pending' | 'charged' | 'refunded'
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          user_id: string
          user_role: 'trucker' | 'provider'
          amount: number
          status?: 'pending' | 'charged' | 'refunded'
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          user_id?: string
          user_role?: 'trucker' | 'provider'
          amount?: number
          status?: 'pending' | 'charged' | 'refunded'
          description?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'trucker' | 'provider'
      service_type: 'towing' | 'repair' | 'mechanic' | 'tire_repair' | 'truck_wash' | 'hose_repair'
      request_status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
      urgency_level: 'low' | 'medium' | 'high'
      message_type: 'text' | 'location' | 'image' | 'system'
      lead_status: 'pending' | 'charged' | 'refunded'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}