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
    PostgrestVersion: "14.4"
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
      data_change_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          group_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          group_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          group_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_change_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          color: string | null
          group_id: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          address: string | null
          id: string
          managed_by_group_id: string | null
          name: string
          organization_id: string
        }
        Insert: {
          address?: string | null
          id?: string
          managed_by_group_id?: string | null
          name: string
          organization_id: string
        }
        Update: {
          address?: string | null
          id?: string
          managed_by_group_id?: string | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          chapter_email: string | null
          ended_at: string | null
          group_id: string
          id: string
          joined_at: string | null
          notes: string | null
          person_id: string
          role_type_id: string | null
          started_at: string | null
          status_id: string | null
        }
        Insert: {
          chapter_email?: string | null
          ended_at?: string | null
          group_id: string
          id?: string
          joined_at?: string | null
          notes?: string | null
          person_id: string
          role_type_id?: string | null
          started_at?: string | null
          status_id?: string | null
        }
        Update: {
          chapter_email?: string | null
          ended_at?: string | null
          group_id?: string
          id?: string
          joined_at?: string | null
          notes?: string | null
          person_id?: string
          role_type_id?: string | null
          started_at?: string | null
          status_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_affiliation_type_id_fkey"
            columns: ["role_type_id"]
            isOneToOne: false
            referencedRelation: "role_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_relationships: {
        Row: {
          child_group_id: string
          created_at: string | null
          created_by: string | null
          id: string
          parent_group_id: string
          relationship_type_id: string
          status: string | null
        }
        Insert: {
          child_group_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          parent_group_id: string
          relationship_type_id: string
          status?: string | null
        }
        Update: {
          child_group_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          parent_group_id?: string
          relationship_type_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_relationships_child_group_id_fkey"
            columns: ["child_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_relationships_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_relationships_relationship_type_id_fkey"
            columns: ["relationship_type_id"]
            isOneToOne: false
            referencedRelation: "org_relationship_types"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          features: Json | null
          group_type: string | null
          id: string
          is_primary: boolean | null
          logo_url: string | null
          name: string
          organization_id: string
          settings: Json | null
          slug: string
          terminology: Json | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          group_type?: string | null
          id?: string
          is_primary?: boolean | null
          logo_url?: string | null
          name: string
          organization_id: string
          settings?: Json | null
          slug: string
          terminology?: Json | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          group_type?: string | null
          id?: string
          is_primary?: boolean | null
          logo_url?: string | null
          name?: string
          organization_id?: string
          settings?: Json | null
          slug?: string
          terminology?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      national_org_templates: {
        Row: {
          chapter_type: string
          default_features: Json
          display_name: string
          id: string
          is_default: boolean | null
          parent_organization_id: string
          term_structure: string | null
        }
        Insert: {
          chapter_type: string
          default_features?: Json
          display_name: string
          id?: string
          is_default?: boolean | null
          parent_organization_id: string
          term_structure?: string | null
        }
        Update: {
          chapter_type?: string
          default_features?: Json
          display_name?: string
          id?: string
          is_default?: boolean | null
          parent_organization_id?: string
          term_structure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_org_templates_national_org_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "parent_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_relationship_types: {
        Row: {
          default_permissions: Json
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          default_permissions?: Json
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          default_permissions?: Json
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      organization_admins: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          organization_id: string
          person_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id: string
          person_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_admins_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admins_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          logo_url: string | null
          name: string
          org_type: string
          parent_organization_id: string | null
          settings: Json | null
          slug: string
          terminology: Json | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          org_type: string
          parent_organization_id?: string | null
          settings?: Json | null
          slug: string
          terminology?: Json | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          org_type?: string
          parent_organization_id?: string | null
          settings?: Json | null
          slug?: string
          terminology?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "orgs_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "parent_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_organizations: {
        Row: {
          abbreviation: string | null
          approved_by: string | null
          founded_year: number | null
          id: string
          logo_url: string | null
          name: string
          org_type: string
          slug: string
          status: string | null
          submitted_by: string | null
          website: string | null
        }
        Insert: {
          abbreviation?: string | null
          approved_by?: string | null
          founded_year?: number | null
          id?: string
          logo_url?: string | null
          name: string
          org_type: string
          slug: string
          status?: string | null
          submitted_by?: string | null
          website?: string | null
        }
        Update: {
          abbreviation?: string | null
          approved_by?: string | null
          founded_year?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          org_type?: string
          slug?: string
          status?: string | null
          submitted_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "national_organizations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "national_organizations_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          bid_date: string | null
          big_id: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          emergency_contact_person_id: string | null
          emergency_contact_relationship: string | null
          expected_grad_year: number | null
          first_name: string | null
          full_name: string
          id: string
          initiation_date: string | null
          last_name: string | null
          major: string | null
          member_number: string | null
          middle_name: string | null
          nickname: string | null
          personal_email: string | null
          phone: string | null
          pledge_class_id: string | null
          preferred_name: string | null
          profile_photo: string | null
          quickbooks_customer_id: string | null
          quickbooks_vendor_id: string | null
          school_email: string
          state: string | null
          street_address: string | null
        }
        Insert: {
          bid_date?: string | null
          big_id?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_person_id?: string | null
          emergency_contact_relationship?: string | null
          expected_grad_year?: number | null
          first_name?: string | null
          full_name: string
          id: string
          initiation_date?: string | null
          last_name?: string | null
          major?: string | null
          member_number?: string | null
          middle_name?: string | null
          nickname?: string | null
          personal_email?: string | null
          phone?: string | null
          pledge_class_id?: string | null
          preferred_name?: string | null
          profile_photo?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_vendor_id?: string | null
          school_email: string
          state?: string | null
          street_address?: string | null
        }
        Update: {
          bid_date?: string | null
          big_id?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_person_id?: string | null
          emergency_contact_relationship?: string | null
          expected_grad_year?: number | null
          first_name?: string | null
          full_name?: string
          id?: string
          initiation_date?: string | null
          last_name?: string | null
          major?: string | null
          member_number?: string | null
          middle_name?: string | null
          nickname?: string | null
          personal_email?: string | null
          phone?: string | null
          pledge_class_id?: string | null
          preferred_name?: string | null
          profile_photo?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_vendor_id?: string | null
          school_email?: string
          state?: string | null
          street_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persons_big_id_fkey"
            columns: ["big_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_emergency_contact_person_id_fkey"
            columns: ["emergency_contact_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_pledge_class_id_fkey"
            columns: ["pledge_class_id"]
            isOneToOne: false
            referencedRelation: "pledge_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      pledge_classes: {
        Row: {
          group_id: string
          id: string
          initiated_count: number | null
          name: string
          term_id: string | null
        }
        Insert: {
          group_id: string
          id?: string
          initiated_count?: number | null
          name: string
          term_id?: string | null
        }
        Update: {
          group_id?: string
          id?: string
          initiated_count?: number | null
          name?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pledge_classes_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      position_assignments: {
        Row: {
          assigned_by: string | null
          group_id: string
          id: string
          is_acting: boolean | null
          person_id: string
          position_id: string
          term_end: string | null
          term_id: string
          term_start: string | null
        }
        Insert: {
          assigned_by?: string | null
          group_id: string
          id?: string
          is_acting?: boolean | null
          person_id: string
          position_id: string
          term_end?: string | null
          term_id: string
          term_start?: string | null
        }
        Update: {
          assigned_by?: string | null
          group_id?: string
          id?: string
          is_acting?: boolean | null
          person_id?: string
          position_id?: string
          term_end?: string | null
          term_id?: string
          term_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          can_rename: boolean | null
          display_order: number | null
          group_id: string
          has_budget: boolean | null
          id: string
          is_locked: boolean | null
          is_presiding_officer: boolean | null
          max_holders: number | null
          officer_selection: string | null
          permission_level: string | null
          semester_scope: string[] | null
          slug: string
          system_role_id: string | null
          title: string
          type: string | null
        }
        Insert: {
          can_rename?: boolean | null
          display_order?: number | null
          group_id: string
          has_budget?: boolean | null
          id?: string
          is_locked?: boolean | null
          is_presiding_officer?: boolean | null
          max_holders?: number | null
          officer_selection?: string | null
          permission_level?: string | null
          semester_scope?: string[] | null
          slug: string
          system_role_id?: string | null
          title: string
          type?: string | null
        }
        Update: {
          can_rename?: boolean | null
          display_order?: number | null
          group_id?: string
          has_budget?: boolean | null
          id?: string
          is_locked?: boolean | null
          is_presiding_officer?: boolean | null
          max_holders?: number | null
          officer_selection?: string | null
          permission_level?: string | null
          semester_scope?: string[] | null
          slug?: string
          system_role_id?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_system_role_id_fkey"
            columns: ["system_role_id"]
            isOneToOne: false
            referencedRelation: "system_position_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_assignments: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          person_id: string
          progress: number
          requirement_id: string
          status: string
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          progress?: number
          requirement_id: string
          status?: string
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          progress?: number
          requirement_id?: string
          status?: string
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_assignments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_assignments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_progress_entries: {
        Row: {
          amount: number
          approved_by: string | null
          assignment_id: string
          created_at: string
          id: string
          logged_by: string
          note: string | null
          occurred_on: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          assignment_id: string
          created_at?: string
          id?: string
          logged_by: string
          note?: string | null
          occurred_on?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          assignment_id?: string
          created_at?: string
          id?: string
          logged_by?: string
          note?: string | null
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_progress_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_progress_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "requirement_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirement_progress_entries_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          amount_cents: number | null
          assign_to: string
          audience_position_ids: string[] | null
          audience_role_type_ids: string[] | null
          audience_subgroup_ids: string[] | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          group_id: string
          id: string
          is_active: boolean
          kind: string
          occurs_at: string | null
          quota_target: number | null
          quota_unit: string | null
          requires_verification: boolean
          term_id: string
          title: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          assign_to?: string
          audience_position_ids?: string[] | null
          audience_role_type_ids?: string[] | null
          audience_subgroup_ids?: string[] | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          kind: string
          occurs_at?: string | null
          quota_target?: number | null
          quota_unit?: string | null
          requires_verification?: boolean
          term_id: string
          title: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          assign_to?: string
          audience_position_ids?: string[] | null
          audience_role_type_ids?: string[] | null
          audience_subgroup_ids?: string[] | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          kind?: string
          occurs_at?: string | null
          quota_target?: number | null
          quota_unit?: string | null
          requires_verification?: boolean
          term_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      role_types: {
        Row: {
          access_level: string
          can_attend_events: boolean | null
          can_hold_office: boolean | null
          can_speak_at_meetings: boolean | null
          can_submit_expenses: boolean | null
          can_view_documents: boolean | null
          can_view_financials: boolean | null
          can_view_minutes: boolean | null
          can_view_roster: boolean | null
          can_vote: boolean | null
          color: string | null
          description: string | null
          display_order: number | null
          group_id: string
          id: string
          is_default: boolean | null
          name: string
          slug: string
        }
        Insert: {
          access_level: string
          can_attend_events?: boolean | null
          can_hold_office?: boolean | null
          can_speak_at_meetings?: boolean | null
          can_submit_expenses?: boolean | null
          can_view_documents?: boolean | null
          can_view_financials?: boolean | null
          can_view_minutes?: boolean | null
          can_view_roster?: boolean | null
          can_vote?: boolean | null
          color?: string | null
          description?: string | null
          display_order?: number | null
          group_id: string
          id?: string
          is_default?: boolean | null
          name: string
          slug: string
        }
        Update: {
          access_level?: string
          can_attend_events?: boolean | null
          can_hold_office?: boolean | null
          can_speak_at_meetings?: boolean | null
          can_submit_expenses?: boolean | null
          can_view_documents?: boolean | null
          can_view_financials?: boolean | null
          can_view_minutes?: boolean | null
          can_view_roster?: boolean | null
          can_vote?: boolean | null
          color?: string | null
          description?: string | null
          display_order?: number | null
          group_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      room_assignments: {
        Row: {
          ends_on: string | null
          id: string
          member_id: string
          notes: string | null
          room_id: string
          starts_on: string
          term_id: string
        }
        Insert: {
          ends_on?: string | null
          id?: string
          member_id: string
          notes?: string | null
          room_id: string
          starts_on: string
          term_id: string
        }
        Update: {
          ends_on?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          room_id?: string
          starts_on?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          beds: number | null
          book_shelves: number | null
          capacity: number | null
          closets: number | null
          description: string | null
          desk_chairs: number | null
          desks: number | null
          display_order: number | null
          dressers: number | null
          facility_id: string
          floor: string | null
          floor_plan_code: string | null
          floor_plan_use: string | null
          id: string
          ideal_capacity: number | null
          is_active: boolean | null
          loft_kits: number | null
          mattresses: number | null
          name: string
          nickname: string | null
          room_number: string | null
          sofas: number | null
          square_footage: number | null
          type: string | null
        }
        Insert: {
          beds?: number | null
          book_shelves?: number | null
          capacity?: number | null
          closets?: number | null
          description?: string | null
          desk_chairs?: number | null
          desks?: number | null
          display_order?: number | null
          dressers?: number | null
          facility_id: string
          floor?: string | null
          floor_plan_code?: string | null
          floor_plan_use?: string | null
          id?: string
          ideal_capacity?: number | null
          is_active?: boolean | null
          loft_kits?: number | null
          mattresses?: number | null
          name: string
          nickname?: string | null
          room_number?: string | null
          sofas?: number | null
          square_footage?: number | null
          type?: string | null
        }
        Update: {
          beds?: number | null
          book_shelves?: number | null
          capacity?: number | null
          closets?: number | null
          description?: string | null
          desk_chairs?: number | null
          desks?: number | null
          display_order?: number | null
          dressers?: number | null
          facility_id?: string
          floor?: string | null
          floor_plan_code?: string | null
          floor_plan_use?: string | null
          id?: string
          ideal_capacity?: number | null
          is_active?: boolean | null
          loft_kits?: number | null
          mattresses?: number | null
          name?: string
          nickname?: string | null
          room_number?: string | null
          sofas?: number | null
          square_footage?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      status_definitions: {
        Row: {
          color: string | null
          description: string | null
          display_order: number | null
          group_id: string | null
          id: string
          is_base: boolean | null
          name: string
          override_access_level: string | null
          override_can_attend_events: boolean | null
          override_can_hold_office: boolean | null
          override_can_speak_at_meetings: boolean | null
          override_can_submit_expenses: boolean | null
          override_can_view_documents: boolean | null
          override_can_view_financials: boolean | null
          override_can_view_minutes: boolean | null
          override_can_view_roster: boolean | null
          override_can_vote: boolean | null
          slug: string
        }
        Insert: {
          color?: string | null
          description?: string | null
          display_order?: number | null
          group_id?: string | null
          id?: string
          is_base?: boolean | null
          name: string
          override_access_level?: string | null
          override_can_attend_events?: boolean | null
          override_can_hold_office?: boolean | null
          override_can_speak_at_meetings?: boolean | null
          override_can_submit_expenses?: boolean | null
          override_can_view_documents?: boolean | null
          override_can_view_financials?: boolean | null
          override_can_view_minutes?: boolean | null
          override_can_view_roster?: boolean | null
          override_can_vote?: boolean | null
          slug: string
        }
        Update: {
          color?: string | null
          description?: string | null
          display_order?: number | null
          group_id?: string | null
          id?: string
          is_base?: boolean | null
          name?: string
          override_access_level?: string | null
          override_can_attend_events?: boolean | null
          override_can_hold_office?: boolean | null
          override_can_speak_at_meetings?: boolean | null
          override_can_submit_expenses?: boolean | null
          override_can_view_documents?: boolean | null
          override_can_view_financials?: boolean | null
          override_can_view_minutes?: boolean | null
          override_can_view_roster?: boolean | null
          override_can_vote?: boolean | null
          slug?: string
        }
        Relationships: []
      }
      subgroup_members: {
        Row: {
          appointed_by: string | null
          id: string
          join_type: string | null
          joined_at: string | null
          left_at: string | null
          person_id: string
          role: string | null
          subgroup_id: string
        }
        Insert: {
          appointed_by?: string | null
          id?: string
          join_type?: string | null
          joined_at?: string | null
          left_at?: string | null
          person_id: string
          role?: string | null
          subgroup_id: string
        }
        Update: {
          appointed_by?: string | null
          id?: string
          join_type?: string | null
          joined_at?: string | null
          left_at?: string | null
          person_id?: string
          role?: string | null
          subgroup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subgroup_members_appointed_by_fkey"
            columns: ["appointed_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subgroup_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subgroup_members_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
        ]
      }
      subgroups: {
        Row: {
          can_rename: boolean | null
          group_id: string
          head_position_id: string | null
          id: string
          is_locked: boolean | null
          is_private: boolean | null
          membership_type: string | null
          name: string
          pledge_class_id: string | null
          slug: string
          subgroup_type: string | null
        }
        Insert: {
          can_rename?: boolean | null
          group_id: string
          head_position_id?: string | null
          id?: string
          is_locked?: boolean | null
          is_private?: boolean | null
          membership_type?: string | null
          name: string
          pledge_class_id?: string | null
          slug: string
          subgroup_type?: string | null
        }
        Update: {
          can_rename?: boolean | null
          group_id?: string
          head_position_id?: string | null
          id?: string
          is_locked?: boolean | null
          is_private?: boolean | null
          membership_type?: string | null
          name?: string
          pledge_class_id?: string | null
          slug?: string
          subgroup_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subgroups_head_position_id_fkey"
            columns: ["head_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subgroups_pledge_class_id_fkey"
            columns: ["pledge_class_id"]
            isOneToOne: false
            referencedRelation: "pledge_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      system_position_roles: {
        Row: {
          default_name: string
          description: string | null
          id: string
          is_house_manager: boolean | null
          is_presiding_officer: boolean | null
          is_required: boolean | null
          is_rush_chair: boolean | null
          is_secretary: boolean | null
          is_treasurer: boolean | null
          is_vice_president: boolean | null
          slug: string
        }
        Insert: {
          default_name: string
          description?: string | null
          id?: string
          is_house_manager?: boolean | null
          is_presiding_officer?: boolean | null
          is_required?: boolean | null
          is_rush_chair?: boolean | null
          is_secretary?: boolean | null
          is_treasurer?: boolean | null
          is_vice_president?: boolean | null
          slug: string
        }
        Update: {
          default_name?: string
          description?: string | null
          id?: string
          is_house_manager?: boolean | null
          is_presiding_officer?: boolean | null
          is_required?: boolean | null
          is_rush_chair?: boolean | null
          is_secretary?: boolean | null
          is_treasurer?: boolean | null
          is_vice_president?: boolean | null
          slug?: string
        }
        Relationships: []
      }
      term_definitions: {
        Row: {
          auto_generate: boolean | null
          end_day: number
          end_month: number
          generate_months_ahead: number | null
          group_id: string
          has_budget: boolean | null
          has_elections: boolean | null
          has_rollover: boolean | null
          has_rush: boolean | null
          id: string
          is_active: boolean | null
          name: string
          officer_selection: string | null
          ordinal: number
          slug: string
          start_day: number
          start_month: number
        }
        Insert: {
          auto_generate?: boolean | null
          end_day: number
          end_month: number
          generate_months_ahead?: number | null
          group_id: string
          has_budget?: boolean | null
          has_elections?: boolean | null
          has_rollover?: boolean | null
          has_rush?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          officer_selection?: string | null
          ordinal: number
          slug: string
          start_day: number
          start_month: number
        }
        Update: {
          auto_generate?: boolean | null
          end_day?: number
          end_month?: number
          generate_months_ahead?: number | null
          group_id?: string
          has_budget?: boolean | null
          has_elections?: boolean | null
          has_rollover?: boolean | null
          has_rush?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          officer_selection?: string | null
          ordinal?: number
          slug?: string
          start_day?: number
          start_month?: number
        }
        Relationships: []
      }
      terms: {
        Row: {
          definition_id: string
          ends_on: string
          group_id: string
          has_budget: boolean
          has_elections: boolean
          has_rollover: boolean
          has_rush: boolean
          id: string
          name: string
          officer_selection: string
          starts_on: string
          status: string | null
          year: number
        }
        Insert: {
          definition_id: string
          ends_on: string
          group_id: string
          has_budget: boolean
          has_elections: boolean
          has_rollover: boolean
          has_rush: boolean
          id?: string
          name: string
          officer_selection: string
          starts_on: string
          status?: string | null
          year: number
        }
        Update: {
          definition_id?: string
          ends_on?: string
          group_id?: string
          has_budget?: boolean
          has_elections?: boolean
          has_rollover?: boolean
          has_rush?: boolean
          id?: string
          name?: string
          officer_selection?: string
          starts_on?: string
          status?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "term_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_system_role_holders: {
        Row: {
          full_name: string | null
          org_id: string | null
          person_id: string | null
          position_title: string | null
          system_role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_my_admin_group_ids: { Args: never; Returns: string[] }
      get_my_group_ids: { Args: never; Returns: string[] }
      get_my_org_ids: { Args: never; Returns: string[] }
      get_my_organization_ids: { Args: never; Returns: string[] }
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
