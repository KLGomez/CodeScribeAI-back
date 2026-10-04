import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memoryFallback = new Map<string, { value: string; expiresAt?: number }>();
  private useFallback = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null, // No reintentar en bucle infinito si no hay Redis local
      });

      this.client.on('error', () => {
        this.useFallback = true;
      });
    } catch {
      this.useFallback = true;
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (this.useFallback || !this.client) return false;
    if (this.client.status === 'ready') return true;
    try {
      await this.client.connect();
      return true;
    } catch {
      this.useFallback = true;
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (await this.ensureConnection() && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        this.useFallback = true;
      }
    }

    const item = this.memoryFallback.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryFallback.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (await this.ensureConnection() && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        this.useFallback = true;
      }
    }

    this.memoryFallback.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<number> {
    let result = 0;
    if (await this.ensureConnection() && this.client) {
      try {
        result = await this.client.del(key);
      } catch {
        this.useFallback = true;
      }
    }
    if (this.memoryFallback.has(key)) {
      this.memoryFallback.delete(key);
      result = 1;
    }
    return result;
  }

  async incr(key: string): Promise<number> {
    if (await this.ensureConnection() && this.client) {
      try {
        return await this.client.incr(key);
      } catch {
        this.useFallback = true;
      }
    }

    const currentStr = await this.get(key);
    const nextVal = (parseInt(currentStr || '0', 10) || 0) + 1;
    await this.set(key, nextVal.toString());
    return nextVal;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    if (await this.ensureConnection() && this.client) {
      try {
        return await this.client.expire(key, ttlSeconds);
      } catch {
        this.useFallback = true;
      }
    }

    const item = this.memoryFallback.get(key);
    if (item) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
      return 1;
    }
    return 0;
  }

  async onModuleDestroy() {
    if (this.client && this.client.status === 'ready') {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }
}
