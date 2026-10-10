import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadConfig } from '../src/config.js';
import { createDatabase } from '../src/db.js';
import { hashPassword } from '../src/security.js';
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = readline.createInterface({
  input: process.stdin,
  output,
  terminal: !!process.stdin.isTTY,
});
const db = await createDatabase(loadConfig());
try {
  console.table((await db.query('SELECT id,name FROM centres ORDER BY name')).rows);
  const centre = await rl.question('Centre ID from the table above: ');
  if (!(await db.query('SELECT id FROM centres WHERE id=$1', [centre])).rows.length)
    throw new Error('Centre not found.');
  const name = z
    .string()
    .trim()
    .min(2)
    .max(100)
    .parse(await rl.question('Operator name: '));
  const email = z.email().parse((await rl.question('Email: ')).trim().toLowerCase());
  process.stdout.write('Password (at least 12 characters; hidden): ');
  muted = true;
  const password = z
    .string()
    .min(12)
    .max(128)
    .parse(await rl.question(''));
  muted = false;
  process.stdout.write('\n');
  await db.query(
    'INSERT INTO operators(id,centre_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), centre, name, email, await hashPassword(password)],
  );
  console.log('Operator created.');
} finally {
  muted = false;
  rl.close();
  await db.close();
}
