import readline from 'node:readline/promises';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const db = await createDatabase(loadConfig());
try {
  console.log('Create a participating centre. Use only details you have permission to publish.');
  const id = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.')
    .max(100)
    .parse((await rl.question('Unique centre ID (for example, my-city-seva): ')).trim());
  const name = z
    .string()
    .trim()
    .min(3)
    .max(100)
    .parse(await rl.question('Centre name: '));
  const hindi = z
    .string()
    .trim()
    .max(100)
    .parse(await rl.question('Name in Hindi (optional): '));
  const area = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .parse(await rl.question('Area: '));
  const city = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .parse(await rl.question('City: '));
  const pin = z
    .string()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid six-digit PIN code.')
    .parse((await rl.question('PIN code: ')).trim());
  const address = z
    .string()
    .trim()
    .min(5)
    .max(240)
    .parse(await rl.question('Public address: '));
  const hours = z
    .string()
    .trim()
    .min(3)
    .max(120)
    .parse(await rl.question('Opening hours (informational only): '));
  const sample =
    (await rl.question('Is this fictional sample data? [Y/n]: ')).trim().toLowerCase() !== 'n';
  await db.query(
    'INSERT INTO centres(id,name,name_hi,area,city,pincode,address,opening_hours,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, name, hindi, area, city, pin, address, hours, sample],
  );
  console.log(
    `Centre created: ${id}. Run npm run operator:create to assign an operator, then add services in the dashboard.`,
  );
} finally {
  rl.close();
  await db.close();
}
