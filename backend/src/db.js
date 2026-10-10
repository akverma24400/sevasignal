import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
export async function createDatabase(config) {
  if (config.databaseMode === 'embedded') {
    if (config.dataDir && !config.dataDir.startsWith('memory://'))
      await mkdir(path.dirname(config.dataDir), { recursive: true });
    const db = await PGlite.create(config.dataDir);
    return {
      query: (sql, params = []) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({ query: (sql, params = []) => tx.query(sql, params), exec: (sql) => tx.exec(sql) }),
        ),
      close: () => db.close(),
    };
  }
  const ssl = config.databaseSsl
    ? {
        rejectUnauthorized: true,
        ...(config.databaseCaFile ? { ca: await readFile(config.databaseCaFile, 'utf8') } : {}),
      }
    : false;
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (error) => console.error('Database connection error:', error.message));
  return {
    query: (sql, params = []) => pool.query(sql, params),
    exec: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          query: (sql, params = []) => client.query(sql, params),
          exec: (sql) => client.query(sql),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
