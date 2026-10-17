import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { seed } from '../src/seed.js';

const config = loadConfig();
const production = config.mode === 'production';

// Production demo data must be explicitly enabled.
if (production && process.env.ENABLE_DEMO_SEED !== 'true') {
  console.log('Demo seeding skipped.');
  process.exit(0);
}

// Never fall back to the local demo password in production.
const password = production ? process.env.DEMO_PASSWORD : config.demoPassword;
if (!password || password.length < 12) {
  throw new Error('DEMO_PASSWORD must contain at least 12 characters.');
}

const db = await createDatabase(config);
try {
  await seed(db, password);
  console.log('Sample centres and demo operators are ready. Existing records were preserved.');
} finally {
  await db.close();
}
