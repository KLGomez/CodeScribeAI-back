export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const jwtSecret = process.env.JWT_SECRET;
  const aiSecret = process.env.AI_SERVICE_SECRET;
  const encKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  if (isProd) {
    const missing: string[] = [];
    if (!jwtSecret) missing.push('JWT_SECRET');
    if (!aiSecret) missing.push('AI_SERVICE_SECRET');
    if (!encKey) missing.push('GITHUB_TOKEN_ENCRYPTION_KEY');
    if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');

    if (missing.length > 0) {
      throw new Error(
        `[ConfigError] Variables de entorno críticas ausentes en producción: ${missing.join(', ')}`,
      );
    }
  }

  return {
    port: parseInt(process.env.PORT, 10) || 3001,
    nodeEnv,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codescribe',
    },
    jwt: {
      secret: jwtSecret || 'dev_jwt_secret_codescribe_local_only',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl:
        process.env.GITHUB_CALLBACK_URL ||
        'http://localhost:3001/api/auth/github/callback',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    },
    aiService: {
      url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
      secret: aiSecret || 'dev_ai_secret_codescribe_local_only',
    },
    githubTokenEncryptionKey:
      encKey || 'dev_encryption_key_32_bytes_ok!',
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,
    },
  };
};
