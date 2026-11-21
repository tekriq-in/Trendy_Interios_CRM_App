import { validateProductionEnv } from '../src/common/utils/validate-production-env';

const strong = (c: string) => c.repeat(48);

const good: NodeJS.ProcessEnv = {
  JWT_SECRET: strong('a'),
  JWT_REFRESH_SECRET: strong('b'),
  CORS_ORIGIN: 'https://ti-crm.vercel.app',
  SEED_MD_PASSWORD: 'Str0ng-and-unique-passphrase',
};

describe('validateProductionEnv', () => {
  it('accepts a safe production configuration', () => {
    expect(validateProductionEnv(good)).toEqual([]);
  });

  it('rejects short JWT secrets', () => {
    const problems = validateProductionEnv({ ...good, JWT_SECRET: 'short' });
    expect(problems).toContain('JWT_SECRET must be at least 32 characters');
  });

  it('rejects the placeholder secrets shipped in .env.example', () => {
    const problems = validateProductionEnv({
      ...good,
      JWT_SECRET: 'change-me-in-production-change-me-in-production',
    });
    expect(problems).toContain('JWT_SECRET still contains a placeholder value');
  });

  it('rejects identical access and refresh secrets', () => {
    const problems = validateProductionEnv({ ...good, JWT_REFRESH_SECRET: good.JWT_SECRET });
    expect(problems).toContain('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  });

  it('rejects the default seed password', () => {
    expect(validateProductionEnv({ ...good, SEED_MD_PASSWORD: 'ChangeMe123!' })).toHaveLength(1);
  });

  it.each(['*', 'http://localhost:3000', 'https://ok.app,http://127.0.0.1:3000'])(
    'rejects unsafe CORS_ORIGIN %s',
    (origin) => {
      expect(validateProductionEnv({ ...good, CORS_ORIGIN: origin })).toHaveLength(1);
    },
  );

  it('allows localhost CORS only with the explicit opt-in, never a wildcard', () => {
    const local = { ...good, CORS_ORIGIN: 'http://localhost:3000', ALLOW_LOCALHOST_CORS: 'true' };
    expect(validateProductionEnv(local)).toEqual([]);
    expect(validateProductionEnv({ ...local, CORS_ORIGIN: '*' })).toHaveLength(1);
  });

  it('requires META_APP_SECRET only when the meta WhatsApp provider is on', () => {
    expect(validateProductionEnv({ ...good, WHATSAPP_PROVIDER: 'mock' })).toEqual([]);
    expect(validateProductionEnv({ ...good, WHATSAPP_PROVIDER: 'meta' })).toHaveLength(1);
    expect(
      validateProductionEnv({ ...good, WHATSAPP_PROVIDER: 'meta', META_APP_SECRET: 'x' }),
    ).toEqual([]);
  });

  it('reports every problem at once', () => {
    const problems = validateProductionEnv({ CORS_ORIGIN: '*' });
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });
});
