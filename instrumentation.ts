export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadEnv } = await import('./src/infrastructure/config/env');
    loadEnv();
  }
}
