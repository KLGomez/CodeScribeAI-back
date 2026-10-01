export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codescribe',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_change_me',
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
    secret: process.env.AI_SERVICE_SECRET || 'shared_secret',
  },
  githubTokenEncryptionKey:
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY ||
    '12345678901234567890123456789012',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 10,
  },
});
