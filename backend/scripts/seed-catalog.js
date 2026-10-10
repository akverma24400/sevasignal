import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { seedCatalog } from '../src/catalog.js';
const db = await createDatabase(loadConfig());
try {
  await seedCatalog(db);
  console.log('Service catalogue ready. No sample centres or operators were created.');
} finally {
  await db.close();
}
