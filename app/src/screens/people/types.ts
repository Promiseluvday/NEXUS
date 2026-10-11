// Shapes of the data the People screens read from the database
// (app.people_list, app.person_record; migration 0026), and small helpers
// shared by the three person tabs.
import { db } from '../../lib/supabase';

export type PersonListRow = {
  person_id: string; full_name: string; rank_or_title: string | null; three_letter_code: string;
  home_department: string | null; departments: string | null; appointments: string | null;
  account_status: 'active' | 'pending' | 'deactivated' | 'no_sign_in';
  certifying_types: string | null; expiry_flag: 'approaching' | 'reached' | null; pending_authorizations: number;
};

export type Flag = 'current' | 'approaching' | 'reached';

export type Qualification = {
  id: string; kind: 'licence' | 'type_rating' | 'medical'; reference: string | null; licence_category: string | null;
  aircraft_type_code: string | null; medical_class: string | null; issuing_authority: string | null;
  issued_on: string | null; expires_on: string | null; flag: Flag | null;
  recorded_by: string | null; created_at: string;
  superseded_at: string | null; superseded_by: string | null; superseded_reason: string | null; replaced_by: string | null;
};

export type AuthState = 'pending' | 'rejected' | 'withdrawn' | 'revoked' | 'not_yet_valid' | 'expired' | 'approaching' | 'active';

export type Authorization = {
  id: string; reference: string; aircraft_type_code: string; valid_from: string; expires_on: string; state: AuthState;
  issued_by: string; issued_at: string; approved_by: string | null; approved_at: string | null;
  revoked_by: string | null; revoked_at: string | null; revoke_reason: string | null;
  request_id: string | null; waiting_step: string | null;
};

export type PersonRecordData = {
  person: { id: string; full_name: string; rank_or_title: string | null; three_letter_code: string; service_number: string | null; created_at: string };
  account_status: PersonListRow['account_status'];
  home_department: string | null; admin_department: string | null;
  departments: string | null; sections: string | null; scope: string | null; appointments: string | null;
  medical_required: boolean; approaching_days: number; today: string;
  certifying_types: string[];
  qualifications: Qualification[] | null;   // null = you may not see them
  authorizations: Authorization[];
  can: { record_qualifications: boolean; issue: boolean; approve: boolean; revoke: boolean; manage_account: boolean; view_people: boolean };
};

export const ACCOUNT_TEXT: Record<string, { text: string; tone: string }> = {
  active: { text: 'Active', tone: 'tone-green' },
  pending: { text: 'Sign-up pending', tone: 'tone-blue' },
  deactivated: { text: 'Deactivated', tone: 'tone-grey' },
  no_sign_in: { text: 'No sign-in', tone: 'tone-grey' },
};

export const KIND_TEXT: Record<Qualification['kind'], string> = {
  licence: 'Licence', type_rating: 'Type rating', medical: 'Medical',
};

// A PIN is 4 to 8 digits (D-094); the database checks it is the right one.
export const pinLooksRight = (pin: string) => /^[0-9]{4,8}$/.test(pin);

// Aircraft types, for the type rating and authorization forms.
export async function loadAircraftTypes(): Promise<{ code: string; name: string }[]> {
  const { data } = await db.from('aircraft_type').select('code, name').order('code');
  return (data ?? []) as { code: string; name: string }[];
}
