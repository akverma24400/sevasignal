import { copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const folder of ['backend', 'frontend']) {
  const target = path.join(root, folder, '.env');
  try {
    await access(target);
    console.log(`${folder}/.env already exists; kept it.`);
  } catch {
    await copyFile(`${target}.example`, target);
    console.log(`Created ${folder}/.env`);
  }
}
