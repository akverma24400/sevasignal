import { loadConfig } from './config.js';
import { createDatabase } from './db.js';
import { createApp } from './app.js';
const config = loadConfig();
const db = await createDatabase(config);
try {
  await db.query('SELECT 1 FROM schema_migrations LIMIT 1');
} catch {
  console.error('Database is not initialized. Run npm run db:setup from the project root.');
  await db.close();
  process.exit(1);
}
const server = createApp(db, config).listen(config.port, config.host, () =>
  console.log(
    `SevaSignal API: http://${config.host}:${config.port} (${config.databaseMode} database)`,
  ),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
server.on('error', async (error) => {
  console.error(error.message);
  await db.close();
  process.exit(1);
});
