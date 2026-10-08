// Username sign-in (D-206).
// People sign in with a username such as "kdo". Supabase's sign-in system
// needs an email address, so behind the scenes "kdo" becomes
// "kdo@users.nexus.local", a made-up address that is never emailed.
// Anyone who types a full email address signs in with that address instead.

export function signInEmail(typed: string, domain: string): string {
  const value = typed.trim().toLowerCase();
  if (value.includes('@')) return value;
  return `${value}@${domain}`;
}

// The same rule the database applies to usernames (migration 0010).
export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value.trim().toLowerCase());
}
