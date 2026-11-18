const REQUIRED = ['B2_ENDPOINT', 'B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY', 'JWT_SECRET'] as const;

export type Env = Record<(typeof REQUIRED)[number], string>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const missing = REQUIRED.filter((k) => !source[k]?.trim());
  if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  const env = Object.fromEntries(REQUIRED.map((k) => [k, source[k]!.trim()])) as Env;
  if (source === process.env) cached = env;
  return env;
}
