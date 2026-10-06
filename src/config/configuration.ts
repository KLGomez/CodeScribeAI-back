export function validateProductionConfig(env: Record<string, string | undefined>) {
  const missing: string[] = [];
  const requiredKeys = [
    'JWT_SECRET',
    'AI_SERVICE_SECRET',
    'GITHUB_TOKEN_ENCRYPTION_KEY',
    'MONGODB_URI',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'FRONTEND_URL',
    'NOTION_CLIENT_ID',
    'NOTION_CLIENT_SECRET',
    'NOTION_REDIRECT_URI',
  ];

  for (const key of requiredKeys) {
    if (!env[key] || env[key].trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[ConfigError] Variables de entorno críticas ausentes en producción: ${missing.join(', ')}`,
    );
  }

  const jwtSecret = env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error(
      `[ConfigError] JWT_SECRET debe tener al menos 32 caracteres (actual: ${jwtSecret.length})`,
    );
  }

  const encKey = env.GITHUB_TOKEN_ENCRYPTION_KEY!;
  const keyBytes = Buffer.byteLength(encKey, 'utf8');
  if (keyBytes !== 32) {
    throw new Error(
      `[ConfigError] GITHUB_TOKEN_ENCRYPTION_KEY debe medir exactamente 32 bytes (actual: ${keyBytes} bytes)`,
    );
  }

  const frontendUrl = env.FRONTEND_URL!;
  if (frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
    throw new Error(
      `[ConfigError] FRONTEND_URL no puede apuntar a localhost en producción: ${frontendUrl}`,
    );
  }

  const KNOWN_PLACEHOLDERS = [
    'dev_jwt_secret_codescribe_local_only',
    'fallback_secret_change_me',
    'super_secret_jwt_key_codescribe',
    'dev_ai_secret_codescribe_local_only',
    'shared_secret',
    'dev_encryption_key_32_bytes_ok!',
    '12345678901234567890123456789012',
    'tu_github_client_id',
    'tu_github_client_secret',
    'tu_clave_de_google_gemini',
    'tu_notion_client_id',
    'tu_notion_client_secret',
  ];

  for (const key of requiredKeys) {
    const val = env[key]!;
    const lower = val.toLowerCase();
    if (
      KNOWN_PLACEHOLDERS.includes(val) ||
      lower.includes('change_me') ||
      lower.includes('changeme') ||
      lower.includes('placeholder')
    ) {
      throw new Error(
        `[ConfigError] ${key} contiene un valor por defecto o placeholder no permitido en producción: "${val}"`,
      );
    }
  }
}

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  if (isProd) {
    validateProductionConfig(process.env);
  }

  const jwtSecret = process.env.JWT_SECRET;
  const aiSecret = process.env.AI_SERVICE_SECRET;
  const encKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  return {
    port: parseInt(process.env.PORT, 10) || 3001,
    nodeEnv,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    trustProxy: process.env.TRUST_PROXY
      ? parseInt(process.env.TRUST_PROXY, 10)
      : (isProd ? 1 : false),
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codescribe',
    },
    jwt: {
      secret: jwtSecret || 'dev_jwt_secret_codescribe_local_only_32_chars!',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:3001/api/auth/github/callback',
    },
    notion: {
      clientId: process.env.NOTION_CLIENT_ID,
      clientSecret: process.env.NOTION_CLIENT_SECRET,
      redirectUri:
        process.env.NOTION_REDIRECT_URI ||
        'http://localhost:5173/integrations/notion/callback',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    aiService: {
      url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
      secret: aiSecret || 'dev_ai_secret_codescribe_local_only',
    },
    githubTokenEncryptionKey:
      encKey || 'dev_encryption_key_32_bytes_ok!',
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
    },
    demo: {
      analysisLimit: parseInt(process.env.DEMO_ANALYSIS_LIMIT, 10) || 2,
      dailyAnalysisLimit: parseInt(process.env.DEMO_DAILY_ANALYSIS_LIMIT, 10) || 50,
    },
  };
};
