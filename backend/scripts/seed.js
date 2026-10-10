import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { seed } from '../src/seed.js';
const config = loadConfig();
if (config.mode === 'production') throw new Error('Demo seeding is disabled in production.');
const db = await createDatabase(config);
try {
  await seed(db, config.demoPassword);
  console.log('Sample centres and demo operators are ready. Existing records were preserved.');
} finally {
  await db.close();
}
