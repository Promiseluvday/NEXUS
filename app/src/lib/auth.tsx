// Who is signed in, and what they may use.
//
// After sign-in this loads, once:
//   * the person (name, 3LC) and whether the account is active or pending
//   * which departments and Engineering sections they hold (D-121, D-124)
//   * whether their signing PIN is set (first sign-in, D-206)
//   * the display settings: date and time format, time zone (D-204)
// Every screen reads these through useAuth(). The database still checks every
// action itself; this is only so the screens show the right things.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { actions, db, errorText } from './supabase';
import { defaultDisplay, type DisplaySettings } from './format';
import { signInEmail } from './username';

export type Department = { code: string; name: string; kind: 'department' | 'oversight' };

export type Me = {
  userId: string;
  personId: string;            // the person record (used for 'may I certify?')
  status: 'pending' | 'active' | 'deactivated';
  username: string | null;
  fullName: string;
  tlc: string; // three-letter code
  departments: Department[];   // departments this person holds
  allDepartments: Department[];
  sections: string[];          // Engineering sections (LINE, TIRE...)
  isOversight: boolean;        // Command or Quality: read-only across all (D-122)
  canReportSnags: boolean;     // pilots (Operations) and engineers only (D-041)
  pinSet: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  me: Me | null;
  display: DisplaySettings;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const usernameDomain = (import.meta.env.VITE_USERNAME_EMAIL_DOMAIN as string | undefined) ?? 'users.nexus.local';

async function loadDisplay(): Promise<DisplaySettings> {
  const { data } = await db
    .from('operator_setting_current')
    .select('key, value')
    .in('key', ['display.date_format', 'display.time_format', 'operator.time_zone']);
  const get = (k: string) => {
    const v = data?.find((r) => r.key === k)?.value;
    return typeof v === 'string' ? v : undefined;
  };
  return {
    dateFormat: get('display.date_format') ?? defaultDisplay.dateFormat,
    timeFormat: get('display.time_format') ?? defaultDisplay.timeFormat,
    timeZone: get('operator.time_zone') ?? defaultDisplay.timeZone,
  };
}

async function loadMe(userId: string): Promise<Me | null> {
  const { data: account } = await db
    .from('user_account')
    .select('status, username, person_id, person:person_id (full_name, three_letter_code)')
    .eq('id', userId)
    .maybeSingle();
  if (!account) return null;

  const { data: depts } = await db.from('department').select('code, name, kind').order('code');
  const { data: secs } = await db.from('engineering_section').select('code');
  const allDepartments = (depts ?? []) as Department[];

  // Ask the database "do I hold this department / section?" for each one.
  // The same questions the security rules ask, so the answers always agree.
  const held = await Promise.all(
    allDepartments.map((d) => actions.rpc('has_department', { p_department: d.code })),
  );
  const heldSections = await Promise.all(
    (secs ?? []).map((s) => actions.rpc('has_section', { p_section: s.code })),
  );
  const { data: pinSet } = await actions.rpc('my_pin_is_set');

  const departments = allDepartments.filter((_, i) => held[i].data === true);
  const person = account.person as unknown as { full_name: string; three_letter_code: string } | null;
  return {
    userId,
    personId: account.person_id,
    status: account.status as Me['status'],
    username: account.username,
    fullName: person?.full_name ?? '',
    tlc: person?.three_letter_code ?? '',
    departments,
    allDepartments,
    sections: (secs ?? []).filter((_, i) => heldSections[i].data === true).map((s) => s.code),
    isOversight: departments.some((d) => d.code === 'CMD' || d.code === 'QUA'),
    canReportSnags: departments.some((d) => d.code === 'ENG' || d.code === 'OPS'),
    pinSet: pinSet === true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [display, setDisplay] = useState<DisplaySettings>(defaultDisplay);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, d] = await Promise.all([loadMe(s.user.id), loadDisplay()]);
    setMe(m);
    setDisplay(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      // Token refreshes happen every hour; only reload on a real change.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Run outside the auth callback, as Supabase recommends.
        setTimeout(() => load(s), 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signIn = useCallback(async (username: string, password: string) => {
    const { error } = await db.auth.signInWithPassword({
      email: signInEmail(username, usernameDomain),
      password,
    });
    return error ? errorText(error) : null;
  }, []);

  const signOut = useCallback(async () => {
    await db.auth.signOut();
  }, []);

  const reload = useCallback(async () => {
    const { data } = await db.auth.getSession();
    await load(data.session);
  }, [load]);

  return (
    <AuthContext.Provider value={{ loading, session, me, display, signIn, signOut, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
