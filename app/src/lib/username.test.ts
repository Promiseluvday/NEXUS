import { describe, expect, it } from 'vitest';
import { isValidUsername, signInEmail } from './username';

describe('username sign-in (D-206)', () => {
  it('adds the operator domain to a username', () => {
    expect(signInEmail('kdo', 'users.nexus.local')).toBe('kdo@users.nexus.local');
  });
  it('ignores capitals and spaces typed by mistake', () => {
    expect(signInEmail('  KDO ', 'users.nexus.local')).toBe('kdo@users.nexus.local');
  });
  it('uses a full email address as typed', () => {
    expect(signInEmail('someone@example.org', 'users.nexus.local')).toBe('someone@example.org');
  });
  it('checks usernames with the same rule as the database', () => {
    expect(isValidUsername('kdo')).toBe(true);
    expect(isValidUsername('k')).toBe(false);
    expect(isValidUsername('-kdo')).toBe(false);
  });
});
