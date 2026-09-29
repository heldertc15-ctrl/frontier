import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const SESSION_COOKIE = 'frontier_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

interface AccountRow {
  id: string;
  password_hash: string;
  username: string;
}

export interface Account {
  id: string;
  username: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createId(): string {
  return randomBytes(16).toString('hex');
}

export function validateUsername(username: unknown): string | null {
  if (typeof username !== 'string') return null;
  const value = username.trim();
  return /^[a-zA-Z0-9_-]{3,24}$/.test(value) ? value : null;
}

export function validatePassword(password: unknown): string | null {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128
    ? password
    : null;
}

function passwordHash(password: string, salt = randomBytes(16).toString('hex')): string {
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = passwordHash(password, salt).split(':')[1];
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function createAccount(database: DatabaseSync, username: string, password: string): Account {
  const account = { id: createId(), username };
  database
    .prepare('INSERT INTO accounts (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(account.id, account.username, passwordHash(password), new Date().toISOString());
  return account;
}

export function getAccountByUsername(database: DatabaseSync, username: string): Account | null {
  const row = database
    .prepare('SELECT id, username FROM accounts WHERE username = ?')
    .get(username) as Account | undefined;
  return row ?? null;
}

export function authenticateAccount(
  database: DatabaseSync,
  username: string,
  password: string,
): Account | null {
  const row = database
    .prepare('SELECT id, username, password_hash FROM accounts WHERE username = ?')
    .get(username) as AccountRow | undefined;
  if (!row || !passwordMatches(password, row.password_hash)) return null;
  return { id: row.id, username: row.username };
}

export function createSession(database: DatabaseSync, accountId: string): string {
  const token = randomBytes(32).toString('base64url');
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
  database
    .prepare(
      'INSERT INTO sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(
      hashToken(token),
      accountId,
      new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      new Date().toISOString(),
    );
  return token;
}

export function accountForSession(
  database: DatabaseSync,
  token: string | undefined,
): Account | null {
  if (!token) return null;
  const row = database
    .prepare(
      `SELECT accounts.id, accounts.username
       FROM sessions JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString()) as Account | undefined;
  return row ?? null;
}

export function removeSession(database: DatabaseSync, token: string | undefined): void {
  if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function createSessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(';')
    .map((value) => value.trim().split('='))
    .find(([key]) => key === SESSION_COOKIE)?.[1];
}
