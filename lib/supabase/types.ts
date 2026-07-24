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
      budget_line_items: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          display_order: number | null
          id: string
          notes: string | null
          proposal_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          display_order?: number | null
          id?: string
          notes?: string | null
          proposal_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          display_order?: number | null
          id?: string
          notes?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "budget_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_proposals: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          notes: string | null
          position_id: string | null
          status: string
          subgroup_id: string | null
          submitted_at: string | null
          submitted_by: string
          updated_at: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          notes?: string | null
          position_id?: string | null
          status?: string
          subgroup_id?: string | null
          submitted_at?: string | null
          submitted_by: string
          updated_at?: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          position_id?: string | null
          status?: string
          subgroup_id?: string | null
          submitted_at?: string | null
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_proposals_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_proposals_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_proposals_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_proposals_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approval_mode: string
          approved_at: string | null
          approved_by: string | null
          approver_group_id: string | null
          approver_position_id: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          poll_id: string | null
          ratified_at: string | null
          status: string
          submitted_at: string | null
          term_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          approver_group_id?: string | null
          approver_position_id?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          poll_id?: string | null
          ratified_at?: string | null
          status?: string
          submitted_at?: string | null
          term_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          approved_at?: string | null
          approved_by?: string | null
          approver_group_id?: string | null
          approver_position_id?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          poll_id?: string | null
          ratified_at?: string | null
          status?: string
          submitted_at?: string | null
          term_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_approver_group_id_fkey"
            columns: ["approver_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_approver_position_id_fkey"
            columns: ["approver_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_tokens: {
        Row: {
          claimed_at: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          group_id: string
          id: string
          person_id: string
          token: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          group_id: string
          id?: string
          person_id: string
          token?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          person_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_tokens_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_requirement_links: {
        Row: {
          comment_id: string
          created_at: string
          created_by: string
          id: string
          requirement_assignment_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          created_by: string
          id?: string
          requirement_assignment_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          created_by?: string
          id?: string
          requirement_assignment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_requirement_links_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_requirement_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_requirement_links_requirement_assignment_id_fkey"
            columns: ["requirement_assignment_id"]
            isOneToOne: false
            referencedRelation: "requirement_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anchor_context_after: string | null
          anchor_context_before: string | null
          anchor_metadata: Json | null
          anchor_text: string | null
          body: string
          created_at: string
          created_by: string
          group_id: string
          id: string
          parent_comment_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          resource_id: string
          resource_type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          anchor_context_after?: string | null
          anchor_context_before?: string | null
          anchor_metadata?: Json | null
          anchor_text?: string | null
          body: string
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id: string
          resource_type: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          anchor_context_after?: string | null
          anchor_context_before?: string | null
          anchor_metadata?: Json | null
          anchor_text?: string | null
          body?: string
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          parent_comment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          resource_id?: string
          resource_type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
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
      document_packages: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          document_id: string
          group_id: string
          id: string
          sealed_at: string | null
          sealed_by: string | null
          signing_deadline: string | null
          signing_order: string
          signing_status: string
          superseded_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          document_id: string
          group_id: string
          id?: string
          sealed_at?: string | null
          sealed_by?: string | null
          signing_deadline?: string | null
          signing_order?: string
          signing_status?: string
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          group_id?: string
          id?: string
          sealed_at?: string | null
          sealed_by?: string | null
          signing_deadline?: string | null
          signing_order?: string
          signing_status?: string
          superseded_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_packages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_packages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_packages_sealed_by_fkey"
            columns: ["sealed_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_packages_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "document_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          consent_text: string | null
          created_at: string
          document_hash_at_request: string | null
          document_hash_at_signing: string | null
          id: string
          ip_address: unknown
          package_id: string
          sign_order: number
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          signer_person_id: string
          signer_role: string | null
          status: string
          updated_at: string
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          consent_text?: string | null
          created_at?: string
          document_hash_at_request?: string | null
          document_hash_at_signing?: string | null
          id?: string
          ip_address?: unknown
          package_id: string
          sign_order?: number
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_person_id: string
          signer_role?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          consent_text?: string | null
          created_at?: string
          document_hash_at_request?: string | null
          document_hash_at_signing?: string | null
          id?: string
          ip_address?: unknown
          package_id?: string
          sign_order?: number
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_person_id?: string
          signer_role?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "document_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_signer_person_id_fkey"
            columns: ["signer_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string | null
          created_at: string
          created_by: string
          file_name: string | null
          file_path: string | null
          file_type: string | null
          group_id: string
          id: string
          kind: string
          parent_document_id: string | null
          poll_id: string | null
          status: string
          submitted_at: string | null
          term_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          created_at?: string
          created_by: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          group_id: string
          id?: string
          kind?: string
          parent_document_id?: string | null
          poll_id?: string | null
          status?: string
          submitted_at?: string | null
          term_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_path?: string | null
          file_type?: string | null
          group_id?: string
          id?: string
          kind?: string
          parent_document_id?: string | null
          poll_id?: string | null
          status?: string
          submitted_at?: string | null
          term_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
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
      event_prospect_attendance: {
        Row: {
          checked_in_by: string
          created_at: string
          event_id: string
          id: string
          prospect_id: string
        }
        Insert: {
          checked_in_by: string
          created_at?: string
          event_id: string
          id?: string
          prospect_id: string
        }
        Update: {
          checked_in_by?: string
          created_at?: string
          event_id?: string
          id?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_prospect_attendance_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_prospect_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_prospect_attendance_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          group_id: string
          id: string
          kind: string
          location: string | null
          starts_at: string
          term_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          group_id: string
          id?: string
          kind?: string
          location?: string | null
          starts_at: string
          term_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          group_id?: string
          id?: string
          kind?: string
          location?: string | null
          starts_at?: string
          term_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "facilities_managed_by_group_id_fkey"
            columns: ["managed_by_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
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
      housing_lotteries: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          facility_id: string
          group_id: string
          id: string
          opens_at: string | null
          pick_window_hours: number | null
          points_config: Json
          status: string
          term_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          facility_id: string
          group_id: string
          id?: string
          opens_at?: string | null
          pick_window_hours?: number | null
          points_config?: Json
          status?: string
          term_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          facility_id?: string
          group_id?: string
          id?: string
          opens_at?: string | null
          pick_window_hours?: number | null
          points_config?: Json
          status?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "housing_lotteries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lotteries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lotteries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lotteries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_lottery_entrants: {
        Row: {
          draft_order: number | null
          id: string
          lottery_id: string
          person_id: string
          points_breakdown: Json | null
          points_snapshot: number
          status: string
          turn_started_at: string | null
        }
        Insert: {
          draft_order?: number | null
          id?: string
          lottery_id: string
          person_id: string
          points_breakdown?: Json | null
          points_snapshot?: number
          status?: string
          turn_started_at?: string | null
        }
        Update: {
          draft_order?: number | null
          id?: string
          lottery_id?: string
          person_id?: string
          points_breakdown?: Json | null
          points_snapshot?: number
          status?: string
          turn_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housing_lottery_entrants_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "housing_lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lottery_entrants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_lottery_picks: {
        Row: {
          entrant_id: string
          id: string
          lottery_id: string
          pick_number: number
          picked_at: string
          room_id: string
        }
        Insert: {
          entrant_id: string
          id?: string
          lottery_id: string
          pick_number: number
          picked_at?: string
          room_id: string
        }
        Update: {
          entrant_id?: string
          id?: string
          lottery_id?: string
          pick_number?: number
          picked_at?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housing_lottery_picks_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "housing_lottery_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lottery_picks_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "housing_lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_lottery_picks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_point_adjustments: {
        Row: {
          amount: number
          created_at: string
          group_id: string
          id: string
          logged_by: string
          person_id: string
          reason: string
          term_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          group_id: string
          id?: string
          logged_by: string
          person_id: string
          reason: string
          term_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          group_id?: string
          id?: string
          logged_by?: string
          person_id?: string
          reason?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "housing_point_adjustments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_point_adjustments_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_point_adjustments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_point_adjustments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          escalated_at: string | null
          escalated_by: string | null
          escalated_to_group_id: string | null
          facility_id: string | null
          group_id: string
          id: string
          kind: string
          location_note: string | null
          photo_paths: string[] | null
          priority: string
          reported_by: string
          resolution_note: string | null
          resolved_at: string | null
          room_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_group_id?: string | null
          facility_id?: string | null
          group_id: string
          id?: string
          kind?: string
          location_note?: string | null
          photo_paths?: string[] | null
          priority?: string
          reported_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          room_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          escalated_to_group_id?: string | null
          facility_id?: string | null
          group_id?: string
          id?: string
          kind?: string
          location_note?: string | null
          photo_paths?: string[] | null
          priority?: string
          reported_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          room_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_escalated_to_group_id_fkey"
            columns: ["escalated_to_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
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
      notification_preferences: {
        Row: {
          calendar_feed_token: string | null
          created_at: string
          email_digest: boolean
          email_enabled: boolean
          person_id: string
          updated_at: string
        }
        Insert: {
          calendar_feed_token?: string | null
          created_at?: string
          email_digest?: boolean
          email_enabled?: boolean
          person_id: string
          updated_at?: string
        }
        Update: {
          calendar_feed_token?: string | null
          created_at?: string
          email_digest?: boolean
          email_enabled?: boolean
          person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          emailed_at: string | null
          group_id: string
          group_key: string | null
          href: string | null
          id: string
          person_id: string
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          group_id: string
          group_key?: string | null
          href?: string | null
          id?: string
          person_id: string
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          group_id?: string
          group_key?: string | null
          href?: string | null
          id?: string
          person_id?: string
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
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
          legal_name: string | null
          logo_url: string | null
          name: string
          org_type: string
          parent_organization_id: string | null
          settings: Json | null
          slug: string
          terminology: Json | null
          university_id: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          org_type: string
          parent_organization_id?: string | null
          settings?: Json | null
          slug: string
          terminology?: Json | null
          university_id?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          org_type?: string
          parent_organization_id?: string | null
          settings?: Json | null
          slug?: string
          terminology?: Json | null
          university_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
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
          primary_color: string | null
          secondary_color: string | null
          settings: Json
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
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
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
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json
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
      person_sensitive_details: {
        Row: {
          city: string | null
          country: string | null
          date_of_birth: string | null
          emergency_contact_person_id: string | null
          emergency_contact_relationship: string | null
          person_id: string
          state: string | null
          street_address: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          date_of_birth?: string | null
          emergency_contact_person_id?: string | null
          emergency_contact_relationship?: string | null
          person_id: string
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          date_of_birth?: string | null
          emergency_contact_person_id?: string | null
          emergency_contact_relationship?: string | null
          person_id?: string
          state?: string | null
          street_address?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_sensitive_details_emergency_contact_person_id_fkey"
            columns: ["emergency_contact_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_sensitive_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          auth_user_id: string | null
          bid_date: string | null
          big_id: string | null
          bio: string | null
          created_at: string | null
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
          preferred_name: string | null
          profile_photo: string | null
          quickbooks_customer_id: string | null
          quickbooks_vendor_id: string | null
          school_email: string
        }
        Insert: {
          auth_user_id?: string | null
          bid_date?: string | null
          big_id?: string | null
          bio?: string | null
          created_at?: string | null
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
          preferred_name?: string | null
          profile_photo?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_vendor_id?: string | null
          school_email: string
        }
        Update: {
          auth_user_id?: string | null
          bid_date?: string | null
          big_id?: string | null
          bio?: string | null
          created_at?: string | null
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
          preferred_name?: string | null
          profile_photo?: string | null
          quickbooks_customer_id?: string | null
          quickbooks_vendor_id?: string | null
          school_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_big_id_fkey"
            columns: ["big_id"]
            isOneToOne: false
            referencedRelation: "persons"
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
      poll_options: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_participants: {
        Row: {
          created_at: string
          id: string
          invitation_token: string | null
          person_id: string | null
          poll_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitation_token?: string | null
          person_id?: string | null
          poll_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitation_token?: string | null
          person_id?: string | null
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_participants_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_abstain: boolean
          allow_proxies: boolean
          closes_at: string | null
          created_at: string
          created_by: string
          description: string | null
          document_id: string | null
          group_id: string
          id: string
          lifecycle: string
          method_settings: Json
          opens_at: string | null
          quorum: number | null
          status: string
          term_id: string | null
          title: string
          updated_at: string
          vote_privacy: string
          voting_method: string
        }
        Insert: {
          allow_abstain?: boolean
          allow_proxies?: boolean
          closes_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          document_id?: string | null
          group_id: string
          id?: string
          lifecycle?: string
          method_settings?: Json
          opens_at?: string | null
          quorum?: number | null
          status?: string
          term_id?: string | null
          title: string
          updated_at?: string
          vote_privacy?: string
          voting_method?: string
        }
        Update: {
          allow_abstain?: boolean
          allow_proxies?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          document_id?: string | null
          group_id?: string
          id?: string
          lifecycle?: string
          method_settings?: Json
          opens_at?: string | null
          quorum?: number | null
          status?: string
          term_id?: string | null
          title?: string
          updated_at?: string
          vote_privacy?: string
          voting_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_term_id_fkey"
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
      profile_change_requests: {
        Row: {
          created_at: string
          current_value: string | null
          field_name: string
          group_id: string
          id: string
          person_id: string
          reason: string | null
          requested_value: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_value?: string | null
          field_name: string
          group_id: string
          id?: string
          person_id: string
          reason?: string | null
          requested_value: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_value?: string | null
          field_name?: string
          group_id?: string
          id?: string
          person_id?: string
          reason?: string | null
          requested_value?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_feedback: {
        Row: {
          author_person_id: string
          body: string
          created_at: string
          id: string
          prospect_id: string
          rating: number | null
        }
        Insert: {
          author_person_id: string
          body: string
          created_at?: string
          id?: string
          prospect_id: string
          rating?: number | null
        }
        Update: {
          author_person_id?: string
          body?: string
          created_at?: string
          id?: string
          prospect_id?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_feedback_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_feedback_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          added_by: string
          converted_person_id: string | null
          created_at: string
          email: string | null
          full_name: string
          group_id: string
          id: string
          is_legacy: boolean
          phone: string | null
          photo_path: string | null
          poll_id: string | null
          school_year: string | null
          status: string
          term_id: string
          updated_at: string
        }
        Insert: {
          added_by: string
          converted_person_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          group_id: string
          id?: string
          is_legacy?: boolean
          phone?: string | null
          photo_path?: string | null
          poll_id?: string | null
          school_year?: string | null
          status?: string
          term_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string
          converted_person_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          group_id?: string
          id?: string
          is_legacy?: boolean
          phone?: string | null
          photo_path?: string | null
          poll_id?: string | null
          school_year?: string | null
          status?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_converted_person_id_fkey"
            columns: ["converted_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          applied_progress_entry_id: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string
          external_ref: string | null
          group_id: string
          id: string
          line_item_id: string | null
          occurred_on: string
          proposal_id: string | null
          receipt_paths: string[] | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          submitted_by: string
          term_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          applied_progress_entry_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description: string
          external_ref?: string | null
          group_id: string
          id?: string
          line_item_id?: string | null
          occurred_on: string
          proposal_id?: string | null
          receipt_paths?: string[] | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_by: string
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_progress_entry_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string
          external_ref?: string | null
          group_id?: string
          id?: string
          line_item_id?: string | null
          occurred_on?: string
          proposal_id?: string | null
          receipt_paths?: string[] | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_by?: string
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_applied_progress_entry_id_fkey"
            columns: ["applied_progress_entry_id"]
            isOneToOne: false
            referencedRelation: "requirement_progress_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "budget_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
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
      universities: {
        Row: {
          abbreviation: string | null
          city: string | null
          country: string
          created_at: string
          greek_life_office_email: string | null
          id: string
          name: string
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abbreviation?: string | null
          city?: string | null
          country?: string
          created_at?: string
          greek_life_office_email?: string | null
          id?: string
          name: string
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abbreviation?: string | null
          city?: string | null
          country?: string
          created_at?: string
          greek_life_office_email?: string | null
          id?: string
          name?: string
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          cast_by_person_id: string | null
          created_at: string
          id: string
          person_id: string
          poll_id: string
          vote_data: Json
        }
        Insert: {
          cast_by_person_id?: string | null
          created_at?: string
          id?: string
          person_id: string
          poll_id: string
          vote_data: Json
        }
        Update: {
          cast_by_person_id?: string | null
          created_at?: string
          id?: string
          person_id?: string
          poll_id?: string
          vote_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "votes_cast_by_person_id_fkey"
            columns: ["cast_by_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
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
      can_admin_view_person: { Args: { p_person_id: string }; Returns: boolean }
      can_read_comments: {
        Args: { p_resource_id: string; p_resource_type: string }
        Returns: boolean
      }
      can_write_comments: {
        Args: { p_resource_id: string; p_resource_type: string }
        Returns: boolean
      }
      current_lottery_turn: { Args: { p_lottery_id: string }; Returns: string }
      get_my_admin_group_ids: { Args: never; Returns: string[] }
      get_my_group_ids: { Args: never; Returns: string[] }
      get_my_module_admin_group_ids: {
        Args: { p_module: string }
        Returns: string[]
      }
      get_my_org_ids: { Args: never; Returns: string[] }
      get_my_organization_ids: { Args: never; Returns: string[] }
      get_my_person_id: { Args: never; Returns: string }
      get_my_position_ids: { Args: never; Returns: string[] }
      is_person_in_group: {
        Args: { p_group_id: string; p_person_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      lottery_turn_open: { Args: { p_entrant_id: string }; Returns: boolean }
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
