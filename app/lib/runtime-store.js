import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
export const isProduction = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const queues = new Map();
export async function localRead(name, fallback = {}) { try { return JSON.parse(await fs.readFile(path.join(process.cwd(), 'data', name), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; return fallback; } }
export function localMutate(name, fallback, mutate) {
  const job = (queues.get(name) || Promise.resolve()).catch(() => {}).then(async () => {
    const data = await localRead(name, fallback), result = await mutate(data);
    const file = path.join(process.cwd(), 'data', name), temp = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(temp, JSON.stringify(data)); await fs.rename(temp, file);
    return result;
  });
  queues.set(name, job); return job;
}
export function storageRequired(error) { return Object.assign(new Error(['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code) ? 'Run the v9 experience migration before using this feature.' : 'Persistent storage is unavailable. Check the Supabase connection.'), { status: 503, code: 'STORAGE_NOT_CONFIGURED' }); }
