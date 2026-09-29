import type { DatabaseSync } from 'node:sqlite';

export function adminAllowed(environment: string, username: string): boolean {
  return (
    environment !== 'production' &&
    (process.env.FRONTIER_ADMIN_USERNAMES ?? '')
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
      .includes(username.toLowerCase())
  );
}

export function adminAccount(
  database: DatabaseSync,
  accountId: string,
  environment = process.env.NODE_ENV ?? 'development',
): boolean {
  const account = database.prepare('SELECT username FROM accounts WHERE id = ?').get(accountId) as
    { username: string } | undefined;
  return Boolean(account && adminAllowed(environment, account.username));
}

export function adminCharacter(
  database: DatabaseSync,
  characterId: string,
  environment = process.env.NODE_ENV ?? 'development',
): boolean {
  const account = database
    .prepare(
      'SELECT accounts.username FROM accounts JOIN characters ON characters.account_id = accounts.id WHERE characters.id = ?',
    )
    .get(characterId) as { username: string } | undefined;
  return Boolean(account && adminAllowed(environment, account.username));
}
