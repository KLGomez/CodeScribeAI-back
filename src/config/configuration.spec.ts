import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import configuration, { validateProductionConfig } from './configuration';

describe('Configuration & Production Validation (B-3)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const validProductionEnv: Record<string, string> = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a_very_secure_jwt_secret_key_that_has_more_than_32_characters_ok',
    AI_SERVICE_SECRET: 'prod_ai_internal_communication_secret_token_123',
    GITHUB_TOKEN_ENCRYPTION_KEY: '123456789012345678901234567890ab', // 32 bytes exactly
    MONGODB_URI: 'mongodb+srv://admin:pass@cluster.mongodb.net/codescribe',
    GITHUB_CLIENT_ID: 'github_client_id_real_prod_123',
    GITHUB_CLIENT_SECRET: 'github_client_secret_real_prod_456',
    FRONTEND_URL: 'https://codescribe.app',
    NOTION_CLIENT_ID: 'notion_client_id_real_prod_789',
    NOTION_CLIENT_SECRET: 'notion_client_secret_real_prod_012',
    NOTION_REDIRECT_URI: 'https://codescribe.app/integrations/notion/callback',
  };

  it('debe validar exitosamente cuando todas las variables de producción son válidas', () => {
    expect(() => validateProductionConfig(validProductionEnv)).not.toThrow();
  });

  it('debe fallar si faltan variables de entorno críticas en producción', () => {
    const incompleteEnv = { ...validProductionEnv };
    delete incompleteEnv.JWT_SECRET;
    delete incompleteEnv.MONGODB_URI;

    expect(() => validateProductionConfig(incompleteEnv)).toThrow(
      /Variables de entorno críticas ausentes en producción: JWT_SECRET, MONGODB_URI/,
    );
  });

  it('debe fallar si faltan credenciales de Notion en producción', () => {
    const noNotionEnv = { ...validProductionEnv };
    delete noNotionEnv.NOTION_CLIENT_ID;

    expect(() => validateProductionConfig(noNotionEnv)).toThrow(
      /Variables de entorno críticas ausentes en producción: NOTION_CLIENT_ID/,
    );
  });

  it('debe fallar si JWT_SECRET tiene menos de 32 caracteres', () => {
    const shortJwtEnv = { ...validProductionEnv, JWT_SECRET: 'short_key_under_32' };

    expect(() => validateProductionConfig(shortJwtEnv)).toThrow(
      /JWT_SECRET debe tener al menos 32 caracteres/,
    );
  });

  it('debe fallar si GITHUB_TOKEN_ENCRYPTION_KEY no mide exactamente 32 bytes', () => {
    const wrongKeyEnv = {
      ...validProductionEnv,
      GITHUB_TOKEN_ENCRYPTION_KEY: 'demasiado_corta_para_32_bytes',
    };

    expect(() => validateProductionConfig(wrongKeyEnv)).toThrow(
      /GITHUB_TOKEN_ENCRYPTION_KEY debe medir exactamente 32 bytes/,
    );
  });

  it('debe fallar si FRONTEND_URL apunta a localhost o 127.0.0.1 en producción', () => {
    const localhostEnv = {
      ...validProductionEnv,
      FRONTEND_URL: 'http://localhost:5173',
    };

    expect(() => validateProductionConfig(localhostEnv)).toThrow(
      /FRONTEND_URL no puede apuntar a localhost en producción/,
    );
  });

  it('debe fallar si alguna variable contiene placeholders o valores por defecto de desarrollo', () => {
    const placeholderEnv = {
      ...validProductionEnv,
      GITHUB_TOKEN_ENCRYPTION_KEY: '12345678901234567890123456789012',
    };

    expect(() => validateProductionConfig(placeholderEnv)).toThrow(
      /contiene un valor por defecto o placeholder no permitido en producción/,
    );
  });

  it('debe fallar si una variable contiene "CHANGE_ME" en producción', () => {
    const changeMeEnv = {
      ...validProductionEnv,
      AI_SERVICE_SECRET: 'CHANGE_ME_NOW_PLEASE_SECURE_SECRET_123',
    };

    expect(() => validateProductionConfig(changeMeEnv)).toThrow(
      /AI_SERVICE_SECRET contiene un valor por defecto o placeholder no permitido/,
    );
  });

  it('en desarrollo no debe lanzar excepción aunque falten variables', () => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = '';
    const config = configuration();

    expect(config.nodeEnv).toBe('development');
    expect(config.jwt.secret).toBeDefined();
    expect(config.throttle.limit).toBe(100);
  });
});
