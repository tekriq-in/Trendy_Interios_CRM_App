const PLACEHOLDER = /change-?me|changeme|your[-_]?secret|example|<.*>/i;
const DEFAULT_SEED_PASSWORD = 'ChangeMe123!';
const MIN_SECRET_LENGTH = 32;

/**
 * Returns a list of problems that make the given environment unsafe to run in
 * production. An empty list means it is fine. Pure (no process access) so it
 * can be unit-tested; main.ts throws if the list is non-empty.
 */
export function validateProductionEnv(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = env[key] ?? '';
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} must be at least ${MIN_SECRET_LENGTH} characters`);
    } else if (PLACEHOLDER.test(value)) {
      problems.push(`${key} still contains a placeholder value`);
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  // The seed falls back to the default password when this is unset, which would
  // create a production admin with a publicly known password.
  if (!env.SEED_MD_PASSWORD || env.SEED_MD_PASSWORD === DEFAULT_SEED_PASSWORD) {
    problems.push('SEED_MD_PASSWORD must be set to a strong, non-default password');
  }

  // The mock drive writes to the container's ephemeral disk; uploads would be
  // lost on every restart or deploy.
  if (env.DRIVE_PROVIDER === 'mock') {
    problems.push('DRIVE_PROVIDER=mock loses files on restart; use cloudinary in production');
  }

  const origins = (env.CORS_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  // ALLOW_LOCALHOST_CORS=true is an explicit opt-in for running the production
  // images locally (docker compose); never set it on Render. A wildcard is
  // always rejected.
  const allowLocal = env.ALLOW_LOCALHOST_CORS === 'true';
  if (origins.some((o) => o === '*' || (!allowLocal && /localhost|127\.0\.0\.1/.test(o)))) {
    problems.push('CORS_ORIGIN must list only the deployed web origin(s), not localhost or "*"');
  }

  if (env.WHATSAPP_PROVIDER === 'meta' && !env.META_APP_SECRET) {
    problems.push('META_APP_SECRET is required when WHATSAPP_PROVIDER=meta (webhook signature)');
  }

  return problems;
}
