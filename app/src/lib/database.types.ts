
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "app": {
          Tables: {
            "number_series": {
                  Row: {
                    "last_value": number,"series": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value"?: number,"series": string
                  }
                  Update: {
                    "last_value"?: number,"series"?: string
                  }
                  Relationships: [
                    
                  ]
                },"offline_key": {
                  Row: {
                    "device_id": string,"issued_at": string,"key": string,"last_seen_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device_id": string,"issued_at"?: string,"key": string,"last_seen_at"?: string,"user_id": string
                  }
                  Update: {
                    "device_id"?: string,"issued_at"?: string,"key"?: string,"last_seen_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_pin": {
                  Row: {
                    "pin_hash": string,"set_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "pin_hash": string,"set_at"?: string,"user_id": string
                  }
                  Update: {
                    "pin_hash"?: string,"set_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_mel_revision":
{ Args: { "p_revision": string }; Returns: undefined
                           },
"add_mel_items":
{ Args: { "p_items": Json,"p_revision": string }; Returns: number
                           },
"add_work_order_entry":
{ Args: { "p_entry": string,"p_wo": string }; Returns: string
                           },
"apply_mel":
{ Args: { "p_m_done": boolean,"p_mel_item": string,"p_o_passed": boolean,"p_pin": string,"p_placard_fitted": boolean,"p_remarks"?: string,"p_set_svc_mel"?: boolean,"p_snag": string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string }; Returns: string
                           },
"apply_mel_core":
{ Args: { "p_m_done": boolean,"p_mel_item": string,"p_o_passed": boolean,"p_pin": string,"p_placard_fitted": boolean,"p_remarks"?: string,"p_snag": string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string }; Returns: string
                           },
"apply_standard_rules":
{ Args: { "p_table": unknown }; Returns: undefined
                           },
"attend_snag":
{ Args: { "p_note"?: string,"p_snag": string }; Returns: undefined
                           },
"can_approve_authorizations":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_load_mel":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_see_aircraft":
{ Args: { "p_aircraft": string }; Returns: boolean
                           },
"can_see_record":
{ Args: { "p_id": string,"p_table": string }; Returns: boolean
                           },
"can_see_store":
{ Args: { "p_store": string }; Returns: boolean
                           },
"can_view_cost":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"certify_work_order":
{ Args: { "p_note": string,"p_pin": string,"p_wo": string }; Returns: undefined
                           },
"check_my_pin":
{ Args: { "p_pin": string }; Returns: boolean
                           },
"clear_ddls_entry":
{ Args: { "p_entry": string,"p_pin": string,"p_rect_tlb_book"?: string,"p_rect_tlb_page"?: string,"p_rectification": string }; Returns: undefined
                           },
"close_snag_no_fault_found":
{ Args: { "p_findings": string,"p_pin": string,"p_snag": string,"p_tlb_book"?: string,"p_tlb_page"?: string }; Returns: undefined
                           },
"complete_work_order":
{ Args: { "p_note": string,"p_wo": string }; Returns: undefined
                           },
"confirm_nadd":
{ Args: { "p_declaration": boolean,"p_limit_days"?: number,"p_nadd": string,"p_pin": string }; Returns: undefined
                           },
"confirm_nadd_fields":
{ Args: { "p_limit_days": number,"p_nadd": string }; Returns: undefined
                           },
"current_person_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"decide_approval":
{ Args: { "p_decision": string,"p_pin": string,"p_reason"?: string,"p_request": string }; Returns: string
                           },
"decide_approval_core":
{ Args: { "p_decision": string,"p_reason"?: string,"p_request": string }; Returns: string
                           },
"defer_as_nadd":
{ Args: { "p_declaration": boolean,"p_limit_days"?: number,"p_location"?: string,"p_pin": string,"p_snag": string,"p_zone"?: string }; Returns: string
                           },
"defer_on_ddls":
{ Args: { "p_days_allowed": number,"p_m_required"?: boolean,"p_manual_reference": string,"p_o_required"?: boolean,"p_pin": string,"p_remarks"?: string,"p_set_svc_mel"?: boolean,"p_snag": string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string }; Returns: string
                           },
"defer_on_ddls_core":
{ Args: { "p_days_allowed": number,"p_m_required"?: boolean,"p_manual_reference": string,"p_o_required"?: boolean,"p_pin": string,"p_remarks"?: string,"p_snag": string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string }; Returns: string
                           },
"device_checkin":
{ Args: { "p_device": string }; Returns: Json
                           },
"device_problem":
{ Args: { "p_device": string }; Returns: string
                           },
"due_from_days":
{ Args: { "p_days": number,"p_start": string }; Returns: string
                           },
"enrol_device":
{ Args: { "p_device": string }; Returns: undefined
                           },
"fleet_board":
{ Args: Record<PropertyKey, never>; Returns: {
              "aircraft_id": string,"aircraft_type": string,"blocked_by": string,"blocked_holder": string,"blocked_ref": string,"blocked_since": string,"expected_rts_on": string,"next_ddls_due": string,"next_nadd_due": string,"open_ddls": number,"open_nadds": number,"open_snags": number,"snag_display": string,"status": string,"status_set_at": string,"status_set_by": string,"tail": string
            }[]
                           },
"has_department":
{ Args: { "p_department": string }; Returns: boolean
                           },
"has_permission":
{ Args: { "p_permission": string }; Returns: boolean
                           },
"has_section":
{ Args: { "p_section": string }; Returns: boolean
                           },
"holds_step":
{ Args: { "p_action": string,"p_step": number }; Returns: boolean
                           },
"involved_in_query":
{ Args: { "p_department": string,"p_person": string,"p_raised_by": string }; Returns: boolean
                           },
"is_certifying":
{ Args: { "p_aircraft_type": string,"p_on"?: string,"p_person": string }; Returns: boolean
                           },
"is_global_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_oversight":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: { "p_department"?: string }; Returns: boolean
                           },
"issue_offline_key":
{ Args: { "p_device": string,"p_pin": string }; Returns: string
                           },
"my_active_appointments":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Tables']["appointment"]['Row'][]
                          SetofOptions: {
        from: "*"
        to: "appointment"
        isOneToOne: false
        isSetofReturn: true
      } },
"my_pending_approvals":
{ Args: Record<PropertyKey, never>; Returns: {
              "action_type": string,"chain_name": string,"id": string,"raised_at": string,"raised_by": string,"record_id": string,"record_table": string,"step_name": string,"step_no": number,"summary": string,"waiting_since": string
            }[]
                           },
"my_pin_is_set":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"nadd_for_engineer":
{ Args: { "p_allowed_status": (string)[],"p_nadd": string }; Returns: Database["public"]['Tables']["nadd"]['Row']
                          SetofOptions: {
        from: "*"
        to: "nadd"
        isOneToOne: true
        isSetofReturn: false
      } },
"next_ddls_slot":
{ Args: { "p_aircraft": string }; Returns: Record<string, unknown>
                           },
"next_number":
{ Args: { "p_default_format": string,"p_series": string }; Returns: string
                           },
"offline_signed_at":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"open_mel_revision":
{ Args: { "p_aircraft_type": string,"p_approval_date": string,"p_approval_reference": string,"p_revision": string }; Returns: string
                           },
"person_has_department":
{ Args: { "p_department": string,"p_person": string }; Returns: boolean
                           },
"person_has_permission":
{ Args: { "p_permission": string,"p_person": string }; Returns: boolean
                           },
"pin_ok":
{ Args: { "p_pin": string }; Returns: boolean
                           },
"propose_nadd":
{ Args: { "p_aircraft": string,"p_ata"?: string,"p_client_ref"?: string,"p_description": string,"p_device_time"?: string,"p_location"?: string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string,"p_zone"?: string }; Returns: string
                           },
"raise_approval":
{ Args: { "p_action": string,"p_record_id": string,"p_record_table": string,"p_summary": string }; Returns: string
                           },
"reclassify_nadd_as_snag":
{ Args: { "p_nadd": string,"p_note": string }; Returns: string
                           },
"record_svc_mel":
{ Args: { "p_reason": string,"p_snag": string }; Returns: undefined
                           },
"rectify_nadd":
{ Args: { "p_action_taken": string,"p_nadd": string,"p_pin": string,"p_rect_tlb_book"?: string,"p_rect_tlb_page"?: string }; Returns: undefined
                           },
"refuse_emergency_zone":
{ Args: { "p_aircraft": string,"p_zone": string }; Returns: undefined
                           },
"reject_nadd":
{ Args: { "p_nadd": string,"p_reason": string }; Returns: undefined
                           },
"repeat_defect":
{ Args: { "p_snag": string }; Returns: {
              "ata_sub_chapter": string,"is_repeat": boolean,"reports_in_window": number,"window_days": number
            }[]
                           },
"report_snag":
{ Args: { "p_aircraft": string,"p_ata"?: string,"p_client_ref"?: string,"p_description": string,"p_device_time"?: string,"p_soft_observation"?: boolean,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string }; Returns: string
                           },
"request_account":
{ Args: { "p_full_name": string,"p_rank_or_title"?: string,"p_requested_department": string,"p_three_letter_code": string,"p_username": string }; Returns: string
                           },
"request_ddls_extension":
{ Args: { "p_authority_reference": string,"p_entry": string,"p_extra_days": number,"p_reason": string }; Returns: string
                           },
"request_device":
{ Args: { "p_label": string }; Returns: string
                           },
"request_nadd_extension":
{ Args: { "p_extra_days": number,"p_nadd": string,"p_reason": string }; Returns: string
                           },
"request_work_order":
{ Args: { "p_est_man_hours"?: number,"p_scope": string,"p_snag": string }; Returns: string
                           },
"require_certifying":
{ Args: { "p_aircraft": string,"p_pin": string }; Returns: undefined
                           },
"revoke_device":
{ Args: { "p_device": string,"p_lost"?: boolean,"p_reason": string }; Returns: undefined
                           },
"search_mel":
{ Args: { "p_aircraft": string,"p_limit"?: number,"p_query": string }; Returns: {
              "category": string,"id": string,"interval_unit": string,"interval_value": number,"item_number": string,"m_procedure": boolean,"o_procedure": boolean,"remarks": string,"revision": string,"revision_id": string,"title": string
            }[]
                           },
"set_my_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"set_tail_status":
{ Args: { "p_aircraft": string,"p_expected_rts"?: string,"p_pin": string,"p_reason": string,"p_status": string }; Returns: string
                           },
"set_tail_status_core":
{ Args: { "p_aircraft": string,"p_expected_rts"?: string,"p_reason": string,"p_status": string }; Returns: string
                           },
"setting":
{ Args: { "p_key": string }; Returns: Json
                           },
"similar_snags":
{ Args: { "p_limit"?: number,"p_snag": string }; Returns: {
              "ata": string,"description": string,"id": string,"number": string,"reported_at": string,"same_ata": boolean,"same_tail": boolean,"status": string,"tail": string
            }[]
                           },
"snag_for_engineer":
{ Args: { "p_allowed_status": (string)[],"p_snag": string }; Returns: Database["public"]['Tables']["snag"]['Row']
                          SetofOptions: {
        from: "*"
        to: "snag"
        isOneToOne: true
        isSetofReturn: false
      } },
"submit_offline_signature":
{ Args: { "p_payload": string,"p_signature": string }; Returns: Json
                           },
"work_order_for_engineer":
{ Args: { "p_allowed_status": (string)[],"p_wo": string }; Returns: Database["public"]['Tables']["work_order"]['Row']
                          SetofOptions: {
        from: "*"
        to: "work_order"
        isOneToOne: true
        isSetofReturn: false
      } },
"work_order_missing_scans":
{ Args: { "p_wo": string }; Returns: (string)[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_grant": {
                  Row: {
                    "aircraft_id": string | null,"aircraft_type_code": string | null,"created_at": string,"created_by": string | null,"department_code": string | null,"device_time": string | null,"grant_type": string,"granted_at": string,"granted_by": string,"id": string,"is_home": boolean,"permission_code": string | null,"person_id": string,"reason": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"section_code": string | null,"store_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id"?: string | null,"aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"grant_type": string,"granted_at"?: string,"granted_by": string,"id"?: string,"is_home"?: boolean,"permission_code"?: string | null,"person_id": string,"reason": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"section_code"?: string | null,"store_code"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string | null,"aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"grant_type"?: string,"granted_at"?: string,"granted_by"?: string,"id"?: string,"is_home"?: boolean,"permission_code"?: string | null,"person_id"?: string,"reason"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"section_code"?: string | null,"store_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_grant_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grant_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "access_grant_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "access_grant_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grant_permission_code_fkey"
      columns: ["permission_code"]
isOneToOne: false
      referencedRelation: "permission"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "access_grant_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grant_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_grant_section_code_fkey"
      columns: ["section_code"]
isOneToOne: false
      referencedRelation: "engineering_section"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "access_grant_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    }
                  ]
                },"aircraft": {
                  Row: {
                    "aircraft_type_code": string,"created_at": string,"created_by": string | null,"deactivated_at": string | null,"deactivated_by": string | null,"deactivation_reason": string | null,"device_time": string | null,"id": string,"msn": string | null,"registration_effective_on": string | null,"status": string,"tail": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code": string,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id"?: string,"msn"?: string | null,"registration_effective_on"?: string | null,"status"?: string,"tail": string
                  }
                  Update: {
                    "aircraft_type_code"?: string,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id"?: string,"msn"?: string | null,"registration_effective_on"?: string | null,"status"?: string,"tail"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "aircraft_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "aircraft_deactivated_by_fkey"
      columns: ["deactivated_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"aircraft_type": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"device_time": string | null,"manufacturer": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"manufacturer"?: string | null,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"manufacturer"?: string | null,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"appointment": {
                  Row: {
                    "can_approve_authorizations": boolean,"created_at": string,"created_by": string | null,"department_code": string | null,"device_time": string | null,"id": string,"super_admin_scope": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "can_approve_authorizations"?: boolean,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"super_admin_scope"?: string,"title": string
                  }
                  Update: {
                    "can_approve_authorizations"?: boolean,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"super_admin_scope"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    }
                  ]
                },"appointment_deputy": {
                  Row: {
                    "appointment_id": string,"created_at": string,"created_by": string | null,"deputy_person_id": string,"device_time": string | null,"granted_by": string,"id": string,"reason": string,"revoked_at": string | null,"revoked_by": string | null,"valid_from": string,"valid_to": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"created_at"?: string,"created_by"?: string | null,"deputy_person_id": string,"device_time"?: string | null,"granted_by": string,"id"?: string,"reason": string,"revoked_at"?: string | null,"revoked_by"?: string | null,"valid_from": string,"valid_to": string
                  }
                  Update: {
                    "appointment_id"?: string,"created_at"?: string,"created_by"?: string | null,"deputy_person_id"?: string,"device_time"?: string | null,"granted_by"?: string,"id"?: string,"reason"?: string,"revoked_at"?: string | null,"revoked_by"?: string | null,"valid_from"?: string,"valid_to"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_deputy_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_deputy_deputy_person_id_fkey"
      columns: ["deputy_person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_deputy_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_deputy_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_holder": {
                  Row: {
                    "appointment_id": string,"created_at": string,"created_by": string | null,"device_time": string | null,"handed_over_by": string | null,"held_from": string,"held_to": string | null,"id": string,"person_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"handed_over_by"?: string | null,"held_from"?: string,"held_to"?: string | null,"id"?: string,"person_id": string,"reason": string
                  }
                  Update: {
                    "appointment_id"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"handed_over_by"?: string | null,"held_from"?: string,"held_to"?: string | null,"id"?: string,"person_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_holder_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_holder_handed_over_by_fkey"
      columns: ["handed_over_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointment_holder_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_chain": {
                  Row: {
                    "action_type": string,"created_at": string,"created_by": string | null,"device_time": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"name": string
                  }
                  Update: {
                    "action_type"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"approval_chain_step": {
                  Row: {
                    "action_type": string,"appointment_id": string | null,"created_at": string,"created_by": string | null,"department_code": string | null,"device_time": string | null,"id": string,"name": string,"step_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": string,"appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"name": string,"step_no": number
                  }
                  Update: {
                    "action_type"?: string,"appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"name"?: string,"step_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_chain_step_action_type_fkey"
      columns: ["action_type"]
isOneToOne: false
      referencedRelation: "approval_chain"
      referencedColumns: ["action_type"]
    },{
      foreignKeyName: "approval_chain_step_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_chain_step_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    }
                  ]
                },"approval_decision": {
                  Row: {
                    "created_at": string,"created_by": string | null,"decided_by": string,"decision": string,"device_time": string | null,"id": string,"reason": string | null,"request_id": string,"step_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"decided_by": string,"decision": string,"device_time"?: string | null,"id"?: string,"reason"?: string | null,"request_id": string,"step_no": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"decided_by"?: string,"decision"?: string,"device_time"?: string | null,"id"?: string,"reason"?: string | null,"request_id"?: string,"step_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_decision_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_decision_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "approval_request"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_request": {
                  Row: {
                    "action_type": string,"created_at": string,"created_by": string | null,"current_step": number,"decided_at": string | null,"device_time": string | null,"id": string,"raised_at": string,"raised_by": string,"record_id": string,"record_table": string,"status": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": string,"created_at"?: string,"created_by"?: string | null,"current_step"?: number,"decided_at"?: string | null,"device_time"?: string | null,"id"?: string,"raised_at"?: string,"raised_by": string,"record_id": string,"record_table": string,"status"?: string,"summary": string
                  }
                  Update: {
                    "action_type"?: string,"created_at"?: string,"created_by"?: string | null,"current_step"?: number,"decided_at"?: string | null,"device_time"?: string | null,"id"?: string,"raised_at"?: string,"raised_by"?: string,"record_id"?: string,"record_table"?: string,"status"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_request_action_type_fkey"
      columns: ["action_type"]
isOneToOne: false
      referencedRelation: "approval_chain"
      referencedColumns: ["action_type"]
    },{
      foreignKeyName: "approval_request_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"attachment": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"file_name": string,"id": string,"kind": string,"mime_type": string,"record_id": string,"record_table": string,"size_bytes": number,"storage_path": string,"superseded_by": string | null,"superseded_reason": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"file_name": string,"id"?: string,"kind": string,"mime_type": string,"record_id": string,"record_table": string,"size_bytes": number,"storage_path": string,"superseded_by"?: string | null,"superseded_reason"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"file_name"?: string,"id"?: string,"kind"?: string,"mime_type"?: string,"record_id"?: string,"record_table"?: string,"size_bytes"?: number,"storage_path"?: string,"superseded_by"?: string | null,"superseded_reason"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachment_superseded_by_fkey"
      columns: ["superseded_by"]
isOneToOne: false
      referencedRelation: "attachment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachment_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"cabin_zone": {
                  Row: {
                    "aircraft_type_code": string,"code": string,"created_at": string,"created_by": string | null,"device_time": string | null,"is_emergency_equipment": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code": string,"code": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"is_emergency_equipment"?: boolean,"name": string
                  }
                  Update: {
                    "aircraft_type_code"?: string,"code"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"is_emergency_equipment"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cabin_zone_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    }
                  ]
                },"certifying_authorization": {
                  Row: {
                    "aircraft_type_code": string,"approved_at": string | null,"approved_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"expires_on": string,"id": string,"issued_at": string,"issued_by": string,"person_id": string,"reference": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"valid_from": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code": string,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on": string,"id"?: string,"issued_at"?: string,"issued_by": string,"person_id": string,"reference": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"valid_from": string
                  }
                  Update: {
                    "aircraft_type_code"?: string,"approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on"?: string,"id"?: string,"issued_at"?: string,"issued_by"?: string,"person_id"?: string,"reference"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"valid_from"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certifying_authorization_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "certifying_authorization_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certifying_authorization_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certifying_authorization_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certifying_authorization_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"ddls_entry": {
                  Row: {
                    "aircraft_id": string,"cleared_at": string | null,"cleared_by": string | null,"created_at": string,"created_by": string | null,"days_allowed": number | null,"defect_text": string,"deferred_at": string,"deferred_by": string,"device_time": string | null,"due_at": string | null,"entry_no": number,"id": string,"interval_unit": string | null,"interval_value": number | null,"kind": string,"limit_text": string | null,"m_done": boolean,"m_required": boolean,"manual_reference": string | null,"mel_category": string | null,"mel_item_id": string | null,"mel_ref": string | null,"mel_revision_id": string | null,"o_passed": boolean,"o_required": boolean,"page_no": number,"placard_fitted": boolean,"rect_tlb_book": string | null,"rect_tlb_page": string | null,"rectification": string | null,"remarks": string | null,"snag_id": string,"status": string,"tlb_book": string | null,"tlb_item": string | null,"tlb_page": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"cleared_at"?: string | null,"cleared_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"days_allowed"?: number | null,"defect_text": string,"deferred_at"?: string,"deferred_by": string,"device_time"?: string | null,"due_at"?: string | null,"entry_no": number,"id"?: string,"interval_unit"?: string | null,"interval_value"?: number | null,"kind": string,"limit_text"?: string | null,"m_done"?: boolean,"m_required"?: boolean,"manual_reference"?: string | null,"mel_category"?: string | null,"mel_item_id"?: string | null,"mel_ref"?: string | null,"mel_revision_id"?: string | null,"o_passed"?: boolean,"o_required"?: boolean,"page_no": number,"placard_fitted"?: boolean,"rect_tlb_book"?: string | null,"rect_tlb_page"?: string | null,"rectification"?: string | null,"remarks"?: string | null,"snag_id": string,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string,"cleared_at"?: string | null,"cleared_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"days_allowed"?: number | null,"defect_text"?: string,"deferred_at"?: string,"deferred_by"?: string,"device_time"?: string | null,"due_at"?: string | null,"entry_no"?: number,"id"?: string,"interval_unit"?: string | null,"interval_value"?: number | null,"kind"?: string,"limit_text"?: string | null,"m_done"?: boolean,"m_required"?: boolean,"manual_reference"?: string | null,"mel_category"?: string | null,"mel_item_id"?: string | null,"mel_ref"?: string | null,"mel_revision_id"?: string | null,"o_passed"?: boolean,"o_required"?: boolean,"page_no"?: number,"placard_fitted"?: boolean,"rect_tlb_book"?: string | null,"rect_tlb_page"?: string | null,"rectification"?: string | null,"remarks"?: string | null,"snag_id"?: string,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ddls_entry_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_entry_cleared_by_fkey"
      columns: ["cleared_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_entry_deferred_by_fkey"
      columns: ["deferred_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_entry_mel_item_id_fkey"
      columns: ["mel_item_id"]
isOneToOne: false
      referencedRelation: "mel_item"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_entry_mel_revision_id_fkey"
      columns: ["mel_revision_id"]
isOneToOne: false
      referencedRelation: "mel_revision"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_entry_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snag"
      referencedColumns: ["id"]
    }
                  ]
                },"ddls_extension": {
                  Row: {
                    "approval_request_id": string | null,"authority_reference": string,"created_at": string,"created_by": string | null,"ddls_entry_id": string,"device_time": string | null,"extra_days": number,"id": string,"new_due_at": string | null,"previous_due_at": string | null,"reason": string,"requested_by": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"authority_reference": string,"created_at"?: string,"created_by"?: string | null,"ddls_entry_id": string,"device_time"?: string | null,"extra_days": number,"id"?: string,"new_due_at"?: string | null,"previous_due_at"?: string | null,"reason": string,"requested_by": string,"status"?: string
                  }
                  Update: {
                    "approval_request_id"?: string | null,"authority_reference"?: string,"created_at"?: string,"created_by"?: string | null,"ddls_entry_id"?: string,"device_time"?: string | null,"extra_days"?: number,"id"?: string,"new_due_at"?: string | null,"previous_due_at"?: string | null,"reason"?: string,"requested_by"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ddls_extension_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_request"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_extension_ddls_entry_id_fkey"
      columns: ["ddls_entry_id"]
isOneToOne: false
      referencedRelation: "ddls_entry"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ddls_extension_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"department": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"device_time": string | null,"kind": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"kind": string,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"device": {
                  Row: {
                    "blocked_at": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"enrolled_at": string | null,"enrolled_by": string | null,"id": string,"label": string,"last_seen_at": string | null,"reported_lost_at": string | null,"requested_at": string,"requested_by": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"enrolled_at"?: string | null,"enrolled_by"?: string | null,"id"?: string,"label": string,"last_seen_at"?: string | null,"reported_lost_at"?: string | null,"requested_at"?: string,"requested_by": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "blocked_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"enrolled_at"?: string | null,"enrolled_by"?: string | null,"id"?: string,"label"?: string,"last_seen_at"?: string | null,"reported_lost_at"?: string | null,"requested_at"?: string,"requested_by"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_enrolled_by_fkey"
      columns: ["enrolled_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "device_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"engineering_section": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"device_time": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mel_item": {
                  Row: {
                    "category": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"interval_unit": string,"interval_value": number | null,"item_number": string,"m_procedure": boolean,"number_digits": string | null,"o_procedure": boolean,"remarks": string | null,"revision_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"interval_unit": string,"interval_value"?: number | null,"item_number": string,"m_procedure"?: boolean,"number_digits"?: never,"o_procedure"?: boolean,"remarks"?: string | null,"revision_id": string,"title": string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"interval_unit"?: string,"interval_value"?: number | null,"item_number"?: string,"m_procedure"?: boolean,"number_digits"?: never,"o_procedure"?: boolean,"remarks"?: string | null,"revision_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mel_item_revision_id_fkey"
      columns: ["revision_id"]
isOneToOne: false
      referencedRelation: "mel_revision"
      referencedColumns: ["id"]
    }
                  ]
                },"mel_revision": {
                  Row: {
                    "activated_at": string | null,"activated_by": string | null,"aircraft_type_code": string,"approval_date": string,"approval_reference": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"loaded_by": string,"revision": string,"status": string,"superseded_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"aircraft_type_code": string,"approval_date": string,"approval_reference": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"loaded_by": string,"revision": string,"status"?: string,"superseded_at"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"aircraft_type_code"?: string,"approval_date"?: string,"approval_reference"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"loaded_by"?: string,"revision"?: string,"status"?: string,"superseded_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mel_revision_activated_by_fkey"
      columns: ["activated_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mel_revision_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "mel_revision_loaded_by_fkey"
      columns: ["loaded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"nadd": {
                  Row: {
                    "action_taken": string | null,"aircraft_id": string,"ata": string | null,"client_ref": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string | null,"declaration": boolean,"description": string,"device_time": string | null,"due_at": string | null,"id": string,"limit_days": number | null,"location": string | null,"number": string,"reclassified_snag_id": string | null,"rect_tlb_book": string | null,"rect_tlb_page": string | null,"rectified_at": string | null,"rectified_by": string | null,"reject_reason": string | null,"rejected_at": string | null,"rejected_by": string | null,"reported_at": string,"reported_by": string,"snag_id": string | null,"status": string,"tlb_book": string | null,"tlb_item": string | null,"tlb_page": string | null,"zone_code": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_taken"?: string | null,"aircraft_id": string,"ata"?: string | null,"client_ref"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration"?: boolean,"description": string,"device_time"?: string | null,"due_at"?: string | null,"id"?: string,"limit_days"?: number | null,"location"?: string | null,"number": string,"reclassified_snag_id"?: string | null,"rect_tlb_book"?: string | null,"rect_tlb_page"?: string | null,"rectified_at"?: string | null,"rectified_by"?: string | null,"reject_reason"?: string | null,"rejected_at"?: string | null,"rejected_by"?: string | null,"reported_at"?: string,"reported_by": string,"snag_id"?: string | null,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null,"zone_code"?: string | null
                  }
                  Update: {
                    "action_taken"?: string | null,"aircraft_id"?: string,"ata"?: string | null,"client_ref"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"declaration"?: boolean,"description"?: string,"device_time"?: string | null,"due_at"?: string | null,"id"?: string,"limit_days"?: number | null,"location"?: string | null,"number"?: string,"reclassified_snag_id"?: string | null,"rect_tlb_book"?: string | null,"rect_tlb_page"?: string | null,"rectified_at"?: string | null,"rectified_by"?: string | null,"reject_reason"?: string | null,"rejected_at"?: string | null,"rejected_by"?: string | null,"reported_at"?: string,"reported_by"?: string,"snag_id"?: string | null,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null,"zone_code"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nadd_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_reclassified_snag_id_fkey"
      columns: ["reclassified_snag_id"]
isOneToOne: false
      referencedRelation: "snag"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_rectified_by_fkey"
      columns: ["rectified_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_rejected_by_fkey"
      columns: ["rejected_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snag"
      referencedColumns: ["id"]
    }
                  ]
                },"nadd_extension": {
                  Row: {
                    "approval_request_id": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"extra_days": number,"id": string,"nadd_id": string,"new_due_at": string | null,"previous_due_at": string | null,"reason": string,"requested_by": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"extra_days": number,"id"?: string,"nadd_id": string,"new_due_at"?: string | null,"previous_due_at"?: string | null,"reason": string,"requested_by": string,"status"?: string
                  }
                  Update: {
                    "approval_request_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"extra_days"?: number,"id"?: string,"nadd_id"?: string,"new_due_at"?: string | null,"previous_due_at"?: string | null,"reason"?: string,"requested_by"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nadd_extension_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_request"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_extension_nadd_id_fkey"
      columns: ["nadd_id"]
isOneToOne: false
      referencedRelation: "nadd"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nadd_extension_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"offline_signature": {
                  Row: {
                    "action": string,"args": NonNullable<Json>,"clock_kind": string | null,"created_at": string,"created_by": string | null,"device_id": string | null,"device_time": string | null,"id": string,"nonce": string,"payload": string,"person_id": string | null,"reason": string | null,"received_at": string,"record_id": string | null,"record_table": string | null,"result": string | null,"signature": string,"signed_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"args"?: NonNullable<Json>,"clock_kind"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"device_time"?: string | null,"id"?: string,"nonce": string,"payload": string,"person_id"?: string | null,"reason"?: string | null,"received_at"?: string,"record_id"?: string | null,"record_table"?: string | null,"result"?: string | null,"signature": string,"signed_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "action"?: string,"args"?: NonNullable<Json>,"clock_kind"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"device_time"?: string | null,"id"?: string,"nonce"?: string,"payload"?: string,"person_id"?: string | null,"reason"?: string | null,"received_at"?: string,"record_id"?: string | null,"record_table"?: string | null,"result"?: string | null,"signature"?: string,"signed_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offline_signature_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "device"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offline_signature_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"operator_setting": {
                  Row: {
                    "authority_ref": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"effective_from": string,"id": string,"key": string,"reason": string,"value": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "authority_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"effective_from"?: string,"id"?: string,"key": string,"reason": string,"value": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "authority_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"effective_from"?: string,"id"?: string,"key"?: string,"reason"?: string,"value"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"permission": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"department_code": string | null,"description": string | null,"device_time": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"description"?: string | null,"device_time"?: string | null,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"description"?: string | null,"device_time"?: string | null,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "permission_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    }
                  ]
                },"person": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"full_name": string,"id": string,"rank_or_title": string | null,"service_number": string | null,"three_letter_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"full_name": string,"id"?: string,"rank_or_title"?: string | null,"service_number"?: string | null,"three_letter_code": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"full_name"?: string,"id"?: string,"rank_or_title"?: string | null,"service_number"?: string | null,"three_letter_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"qualification": {
                  Row: {
                    "aircraft_type_code": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"expires_on": string | null,"id": string,"issued_on": string | null,"issuing_authority": string | null,"kind": string,"licence_category": string | null,"medical_class": string | null,"person_id": string,"reference": string | null,"superseded_at": string | null,"superseded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"issuing_authority"?: string | null,"kind": string,"licence_category"?: string | null,"medical_class"?: string | null,"person_id": string,"reference"?: string | null,"superseded_at"?: string | null,"superseded_by"?: string | null
                  }
                  Update: {
                    "aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"issuing_authority"?: string | null,"kind"?: string,"licence_category"?: string | null,"medical_class"?: string | null,"person_id"?: string,"reference"?: string | null,"superseded_at"?: string | null,"superseded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "qualification_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "qualification_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qualification_superseded_by_fkey"
      columns: ["superseded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"snag": {
                  Row: {
                    "aircraft_id": string,"assessment": string | null,"ata": string | null,"attended_at": string | null,"attended_by": string | null,"client_ref": string | null,"closed_at": string | null,"closed_by": string | null,"closure_note": string | null,"created_at": string,"created_by": string | null,"description": string,"device_time": string | null,"disposition": string | null,"dispositioned_at": string | null,"dispositioned_by": string | null,"id": string,"is_soft_observation": boolean,"number": string,"reported_by": string,"reporter_kind": string,"status": string,"tlb_book": string | null,"tlb_item": string | null,"tlb_page": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"assessment"?: string | null,"ata"?: string | null,"attended_at"?: string | null,"attended_by"?: string | null,"client_ref"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_note"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"device_time"?: string | null,"disposition"?: string | null,"dispositioned_at"?: string | null,"dispositioned_by"?: string | null,"id"?: string,"is_soft_observation"?: boolean,"number": string,"reported_by": string,"reporter_kind": string,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string,"assessment"?: string | null,"ata"?: string | null,"attended_at"?: string | null,"attended_by"?: string | null,"client_ref"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closure_note"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"device_time"?: string | null,"disposition"?: string | null,"dispositioned_at"?: string | null,"dispositioned_by"?: string | null,"id"?: string,"is_soft_observation"?: boolean,"number"?: string,"reported_by"?: string,"reporter_kind"?: string,"status"?: string,"tlb_book"?: string | null,"tlb_item"?: string | null,"tlb_page"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "snag_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snag_attended_by_fkey"
      columns: ["attended_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snag_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snag_dispositioned_by_fkey"
      columns: ["dispositioned_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "snag_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"store": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"device_time": string | null,"is_store_of_record": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"is_store_of_record"?: boolean,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"is_store_of_record"?: boolean,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tail_status_event": {
                  Row: {
                    "aircraft_id": string,"created_at": string,"created_by": string | null,"device_time": string | null,"expected_rts_on": string | null,"id": string,"reason": string,"set_at": string,"set_by": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expected_rts_on"?: string | null,"id"?: string,"reason": string,"set_at"?: string,"set_by": string,"status": string
                  }
                  Update: {
                    "aircraft_id"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expected_rts_on"?: string | null,"id"?: string,"reason"?: string,"set_at"?: string,"set_by"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tail_status_event_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tail_status_event_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"technical_query": {
                  Row: {
                    "assigned_department": string | null,"assigned_person": string | null,"body": string,"closed_at": string | null,"closed_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"due_on": string | null,"id": string,"number": string,"raised_by": string,"record_id": string,"record_table": string,"status": string,"subject": string,"urgent": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_department"?: string | null,"assigned_person"?: string | null,"body": string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"due_on"?: string | null,"id"?: string,"number": string,"raised_by": string,"record_id": string,"record_table": string,"status"?: string,"subject": string,"urgent"?: boolean
                  }
                  Update: {
                    "assigned_department"?: string | null,"assigned_person"?: string | null,"body"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"due_on"?: string | null,"id"?: string,"number"?: string,"raised_by"?: string,"record_id"?: string,"record_table"?: string,"status"?: string,"subject"?: string,"urgent"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "technical_query_assigned_department_fkey"
      columns: ["assigned_department"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "technical_query_assigned_person_fkey"
      columns: ["assigned_person"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "technical_query_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "technical_query_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"technical_query_note": {
                  Row: {
                    "author": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"note": string,"query_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"note": string,"query_id": string
                  }
                  Update: {
                    "author"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"note"?: string,"query_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "technical_query_note_author_fkey"
      columns: ["author"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "technical_query_note_query_id_fkey"
      columns: ["query_id"]
isOneToOne: false
      referencedRelation: "technical_query"
      referencedColumns: ["id"]
    }
                  ]
                },"user_account": {
                  Row: {
                    "activated_at": string | null,"activated_by": string | null,"created_at": string,"created_by": string | null,"deactivated_at": string | null,"deactivated_by": string | null,"deactivation_reason": string | null,"device_time": string | null,"id": string,"person_id": string,"requested_department": string | null,"status": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id": string,"person_id": string,"requested_department"?: string | null,"status"?: string,"username"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id"?: string,"person_id"?: string,"requested_department"?: string | null,"status"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_account_activated_by_fkey"
      columns: ["activated_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_account_deactivated_by_fkey"
      columns: ["deactivated_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_account_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preference": {
                  Row: {
                    "key": string,"updated_at": string,"user_id": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"user_id": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"user_id"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_preference_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "user_account"
      referencedColumns: ["id"]
    }
                  ]
                },"work_order": {
                  Row: {
                    "aircraft_id": string,"approval_request_id": string | null,"certification_note": string | null,"certified_at": string | null,"certified_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"est_man_hours": number | null,"id": string,"number": string,"requested_by": string,"scope": string,"snag_id": string | null,"status": string,"work_completed_at": string | null,"work_completed_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"approval_request_id"?: string | null,"certification_note"?: string | null,"certified_at"?: string | null,"certified_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"number": string,"requested_by": string,"scope": string,"snag_id"?: string | null,"status"?: string,"work_completed_at"?: string | null,"work_completed_by"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string,"approval_request_id"?: string | null,"certification_note"?: string | null,"certified_at"?: string | null,"certified_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"number"?: string,"requested_by"?: string,"scope"?: string,"snag_id"?: string | null,"status"?: string,"work_completed_at"?: string | null,"work_completed_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_order_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_request"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_certified_by_fkey"
      columns: ["certified_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snag"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_work_completed_by_fkey"
      columns: ["work_completed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"work_order_entry": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"entered_by": string,"entry": string,"id": string,"work_order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"entered_by": string,"entry": string,"id"?: string,"work_order_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"entered_by"?: string,"entry"?: string,"id"?: string,"work_order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_order_entry_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_entry_work_order_id_fkey"
      columns: ["work_order_id"]
isOneToOne: false
      referencedRelation: "work_order"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "aircraft_current_status": {
                  Row: {
                    "aircraft_id": string | null,"expected_rts_on": string | null,"reason": string | null,"set_at": string | null,"set_by": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tail_status_event_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tail_status_event_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"operator_setting_current": {
                  Row: {
                    "authority_ref": string | null,"created_by": string | null,"effective_from": string | null,"key": string | null,"reason": string | null,"value": Json | null,"version": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "app": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
