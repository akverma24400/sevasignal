import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { migrate } from '../src/migrate.js';
const db = await createDatabase(loadConfig());
try {
  await migrate(db);
  console.log('Database migrations are up to date.');
} finally {
  await db.close();
}
