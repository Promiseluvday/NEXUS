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
import { readCache, writeCache } from './offline/cache';
import { isNetworkError, isOnline } from './offline/net';
import { setCurrentUser } from './perform';
import { loadDevice, loadLastKnownProblem } from './offline/device';

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
  adminDepartments: string[];  // departments this person is Super Admin for; ['*'] = all (D-035)
  mustChangePassword: boolean; // a Super Admin set a temporary password (D-219)
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  me: Me | null;
  display: DisplaySettings;
  signIn: (username: string, password: string) => Promise<string | null>;
  requestAccount: (r: AccountRequest) => Promise<string | null>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

// What a person fills in to ask for an account (D-206, D-123).
export type AccountRequest = {
  fullName: string; rank: string; username: string; tlc: string; department: string; password: string;
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
  const { data: account, error } = await db
    .from('user_account')
    .select('status, username, person_id, must_change_password, person:person_id (full_name, three_letter_code)')
    .eq('id', userId)
    .maybeSingle();
  if (isNetworkError(error)) throw new Error('offline');
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
  const { data: adminDepts } = await actions.rpc('my_admin_departments');

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
    adminDepartments: (adminDepts ?? []) as string[],
    mustChangePassword: Boolean((account as { must_change_password?: boolean }).must_change_password),
  };
}

// Offline (D-102): use what this tablet last knew about the person and the
// display settings. Every action is still checked by the server when sent.
async function loadMeOrCached(userId: string): Promise<Me | null> {
  try {
    const m = await loadMe(userId);
    if (m) await writeCache(`me:${userId}`, m);
    return m;
  } catch {
    return (await readCache<Me>(`me:${userId}`)) ?? null;
  }
}

async function loadDisplayOrCached(): Promise<DisplaySettings> {
  const cachedDisplay = await readCache<DisplaySettings>('display');
  if (!isOnline() && cachedDisplay) return cachedDisplay;
  const d = await loadDisplay().catch(() => cachedDisplay ?? defaultDisplay);
  await writeCache('display', d);
  return d;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [display, setDisplay] = useState<DisplaySettings>(defaultDisplay);

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setCurrentUser(undefined);
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, d] = await Promise.all([loadMeOrCached(s.user.id), loadDisplayOrCached()]);
    setCurrentUser(m ? s.user.id : undefined);
    await loadDevice();
    await loadLastKnownProblem();
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

  // Offline, sign out on this tablet only (the server is told next time).
  const signOut = useCallback(async () => {
    await db.auth.signOut(isOnline() ? undefined : { scope: 'local' });
  }, []);

  const reload = useCallback(async () => {
    const { data } = await db.auth.getSession();
    await load(data.session);
  }, [load]);

  // Ask for an account: make the sign-in, then the PENDING account. It has
  // no rights until a Super Admin of the requested department approves it.
  const requestAccount = useCallback(async (r: AccountRequest) => {
    const { error } = await db.auth.signUp({ email: signInEmail(r.username, usernameDomain), password: r.password });
    if (error) return errorText(error);
    const { error: err } = await actions.rpc('request_account', {
      p_full_name: r.fullName, p_username: r.username.trim().toLowerCase(), p_three_letter_code: r.tlc.toUpperCase(),
      p_requested_department: r.department, p_rank_or_title: r.rank || undefined,
    });
    if (err) {
      await db.auth.signOut();
      return errorText(err);
    }
    await reload();
    return null;
  }, [reload]);

  return (
    <AuthContext.Provider value={{ loading, session, me, display, signIn, requestAccount, signOut, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
