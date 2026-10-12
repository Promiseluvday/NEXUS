
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
            "accept_receipt":
{ Args: { "p_certificate_ref": string,"p_certificate_type": string,"p_condition_ok": boolean,"p_pin": string,"p_pn_sn_match": boolean,"p_receipt": string }; Returns: string
                           },
"accept_returned_part":
{ Args: { "p_condition": string,"p_line": string,"p_reason"?: string }; Returns: string
                           },
"access_summary":
{ Args: { "p_category": string,"p_person": string }; Returns: string
                           },
"acknowledge_notice":
{ Args: { "p_note"?: string,"p_notification": string }; Returns: number
                           },
"acknowledge_receipt":
{ Args: { "p_receipt": string }; Returns: string
                           },
"acknowledge_transfer":
{ Args: { "p_transfer": string }; Returns: string
                           },
"activate_mel_revision":
{ Args: { "p_revision": string }; Returns: undefined
                           },
"add_mel_items":
{ Args: { "p_items": Json,"p_revision": string }; Returns: number
                           },
"add_mro_part":
{ Args: { "p_description"?: string,"p_job": string,"p_part"?: string,"p_part_number_text"?: string,"p_qty": number,"p_unit_cost": number }; Returns: string
                           },
"add_mro_quote":
{ Args: { "p_amount": number,"p_entry": string,"p_job": string,"p_note"?: string }; Returns: string
                           },
"add_part":
{ Args: { "p_class": string,"p_description": string,"p_part_number": string,"p_serialised"?: boolean,"p_shelf_life_tracked"?: boolean,"p_unit"?: string }; Returns: string
                           },
"add_po_line":
{ Args: { "p_po": string,"p_req": string }; Returns: string
                           },
"add_supplier":
{ Args: { "p_approval_ref"?: string,"p_code": string,"p_contact"?: string,"p_country"?: string,"p_kind": string,"p_name": string,"p_pin": string,"p_scope_note"?: string }; Returns: string
                           },
"add_work_order_entry":
{ Args: { "p_entry": string,"p_wo": string }; Returns: string
                           },
"admin_check":
{ Args: { "p_person": string,"p_pin": string,"p_reason": string }; Returns: string
                           },
"admin_create_account":
{ Args: { "p_access": Json,"p_full_name": string,"p_pin": string,"p_rank_or_title": string,"p_reason": string,"p_temporary_password": string,"p_three_letter_code": string,"p_username": string }; Returns: string
                           },
"admin_options":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_people":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"departments": string,"full_name": string,"home_department": string,"must_change_password": boolean,"permissions": string,"person_id": string,"rank_or_title": string,"requested_department": string,"scope": string,"status": string,"three_letter_code": string,"username": string
            }[]
                           },
"admin_reset_password":
{ Args: { "p_person": string,"p_pin": string,"p_reason": string,"p_temporary_password": string }; Returns: undefined
                           },
"admin_set_access":
{ Args: { "p_category": string,"p_person": string,"p_pin": string,"p_reason": string,"p_values": Json }; Returns: undefined
                           },
"admin_set_status":
{ Args: { "p_person": string,"p_pin": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"adsb_aircraft_totals":
{ Args: { "p_aircraft": string }; Returns: Record<string, unknown>
                           },
"adsb_check_document":
{ Args: { "p": Json }; Returns: undefined
                           },
"adsb_check_unique_reference":
{ Args: { "p": Json,"p_except_key": string }; Returns: undefined
                           },
"adsb_decide":
{ Args: { "p_decision": string,"p_entry": string,"p_note": string,"p_pin": string }; Returns: string
                           },
"adsb_due_flags":
{ Args: { "p_aircraft": string,"p_next_cycles": number,"p_next_hours": number,"p_next_on": string,"p_status": string }; Returns: Record<string, unknown>
                           },
"adsb_figure_flag":
{ Args: { "p_current": number,"p_due": number,"p_margin": number }; Returns: string
                           },
"adsb_require_engineer":
{ Args: { "p_aircraft"?: string }; Returns: string
                           },
"adsb_text":
{ Args: { "p": Json,"p_key": string }; Returns: string
                           },
"adsb_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"adsb_write_entry":
{ Args: { "p_aircraft": string,"p_device_time": string,"p_document_key": string,"p_entry_key": string,"p_fields": Json,"p_reason": string,"p_supersedes": string,"p_version": number }; Returns: string
                           },
"agree_mro_cost":
{ Args: { "p_amount": number,"p_job": string,"p_note"?: string,"p_pin": string }; Returns: undefined
                           },
"aircraft_totals":
{ Args: { "p_aircraft": string }; Returns: {
              "aircraft_id": string,"apu_cycles": number,"apu_hours": number,"baseline_as_at": string,"cycles": number,"flights": number,"has_baseline": boolean,"hours": number,"hours_basis": string,"landings": number,"last_entered_at": string,"last_entered_by": string,"last_entered_name": string,"last_flight_date": string,"tail": string
            }[]
                           },
"allocate_line":
{ Args: { "p_line": string }; Returns: number
                           },
"apply_access":
{ Args: { "p_category": string,"p_person": string,"p_reason": string,"p_values": Json }; Returns: undefined
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
"authorization_request":
{ Args: { "p_authorization": string }; Returns: string
                           },
"authorization_state":
{ Args: { "a": Omit<Database["public"]['Tables']["certifying_authorization"]['Row'], Database["public"]['Tables']["certifying_authorization"]['ComputedFields']> }; Returns: string
                           },
"authorizations_waiting":
{ Args: Record<PropertyKey, never>; Returns: {
              "aircraft_type_code": string,"expires_on": string,"full_name": string,"id": string,"issued_at": string,"issued_by": string,"person_id": string,"reference": string,"three_letter_code": string,"valid_from": string
            }[]
                           },
"can_approve_authorizations":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_load_mel":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_manage_numbering":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_see_aircraft":
{ Args: { "p_aircraft": string }; Returns: boolean
                           },
"can_see_notice":
{ Args: { "p_notification": string }; Returns: boolean
                           },
"can_see_outside_mro":
{ Args: { "p_aircraft": string }; Returns: boolean
                           },
"can_see_part_request":
{ Args: { "p_aircraft": string,"p_requested_by": string,"p_store": string }; Returns: boolean
                           },
"can_see_purchase_orders":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_see_record":
{ Args: { "p_id": string,"p_table": string }; Returns: boolean
                           },
"can_see_record_before_procurement":
{ Args: { "p_id": string,"p_table": string }; Returns: boolean
                           },
"can_see_record_before_stores":
{ Args: { "p_id": string,"p_table": string }; Returns: boolean
                           },
"can_see_requisition":
{ Args: { "p_action": string,"p_line": string,"p_raised_by": string,"p_store": string }; Returns: boolean
                           },
"can_see_store":
{ Args: { "p_store": string }; Returns: boolean
                           },
"can_view_cost":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_view_people":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_part_request":
{ Args: { "p_reason": string,"p_request": string }; Returns: undefined
                           },
"cancel_purchase_order":
{ Args: { "p_pin": string,"p_po": string,"p_reason": string }; Returns: undefined
                           },
"cancel_requisition":
{ Args: { "p_reason": string,"p_req": string }; Returns: undefined
                           },
"certify_work_order":
{ Args: { "p_no_fault_found"?: boolean,"p_note": string,"p_pin": string,"p_tlb_book"?: string,"p_tlb_page"?: string,"p_wo": string }; Returns: undefined
                           },
"check_after_baseline":
{ Args: { "p_aircraft": string,"p_date": string }; Returns: undefined
                           },
"check_engineer_for_flights":
{ Args: { "p_aircraft": string,"p_pin": string,"p_reason": string }; Returns: undefined
                           },
"check_flight_figures":
{ Args: { "p_apu_cycles": number,"p_apu_hours": number,"p_cycles": number,"p_date": string,"p_hours": number,"p_kind": string,"p_landings": number,"p_void"?: boolean }; Returns: undefined
                           },
"check_may_log_flight":
{ Args: { "p_aircraft": string }; Returns: undefined
                           },
"check_my_pin":
{ Args: { "p_pin": string }; Returns: boolean
                           },
"check_new_password":
{ Args: { "p_password": string }; Returns: undefined
                           },
"check_number_format":
{ Args: { "p_format": string,"p_series": string }; Returns: Record<string, unknown>
                           },
"clear_ddls_entry":
{ Args: { "p_entry": string,"p_pin": string,"p_rect_tlb_book"?: string,"p_rect_tlb_page"?: string,"p_rectification": string }; Returns: undefined
                           },
"close_request_if_done":
{ Args: { "p_request": string }; Returns: undefined
                           },
"close_snag_no_fault_found":
{ Args: { "p_findings": string,"p_pin": string,"p_snag": string,"p_tlb_book"?: string,"p_tlb_page"?: string }; Returns: undefined
                           },
"complete_work_order":
{ Args: { "p_note": string,"p_wo": string }; Returns: undefined
                           },
"confirm_aog_priority":
{ Args: { "p_pin": string,"p_request": string }; Returns: undefined
                           },
"confirm_nadd":
{ Args: { "p_declaration": boolean,"p_limit_days"?: number,"p_nadd": string,"p_pin": string }; Returns: undefined
                           },
"confirm_nadd_fields":
{ Args: { "p_limit_days": number,"p_nadd": string }; Returns: undefined
                           },
"correct_adsb_compliance":
{ Args: { "p_device_time"?: string,"p_entry": string,"p_fields": Json,"p_pin": string,"p_reason": string }; Returns: string
                           },
"correct_adsb_document":
{ Args: { "p_device_time"?: string,"p_document_key": string,"p_fields": Json,"p_reason": string }; Returns: string
                           },
"correct_flight_record":
{ Args: { "p_apu_cycles"?: number,"p_apu_hours"?: number,"p_cycles": number,"p_device_time"?: string,"p_flight_date": string,"p_from"?: string,"p_hours": number,"p_landings": number,"p_log_ref"?: string,"p_pin": string,"p_reason": string,"p_record": string,"p_to"?: string,"p_void"?: boolean }; Returns: string
                           },
"cost_check":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"create_purchase_order":
{ Args: { "p_eta"?: string,"p_note"?: string,"p_requisitions": (string)[],"p_supplier": string,"p_supplier_ref"?: string }; Returns: Json
                           },
"currency_code":
{ Args: Record<PropertyKey, never>; Returns: string
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
"decide_certifying_authorization":
{ Args: { "p_authorization": string,"p_decision": string,"p_pin": string,"p_reason"?: string }; Returns: string
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
"enter_adsb_compliance":
{ Args: { "p_aircraft": string,"p_device_time"?: string,"p_document_key": string,"p_fields": Json,"p_pin": string }; Returns: string
                           },
"expiry_flag":
{ Args: { "p_expires": string }; Returns: string
                           },
"fleet_board":
{ Args: Record<PropertyKey, never>; Returns: {
              "aircraft_id": string,"aircraft_type": string,"blocked_by": string,"blocked_holder": string,"blocked_ref": string,"blocked_since": string,"expected_rts_on": string,"in_work_ref": string,"next_ddls_due": string,"next_nadd_due": string,"open_ddls": number,"open_nadds": number,"open_snags": number,"snag_display": string,"status": string,"status_set_at": string,"status_set_by": string,"tail": string
            }[]
                           },
"fleet_totals":
{ Args: Record<PropertyKey, never>; Returns: {
              "aircraft_id": string,"apu_cycles": number,"apu_hours": number,"baseline_as_at": string,"cycles": number,"flights": number,"has_baseline": boolean,"hours": number,"hours_basis": string,"landings": number,"last_entered_at": string,"last_entered_by": string,"last_entered_name": string,"last_flight_date": string,"tail": string
            }[]
                           },
"flight_hours_basis":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"flight_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"format_number":
{ Args: { "p_at": string,"p_format": string,"p_n": number,"p_tail": string }; Returns: string
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
"holds_store":
{ Args: { "p_store": string }; Returns: boolean
                           },
"holds_target":
{ Args: { "p_appointment": string,"p_department": string }; Returns: boolean
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
"issue_certifying_authorization":
{ Args: { "p_aircraft_type": string,"p_expires_on": string,"p_person": string,"p_pin": string,"p_reference": string,"p_valid_from": string }; Returns: string
                           },
"issue_offline_key":
{ Args: { "p_device": string,"p_pin": string }; Returns: string
                           },
"issue_part":
{ Args: { "p_line": string,"p_pin": string }; Returns: string
                           },
"log_flight":
{ Args: { "p_aircraft": string,"p_apu_cycles"?: number,"p_apu_hours"?: number,"p_client_ref"?: string,"p_cycles": number,"p_device_time"?: string,"p_flight_date": string,"p_from"?: string,"p_hours": number,"p_landings": number,"p_log_ref"?: string,"p_to"?: string }; Returns: string
                           },
"lot_problem":
{ Args: { "p_lot": Omit<Database["public"]['Tables']["stock_lot"]['Row'], Database["public"]['Tables']["stock_lot"]['ComputedFields']> }; Returns: string
                           },
"medical_required":
{ Args: { "p_person": string }; Returns: boolean
                           },
"mro_job_for_procurement":
{ Args: { "p_job": string }; Returns: Database["public"]['Tables']["outside_mro_job"]['Row']
                          SetofOptions: {
        from: "*"
        to: "outside_mro_job"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_active_appointments":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Tables']["appointment"]['Row'][]
                          SetofOptions: {
        from: "*"
        to: "appointment"
        isOneToOne: false
        isSetofReturn: true
      } },
"my_admin_departments":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_must_change_password":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_notices":
{ Args: { "p_done_limit"?: number }; Returns: {
              "aircraft_id": string,"body": string,"created_at": string,"id": string,"kind": string,"record_id": string,"record_table": string,"steps": Json,"tail": string,"title": string,"waiting_for_me": boolean
            }[]
                           },
"my_pending_approvals":
{ Args: Record<PropertyKey, never>; Returns: {
              "action_type": string,"chain_name": string,"id": string,"raised_at": string,"raised_by": string,"record_id": string,"record_table": string,"step_name": string,"step_no": number,"summary": string,"waiting_since": string
            }[]
                           },
"my_pin_is_set":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_procurement_rights":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_unacknowledged_count":
{ Args: Record<PropertyKey, never>; Returns: number
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
                           } |
{ Args: { "p_default_format": string,"p_series": string,"p_tail": string }; Returns: string
                           },
"notice_steps":
{ Args: { "p_notification": string }; Returns: Json
                           },
"number_counter":
{ Args: { "p_at": string,"p_format": string,"p_series": string }; Returns: string
                           },
"numbered_documents":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"col": string,"default_format": string,"label": string,"series": string,"tbl": string
            }[]
                           },
"numbering_settings":
{ Args: Record<PropertyKey, never>; Returns: {
              "changed_at": string,"changed_by": string,"code": string,"format": string,"label": string,"next_number": string,"reason": string,"series": string,"version": number
            }[]
                           },
"offline_signed_at":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"open_mel_revision":
{ Args: { "p_aircraft_type": string,"p_approval_date": string,"p_approval_reference": string,"p_revision": string }; Returns: string
                           },
"open_outside_mro_job":
{ Args: { "p_aircraft"?: string,"p_expected_back"?: string,"p_part"?: string,"p_scope"?: string,"p_sent_on"?: string,"p_serial"?: string,"p_supplier": string,"p_title": string,"p_us_return"?: string,"p_work_order"?: string }; Returns: Json
                           },
"open_receipt":
{ Args: { "p_batch"?: string,"p_bin"?: string,"p_delivered_against"?: string,"p_expiry"?: string,"p_for_request_line"?: string,"p_part": string,"p_purchase_order"?: string,"p_qty": number,"p_serial"?: string,"p_store": string }; Returns: string
                           },
"operator_local_time":
{ Args: { "p_at": string }; Returns: string
                           },
"operator_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"outside_mro_job_detail":
{ Args: { "p_id": string }; Returns: Json
                           },
"outside_mro_jobs":
{ Args: { "p_open_only"?: boolean }; Returns: {
              "accepted": boolean,"agreed_cost": number,"aircraft_id": string,"created_at": string,"currency": string,"expected_back": string,"id": string,"number": string,"overdue": boolean,"part_number": string,"raised_by_code": string,"returned_on": string,"sent_on": string,"serial_no": string,"status": string,"status_since": string,"supplier_name": string,"tail": string,"title": string,"us_return_number": string,"work_order_id": string,"work_order_number": string
            }[]
                           },
"part_request_lines":
{ Args: { "p_aircraft"?: string,"p_open_only"?: boolean,"p_request"?: string,"p_work_order"?: string }; Returns: {
              "aircraft_id": string,"aog_confirmed": boolean,"batch_no": string,"bin": string,"description": string,"fit_position": string,"held_since": string,"holder": string,"ipc_ref": string,"issue_voucher": string,"line_id": string,"line_no": number,"lot_id": string,"lot_problem": string,"part_id": string,"part_number": string,"priority": string,"purpose": string,"qty": number,"remarks": string,"removed_part": string,"request_id": string,"request_number": string,"request_status": string,"request_type": string,"requested_at": string,"requested_by_code": string,"required_by": string,"requisition_id": string,"serial_no": string,"split_from": string,"state": string,"state_reason": string,"store_code": string,"store_name": string,"tail": string,"unit": string,"work_order_id": string,"work_order_number": string,"work_order_status": string
            }[]
                           },
"people_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "account_status": string,"appointments": string,"certifying_types": string,"departments": string,"expiry_flag": string,"full_name": string,"home_department": string,"pending_authorizations": number,"person_id": string,"rank_or_title": string,"three_letter_code": string
            }[]
                           },
"person_admin_department":
{ Args: { "p_person": string }; Returns: string
                           },
"person_appointments":
{ Args: { "p_person": string }; Returns: string
                           },
"person_expiry_flag":
{ Args: { "p_person": string }; Returns: string
                           },
"person_has_department":
{ Args: { "p_department": string,"p_person": string }; Returns: boolean
                           },
"person_has_permission":
{ Args: { "p_permission": string,"p_person": string }; Returns: boolean
                           },
"person_is_commander":
{ Args: { "p_person": string }; Returns: boolean
                           },
"person_record":
{ Args: { "p_person": string }; Returns: Json
                           },
"pin_ok":
{ Args: { "p_pin": string }; Returns: boolean
                           },
"place_purchase_order":
{ Args: { "p_pin": string,"p_po": string }; Returns: undefined
                           },
"po_add_requisition":
{ Args: { "p_po": string,"p_req": string }; Returns: string
                           },
"po_event":
{ Args: { "p_eta"?: string,"p_event": string,"p_note"?: string,"p_po": string }; Returns: undefined
                           },
"po_for_buyer":
{ Args: { "p_allowed": (string)[],"p_po": string }; Returns: Database["public"]['Tables']["purchase_order"]['Row']
                          SetofOptions: {
        from: "*"
        to: "purchase_order"
        isOneToOne: true
        isSetofReturn: false
      } },
"po_state_words":
{ Args: { "p_status": string }; Returns: string
                           },
"po_touch_lines":
{ Args: { "p_po": string }; Returns: undefined
                           },
"preview_number":
{ Args: { "p_format"?: string,"p_series": string }; Returns: string
                           },
"price_history":
{ Args: { "p_part": string }; Returns: {
              "at": string,"currency": string,"qty": number,"reason": string,"reference": string,"source": string,"supplier": string,"unit_price": number
            }[]
                           },
"priority_use_report":
{ Args: { "p_since"?: string }; Returns: {
              "aog_confirmed": number,"aog_requested": number,"aog_unconfirmed": number,"full_name": string,"person_id": string,"routine": number,"three_letter_code": string,"urgent": number
            }[]
                           },
"procurement_check":
{ Args: { "p_permission": string }; Returns: string
                           },
"propose_nadd":
{ Args: { "p_aircraft": string,"p_ata"?: string,"p_client_ref"?: string,"p_description": string,"p_device_time"?: string,"p_location"?: string,"p_tlb_book"?: string,"p_tlb_item"?: string,"p_tlb_page"?: string,"p_zone"?: string }; Returns: string
                           },
"purchase_order_detail":
{ Args: { "p_id": string }; Returns: Json
                           },
"purchase_order_list":
{ Args: { "p_open_only"?: boolean }; Returns: {
              "clearing_ref": string,"created_at": string,"currency": string,"eta": string,"first_line": string,"has_aog": boolean,"id": string,"lines": number,"number": string,"ordered_at": string,"overdue": boolean,"raised_by_code": string,"shipment_ref": string,"status": string,"status_since": string,"supplier_id": string,"supplier_name": string,"supplier_ref": string,"tails": string,"total": number
            }[]
                           },
"quality_check":
{ Args: { "p_person": string,"p_pin": string }; Returns: string
                           },
"quarantine_lot":
{ Args: { "p_lot": string,"p_reason": string }; Returns: undefined
                           },
"quarantine_receipt":
{ Args: { "p_reason": string,"p_receipt": string }; Returns: string
                           },
"raise_approval":
{ Args: { "p_action": string,"p_record_id": string,"p_record_table": string,"p_summary": string }; Returns: string
                           },
"raise_rectified_notice":
{ Args: { "p_aircraft": string,"p_body": string,"p_record": string,"p_snag": string,"p_table": string,"p_title": string }; Returns: string
                           },
"raise_requisition":
{ Args: { "p_device_time"?: string,"p_estimated_value"?: number,"p_kind": string,"p_part"?: string,"p_part_number_text"?: string,"p_priority"?: string,"p_purpose"?: string,"p_qty"?: number,"p_remarks"?: string,"p_request_line"?: string,"p_required_by"?: string,"p_store"?: string,"p_us_return"?: string }; Returns: Json
                           },
"raise_transfer":
{ Args: { "p_from": string,"p_lot"?: string,"p_note"?: string,"p_part": string,"p_qty": number,"p_return_of"?: string,"p_to": string }; Returns: string
                           },
"receipt_missing_documents":
{ Args: { "p_receipt": string }; Returns: (string)[]
                           },
"receive_po_delivery":
{ Args: { "p_batch"?: string,"p_bin"?: string,"p_expiry"?: string,"p_line": string,"p_part"?: string,"p_qty"?: number,"p_serial"?: string }; Returns: string
                           },
"receive_transfer":
{ Args: { "p_transfer": string }; Returns: string
                           },
"receive_us_return":
{ Args: { "p_note"?: string,"p_part"?: string,"p_return": string,"p_tag_ref": string }; Returns: string
                           },
"reclassify_nadd_as_snag":
{ Args: { "p_nadd": string,"p_note": string }; Returns: string
                           },
"record_invoice":
{ Args: { "p_amount": number,"p_invoice_date": string,"p_invoice_no": string,"p_note"?: string,"p_outside_mro_job"?: string,"p_purchase_order"?: string }; Returns: string
                           },
"record_mro_technical_acceptance":
{ Args: { "p_job": string,"p_note": string,"p_pin": string }; Returns: undefined
                           },
"record_notice":
{ Args: { "p_record": string,"p_table": string }; Returns: Json
                           },
"record_part_fitted":
{ Args: { "p_line": string,"p_note"?: string,"p_removed_serial"?: string }; Returns: string
                           },
"record_qualification":
{ Args: { "p_aircraft_type"?: string,"p_expires_on"?: string,"p_issued_on"?: string,"p_issuing_authority"?: string,"p_kind": string,"p_licence_category"?: string,"p_medical_class"?: string,"p_person": string,"p_pin": string,"p_reason"?: string,"p_reference"?: string,"p_replaces"?: string }; Returns: string
                           },
"record_svc_mel":
{ Args: { "p_reason": string,"p_snag": string }; Returns: undefined
                           },
"record_us_removal":
{ Args: { "p_aircraft": string,"p_part": string,"p_part_number_text": string,"p_reason": string,"p_request_line"?: string,"p_serial": string,"p_store": string,"p_work_order"?: string }; Returns: string
                           },
"rectify_nadd":
{ Args: { "p_action_taken": string,"p_nadd": string,"p_pin": string,"p_rect_tlb_book"?: string,"p_rect_tlb_page"?: string }; Returns: undefined
                           },
"refuse_emergency_zone":
{ Args: { "p_aircraft": string,"p_zone": string }; Returns: undefined
                           },
"register_adsb_document":
{ Args: { "p_device_time"?: string,"p_fields": Json }; Returns: string
                           },
"reject_adsb_compliance":
{ Args: { "p_entry": string,"p_pin": string,"p_reason": string }; Returns: string
                           },
"reject_nadd":
{ Args: { "p_nadd": string,"p_reason": string }; Returns: undefined
                           },
"release_from_quarantine":
{ Args: { "p_certificate_ref": string,"p_certificate_type": string,"p_lot": string,"p_pin": string,"p_reason": string }; Returns: undefined
                           },
"release_reservation":
{ Args: { "p_line": string,"p_reason": string }; Returns: undefined
                           },
"remove_po_line":
{ Args: { "p_line": string,"p_reason": string }; Returns: undefined
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
"request_part":
{ Args: { "p_aircraft"?: string,"p_client_ref"?: string,"p_device_time"?: string,"p_ipc_ref"?: string,"p_part"?: string,"p_part_number_text"?: string,"p_position"?: string,"p_priority"?: string,"p_purpose"?: string,"p_qty": number,"p_remarks"?: string,"p_removed_part"?: string,"p_request_type": string,"p_required_by"?: string,"p_store": string,"p_work_order"?: string }; Returns: Json
                           },
"request_work_order":
{ Args: { "p_est_man_hours"?: number,"p_scope": string,"p_snag": string }; Returns: string
                           },
"require_certifying":
{ Args: { "p_aircraft": string,"p_pin": string }; Returns: undefined
                           },
"require_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"requisition_chain_for":
{ Args: { "p_priority": string,"p_value": number }; Returns: string
                           },
"requisition_detail":
{ Args: { "p_id": string }; Returns: Json
                           },
"requisition_for_supply":
{ Args: { "p_req": string }; Returns: Database["public"]['Tables']["requisition"]['Row']
                          SetofOptions: {
        from: "*"
        to: "requisition"
        isOneToOne: true
        isSetofReturn: false
      } },
"requisition_line_note":
{ Args: { "p_note": string,"p_req": string }; Returns: undefined
                           },
"requisition_list":
{ Args: { "p_id"?: string,"p_open_only"?: boolean }; Returns: {
              "action_type": string,"aircraft_id": string,"approval_request_id": string,"can_approve": boolean,"cancel_reason": string,"chain_name": string,"currency": string,"description": string,"estimated_value": number,"held_since": string,"holder": string,"id": string,"kind": string,"number": string,"part_id": string,"part_number": string,"po_eta": string,"po_id": string,"po_number": string,"po_status": string,"priority": string,"purpose": string,"qty": number,"raised_at": string,"raised_by": string,"raised_by_code": string,"rejected_reason": string,"remarks": string,"request_cancelled": boolean,"request_id": string,"request_line_id": string,"request_line_state": string,"request_number": string,"required_by": string,"stage": string,"status": string,"step_count": number,"step_name": string,"step_no": number,"store_code": string,"superseded_by": string,"supplier_name": string,"tail": string,"unit": string,"us_return_id": string,"us_return_number": string,"version": number
            }[]
                           },
"requisition_summary":
{ Args: { "p_req": string,"p_tail": string }; Returns: string
                           },
"reserve_line":
{ Args: { "p_line": string }; Returns: string
                           },
"resubmit_requisition":
{ Args: { "p_estimated_value"?: number,"p_priority"?: string,"p_qty"?: number,"p_remarks"?: string,"p_req": string,"p_required_by"?: string }; Returns: Json
                           },
"return_unused_part":
{ Args: { "p_line": string,"p_reason": string }; Returns: undefined
                           },
"revise_work_order":
{ Args: { "p_est_man_hours": number,"p_pin": string,"p_reason": string,"p_scope": string,"p_wo": string }; Returns: Json
                           },
"revoke_certifying_authorization":
{ Args: { "p_authorization": string,"p_pin": string,"p_reason": string }; Returns: string
                           },
"revoke_device":
{ Args: { "p_device": string,"p_lost"?: boolean,"p_reason": string }; Returns: undefined
                           },
"search_mel":
{ Args: { "p_aircraft": string,"p_limit"?: number,"p_query": string }; Returns: {
              "category": string,"id": string,"interval_unit": string,"interval_value": number,"item_number": string,"m_procedure": boolean,"o_procedure": boolean,"remarks": string,"revision": string,"revision_id": string,"title": string
            }[]
                           },
"search_stores":
{ Args: { "p_limit"?: number,"p_text"?: string }; Returns: {
              "available": number,"certificate": string,"description": string,"expired_qty": number,"next_expiry": string,"on_hand": number,"part_class": string,"part_id": string,"part_number": string,"quarantine_qty": number,"reserved": number,"serialised": boolean,"shelf_life_tracked": boolean,"stores": Json,"uncertified_qty": number,"unit": string
            }[]
                           },
"sentence":
{ Args: { "p_text": string }; Returns: string
                           },
"set_flight_baseline":
{ Args: { "p_aircraft": string,"p_apu_cycles"?: number,"p_apu_hours"?: number,"p_as_at": string,"p_cycles": number,"p_device_time"?: string,"p_hours": number,"p_landings": number,"p_log_ref"?: string,"p_pin": string,"p_reason": string }; Returns: string
                           },
"set_line_state":
{ Args: { "p_line": string,"p_reason"?: string,"p_state": string }; Returns: undefined
                           },
"set_my_password":
{ Args: { "p_new_password": string }; Returns: undefined
                           },
"set_my_pin":
{ Args: { "p_pin": string }; Returns: undefined
                           },
"set_numbering_setting":
{ Args: { "p_key": string,"p_pin": string,"p_reason": string,"p_value": string }; Returns: string
                           },
"set_outside_mro_status":
{ Args: { "p_date"?: string,"p_job": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"set_po_line_price":
{ Args: { "p_line": string,"p_reason"?: string,"p_unit_price": number }; Returns: undefined
                           },
"set_procurement_setting":
{ Args: { "p_key": string,"p_pin": string,"p_reason": string,"p_value": Json }; Returns: undefined
                           },
"set_stores_setting":
{ Args: { "p_key": string,"p_pin": string,"p_reason": string,"p_value": Json }; Returns: undefined
                           },
"set_supplier_status":
{ Args: { "p_pin": string,"p_reason": string,"p_status": string,"p_supplier": string }; Returns: undefined
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
"stock_alerts":
{ Args: Record<PropertyKey, never>; Returns: {
              "alert": string,"condition": string,"description": string,"expires_on": string,"level": string,"lot_id": string,"part_id": string,"part_number": string,"qty": number,"store_code": string
            }[]
                           },
"stock_move":
{ Args: { "p_kind": string,"p_line"?: string,"p_lot": string,"p_on_hand": number,"p_qty": number,"p_reason"?: string,"p_receipt"?: string,"p_reserved": number,"p_transfer"?: string,"p_us_return"?: string,"p_voucher"?: string }; Returns: string
                           },
"stock_receipt_into_lot":
{ Args: { "p_receipt": string }; Returns: string
                           },
"store_of_record":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"submit_offline_signature":
{ Args: { "p_payload": string,"p_signature": string }; Returns: Json
                           },
"supply_check":
{ Args: { "p_permissions": (string)[],"p_store": string }; Returns: string
                           },
"today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"transfer_into_lot":
{ Args: { "p_transfer": string }; Returns: string
                           },
"unreserve_line":
{ Args: { "p_line": string,"p_new_state": string,"p_reason": string }; Returns: undefined
                           },
"update_purchase_order":
{ Args: { "p_clearing_ref"?: string,"p_eta"?: string,"p_note"?: string,"p_po": string,"p_shipment_ref"?: string,"p_status"?: string }; Returns: undefined
                           },
"verify_adsb_compliance":
{ Args: { "p_entry": string,"p_note"?: string,"p_pin": string }; Returns: string
                           },
"withdraw_qualification":
{ Args: { "p_pin": string,"p_qualification": string,"p_reason": string }; Returns: undefined
                           },
"work_order_for_engineer":
{ Args: { "p_allowed_status": (string)[],"p_wo": string }; Returns: Database["public"]['Tables']["work_order"]['Row']
                          SetofOptions: {
        from: "*"
        to: "work_order"
        isOneToOne: true
        isSetofReturn: false
      } },
"work_order_label":
{ Args: { "p_number": string,"p_revision": number }; Returns: string
                           },
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
                },"account_event": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"done_at": string,"done_by": string,"from_value": string | null,"id": string,"person_id": string,"reason": string,"to_value": string | null,"what": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_at"?: string,"done_by": string,"from_value"?: string | null,"id"?: string,"person_id": string,"reason": string,"to_value"?: string | null,"what": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_at"?: string,"done_by"?: string,"from_value"?: string | null,"id"?: string,"person_id"?: string,"reason"?: string,"to_value"?: string | null,"what"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_event_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_event_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"adsb_compliance": {
                  Row: {
                    "aircraft_id": string,"applicability": string,"compliance_method": string | null,"compliance_reference": string | null,"correction_reason": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"document_id": string,"document_key": string,"entered_at": string,"entered_by": string,"entry_key": string,"id": string,"last_complied_cycles": number | null,"last_complied_hours": number | null,"last_complied_on": string | null,"next_due_cycles": number | null,"next_due_hours": number | null,"next_due_on": string | null,"next_due_text": string | null,"not_applicable_reason": string | null,"remarks": string | null,"status": string,"supersedes_id": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"applicability": string,"compliance_method"?: string | null,"compliance_reference"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"document_id": string,"document_key": string,"entered_at"?: string,"entered_by": string,"entry_key"?: string,"id"?: string,"last_complied_cycles"?: number | null,"last_complied_hours"?: number | null,"last_complied_on"?: string | null,"next_due_cycles"?: number | null,"next_due_hours"?: number | null,"next_due_on"?: string | null,"next_due_text"?: string | null,"not_applicable_reason"?: string | null,"remarks"?: string | null,"status": string,"supersedes_id"?: string | null,"version"?: number
                  }
                  Update: {
                    "aircraft_id"?: string,"applicability"?: string,"compliance_method"?: string | null,"compliance_reference"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"document_id"?: string,"document_key"?: string,"entered_at"?: string,"entered_by"?: string,"entry_key"?: string,"id"?: string,"last_complied_cycles"?: number | null,"last_complied_hours"?: number | null,"last_complied_on"?: string | null,"next_due_cycles"?: number | null,"next_due_hours"?: number | null,"next_due_on"?: string | null,"next_due_text"?: string | null,"not_applicable_reason"?: string | null,"remarks"?: string | null,"status"?: string,"supersedes_id"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "adsb_compliance_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "adsb_document"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "adsb_document_current"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: true
      referencedRelation: "adsb_compliance"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: true
      referencedRelation: "adsb_compliance_current"
      referencedColumns: ["id"]
    }
                  ]
                },"adsb_document": {
                  Row: {
                    "aircraft_type_code": string,"applies_to_note": string | null,"correction_reason": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"doc_type": string,"document_key": string,"effective_on": string | null,"entered_by": string,"id": string,"issuing_authority": string,"reference": string,"revision": string | null,"supersedes_id": string | null,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code": string,"applies_to_note"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"doc_type": string,"document_key"?: string,"effective_on"?: string | null,"entered_by": string,"id"?: string,"issuing_authority": string,"reference": string,"revision"?: string | null,"supersedes_id"?: string | null,"title": string,"version"?: number
                  }
                  Update: {
                    "aircraft_type_code"?: string,"applies_to_note"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"doc_type"?: string,"document_key"?: string,"effective_on"?: string | null,"entered_by"?: string,"id"?: string,"issuing_authority"?: string,"reference"?: string,"revision"?: string | null,"supersedes_id"?: string | null,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "adsb_document_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "adsb_document_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_document_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: true
      referencedRelation: "adsb_document"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_document_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: true
      referencedRelation: "adsb_document_current"
      referencedColumns: ["id"]
    }
                  ]
                },"adsb_verification": {
                  Row: {
                    "compliance_id": string,"created_at": string,"created_by": string | null,"decided_at": string,"decided_by": string,"decision": string,"device_time": string | null,"id": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "compliance_id": string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string,"decided_by": string,"decision": string,"device_time"?: string | null,"id"?: string,"note"?: string | null
                  }
                  Update: {
                    "compliance_id"?: string,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string,"decided_by"?: string,"decision"?: string,"device_time"?: string | null,"id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "adsb_verification_compliance_id_fkey"
      columns: ["compliance_id"]
isOneToOne: true
      referencedRelation: "adsb_compliance"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_verification_compliance_id_fkey"
      columns: ["compliance_id"]
isOneToOne: true
      referencedRelation: "adsb_compliance_current"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_verification_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
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
                },"flight_record": {
                  Row: {
                    "aircraft_id": string,"apu_cycles": number | null,"apu_hours": number | null,"client_ref": string | null,"created_at": string,"created_by": string | null,"cycles": number,"device_time": string | null,"entered_at": string,"entered_by": string,"flight_date": string,"from_place": string | null,"hours": number,"hours_basis": string,"id": string,"is_void": boolean,"kind": string,"landings": number,"log_ref": string | null,"reason": string | null,"record_id": string,"supersedes": string | null,"to_place": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"apu_cycles"?: number | null,"apu_hours"?: number | null,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"cycles": number,"device_time"?: string | null,"entered_at"?: string,"entered_by": string,"flight_date": string,"from_place"?: string | null,"hours": number,"hours_basis": string,"id"?: string,"is_void"?: boolean,"kind": string,"landings": number,"log_ref"?: string | null,"reason"?: string | null,"record_id": string,"supersedes"?: string | null,"to_place"?: string | null,"version"?: number
                  }
                  Update: {
                    "aircraft_id"?: string,"apu_cycles"?: number | null,"apu_hours"?: number | null,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"cycles"?: number,"device_time"?: string | null,"entered_at"?: string,"entered_by"?: string,"flight_date"?: string,"from_place"?: string | null,"hours"?: number,"hours_basis"?: string,"id"?: string,"is_void"?: boolean,"kind"?: string,"landings"?: number,"log_ref"?: string | null,"reason"?: string | null,"record_id"?: string,"supersedes"?: string | null,"to_place"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "flight_record_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "flight_record"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "flight_record_current"
      referencedColumns: ["id"]
    }
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
                },"notification": {
                  Row: {
                    "aircraft_id": string,"body": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"kind": string,"record_id": string,"record_table": string,"snag_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"body": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind": string,"record_id": string,"record_table": string,"snag_id"?: string | null,"title": string
                  }
                  Update: {
                    "aircraft_id"?: string,"body"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind"?: string,"record_id"?: string,"record_table"?: string,"snag_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_snag_id_fkey"
      columns: ["snag_id"]
isOneToOne: false
      referencedRelation: "snag"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_ack": {
                  Row: {
                    "acknowledged_by": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"note": string | null,"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_by": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"note"?: string | null,"target_id": string
                  }
                  Update: {
                    "acknowledged_by"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"note"?: string | null,"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_ack_acknowledged_by_fkey"
      columns: ["acknowledged_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_ack_target_id_fkey"
      columns: ["target_id"]
isOneToOne: true
      referencedRelation: "notification_target"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_target": {
                  Row: {
                    "appointment_id": string | null,"created_at": string,"created_by": string | null,"department_code": string | null,"device_time": string | null,"id": string,"name": string,"notification_id": string,"step_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"name": string,"notification_id": string,"step_no": number
                  }
                  Update: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"department_code"?: string | null,"device_time"?: string | null,"id"?: string,"name"?: string,"notification_id"?: string,"step_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_target_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_target_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "department"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "notification_target_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notification"
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
                },"outside_mro_job": {
                  Row: {
                    "acceptance_note": string | null,"accepted_at": string | null,"accepted_by": string | null,"aircraft_id": string | null,"cancel_reason": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"expected_back": string | null,"id": string,"number": string,"part_id": string | null,"raised_by": string,"returned_on": string | null,"scope": string | null,"sent_on": string | null,"serial_no": string | null,"status": string,"status_since": string,"supplier_id": string,"title": string,"us_return_id": string | null,"work_order_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acceptance_note"?: string | null,"accepted_at"?: string | null,"accepted_by"?: string | null,"aircraft_id"?: string | null,"cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expected_back"?: string | null,"id"?: string,"number": string,"part_id"?: string | null,"raised_by": string,"returned_on"?: string | null,"scope"?: string | null,"sent_on"?: string | null,"serial_no"?: string | null,"status"?: string,"status_since"?: string,"supplier_id": string,"title": string,"us_return_id"?: string | null,"work_order_id"?: string | null
                  }
                  Update: {
                    "acceptance_note"?: string | null,"accepted_at"?: string | null,"accepted_by"?: string | null,"aircraft_id"?: string | null,"cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expected_back"?: string | null,"id"?: string,"number"?: string,"part_id"?: string | null,"raised_by"?: string,"returned_on"?: string | null,"scope"?: string | null,"sent_on"?: string | null,"serial_no"?: string | null,"status"?: string,"status_since"?: string,"supplier_id"?: string,"title"?: string,"us_return_id"?: string | null,"work_order_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outside_mro_job_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "supplier"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_us_return_id_fkey"
      columns: ["us_return_id"]
isOneToOne: false
      referencedRelation: "us_return"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_job_work_order_id_fkey"
      columns: ["work_order_id"]
isOneToOne: false
      referencedRelation: "work_order"
      referencedColumns: ["id"]
    }
                  ]
                },"outside_mro_part": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"description": string | null,"device_time": string | null,"entered_by": string,"id": string,"job_id": string,"part_id": string | null,"part_number_text": string | null,"qty": number,"unit_cost": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"description"?: string | null,"device_time"?: string | null,"entered_by": string,"id"?: string,"job_id": string,"part_id"?: string | null,"part_number_text"?: string | null,"qty": number,"unit_cost": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"device_time"?: string | null,"entered_by"?: string,"id"?: string,"job_id"?: string,"part_id"?: string | null,"part_number_text"?: string | null,"qty"?: number,"unit_cost"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "outside_mro_part_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_part_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "outside_mro_job"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_part_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    }
                  ]
                },"outside_mro_quote": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"currency": string,"device_time": string | null,"entered_by": string,"entry": string,"id": string,"job_id": string,"note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"device_time"?: string | null,"entered_by": string,"entry": string,"id"?: string,"job_id": string,"note"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"device_time"?: string | null,"entered_by"?: string,"entry"?: string,"id"?: string,"job_id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "outside_mro_quote_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "outside_mro_quote_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "outside_mro_job"
      referencedColumns: ["id"]
    }
                  ]
                },"part": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string,"device_time": string | null,"id": string,"part_class": string,"part_number": string,"serialised": boolean,"shelf_life_tracked": boolean,"status": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description": string,"device_time"?: string | null,"id"?: string,"part_class": string,"part_number": string,"serialised"?: boolean,"shelf_life_tracked"?: boolean,"status"?: string,"unit"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string,"device_time"?: string | null,"id"?: string,"part_class"?: string,"part_number"?: string,"serialised"?: boolean,"shelf_life_tracked"?: boolean,"status"?: string,"unit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"part_request": {
                  Row: {
                    "aircraft_id": string | null,"aog_confirmed_at": string | null,"aog_confirmed_by": string | null,"aog_confirmed_how": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"client_ref": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"number": string,"priority": string,"purpose": string | null,"remarks": string | null,"request_type": string,"requested_by": string,"required_by": string | null,"status": string,"store_code": string,"work_order_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id"?: string | null,"aog_confirmed_at"?: string | null,"aog_confirmed_by"?: string | null,"aog_confirmed_how"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"number": string,"priority"?: string,"purpose"?: string | null,"remarks"?: string | null,"request_type": string,"requested_by": string,"required_by"?: string | null,"status"?: string,"store_code": string,"work_order_id"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string | null,"aog_confirmed_at"?: string | null,"aog_confirmed_by"?: string | null,"aog_confirmed_how"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"client_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"number"?: string,"priority"?: string,"purpose"?: string | null,"remarks"?: string | null,"request_type"?: string,"requested_by"?: string,"required_by"?: string | null,"status"?: string,"store_code"?: string,"work_order_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "part_request_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_aog_confirmed_by_fkey"
      columns: ["aog_confirmed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "part_request_work_order_id_fkey"
      columns: ["work_order_id"]
isOneToOne: false
      referencedRelation: "work_order"
      referencedColumns: ["id"]
    }
                  ]
                },"part_request_line": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"fit_note": string | null,"fitted_at": string | null,"fitted_by": string | null,"id": string,"ipc_ref": string | null,"issue_voucher": string | null,"issued_at": string | null,"issued_by": string | null,"line_no": number,"lot_id": string | null,"part_id": string | null,"part_number_text": string | null,"position": string | null,"qty": number,"removed_part": string,"request_id": string,"requisition_id": string | null,"reserved_at": string | null,"return_accepted_by": string | null,"return_condition": string | null,"return_reason": string | null,"returned_at": string | null,"split_from": string | null,"state": string,"state_reason": string | null,"state_since": string,"store_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"fit_note"?: string | null,"fitted_at"?: string | null,"fitted_by"?: string | null,"id"?: string,"ipc_ref"?: string | null,"issue_voucher"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"line_no": number,"lot_id"?: string | null,"part_id"?: string | null,"part_number_text"?: string | null,"position"?: string | null,"qty": number,"removed_part"?: string,"request_id": string,"requisition_id"?: string | null,"reserved_at"?: string | null,"return_accepted_by"?: string | null,"return_condition"?: string | null,"return_reason"?: string | null,"returned_at"?: string | null,"split_from"?: string | null,"state"?: string,"state_reason"?: string | null,"state_since"?: string,"store_code": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"fit_note"?: string | null,"fitted_at"?: string | null,"fitted_by"?: string | null,"id"?: string,"ipc_ref"?: string | null,"issue_voucher"?: string | null,"issued_at"?: string | null,"issued_by"?: string | null,"line_no"?: number,"lot_id"?: string | null,"part_id"?: string | null,"part_number_text"?: string | null,"position"?: string | null,"qty"?: number,"removed_part"?: string,"request_id"?: string,"requisition_id"?: string | null,"reserved_at"?: string | null,"return_accepted_by"?: string | null,"return_condition"?: string | null,"return_reason"?: string | null,"returned_at"?: string | null,"split_from"?: string | null,"state"?: string,"state_reason"?: string | null,"state_since"?: string,"store_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "part_request_line_fitted_by_fkey"
      columns: ["fitted_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "part_request"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_requisition_fk"
      columns: ["requisition_id"]
isOneToOne: false
      referencedRelation: "requisition"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_return_accepted_by_fkey"
      columns: ["return_accepted_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_split_from_fkey"
      columns: ["split_from"]
isOneToOne: false
      referencedRelation: "part_request_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "part_request_line_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    }
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
                },"purchase_order": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"clearing_ref": string | null,"created_at": string,"created_by": string | null,"currency": string,"device_time": string | null,"eta": string | null,"id": string,"note": string | null,"number": string,"ordered_at": string | null,"ordered_by": string | null,"raised_by": string,"shipment_ref": string | null,"status": string,"status_since": string,"supplier_id": string,"supplier_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clearing_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency": string,"device_time"?: string | null,"eta"?: string | null,"id"?: string,"note"?: string | null,"number": string,"ordered_at"?: string | null,"ordered_by"?: string | null,"raised_by": string,"shipment_ref"?: string | null,"status"?: string,"status_since"?: string,"supplier_id": string,"supplier_ref"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"clearing_ref"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"device_time"?: string | null,"eta"?: string | null,"id"?: string,"note"?: string | null,"number"?: string,"ordered_at"?: string | null,"ordered_by"?: string | null,"raised_by"?: string,"shipment_ref"?: string | null,"status"?: string,"status_since"?: string,"supplier_id"?: string,"supplier_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_ordered_by_fkey"
      columns: ["ordered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "supplier"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_order_event": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"done_by": string | null,"eta": string | null,"event": string,"id": string,"note": string | null,"purchase_order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_by"?: string | null,"eta"?: string | null,"event": string,"id"?: string,"note"?: string | null,"purchase_order_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_by"?: string | null,"eta"?: string | null,"event"?: string,"id"?: string,"note"?: string | null,"purchase_order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_event_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_event_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_order"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_order_line": {
                  Row: {
                    "cancel_reason": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"line_no": number,"part_id": string | null,"part_number_text": string | null,"purchase_order_id": string,"qty": number,"requisition_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"line_no": number,"part_id"?: string | null,"part_number_text"?: string | null,"purchase_order_id": string,"qty": number,"requisition_id": string,"status"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"line_no"?: number,"part_id"?: string | null,"part_number_text"?: string | null,"purchase_order_id"?: string,"qty"?: number,"requisition_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_line_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_line_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_order"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_line_requisition_id_fkey"
      columns: ["requisition_id"]
isOneToOne: false
      referencedRelation: "requisition"
      referencedColumns: ["id"]
    }
                  ]
                },"purchase_order_line_price": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"device_time": string | null,"entered_by": string,"id": string,"po_line_id": string,"reason": string | null,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"device_time"?: string | null,"entered_by": string,"id"?: string,"po_line_id": string,"reason"?: string | null,"unit_price": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"device_time"?: string | null,"entered_by"?: string,"id"?: string,"po_line_id"?: string,"reason"?: string | null,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_line_price_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_line_price_po_line_id_fkey"
      columns: ["po_line_id"]
isOneToOne: false
      referencedRelation: "purchase_order_line"
      referencedColumns: ["id"]
    }
                  ]
                },"qualification": {
                  Row: {
                    "aircraft_type_code": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"expires_on": string | null,"id": string,"issued_on": string | null,"issuing_authority": string | null,"kind": string,"licence_category": string | null,"medical_class": string | null,"person_id": string,"recorded_by": string | null,"reference": string | null,"replaced_by": string | null,"superseded_at": string | null,"superseded_by": string | null,"superseded_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"issuing_authority"?: string | null,"kind": string,"licence_category"?: string | null,"medical_class"?: string | null,"person_id": string,"recorded_by"?: string | null,"reference"?: string | null,"replaced_by"?: string | null,"superseded_at"?: string | null,"superseded_by"?: string | null,"superseded_reason"?: string | null
                  }
                  Update: {
                    "aircraft_type_code"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"expires_on"?: string | null,"id"?: string,"issued_on"?: string | null,"issuing_authority"?: string | null,"kind"?: string,"licence_category"?: string | null,"medical_class"?: string | null,"person_id"?: string,"recorded_by"?: string | null,"reference"?: string | null,"replaced_by"?: string | null,"superseded_at"?: string | null,"superseded_by"?: string | null,"superseded_reason"?: string | null
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
      foreignKeyName: "qualification_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qualification_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "qualification"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "qualification_superseded_by_fkey"
      columns: ["superseded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"requisition": {
                  Row: {
                    "action_type": string,"approval_request_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"kind": string,"number": string,"part_id": string | null,"part_number_text": string | null,"priority": string,"purpose": string | null,"qty": number,"raised_at": string,"raised_by": string,"rejected_reason": string | null,"remarks": string | null,"request_line_id": string | null,"required_by": string | null,"status": string,"status_since": string,"store_code": string,"superseded_by": string | null,"supersedes": string | null,"us_return_id": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": string,"approval_request_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind": string,"number": string,"part_id"?: string | null,"part_number_text"?: string | null,"priority"?: string,"purpose"?: string | null,"qty": number,"raised_at"?: string,"raised_by": string,"rejected_reason"?: string | null,"remarks"?: string | null,"request_line_id"?: string | null,"required_by"?: string | null,"status"?: string,"status_since"?: string,"store_code": string,"superseded_by"?: string | null,"supersedes"?: string | null,"us_return_id"?: string | null,"version"?: number
                  }
                  Update: {
                    "action_type"?: string,"approval_request_id"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind"?: string,"number"?: string,"part_id"?: string | null,"part_number_text"?: string | null,"priority"?: string,"purpose"?: string | null,"qty"?: number,"raised_at"?: string,"raised_by"?: string,"rejected_reason"?: string | null,"remarks"?: string | null,"request_line_id"?: string | null,"required_by"?: string | null,"status"?: string,"status_since"?: string,"store_code"?: string,"superseded_by"?: string | null,"supersedes"?: string | null,"us_return_id"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "requisition_action_type_fkey"
      columns: ["action_type"]
isOneToOne: false
      referencedRelation: "approval_chain"
      referencedColumns: ["action_type"]
    },{
      foreignKeyName: "requisition_approval_request_id_fkey"
      columns: ["approval_request_id"]
isOneToOne: false
      referencedRelation: "approval_request"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_request_line_id_fkey"
      columns: ["request_line_id"]
isOneToOne: false
      referencedRelation: "part_request_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "requisition_superseded_by_fkey"
      columns: ["superseded_by"]
isOneToOne: false
      referencedRelation: "requisition"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "requisition"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_us_return_id_fkey"
      columns: ["us_return_id"]
isOneToOne: false
      referencedRelation: "us_return"
      referencedColumns: ["id"]
    }
                  ]
                },"requisition_estimate": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"device_time": string | null,"entered_by": string,"estimated_value": number,"requisition_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency": string,"device_time"?: string | null,"entered_by": string,"estimated_value": number,"requisition_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"device_time"?: string | null,"entered_by"?: string,"estimated_value"?: number,"requisition_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requisition_estimate_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requisition_estimate_requisition_id_fkey"
      columns: ["requisition_id"]
isOneToOne: true
      referencedRelation: "requisition"
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
                },"stock_lot": {
                  Row: {
                    "batch_no": string | null,"bin": string | null,"certificate_ref": string | null,"certificate_status": string,"certificate_type": string | null,"condition": string,"condition_reason": string | null,"condition_set_at": string | null,"condition_set_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"part_id": string,"qty_on_hand": number,"qty_reserved": number,"receipt_id": string | null,"serial_no": string | null,"shelf_life_expires_on": string | null,"source": string,"store_code": string,"transfer_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no"?: string | null,"bin"?: string | null,"certificate_ref"?: string | null,"certificate_status"?: string,"certificate_type"?: string | null,"condition"?: string,"condition_reason"?: string | null,"condition_set_at"?: string | null,"condition_set_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"part_id": string,"qty_on_hand"?: number,"qty_reserved"?: number,"receipt_id"?: string | null,"serial_no"?: string | null,"shelf_life_expires_on"?: string | null,"source": string,"store_code": string,"transfer_id"?: string | null
                  }
                  Update: {
                    "batch_no"?: string | null,"bin"?: string | null,"certificate_ref"?: string | null,"certificate_status"?: string,"certificate_type"?: string | null,"condition"?: string,"condition_reason"?: string | null,"condition_set_at"?: string | null,"condition_set_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"part_id"?: string,"qty_on_hand"?: number,"qty_reserved"?: number,"receipt_id"?: string | null,"serial_no"?: string | null,"shelf_life_expires_on"?: string | null,"source"?: string,"store_code"?: string,"transfer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_lot_condition_set_by_fkey"
      columns: ["condition_set_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_lot_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_lot_receipt_fk"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "stock_receipt"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_lot_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stock_lot_transfer_fk"
      columns: ["transfer_id"]
isOneToOne: false
      referencedRelation: "stock_transfer"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movement": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"done_by": string,"id": string,"kind": string,"lot_id": string,"on_hand_change": number,"part_id": string,"qty": number,"reason": string | null,"receipt_id": string | null,"request_line_id": string | null,"reserved_change": number,"seq": number,"store_code": string,"transfer_id": string | null,"us_return_id": string | null,"voucher": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_by": string,"id"?: string,"kind": string,"lot_id": string,"on_hand_change"?: number,"part_id": string,"qty": number,"reason"?: string | null,"receipt_id"?: string | null,"request_line_id"?: string | null,"reserved_change"?: number,"seq"?: never,"store_code": string,"transfer_id"?: string | null,"us_return_id"?: string | null,"voucher"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"done_by"?: string,"id"?: string,"kind"?: string,"lot_id"?: string,"on_hand_change"?: number,"part_id"?: string,"qty"?: number,"reason"?: string | null,"receipt_id"?: string | null,"request_line_id"?: string | null,"reserved_change"?: number,"seq"?: never,"store_code"?: string,"transfer_id"?: string | null,"us_return_id"?: string | null,"voucher"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movement_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_receipt_id_fkey"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "stock_receipt"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_request_line_id_fkey"
      columns: ["request_line_id"]
isOneToOne: false
      referencedRelation: "part_request_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stock_movement_transfer_id_fkey"
      columns: ["transfer_id"]
isOneToOne: false
      referencedRelation: "stock_transfer"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movement_us_return_id_fkey"
      columns: ["us_return_id"]
isOneToOne: false
      referencedRelation: "us_return"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_receipt": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by": string | null,"batch_no": string | null,"bin": string | null,"certificate_ref": string | null,"certificate_type": string | null,"condition_ok": boolean | null,"created_at": string,"created_by": string | null,"delivered_against": string | null,"device_time": string | null,"for_request_line_id": string | null,"id": string,"inspected_at": string | null,"inspected_by": string | null,"lot_id": string | null,"number": string,"opened_by": string,"part_id": string,"pn_sn_match": boolean | null,"purchase_order_id": string | null,"purchase_order_line_id": string | null,"qty": number,"quarantine_reason": string | null,"serial_no": string | null,"shelf_life_expires_on": string | null,"status": string,"store_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"batch_no"?: string | null,"bin"?: string | null,"certificate_ref"?: string | null,"certificate_type"?: string | null,"condition_ok"?: boolean | null,"created_at"?: string,"created_by"?: string | null,"delivered_against"?: string | null,"device_time"?: string | null,"for_request_line_id"?: string | null,"id"?: string,"inspected_at"?: string | null,"inspected_by"?: string | null,"lot_id"?: string | null,"number": string,"opened_by": string,"part_id": string,"pn_sn_match"?: boolean | null,"purchase_order_id"?: string | null,"purchase_order_line_id"?: string | null,"qty": number,"quarantine_reason"?: string | null,"serial_no"?: string | null,"shelf_life_expires_on"?: string | null,"status"?: string,"store_code": string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"batch_no"?: string | null,"bin"?: string | null,"certificate_ref"?: string | null,"certificate_type"?: string | null,"condition_ok"?: boolean | null,"created_at"?: string,"created_by"?: string | null,"delivered_against"?: string | null,"device_time"?: string | null,"for_request_line_id"?: string | null,"id"?: string,"inspected_at"?: string | null,"inspected_by"?: string | null,"lot_id"?: string | null,"number"?: string,"opened_by"?: string,"part_id"?: string,"pn_sn_match"?: boolean | null,"purchase_order_id"?: string | null,"purchase_order_line_id"?: string | null,"qty"?: number,"quarantine_reason"?: string | null,"serial_no"?: string | null,"shelf_life_expires_on"?: string | null,"status"?: string,"store_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_receipt_acknowledged_by_fkey"
      columns: ["acknowledged_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_for_request_line_id_fkey"
      columns: ["for_request_line_id"]
isOneToOne: false
      referencedRelation: "part_request_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_inspected_by_fkey"
      columns: ["inspected_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_opened_by_fkey"
      columns: ["opened_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_purchase_order_fk"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_order"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_purchase_order_line_id_fkey"
      columns: ["purchase_order_line_id"]
isOneToOne: false
      referencedRelation: "purchase_order_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_receipt_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    }
                  ]
                },"stock_transfer": {
                  Row: {
                    "acknowledged_at": string | null,"acknowledged_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"from_lot_id": string,"from_store": string,"id": string,"note": string | null,"number": string,"part_id": string,"qty": number,"raised_at": string,"raised_by": string,"received_at": string | null,"received_by": string | null,"return_of": string | null,"status": string,"to_lot_id": string | null,"to_store": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"from_lot_id": string,"from_store": string,"id"?: string,"note"?: string | null,"number": string,"part_id": string,"qty": number,"raised_at"?: string,"raised_by": string,"received_at"?: string | null,"received_by"?: string | null,"return_of"?: string | null,"status"?: string,"to_lot_id"?: string | null,"to_store": string
                  }
                  Update: {
                    "acknowledged_at"?: string | null,"acknowledged_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"from_lot_id"?: string,"from_store"?: string,"id"?: string,"note"?: string | null,"number"?: string,"part_id"?: string,"qty"?: number,"raised_at"?: string,"raised_by"?: string,"received_at"?: string | null,"received_by"?: string | null,"return_of"?: string | null,"status"?: string,"to_lot_id"?: string | null,"to_store"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_transfer_acknowledged_by_fkey"
      columns: ["acknowledged_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_from_lot_id_fkey"
      columns: ["from_lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_from_store_fkey"
      columns: ["from_store"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "stock_transfer_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_return_of_fkey"
      columns: ["return_of"]
isOneToOne: false
      referencedRelation: "stock_transfer"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_to_lot_id_fkey"
      columns: ["to_lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_transfer_to_store_fkey"
      columns: ["to_store"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
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
                },"supplier": {
                  Row: {
                    "added_by": string,"approval_ref": string | null,"code": string,"contact": string | null,"country": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"kind": string,"name": string,"scope_note": string | null,"status": string,"status_reason": string | null,"status_set_at": string | null,"status_set_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by": string,"approval_ref"?: string | null,"code": string,"contact"?: string | null,"country"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind"?: string,"name": string,"scope_note"?: string | null,"status"?: string,"status_reason"?: string | null,"status_set_at"?: string | null,"status_set_by"?: string | null
                  }
                  Update: {
                    "added_by"?: string,"approval_ref"?: string | null,"code"?: string,"contact"?: string | null,"country"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"scope_note"?: string | null,"status"?: string,"status_reason"?: string | null,"status_set_at"?: string | null,"status_set_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_status_set_by_fkey"
      columns: ["status_set_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"supplier_invoice": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"currency": string,"device_time": string | null,"id": string,"invoice_date": string,"invoice_no": string,"note": string | null,"outside_mro_job_id": string | null,"purchase_order_id": string | null,"recorded_by": string,"supplier_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"device_time"?: string | null,"id"?: string,"invoice_date": string,"invoice_no": string,"note"?: string | null,"outside_mro_job_id"?: string | null,"purchase_order_id"?: string | null,"recorded_by": string,"supplier_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"device_time"?: string | null,"id"?: string,"invoice_date"?: string,"invoice_no"?: string,"note"?: string | null,"outside_mro_job_id"?: string | null,"purchase_order_id"?: string | null,"recorded_by"?: string,"supplier_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "supplier_invoice_outside_mro_job_id_fkey"
      columns: ["outside_mro_job_id"]
isOneToOne: false
      referencedRelation: "outside_mro_job"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_invoice_purchase_order_id_fkey"
      columns: ["purchase_order_id"]
isOneToOne: false
      referencedRelation: "purchase_order"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_invoice_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "supplier_invoice_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "supplier"
      referencedColumns: ["id"]
    }
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
                },"us_return": {
                  Row: {
                    "aircraft_id": string,"created_at": string,"created_by": string | null,"device_time": string | null,"id": string,"lot_id": string | null,"number": string,"part_id": string | null,"part_number_text": string | null,"reason": string,"receive_note": string | null,"received_at": string | null,"received_by": string | null,"removed_at": string,"removed_by": string,"request_line_id": string | null,"return_due_on": string | null,"serial_no": string | null,"status": string,"store_code": string,"tag_ref": string | null,"work_order_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"lot_id"?: string | null,"number": string,"part_id"?: string | null,"part_number_text"?: string | null,"reason": string,"receive_note"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"removed_at"?: string,"removed_by": string,"request_line_id"?: string | null,"return_due_on"?: string | null,"serial_no"?: string | null,"status"?: string,"store_code": string,"tag_ref"?: string | null,"work_order_id"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"id"?: string,"lot_id"?: string | null,"number"?: string,"part_id"?: string | null,"part_number_text"?: string | null,"reason"?: string,"receive_note"?: string | null,"received_at"?: string | null,"received_by"?: string | null,"removed_at"?: string,"removed_by"?: string,"request_line_id"?: string | null,"return_due_on"?: string | null,"serial_no"?: string | null,"status"?: string,"store_code"?: string,"tag_ref"?: string | null,"work_order_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "us_return_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "stock_lot"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_part_id_fkey"
      columns: ["part_id"]
isOneToOne: false
      referencedRelation: "part"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_request_line_id_fkey"
      columns: ["request_line_id"]
isOneToOne: false
      referencedRelation: "part_request_line"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "us_return_store_code_fkey"
      columns: ["store_code"]
isOneToOne: false
      referencedRelation: "store"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "us_return_work_order_id_fkey"
      columns: ["work_order_id"]
isOneToOne: false
      referencedRelation: "work_order"
      referencedColumns: ["id"]
    }
                  ]
                },"user_account": {
                  Row: {
                    "activated_at": string | null,"activated_by": string | null,"created_at": string,"created_by": string | null,"deactivated_at": string | null,"deactivated_by": string | null,"deactivation_reason": string | null,"device_time": string | null,"id": string,"must_change_password": boolean,"person_id": string,"requested_department": string | null,"status": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id": string,"must_change_password"?: boolean,"person_id": string,"requested_department"?: string | null,"status"?: string,"username"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"activated_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deactivated_at"?: string | null,"deactivated_by"?: string | null,"deactivation_reason"?: string | null,"device_time"?: string | null,"id"?: string,"must_change_password"?: boolean,"person_id"?: string,"requested_department"?: string | null,"status"?: string,"username"?: string | null
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
                    "aircraft_id": string,"approval_request_id": string | null,"certification_note": string | null,"certified_at": string | null,"certified_by": string | null,"created_at": string,"created_by": string | null,"device_time": string | null,"est_man_hours": number | null,"id": string,"number": string,"requested_by": string,"revision": number,"scope": string,"snag_id": string | null,"status": string,"work_completed_at": string | null,"work_completed_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aircraft_id": string,"approval_request_id"?: string | null,"certification_note"?: string | null,"certified_at"?: string | null,"certified_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"number": string,"requested_by": string,"revision"?: number,"scope": string,"snag_id"?: string | null,"status"?: string,"work_completed_at"?: string | null,"work_completed_by"?: string | null
                  }
                  Update: {
                    "aircraft_id"?: string,"approval_request_id"?: string | null,"certification_note"?: string | null,"certified_at"?: string | null,"certified_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"number"?: string,"requested_by"?: string,"revision"?: number,"scope"?: string,"snag_id"?: string | null,"status"?: string,"work_completed_at"?: string | null,"work_completed_by"?: string | null
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
                },"work_order_revision": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_time": string | null,"est_man_hours": number | null,"id": string,"previous_est_man_hours": number | null,"previous_scope": string,"previous_status": string,"reason": string,"revised_by": string,"revision": number,"scope": string,"work_order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"previous_est_man_hours"?: number | null,"previous_scope": string,"previous_status": string,"reason": string,"revised_by": string,"revision": number,"scope": string,"work_order_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_time"?: string | null,"est_man_hours"?: number | null,"id"?: string,"previous_est_man_hours"?: number | null,"previous_scope"?: string,"previous_status"?: string,"reason"?: string,"revised_by"?: string,"revision"?: number,"scope"?: string,"work_order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_order_revision_revised_by_fkey"
      columns: ["revised_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "work_order_revision_work_order_id_fkey"
      columns: ["work_order_id"]
isOneToOne: false
      referencedRelation: "work_order"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "adsb_compliance_current": {
                  Row: {
                    "aircraft_id": string | null,"aircraft_type_code": string | null,"applicability": string | null,"assessed_revision": string | null,"compliance_method": string | null,"compliance_reference": string | null,"correction_reason": string | null,"current_cycles": number | null,"current_hours": number | null,"current_revision": string | null,"cycles_flag": string | null,"date_flag": string | null,"doc_type": string | null,"document_id": string | null,"document_key": string | null,"document_revised": boolean | null,"due_flag": string | null,"entered_at": string | null,"entered_by": string | null,"entered_by_tlc": string | null,"entry_key": string | null,"hours_flag": string | null,"id": string | null,"issuing_authority": string | null,"last_complied_cycles": number | null,"last_complied_hours": number | null,"last_complied_on": string | null,"next_due_cycles": number | null,"next_due_hours": number | null,"next_due_on": string | null,"next_due_text": string | null,"not_applicable_reason": string | null,"reference": string | null,"remarks": string | null,"status": string | null,"tail": string | null,"title": string | null,"totals_available": boolean | null,"verification_note": string | null,"verification_state": string | null,"verified_at": string | null,"verified_by_tlc": string | null,"version": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "adsb_compliance_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "adsb_document"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "adsb_document_current"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adsb_compliance_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aircraft_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    }
                  ]
                },"adsb_document_current": {
                  Row: {
                    "aircraft_type_code": string | null,"applies_to_note": string | null,"correction_reason": string | null,"created_at": string | null,"doc_type": string | null,"document_key": string | null,"effective_on": string | null,"entered_by": string | null,"entered_by_tlc": string | null,"id": string | null,"issuing_authority": string | null,"reference": string | null,"revision": string | null,"title": string | null,"version": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "adsb_document_aircraft_type_code_fkey"
      columns: ["aircraft_type_code"]
isOneToOne: false
      referencedRelation: "aircraft_type"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "adsb_document_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    }
                  ]
                },"aircraft_current_status": {
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
                },"flight_record_current": {
                  Row: {
                    "aircraft_id": string | null,"apu_cycles": number | null,"apu_hours": number | null,"client_ref": string | null,"created_at": string | null,"created_by": string | null,"cycles": number | null,"device_time": string | null,"entered_at": string | null,"entered_by": string | null,"flight_date": string | null,"from_place": string | null,"hours": number | null,"hours_basis": string | null,"id": string | null,"is_void": boolean | null,"kind": string | null,"landings": number | null,"log_ref": string | null,"reason": string | null,"record_id": string | null,"supersedes": string | null,"to_place": string | null,"version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "aircraft_id"?: string | null,"apu_cycles"?: number | null,"apu_hours"?: number | null,"client_ref"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"cycles"?: number | null,"device_time"?: string | null,"entered_at"?: string | null,"entered_by"?: string | null,"flight_date"?: string | null,"from_place"?: string | null,"hours"?: number | null,"hours_basis"?: string | null,"id"?: string | null,"is_void"?: boolean | null,"kind"?: string | null,"landings"?: number | null,"log_ref"?: string | null,"reason"?: string | null,"record_id"?: string | null,"supersedes"?: string | null,"to_place"?: string | null,"version"?: number | null
                         }
                        Update: {
                           "aircraft_id"?: string | null,"apu_cycles"?: number | null,"apu_hours"?: number | null,"client_ref"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"cycles"?: number | null,"device_time"?: string | null,"entered_at"?: string | null,"entered_by"?: string | null,"flight_date"?: string | null,"from_place"?: string | null,"hours"?: number | null,"hours_basis"?: string | null,"id"?: string | null,"is_void"?: boolean | null,"kind"?: string | null,"landings"?: number | null,"log_ref"?: string | null,"reason"?: string | null,"record_id"?: string | null,"supersedes"?: string | null,"to_place"?: string | null,"version"?: number | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "flight_record_aircraft_id_fkey"
      columns: ["aircraft_id"]
isOneToOne: false
      referencedRelation: "aircraft"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "person"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "flight_record"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flight_record_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "flight_record_current"
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
