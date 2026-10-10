import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { backendRoot } from './config.js';
export async function migrate(db) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );
  const files = (await readdir(path.join(backendRoot, 'migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = await readFile(path.join(backendRoot, 'migrations', file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const applied = (await db.query('SELECT checksum FROM schema_migrations WHERE name=$1', [file]))
      .rows[0];
    if (applied) {
      if (applied.checksum !== checksum)
        throw new Error(`Applied migration ${file} changed. Create a new migration instead.`);
      continue;
    }
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
        file,
        checksum,
      ]);
    });
  }
}
